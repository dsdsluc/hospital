import { randomInt } from 'node:crypto';
import { prisma } from '../config/database.js';
import { AppError } from '../errors/app.error.js';
import { InvoiceItemGroup, InvoiceStatus, PaymentMethod, Prisma } from '../generated/prisma/client.js';
import { activeOn, todayDate } from './price.service.js';
import { notifyMedicineReady, notifyPaymentDue, notifySafely } from './notification.service.js';

/**
 * Hóa đơn viện phí (CAS-103).
 * - Khám thường: `generateVisitInvoice` gọi khi bác sĩ "Hoàn tất khám".
 * - Cấp cứu / nội trú: `generateEmergencyInvoice` gọi khi ra viện qua quầy thuốc PHM-105.
 * Hóa đơn chưa thu thì được tạo lại (cập nhật) nếu gọi lần nữa; đã thu thì giữ nguyên.
 * Ngày giường: làm tròn lên theo 24 giờ, tối thiểu 1 ngày.
 */

type Tx = Prisma.TransactionClient;
type Draft = {
  group: InvoiceItemGroup;
  item_code: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  origin?: string | null;
  source_room?: string | null;
  performed_at?: Date | null;
  detail?: string | null;
};

const PHARMACY_ROOM = 'PHM-105';
const RECEPTION_ROOM = 'REC-101';
const HOUR = 60 * 60 * 1000;
const WARD_ROOMS = ['IP-401', 'IP-402', 'OBS-403'];

/** Số ngày giường: làm tròn lên theo 24 giờ, tối thiểu 1. */
export function bedDays(from: Date, to: Date) {
  return Math.max(1, Math.ceil(Math.max(0, to.getTime() - from.getTime()) / (24 * HOUR)));
}
const hours = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / HOUR));
const clock = (value: Date) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(value);

/** Bảng giá đang hiệu lực: theo mã dịch vụ, theo chức năng phòng, và giá thuốc. */
async function loadPrices(tx: Tx) {
  const today = todayDate();
  const services = await tx.servicePrice.findMany({ where: activeOn(today), orderBy: [{ service_code: 'asc' }, { effective_from: 'desc' }], select: { service_code: true, name: true, unit: true, unit_price: true, room_function_id: true, category: true } });
  const byCode = new Map<string, (typeof services)[number]>();
  const byFunction = new Map<string, (typeof services)[number]>();
  for (const s of services) {
    if (!byCode.has(s.service_code)) byCode.set(s.service_code, s);
    if (s.room_function_id && !byFunction.has(s.room_function_id) && ['EXAMINATION', 'IMAGING', 'LABORATORY', 'FUNCTIONAL_TEST'].includes(s.category)) byFunction.set(s.room_function_id, s);
  }
  const medicinePrices = await tx.medicinePrice.findMany({ where: activeOn(today), orderBy: { effective_from: 'desc' }, select: { medicine_id: true, unit_price: true } });
  const byMedicine = new Map<string, number>();
  for (const m of medicinePrices) if (!byMedicine.has(m.medicine_id)) byMedicine.set(m.medicine_id, m.unit_price);
  return { byCode, byFunction, byMedicine };
}
type Prices = Awaited<ReturnType<typeof loadPrices>>;

/** Dòng dịch vụ theo mã; thiếu giá thì để 0 và ghi chú để thu ngân biết. */
function service(prices: Prices, code: string, group: InvoiceItemGroup, quantity: number, extra: Partial<Draft> & { fallbackName?: string; fallbackUnit?: string } = {}): Draft {
  const price = prices.byCode.get(code);
  const { fallbackName, fallbackUnit, ...rest } = extra;
  return {
    group, item_code: code, name: price?.name ?? fallbackName ?? code, unit: price?.unit ?? fallbackUnit ?? 'lần', quantity,
    unit_price: price?.unit_price ?? 0, ...rest,
    detail: [rest.detail, price ? null : 'Chưa có giá trong bảng giá'].filter(Boolean).join(' · ') || null,
  };
}

async function newCode(tx: Tx, prefix: string, field: 'invoice_code' | 'receipt_no') {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${prefix}${day}${randomInt(1000, 10000)}`;
    if (!await tx.invoice.findFirst({ where: { [field]: candidate }, select: { id: true } })) return candidate;
  }
  throw new AppError(500, 'Không thể tạo mã hóa đơn.');
}

/** Ghi hóa đơn: chưa có thì tạo, chưa thu thì thay toàn bộ dòng, đã thu thì giữ nguyên. */
async function saveInvoice(tx: Tx, key: { medical_visit_id: string } | { emergency_case_id: string }, header: { patient_name: string; patient_code: string | null; record_code: string; source_room: string | null; next_destination: string | null }, drafts: Draft[]) {
  const existing = await tx.invoice.findFirst({ where: key, select: { id: true, status: true } });
  if (existing?.status === InvoiceStatus.PAID) return existing;
  const items = drafts.map((d, index) => ({ ...d, amount: d.quantity * d.unit_price, sort_order: index }));
  const total_amount = items.reduce((sum, i) => sum + i.amount, 0);
  if (existing) {
    await tx.invoiceItem.deleteMany({ where: { invoice_id: existing.id } });
    return tx.invoice.update({ where: { id: existing.id }, data: { ...header, total_amount, items: { create: items } } });
  }
  const created = await tx.invoice.create({ data: { ...key, ...header, invoice_code: await newCode(tx, 'HD', 'invoice_code'), total_amount, items: { create: items } } });
  // Thông báo "chờ thanh toán" — ghi trong cùng transaction (createMany skipDuplicates, không lỗi do trùng).
  await notifyPaymentDue(tx, created.id);
  return created;
}

/* ───────── Khám thường ───────── */

/** Phí khám + cận lâm sàng đã có kết quả (+ thuốc nếu `withMedicine`) của một lượt khám. */
async function visitDrafts(tx: Tx, prices: Prices, visitId: string, withMedicine: boolean, origin: string | null) {
  const visit = await tx.medicalVisit.findUniqueOrThrow({
    where: { id: visitId },
    include: {
      patient: true,
      receiving_room: { select: { id: true, room_code: true, function_id: true } },
      steps: { orderBy: { created_at: 'asc' }, include: { room: { select: { id: true, room_code: true, name: true, function_id: true } } } },
      prescription: { include: { items: { include: { medicine: true } } } },
    },
  });
  const drafts: Draft[] = [];
  const examPrice = prices.byFunction.get(visit.receiving_room.function_id);
  drafts.push({ group: 'EXAMINATION', item_code: examPrice?.service_code ?? 'EXAM', name: examPrice?.name ?? `Khám bệnh tại ${visit.receiving_room.room_code}`, unit: examPrice?.unit ?? 'lần', quantity: 1, unit_price: examPrice?.unit_price ?? 0, origin, source_room: visit.receiving_room.room_code, performed_at: visit.created_at, detail: examPrice ? null : 'Chưa có giá trong bảng giá' });
  for (const step of visit.steps) {
    // Bỏ qua phòng khám chính (đã tính phí khám), tiếp nhận REC-101 (không thu phí) và nhà thuốc.
    if (step.status !== 'COMPLETED' || step.room_id === visit.receiving_room.id || step.room.room_code === PHARMACY_ROOM || step.room.room_code === RECEPTION_ROOM) continue;
    const price = prices.byFunction.get(step.room.function_id);
    drafts.push({ group: 'PARACLINICAL', item_code: price?.service_code ?? step.room.room_code, name: price?.name ?? step.room.name, unit: price?.unit ?? 'lần', quantity: 1, unit_price: price?.unit_price ?? 0, origin, source_room: step.room.room_code, performed_at: step.completed_at, detail: [step.completed_at && `Có kết quả lúc ${clock(step.completed_at)}`, !price && 'Chưa có giá trong bảng giá'].filter(Boolean).join(' · ') || null });
  }
  if (withMedicine) for (const item of visit.prescription?.items ?? []) {
    const unitPrice = prices.byMedicine.get(item.medicine_id);
    drafts.push({ group: 'MEDICINE', item_code: item.medicine.medicine_code, name: item.medicine.name, unit: item.medicine.unit, quantity: item.quantity, unit_price: unitPrice ?? 0, origin, source_room: visit.receiving_room.room_code, detail: [item.dosage, item.usage, unitPrice === undefined && 'Chưa có giá'].filter(Boolean).join(' · ') || null });
  }
  return { visit, drafts };
}

export async function generateVisitInvoice(tx: Tx, visitId: string) {
  const prices = await loadPrices(tx);
  const { visit, drafts } = await visitDrafts(tx, prices, visitId, true, null);
  const hasMedicine = (visit.prescription?.items.length ?? 0) > 0;
  return saveInvoice(tx, { medical_visit_id: visit.id }, { patient_name: visit.patient.full_name, patient_code: visit.patient.patient_code, record_code: visit.visit_code, source_room: visit.receiving_room.room_code, next_destination: hasMedicine ? PHARMACY_ROOM : null }, drafts);
}

/* ───────── Cấp cứu / nội trú ───────── */

/**
 * Hóa đơn cả đợt điều trị cấp cứu, tạo khi ra viện qua PHM-105. Gồm:
 * lượt khám ngoại trú trước đó (nếu chuyển lên từ phòng khám), khám cấp cứu, thủ thuật, chỉ định PRE-503,
 * phẫu thuật, hồi tỉnh, ngày giường ICU / cách ly / tầng 4, và thuốc ra viện.
 * @param lastWardRoom phòng tầng 4 cuối cùng (để tính đơn giá giường), nếu biết.
 */
export async function generateEmergencyInvoice(tx: Tx, emergencyCaseId: string, sourceRoom: string, lastWardRoom?: string | null) {
  const now = new Date();
  const prices = await loadPrices(tx);
  const c = await tx.emergencyCase.findUniqueOrThrow({
    where: { id: emergencyCaseId },
    include: {
      patient: { select: { patient_code: true } },
      interventions: { orderBy: { performed_at: 'asc' } },
      isolation_episode: true,
      preparation: { include: { orders: { orderBy: { ordered_at: 'asc' } }, ward_progress_notes: { orderBy: { created_at: 'asc' }, select: { room_code: true } }, emergency_prescription: { include: { items: { include: { medicine: true } } } } } },
    },
  });
  const drafts: Draft[] = [];
  const caseOrigin = `Cấp cứu ${c.emergency_code}`;

  // 1. Lượt khám ngoại trú trước khi chuyển lên tầng 4 (gộp vào hóa đơn ra viện).
  if (c.source_medical_visit_id) {
    const visit = await tx.medicalVisit.findUnique({ where: { id: c.source_medical_visit_id }, select: { visit_code: true, receiving_room: { select: { room_code: true } } } });
    if (visit) drafts.push(...(await visitDrafts(tx, prices, c.source_medical_visit_id, true, `Lượt khám ${visit.visit_code} · ${visit.receiving_room.room_code}`)).drafts);
  } else {
    drafts.push(service(prices, 'ER-EXAM', 'EMERGENCY', 1, { origin: caseOrigin, source_room: 'ER-102', performed_at: c.arrived_at, detail: `Vào cấp cứu lúc ${clock(c.arrived_at)}` }));
  }

  // 2. Thủ thuật cấp cứu đã ghi nhận.
  for (const it of c.interventions) drafts.push(service(prices, `ER-INT-${it.intervention_type}`, 'EMERGENCY', 1, { origin: caseOrigin, source_room: 'ER-102', performed_at: it.performed_at, detail: [clock(it.performed_at), it.details].filter(Boolean).join(' · '), fallbackName: 'Thủ thuật cấp cứu' }));

  const p = c.preparation;
  if (p) {
    // 3. Chỉ định tại PRE-503 đã có kết quả.
    for (const order of p.orders) if (order.status === 'COMPLETED') drafts.push(service(prices, `PREP-${order.order_type}`, 'PARACLINICAL', 1, { origin: caseOrigin, source_room: 'PRE-503', performed_at: order.completed_at, detail: order.completed_at ? `Có kết quả lúc ${clock(order.completed_at)}` : null }));

    // 4. Phẫu thuật + hồi tỉnh.
    if (p.surgery_status === 'COMPLETED') {
      const time = p.incision_at && p.closure_at ? `${clock(p.incision_at)} → ${clock(p.closure_at)}` : p.surgery_completed_at ? `hoàn tất ${clock(p.surgery_completed_at)}` : null;
      drafts.push(service(prices, 'SURG-EMERGENCY', 'SURGERY', 1, { origin: caseOrigin, source_room: p.destination_room, performed_at: p.surgery_completed_at, detail: [p.procedure_name, p.surgical_approach, time].filter(Boolean).join(' · ') || null }));
      if (p.postoperative_destination === 'REC-504') drafts.push(service(prices, 'BED-RECOVERY', 'BED_DAY', 1, { origin: caseOrigin, source_room: 'REC-504', performed_at: p.surgery_completed_at }));
    }

    // 5. Ngày giường ICU.
    const icuStart = p.surgery_status === 'COMPLETED' && p.postoperative_destination === 'ICU-505' ? p.surgery_completed_at : p.destination_room === 'ICU-505' ? p.decided_at : null;
    if (icuStart) {
      const icuEnd = p.icu_discharged_at ?? now;
      drafts.push(service(prices, 'BED-ICU', 'BED_DAY', bedDays(icuStart, icuEnd), { origin: caseOrigin, source_room: 'ICU-505', performed_at: icuStart, detail: `${clock(icuStart)} → ${clock(icuEnd)} · ${hours(icuStart, icuEnd)} giờ` }));
    }
  }

  // 6. Ngày giường cách ly.
  const iso = c.isolation_episode;
  const isoStart = iso?.admitted_at ?? null;
  const isoEnd = isoStart ? (iso?.released_at ?? now) : null;
  if (isoStart && isoEnd) drafts.push(service(prices, 'BED-ISOLATION', 'BED_DAY', bedDays(isoStart, isoEnd), { origin: caseOrigin, source_room: 'ISO-404', performed_at: isoStart, detail: `${clock(isoStart)} → ${clock(isoEnd)} · ${hours(isoStart, isoEnd)} giờ` }));

  // 7. Ngày giường tầng 4 (trừ thời gian nằm cách ly trong khoảng này).
  if (p) {
    const wardStart = p.icu_outcome === 'TRANSFERRED_TO_FLOOR_4' ? p.icu_discharged_at
      : p.destination_room && WARD_ROOMS.includes(p.destination_room) ? p.decided_at
      : p.destination_room === 'ISO-404' && iso?.released_at && iso.destination_room && WARD_ROOMS.includes(iso.destination_room) ? iso.released_at
      : null;
    if (wardStart) {
      const wardEnd = p.ward_discharged_at ?? now;
      const overlap = isoStart && isoEnd ? Math.max(0, Math.min(wardEnd.getTime(), isoEnd.getTime()) - Math.max(wardStart.getTime(), isoStart.getTime())) : 0;
      const wardEndAdjusted = new Date(wardEnd.getTime() - overlap);
      const rooms = [...new Set([...p.ward_progress_notes.map((n) => n.room_code), ...(lastWardRoom ? [lastWardRoom] : [])])];
      const lastRoom = lastWardRoom ?? rooms.at(-1) ?? (p.destination_room && WARD_ROOMS.includes(p.destination_room) ? p.destination_room : 'IP-401');
      const code = lastRoom === 'OBS-403' ? 'BED-OBSERVATION' : 'BED-INPATIENT';
      drafts.push(service(prices, code, 'BED_DAY', bedDays(wardStart, wardEndAdjusted), { origin: caseOrigin, source_room: lastRoom, performed_at: wardStart, detail: [`${clock(wardStart)} → ${clock(wardEnd)}`, `${hours(wardStart, wardEndAdjusted)} giờ`, rooms.length > 1 ? `Phòng: ${rooms.join(' → ')}` : null, overlap ? 'đã trừ thời gian cách ly' : null].filter(Boolean).join(' · ') }));
    }

    // 8. Thuốc ra viện.
    for (const item of p.emergency_prescription?.items ?? []) {
      const unitPrice = prices.byMedicine.get(item.medicine_id);
      drafts.push({ group: 'MEDICINE', item_code: item.medicine.medicine_code, name: item.medicine.name, unit: item.medicine.unit, quantity: item.quantity, unit_price: unitPrice ?? 0, origin: caseOrigin, source_room: sourceRoom, detail: [item.dosage, item.usage, unitPrice === undefined && 'Chưa có giá'].filter(Boolean).join(' · ') || null });
    }
  }

  return saveInvoice(tx, { emergency_case_id: c.id }, { patient_name: c.full_name, patient_code: c.patient?.patient_code ?? null, record_code: c.emergency_code, source_room: sourceRoom, next_destination: PHARMACY_ROOM }, drafts);
}

/* ───────── Thu ngân ───────── */

const listInclude = {
  items: { orderBy: { sort_order: 'asc' as const } },
  medical_visit: { select: { created_at: true, patient: { select: { date_of_birth: true } } } },
  emergency_case: { select: { arrived_at: true, age: true, date_of_birth: true } },
};

/** Hóa đơn chờ thu (tất cả) + hóa đơn đã thu trong ngày `date` (giờ Việt Nam). */
function shapeInvoice({ medical_visit, emergency_case, ...invoice }: Prisma.InvoiceGetPayload<{ include: typeof listInclude }>) {
  return {
    ...invoice,
    type: invoice.emergency_case_id ? 'EMERGENCY' as const : 'VISIT' as const,
    started_at: emergency_case?.arrived_at ?? medical_visit?.created_at ?? invoice.created_at,
    date_of_birth: emergency_case?.date_of_birth ?? medical_visit?.patient.date_of_birth ?? null,
    age: emergency_case?.age ?? null,
  };
}

/** Chi tiết một hóa đơn (trang chi tiết mở từ lịch sử CAS-103). */
export async function findInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: listInclude });
  if (!invoice) throw new AppError(404, 'Không tìm thấy hóa đơn.');
  return shapeInvoice(invoice);
}

export async function findInvoices(date: string) {
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * HOUR);
  const rows = await prisma.invoice.findMany({
    where: { OR: [{ status: InvoiceStatus.UNPAID }, { status: InvoiceStatus.PAID, paid_at: { gte: start, lt: end } }] },
    include: listInclude,
    orderBy: { created_at: 'asc' },
  });
  return rows.map(shapeInvoice);
}

/** Có BHYT: bệnh nhân trả đúng 20% (tới đồng), BHYT trả 80% còn lại. */
export function insuranceSplit(total: number, applied: boolean) {
  const patient = applied ? Math.round(total * 0.2) : total;
  return { patient_amount: patient, insurance_amount: total - patient };
}

/** Xác nhận thanh toán: chỉ lưu phương thức + đổi trạng thái (tiền thu / biên lai do hệ thống khác của bệnh viện quản lý). */
export async function payInvoice(id: string, input: { payment_method: PaymentMethod; cashier_note?: string | null; insurance_applied?: boolean; insurance_number?: string | null; insurance_holder_name?: string | null }) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { id: true, status: true, total_amount: true } });
  if (!invoice) throw new AppError(404, 'Không tìm thấy hóa đơn.');
  if (invoice.status === InvoiceStatus.PAID) throw new AppError(409, 'Hóa đơn đã được thanh toán.');
  const applied = Boolean(input.insurance_applied);
  const split = insuranceSplit(invoice.total_amount, applied);
  const paid = await prisma.$transaction(async (tx) => tx.invoice.update({
    where: { id },
    data: {
      status: InvoiceStatus.PAID, payment_method: input.payment_method, paid_at: new Date(),
      ...split,
      insurance_applied: applied,
      insurance_number: applied ? (input.insurance_number?.trim() || null) : null,
      insurance_holder_name: applied ? (input.insurance_holder_name?.trim() || null) : null,
      cashier_note: input.cashier_note ?? null,
    },
    include: { items: { orderBy: { sort_order: 'asc' } } },
  }));
  // Thông báo "nhận thuốc" nếu còn đơn thuốc chờ cấp tại PHM-105 (không chặn nếu lỗi).
  await notifySafely(() => notifyMedicineReady(prisma, id));
  return paid;
}
