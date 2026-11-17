import { generateEmergencyInvoice } from './invoice.service.js';
import { randomInt } from 'node:crypto';
import { prisma } from '../config/database.js';
import { AppError } from '../errors/app.error.js';
import type { CloseIntensiveCareInput, CompleteEmergencySurgeryInput, CompletePreparationOrderInput, CreateEmergencyCaseInput, CreateEmergencyInterventionInput, DecidePreparationDispositionInput, DecideWardDispositionInput, RequestEmergencyPreparationInput, SaveEmergencyPrescriptionInput, SaveIntensiveCareProgressInput, SaveWardProgressInput, UpdateEmergencyAssessmentInput } from '../validation/emergency.validation.js';

const emergencyInclude = {
  patient: { select: { id: true, patient_code: true, full_name: true } },
  // Hóa đơn ra viện: chưa thu → bệnh nhân đang ở quầy thu ngân CAS-103.
  invoice: { select: { invoice_code: true, status: true, total_amount: true } },
  assessment: true,
  interventions: {
    orderBy: { performed_at: 'desc' as const },
    include: { recorded_by: { select: { id: true, doctor: { select: { doctor_code: true, full_name: true } } } } },
  },
  preparation: { include: { orders: { orderBy: { ordered_at: 'asc' as const } } } },
};

async function generateEmergencyCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `ER-${new Date().getFullYear().toString().slice(-2)}${randomInt(10000, 100000)}`;
    const exists = await prisma.emergencyCase.findUnique({ where: { emergency_code: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new AppError(500, 'Không thể tạo mã ca cấp cứu.');
}

export async function findEmergencyCases() {
  const cases = await prisma.emergencyCase.findMany({
    where: { status: { in: ['WAITING', 'IN_TREATMENT', 'STABILIZED'] } },
    include: emergencyInclude,
    orderBy: { arrived_at: 'asc' },
  });
  const priorityOrder = { RED: 0, ORANGE: 1, YELLOW: 2, GREEN: 3 } as const;
  return cases.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]);
}

/**
 * Mọi ca cấp cứu chưa kết thúc (khác CLOSED). Ca TRANSFERRED vẫn đang điều trị trong viện (phòng mổ / ICU /
 * nội trú / cách ly / chờ nhận thuốc) nên vẫn được tính. Phòng ER-102 dùng findEmergencyCases (chỉ ca tại ER).
 * Kết quả sắp theo mức ưu tiên rồi giờ đến. Dùng cho tab "Ca cấp cứu" ở trang Hàng đợi.
 */
export async function findOpenEmergencyCases() {
  const cases = await prisma.emergencyCase.findMany({
    where: { status: { not: 'CLOSED' } },
    include: emergencyInclude,
    orderBy: { arrived_at: 'asc' },
  });
  const priorityOrder = { RED: 0, ORANGE: 1, YELLOW: 2, GREEN: 3 } as const;
  return cases.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]);
}

/**
 * Mọi ca cấp cứu (mọi trạng thái) đến trong khoảng ngày `[from, to]` theo giờ Việt Nam,
 * mới nhất trước. Dùng cho mục "Ca cũ" ở trang Hàng đợi.
 */
export async function findEmergencyCaseHistory(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000);
  return prisma.emergencyCase.findMany({
    where: { arrived_at: { gte: start, lt: end } },
    include: emergencyInclude,
    orderBy: { arrived_at: 'desc' },
    take: 1000,
  });
}

export async function requestEmergencyPreparation(id: string, input: RequestEmergencyPreparationInput) {
  const emergencyCase = await findEmergencyCase(id);
  if (emergencyCase.preparation) throw new AppError(409, 'Ca cấp cứu đã được chuyển đến PRE-503.');
  return prisma.$transaction(async (transaction) => {
    const preparation = await transaction.emergencyPreparation.create({
      data: {
        emergency_case_id: id,
        urgency: input.urgency,
        suspected_diagnosis: input.suspected_diagnosis,
        transport_condition: input.transport_condition,
        request_note: input.request_note,
        orders: { create: [...new Set(input.orders)].map((order_type) => ({ order_type })) },
      },
      include: { orders: true, emergency_case: { include: { assessment: true } } },
    });
    await transaction.emergencyCase.update({ where: { id }, data: { status: 'AWAITING_PREPARATION', location: 'PRE-503' } });
    return preparation;
  });
}

export async function findEmergencyPreparations() {
  return prisma.emergencyPreparation.findMany({
    where: { status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
    include: { emergency_case: { include: { assessment: true, interventions: { orderBy: { performed_at: 'desc' } } } }, orders: { orderBy: { ordered_at: 'asc' } } },
    orderBy: { requested_at: 'asc' },
  });
}

export async function findSurgicalTransfers(roomCode: string) {
  if (!['OR-501', 'OR-502'].includes(roomCode)) throw new AppError(400, 'Mã phòng phẫu thuật không hợp lệ.');
  return prisma.emergencyPreparation.findMany({
    where: { status: 'COMPLETED', destination_room: roomCode, surgery_status: { in: ['WAITING', 'IN_PROGRESS'] } },
    include: {
      emergency_case: { include: { assessment: true, interventions: { orderBy: { performed_at: 'desc' } } } },
      orders: { orderBy: { ordered_at: 'asc' } },
    },
    orderBy: { decided_at: 'asc' },
  });
}

export async function startEmergencySurgery(id: string, roomCode: string) {
  if (!['OR-501', 'OR-502'].includes(roomCode)) throw new AppError(400, 'Mã phòng phẫu thuật không hợp lệ.');
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id } });
  if (!preparation) throw new AppError(404, 'Không tìm thấy ca phẫu thuật.');
  if (preparation.destination_room !== roomCode) throw new AppError(409, 'Ca này không được điều phối đến phòng mổ hiện tại.');
  if (preparation.surgery_status === 'COMPLETED') throw new AppError(409, 'Ca phẫu thuật đã hoàn tất.');
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.emergencyPreparation.update({
      where: { id },
      data: { surgery_status: 'IN_PROGRESS', surgery_started_at: preparation.surgery_started_at ?? new Date() },
      include: { emergency_case: { include: { assessment: true, interventions: true } }, orders: { orderBy: { ordered_at: 'asc' } } },
    });
    await transaction.emergencyCase.update({ where: { id: preparation.emergency_case_id }, data: { location: roomCode, status: 'IN_TREATMENT' } });
    return updated;
  });
}

export async function completeEmergencySurgery(id: string, roomCode: string, input: CompleteEmergencySurgeryInput) {
  if (!['OR-501', 'OR-502'].includes(roomCode)) throw new AppError(400, 'Mã phòng phẫu thuật không hợp lệ.');
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id } });
  if (!preparation) throw new AppError(404, 'Không tìm thấy ca phẫu thuật.');
  if (preparation.destination_room !== roomCode) throw new AppError(409, 'Ca này không được điều phối đến phòng mổ hiện tại.');
  if (preparation.surgery_status !== 'IN_PROGRESS') throw new AppError(409, 'Cần bắt đầu ca mổ trước khi hoàn tất.');
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.emergencyPreparation.update({
      where: { id },
      data: {
        surgery_status: 'COMPLETED',
        surgery_completed_at: new Date(),
        procedure_name: input.procedure_name,
        anesthesia_note: input.anesthesia_note,
        surgical_findings: input.surgical_findings,
        surgery_note: input.surgery_note,
        surgical_approach: input.surgical_approach,
        incision_at: input.incision_at ? new Date(input.incision_at) : input.incision_at,
        closure_at: input.closure_at ? new Date(input.closure_at) : input.closure_at,
        estimated_blood_loss_ml: input.estimated_blood_loss_ml,
        transfusion_note: input.transfusion_note,
        surgery_outcome: input.surgery_outcome,
        surgeon_conclusion: input.surgeon_conclusion,
        postoperative_destination: input.postoperative_destination,
      },
      include: { emergency_case: { include: { assessment: true, interventions: true } }, orders: { orderBy: { ordered_at: 'asc' } } },
    });
    await transaction.emergencyCase.update({
      where: { id: preparation.emergency_case_id },
      data: { location: input.postoperative_destination, status: 'TRANSFERRED' },
    });
    return updated;
  });
}

export async function findPostoperativeTransfers(roomCode: string) {
  if (!['REC-504', 'ICU-505'].includes(roomCode)) throw new AppError(400, 'Mã phòng hậu phẫu không hợp lệ.');
  return prisma.emergencyPreparation.findMany({
    where: roomCode === 'REC-504'
      ? { surgery_status: 'COMPLETED', postoperative_destination: 'REC-504' }
      : { icu_discharged_at: null, icu_closed_at: null, OR: [{ surgery_status: 'COMPLETED', postoperative_destination: 'ICU-505' }, { destination_room: 'ICU-505', surgery_status: null }] },
    include: {
      emergency_case: { include: { assessment: true, interventions: { orderBy: { performed_at: 'desc' } } } },
      orders: { orderBy: { ordered_at: 'asc' } },
      icu_progress_notes: { orderBy: { created_at: 'desc' } },
      emergency_prescription: { include: { items: { include: { medicine: true } } } },
    },
    orderBy: [{ surgery_completed_at: 'desc' }, { decided_at: 'desc' }],
  });
}

export async function closeIntensiveCare(id: string, input: CloseIntensiveCareInput) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id }, include: { emergency_case: true } });
  if (!preparation) throw new AppError(404, 'Không tìm thấy ca hồi sức tích cực.');
  const belongsToIcu = preparation.postoperative_destination === 'ICU-505' || (preparation.destination_room === 'ICU-505' && preparation.surgery_status === null);
  if (!belongsToIcu) throw new AppError(409, 'Ca này không thuộc ICU-505.');
  if (preparation.icu_closed_at || preparation.icu_discharged_at) throw new AppError(409, 'Ca đã rời ICU.');
  if (input.outcome === 'TRANSFERRED_TO_FLOOR_4' && !input.destination_room) throw new AppError(400, 'Cần chọn phòng tiếp nhận tại tầng 4.');
  return prisma.$transaction(async (transaction) => {
    // Không bắt buộc có đơn thuốc: nếu chưa có thì tạo đơn trống để bệnh nhân vẫn hiện ở quầy thuốc PHM-105.
    if (input.outcome === 'PHARMACY_DISCHARGE') {
      await transaction.emergencyPrescription.upsert({ where: { preparation_id: id }, create: { preparation_id: id }, update: {} });
    }
    const destination = input.outcome === 'PHARMACY_DISCHARGE' ? 'PHM-105' : input.outcome === 'TRANSFERRED_TO_FLOOR_4' ? input.destination_room! : 'ICU-505';
    const updated = await transaction.emergencyPreparation.update({
      where: { id },
      data: { icu_final_assessment: input.final_assessment, icu_outcome: input.outcome, ...(input.outcome === 'DECEASED' ? { icu_closed_at: new Date() } : { icu_discharged_at: new Date() }), ...(input.outcome === 'TRANSFERRED_TO_FLOOR_4' && { ward_admitted_at: new Date() }) },
      include: { emergency_case: true, orders: true },
    });
    await transaction.emergencyCase.update({ where: { id: preparation.emergency_case_id }, data: { status: input.outcome === 'DECEASED' ? 'CLOSED' : 'TRANSFERRED', location: destination } });
    // Ra viện qua quầy thuốc → lập hóa đơn cả đợt điều trị (CAS-103).
    if (input.outcome === 'PHARMACY_DISCHARGE') await generateEmergencyInvoice(transaction, preparation.emergency_case_id, 'ICU-505');
    return updated;
  });
}

export async function saveIntensiveCareProgress(id: string, input: SaveIntensiveCareProgressInput) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id } });
  if (!preparation) throw new AppError(404, 'Không tìm thấy ca hồi sức tích cực.');
  if (preparation.icu_closed_at || preparation.icu_discharged_at) throw new AppError(409, 'Ca đã rời ICU.');
  return prisma.emergencyIcuProgress.create({ data: { preparation_id: id, ...input } });
}

export async function saveEmergencyPrescription(id: string, input: SaveEmergencyPrescriptionInput) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id } });
  if (!preparation) throw new AppError(404, 'Không tìm thấy ca hồi sức tích cực.');
  if (preparation.icu_closed_at || preparation.icu_discharged_at) throw new AppError(409, 'Ca đã rời ICU.');
  const medicineIds = [...new Set(input.items.map((item) => item.medicine_id))];
  const medicines = await prisma.medicine.findMany({ where: { id: { in: medicineIds }, status: 'AVAILABLE' }, select: { id: true } });
  if (medicines.length !== medicineIds.length) throw new AppError(400, 'Đơn thuốc chứa thuốc không tồn tại hoặc đã ngừng sử dụng.');
  return prisma.$transaction(async (transaction) => {
    const prescription = await transaction.emergencyPrescription.upsert({ where: { preparation_id: id }, create: { preparation_id: id, note: input.note }, update: { note: input.note, confirmed_at: new Date() } });
    await transaction.emergencyPrescriptionItem.deleteMany({ where: { prescription_id: prescription.id } });
    await transaction.emergencyPrescriptionItem.createMany({ data: input.items.map((item) => ({ prescription_id: prescription.id, ...item })) });
    return transaction.emergencyPrescription.findUniqueOrThrow({ where: { id: prescription.id }, include: { items: { include: { medicine: true } } } });
  });
}

export async function findEmergencyPharmacyTransfers() {
  return prisma.emergencyPreparation.findMany({
    where: { OR: [{ icu_outcome: 'PHARMACY_DISCHARGE' }, { ward_outcome: 'PHARMACY_DISCHARGE' }], emergency_prescription: { dispensed_at: null }, emergency_case: { location: 'PHM-105' } },
    include: { emergency_case: { include: { invoice: { select: { invoice_code: true, status: true, total_amount: true } } } }, emergency_prescription: { include: { items: { include: { medicine: true } } } } },
    orderBy: { icu_discharged_at: 'asc' },
  });
}

export async function findWardTransfers(roomCode: string) {
  if (!['IP-401', 'IP-402', 'OBS-403'].includes(roomCode)) throw new AppError(400, 'Phòng điều trị tầng 4 không hợp lệ.');
  return prisma.emergencyPreparation.findMany({
    where: { ward_discharged_at: null, emergency_case: { location: roomCode, status: { not: 'CLOSED' } } },
    include: { emergency_case: true, orders: { orderBy: { ordered_at: 'asc' } }, ward_progress_notes: { orderBy: { created_at: 'desc' } }, icu_progress_notes: { orderBy: { created_at: 'desc' } }, emergency_prescription: { include: { items: { include: { medicine: true } } } } },
    orderBy: [{ icu_discharged_at: 'asc' }, { decided_at: 'asc' }],
  });
}

export async function saveWardProgress(id: string, roomCode: string, input: SaveWardProgressInput) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id }, include: { emergency_case: true } });
  if (!preparation || preparation.emergency_case.location !== roomCode) throw new AppError(404, 'Không tìm thấy bệnh nhân tại phòng theo dõi.');
  if (preparation.ward_discharged_at) throw new AppError(409, 'Bệnh nhân đã rời phòng theo dõi.');
  return prisma.emergencyWardProgress.create({ data: { preparation_id: id, room_code: roomCode, ...input } });
}

export async function saveWardPrescription(id: string, roomCode: string, input: SaveEmergencyPrescriptionInput) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id }, include: { emergency_case: true } });
  if (!preparation || preparation.emergency_case.location !== roomCode) throw new AppError(404, 'Không tìm thấy bệnh nhân tại phòng theo dõi.');
  const medicineIds = [...new Set(input.items.map((item) => item.medicine_id))];
  const medicines = await prisma.medicine.findMany({ where: { id: { in: medicineIds }, status: 'AVAILABLE' }, select: { id: true } });
  if (medicines.length !== medicineIds.length) throw new AppError(400, 'Đơn thuốc chứa thuốc không tồn tại hoặc đã ngừng sử dụng.');
  return prisma.$transaction(async (transaction) => {
    const prescription = await transaction.emergencyPrescription.upsert({ where: { preparation_id: id }, create: { preparation_id: id, note: input.note }, update: { note: input.note, confirmed_at: new Date(), dispensed_at: null } });
    await transaction.emergencyPrescriptionItem.deleteMany({ where: { prescription_id: prescription.id } });
    await transaction.emergencyPrescriptionItem.createMany({ data: input.items.map((item) => ({ prescription_id: prescription.id, ...item })) });
    return transaction.emergencyPrescription.findUniqueOrThrow({ where: { id: prescription.id }, include: { items: { include: { medicine: true } } } });
  });
}

export async function decideWardDisposition(id: string, roomCode: string, input: DecideWardDispositionInput) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id }, include: { emergency_case: true, emergency_prescription: { include: { items: true } } } });
  if (!preparation || preparation.emergency_case.location !== roomCode) throw new AppError(404, 'Không tìm thấy bệnh nhân tại phòng theo dõi.');
  if (input.outcome === 'TRANSFERRED_TO_WARD' && !input.destination_room) throw new AppError(400, 'Cần chọn phòng bệnh tiếp nhận.');
  if (input.outcome === 'SURGERY_PREPARATION' && !input.preparation_orders?.length) throw new AppError(400, 'Cần chọn ít nhất một chỉ định chuẩn bị phẫu thuật.');
  if (input.outcome === 'PHARMACY_DISCHARGE' && !preparation.emergency_prescription?.items.length) throw new AppError(409, 'Cần tạo đơn thuốc trước khi chuyển xuống quầy thuốc.');
  const destination = input.outcome === 'PHARMACY_DISCHARGE' ? 'PHM-105' : input.outcome === 'RETURN_TO_ICU' ? 'ICU-505' : input.outcome === 'SURGERY_PREPARATION' ? 'PRE-503' : input.outcome === 'TRANSFERRED_TO_WARD' ? input.destination_room! : roomCode;
  return prisma.$transaction(async (transaction) => {
    if (input.outcome === 'SURGERY_PREPARATION') {
      await transaction.preparationOrder.deleteMany({ where: { preparation_id: id } });
      await transaction.preparationOrder.createMany({ data: input.preparation_orders!.map((order_type) => ({ preparation_id: id, order_type })) });
    }
    const updated = await transaction.emergencyPreparation.update({ where: { id }, data: { ward_final_assessment: input.final_assessment, ward_outcome: input.outcome, ...(input.outcome === 'TRANSFERRED_TO_WARD' ? { ward_discharged_at: null, ward_admitted_at: new Date() } : { ward_discharged_at: new Date() }), ...(input.outcome === 'RETURN_TO_ICU' && { icu_discharged_at: null, icu_outcome: null }), ...(input.outcome === 'SURGERY_PREPARATION' && { status: 'REQUESTED', requested_at: new Date(), started_at: null, completed_at: null, destination_room: null, decided_at: null, surgery_status: null }) } });
    await transaction.emergencyCase.update({ where: { id: preparation.emergency_case_id }, data: { location: destination, status: input.outcome === 'DECEASED' ? 'CLOSED' : 'TRANSFERRED' } });
    if (input.outcome === 'PHARMACY_DISCHARGE') await generateEmergencyInvoice(transaction, preparation.emergency_case_id, roomCode, roomCode);
    return updated;
  });
}

export async function dispenseEmergencyPrescription(id: string) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id }, include: { emergency_prescription: { include: { items: { include: { medicine: true } } } } } });
  if (!preparation?.emergency_prescription) throw new AppError(404, 'Không tìm thấy đơn thuốc cấp cứu.');
  const prescription = preparation.emergency_prescription;
  if (prescription.dispensed_at) throw new AppError(409, 'Đơn thuốc đã được cấp.');
  return prisma.$transaction(async (transaction) => {
    for (const item of prescription.items) {
      const updated = await transaction.medicine.updateMany({ where: { id: item.medicine_id, status: 'AVAILABLE', stock_quantity: { gte: item.quantity } }, data: { stock_quantity: { decrement: item.quantity } } });
      if (updated.count === 0) throw new AppError(409, `Thuốc ${item.medicine.name} không đủ tồn kho để cấp.`);
    }
    await transaction.emergencyPrescription.update({ where: { id: prescription.id }, data: { dispensed_at: new Date() } });
    await transaction.emergencyCase.update({ where: { id: preparation.emergency_case_id }, data: { status: 'CLOSED', location: 'PHM-105' } });
    return { id: prescription.id, dispensed_at: new Date() };
  });
}

export async function startEmergencyPreparation(id: string) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id } });
  if (!preparation) throw new AppError(404, 'Không tìm thấy yêu cầu chuẩn bị phẫu thuật.');
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.emergencyPreparation.update({ where: { id }, data: { status: 'IN_PROGRESS', started_at: preparation.started_at ?? new Date() }, include: { orders: true } });
    await transaction.emergencyCase.update({ where: { id: preparation.emergency_case_id }, data: { status: 'IN_PREPARATION', location: 'PRE-503' } });
    return updated;
  });
}

export async function completePreparationOrder(id: string, input: CompletePreparationOrderInput) {
  const order = await prisma.preparationOrder.findUnique({ where: { id }, include: { preparation: true } });
  if (!order) throw new AppError(404, 'Không tìm thấy chỉ định tại PRE-503.');
  if (order.preparation.status === 'COMPLETED') throw new AppError(409, 'Quá trình chuẩn bị đã hoàn tất.');
  return prisma.preparationOrder.update({ where: { id }, data: { status: 'COMPLETED', result: input.result, started_at: order.started_at ?? new Date(), completed_at: new Date() } });
}

export async function decidePreparationDisposition(id: string, input: DecidePreparationDispositionInput) {
  const preparation = await prisma.emergencyPreparation.findUnique({ where: { id }, include: { orders: true } });
  if (!preparation) throw new AppError(404, 'Không tìm thấy yêu cầu chuẩn bị phẫu thuật.');
  // Cho phép chuyển phòng khi còn chỉ định chưa có kết quả (vd. ca cần lên phòng mổ ngay).
  // Các chỉ định còn dở được ghi tự động vào ghi chú bàn giao để phòng nhận biết.
  const orderLabels = { BLOOD_TEST: 'Xét nghiệm máu', ULTRASOUND: 'Siêu âm tại chỗ', CT_SCAN: 'CT tại chỗ' } as const;
  const pendingOrders = preparation.orders.filter((order) => order.status !== 'COMPLETED').map((order) => orderLabels[order.order_type]);
  const dispositionNote = pendingOrders.length > 0
    ? [`Chuyển khi còn chưa có kết quả: ${pendingOrders.join(', ')}.`, input.disposition_note].filter(Boolean).join('\n')
    : input.disposition_note;
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const updated = await transaction.emergencyPreparation.update({ where: { id }, data: { status: 'COMPLETED', completed_at: now, destination_room: input.destination_room, disposition_note: dispositionNote, decided_at: now, preliminary_diagnosis: input.preliminary_diagnosis, pretransfer_pulse: input.pulse, pretransfer_blood_pressure: input.blood_pressure, pretransfer_spo2: input.spo2, pretransfer_temperature: input.temperature, pretransfer_respiratory_rate: input.respiratory_rate, pretransfer_consciousness: input.consciousness, pretransfer_assessed_at: now, surgery_status: input.destination_room.startsWith('OR-') ? 'WAITING' : null, ward_admitted_at: ['IP-401', 'IP-402', 'OBS-403'].includes(input.destination_room) ? now : null }, include: { orders: true } });
    await transaction.emergencyCase.update({ where: { id: preparation.emergency_case_id }, data: { status: 'TRANSFERRED', location: input.destination_room } });
    return updated;
  });
}

export async function findEmergencyCase(id: string) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id }, include: emergencyInclude });
  if (!emergencyCase) throw new AppError(404, 'Không tìm thấy ca cấp cứu.');
  return emergencyCase;
}

/** Họ tên bệnh nhân cấp cứu lưu dạng VIẾT HOA: "hà minh  phương" → "HÀ MINH PHƯƠNG". */
function toUpperName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('vi');
}

export async function createEmergencyCase(input: CreateEmergencyCaseInput) {
  if (input.patient_id) {
    const patient = await prisma.patient.findUnique({ where: { id: input.patient_id }, select: { id: true } });
    if (!patient) throw new AppError(404, 'Không tìm thấy hồ sơ bệnh nhân được liên kết.');
  }
  const emergencyCode = await generateEmergencyCode();
  const { assessment, arrived_at, date_of_birth, ...caseData } = input;
  if (!caseData.unidentified) caseData.full_name = toUpperName(caseData.full_name);
  return prisma.emergencyCase.create({
    data: {
      ...caseData,
      emergency_code: emergencyCode,
      arrived_at: arrived_at ? new Date(arrived_at) : new Date(),
      date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      status: input.priority === 'RED' ? 'IN_TREATMENT' : 'WAITING',
      ...(assessment && { assessment: { create: assessment } }),
    },
    include: emergencyInclude,
  });
}

export async function saveEmergencyAssessment(id: string, input: UpdateEmergencyAssessmentInput) {
  await findEmergencyCase(id);
  const { priority, location, ...assessment } = input;
  return prisma.$transaction(async (transaction) => {
    if (priority !== undefined || location !== undefined) {
      await transaction.emergencyCase.update({
        where: { id },
        data: {
          ...(priority !== undefined && { priority }),
          ...(location !== undefined && { location }),
          status: 'IN_TREATMENT',
        },
      });
    }
    await transaction.emergencyAssessment.upsert({
      where: { emergency_case_id: id },
      create: { emergency_case_id: id, ...assessment },
      update: { ...assessment, assessed_at: new Date() },
    });
    return transaction.emergencyCase.findUniqueOrThrow({ where: { id }, include: emergencyInclude });
  });
}

export async function addEmergencyIntervention(id: string, userId: string, input: CreateEmergencyInterventionInput) {
  await findEmergencyCase(id);
  const intervention = await prisma.emergencyIntervention.create({
    data: {
      emergency_case_id: id,
      recorded_by_user_id: userId,
      intervention_type: input.intervention_type,
      details: input.details,
      performed_at: input.performed_at ? new Date(input.performed_at) : new Date(),
    },
  });
  await prisma.emergencyCase.update({ where: { id }, data: { status: 'IN_TREATMENT' } });
  return intervention;
}
