import { prisma } from '../config/database.js';
import { AppError } from '../errors/app.error.js';
import { AppointmentStatus, MedicalVisitStatus, PatientNotificationType, Prisma, VisitStepStatus } from '../generated/prisma/client.js';

/**
 * Thông báo cho bệnh nhân (bảng patient_notifications).
 *
 * Ghi ngay khi có sự kiện:
 * - NEXT_ROOM       : tiếp nhận xong (→ phòng khám), bác sĩ chỉ định cận lâm sàng, một phòng trả kết quả
 *                     (→ phòng còn lại hoặc quay về phòng khám nhận kết luận).
 * - PAYMENT_DUE     : lập hóa đơn mới (saveInvoice).
 * - MEDICINE_READY  : thu tiền xong và bệnh nhân còn đơn thuốc chờ nhận tại PHM-105 (payInvoice).
 * - APPOINTMENT_REMINDER : tạo khi bệnh nhân mở thông báo (chưa có tác vụ chạy định kỳ):
 *                     trong vòng 24 giờ trước giờ hẹn, và trong vòng 2 giờ trước giờ hẹn.
 *
 * Nguyên tắc: thông báo không bao giờ chặn nghiệp vụ — lỗi chỉ ghi log.
 * Chỉ ghi cho bệnh nhân có tài khoản (vãng lai không đăng nhập nên không xem được).
 * `dedupe_key` duy nhất → một sự kiện chỉ sinh một thông báo dù gọi lại nhiều lần.
 */

type Db = Prisma.TransactionClient | typeof prisma;

const PHARMACY_ROOM = 'PHM-105';
const RECEPTION_ROOM = 'REC-101';
const CASHIER_ROOM = 'CAS-103';
const HOUR = 60 * 60 * 1000;
const LIST_LIMIT = 50;

type NotificationInput = {
  patientId: string;
  type: PatientNotificationType;
  title: string;
  body: string;
  href?: string | null;
  urgent?: boolean;
  dedupeKey: string;
};

/** Ghi một thông báo (bỏ qua nếu bệnh nhân không có tài khoản hoặc đã có thông báo cùng dedupe_key). */
async function createNotification(db: Db, input: NotificationInput) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId }, select: { user_id: true } });
  if (!patient?.user_id) return;
  await db.patientNotification.createMany({
    data: [{
      patient_id: input.patientId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body,
      href: input.href ?? null,
      urgent: input.urgent ?? false,
      dedupe_key: input.dedupeKey.slice(0, 150),
    }],
    skipDuplicates: true,
  });
}

/** Gọi một hàm tạo thông báo mà không để lỗi làm hỏng nghiệp vụ chính. */
export async function notifySafely(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    console.error('[notification] Không thể tạo thông báo cho bệnh nhân:', error);
  }
}

const roomSelect = { room_code: true, name: true, floor: { select: { name: true } } } as const;

function floorShort(name: string) {
  return name.split(' - ')[0] || name;
}

function roomLabel(room: { room_code: string; name: string; floor: { name: string } }) {
  return `${room.room_code} · ${room.name} (${floorShort(room.floor.name)})`;
}

/* ─────────────────────────────── Đến phòng tiếp theo ─────────────────────────────── */

/** Tiếp nhận xong → mời đến phòng bác sĩ khám. */
export async function notifyVisitStarted(db: Db, medicalVisitId: string) {
  const visit = await db.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    select: { id: true, visit_code: true, patient_id: true, receiving_room: { select: roomSelect } },
  });
  if (!visit) return;
  await createNotification(db, {
    patientId: visit.patient_id,
    type: PatientNotificationType.NEXT_ROOM,
    urgent: true,
    title: `Mời bạn đến ${visit.receiving_room.name} ${visit.receiving_room.room_code}`,
    body: `Tiếp nhận xong. Vui lòng đến ${floorShort(visit.receiving_room.floor.name)}, phòng ${visit.receiving_room.room_code} và chờ bác sĩ gọi theo mã lượt khám ${visit.visit_code}.`,
    href: '/patient',
    dedupeKey: `NEXT_ROOM:start:${visit.id}`,
  });
}

/** Bác sĩ chỉ định cận lâm sàng → mời đến phòng đầu tiên, liệt kê các phòng còn lại. */
export async function notifyVisitOrders(db: Db, medicalVisitId: string, newStepIds: string[]) {
  if (newStepIds.length === 0) return;
  const steps = await db.visitStep.findMany({
    where: { id: { in: newStepIds }, room: { room_code: { not: PHARMACY_ROOM } } },
    orderBy: { created_at: 'asc' },
    select: { id: true, room: { select: roomSelect }, medical_visit: { select: { patient_id: true, visit_code: true, receiving_room_id: true } } },
  });
  if (steps.length === 0) return;
  const [first, ...rest] = steps;
  await createNotification(db, {
    patientId: first.medical_visit.patient_id,
    type: PatientNotificationType.NEXT_ROOM,
    urgent: true,
    title: `Mời bạn đến ${first.room.name} ${first.room.room_code}`,
    body: steps.length === 1
      ? `Bác sĩ đã chỉ định ${first.room.name.toLowerCase()}. Vui lòng đến ${roomLabel(first.room)} và chờ gọi theo mã lượt khám ${first.medical_visit.visit_code}.`
      : `Bác sĩ đã chỉ định ${steps.length} phòng. Vui lòng đến ${roomLabel(first.room)} trước; sau đó: ${rest.map((step) => step.room.room_code).join(', ')}.`,
    href: '/patient',
    dedupeKey: `NEXT_ROOM:orders:${first.id}`,
  });
}

/**
 * Một phòng vừa trả kết quả → nếu còn phòng cận lâm sàng chưa làm thì mời sang phòng đó,
 * nếu đã đủ kết quả thì mời quay về phòng bác sĩ nhận kết luận.
 */
export async function notifyAfterStepCompleted(db: Db, visitStepId: string) {
  const step = await db.visitStep.findUnique({
    where: { id: visitStepId },
    select: {
      id: true,
      room_id: true,
      room: { select: { room_code: true } },
      medical_visit: {
        select: {
          id: true, visit_code: true, status: true, patient_id: true, receiving_room_id: true,
          receiving_room: { select: roomSelect },
          steps: { orderBy: { created_at: 'asc' }, select: { id: true, status: true, room_id: true, room: { select: roomSelect } } },
        },
      },
    },
  });
  const visit = step?.medical_visit;
  // Bước tại phòng bác sĩ / tiếp nhận / nhà thuốc không dẫn tới "phòng tiếp theo".
  if (!step || !visit || visit.status !== MedicalVisitStatus.IN_PROGRESS) return;
  if (step.room_id === visit.receiving_room_id || [RECEPTION_ROOM, PHARMACY_ROOM].includes(step.room.room_code)) return;

  const remaining = visit.steps.filter((item) =>
    item.room_id !== visit.receiving_room_id
    && item.room.room_code !== PHARMACY_ROOM
    && (item.status === VisitStepStatus.PENDING || item.status === VisitStepStatus.IN_PROGRESS));
  const next = remaining.find((item) => item.status === VisitStepStatus.IN_PROGRESS) ?? remaining[0];

  await createNotification(db, next
    ? {
      patientId: visit.patient_id,
      type: PatientNotificationType.NEXT_ROOM,
      urgent: true,
      title: `Mời bạn đến ${next.room.name} ${next.room.room_code}`,
      body: `Đã xong tại ${step.room.room_code}. Vui lòng đến ${roomLabel(next.room)}${remaining.length > 1 ? `, còn ${remaining.length - 1} phòng sau đó` : ''}.`,
      href: '/patient',
      dedupeKey: `NEXT_ROOM:after:${step.id}`,
    }
    : {
      patientId: visit.patient_id,
      type: PatientNotificationType.NEXT_ROOM,
      urgent: true,
      title: `Đã đủ kết quả — mời quay lại ${visit.receiving_room.room_code}`,
      body: `Các phòng cận lâm sàng đã trả kết quả. Vui lòng quay lại ${roomLabel(visit.receiving_room)} và chờ bác sĩ gọi để nhận kết luận.`,
      href: '/patient',
      dedupeKey: `NEXT_ROOM:after:${step.id}`,
    });
}

/* ───────────────────────────── Thanh toán & nhận thuốc ───────────────────────────── */

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

async function invoicePatient(db: Db, invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true, invoice_code: true, record_code: true, total_amount: true, next_destination: true, medical_visit_id: true,
      medical_visit: { select: { patient_id: true } },
      emergency_case: { select: { patient_id: true } },
    },
  });
  const patientId = invoice?.medical_visit?.patient_id ?? invoice?.emergency_case?.patient_id ?? null;
  return invoice && patientId ? { invoice, patientId } : null;
}

/** Hóa đơn mới lập → mời đến quầy thu ngân. */
export async function notifyPaymentDue(db: Db, invoiceId: string) {
  const found = await invoicePatient(db, invoiceId);
  if (!found) return;
  const { invoice, patientId } = found;
  const toPharmacy = invoice.next_destination === PHARMACY_ROOM;
  await createNotification(db, {
    patientId,
    type: PatientNotificationType.PAYMENT_DUE,
    urgent: true,
    title: `Hóa đơn chờ thanh toán: ${vnd.format(invoice.total_amount)}`,
    body: `Hóa đơn ${invoice.invoice_code} (${invoice.record_code}). Vui lòng thanh toán tại quầy thu ngân ${CASHIER_ROOM}, tầng 1${toPharmacy ? `, sau đó nhận thuốc tại nhà thuốc ${PHARMACY_ROOM}` : ''}.`,
    href: invoice.medical_visit_id ? `/patient/visits/${invoice.medical_visit_id}` : '/patient/visits',
    dedupeKey: `PAYMENT_DUE:${invoice.id}`,
  });
}

/** Thu tiền xong và còn đơn thuốc → mời đến nhà thuốc. */
export async function notifyMedicineReady(db: Db, invoiceId: string) {
  const found = await invoicePatient(db, invoiceId);
  if (!found || found.invoice.next_destination !== PHARMACY_ROOM) return;
  const { invoice, patientId } = found;
  await createNotification(db, {
    patientId,
    type: PatientNotificationType.MEDICINE_READY,
    urgent: true,
    title: `Mời bạn nhận thuốc tại nhà thuốc ${PHARMACY_ROOM}`,
    body: `Đã thanh toán hóa đơn ${invoice.invoice_code}. Vui lòng đến nhà thuốc ${PHARMACY_ROOM} (tầng 1), đọc mã ${invoice.record_code} để nhận thuốc.`,
    href: invoice.medical_visit_id ? `/patient/visits/${invoice.medical_visit_id}` : '/patient/visits',
    dedupeKey: `MEDICINE_READY:${invoice.id}`,
  });
}

/* ──────────────────────────────── Nhắc lịch hẹn ──────────────────────────────── */

/** Giờ hẹn thực (giờ Việt Nam) từ appointment_date (@db.Date) + appointment_time (@db.Time). */
function appointmentDateTime(date: Date, time: Date) {
  return new Date(`${date.toISOString().slice(0, 10)}T${time.toISOString().slice(11, 16)}:00+07:00`);
}

const clockFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const dayKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(value);

/** Tạo nhắc cho các lịch hẹn sắp tới của bệnh nhân (gọi khi bệnh nhân mở thông báo). */
async function ensureAppointmentReminders(patientId: string) {
  const now = new Date();
  const fromDate = new Date(`${dayKey(now)}T00:00:00.000Z`);
  const toDate = new Date(fromDate.getTime() + 2 * 24 * HOUR);
  const appointments = await prisma.appointment.findMany({
    where: { patient_id: patientId, status: AppointmentStatus.BOOKED, checked_in_at: null, appointment_date: { gte: fromDate, lte: toDate } },
    select: { id: true, appointment_code: true, appointment_date: true, appointment_time: true, doctor: { select: { full_name: true } } },
  });

  for (const appointment of appointments) {
    const at = appointmentDateTime(appointment.appointment_date, appointment.appointment_time);
    const remaining = at.getTime() - now.getTime();
    if (remaining <= 0 || remaining > 24 * HOUR) continue;
    const clock = clockFormat.format(at);
    const dayWord = dayKey(at) === dayKey(now) ? 'hôm nay' : 'ngày mai';
    const doctor = appointment.doctor ? ` với BS. ${appointment.doctor.full_name}` : '';

    await createNotification(prisma, {
      patientId,
      type: PatientNotificationType.APPOINTMENT_REMINDER,
      title: `Nhắc lịch khám ${dayWord} lúc ${clock}`,
      body: `Lịch hẹn ${appointment.appointment_code}${doctor}. Vui lòng đến quầy tiếp nhận REC-101 trước giờ hẹn khoảng 15 phút và mang theo giấy tờ tùy thân.`,
      href: '/patient/appointments',
      dedupeKey: `REMINDER_DAY:${appointment.id}`,
    });
    if (remaining <= 2 * HOUR) {
      const minutes = Math.max(1, Math.round(remaining / 60_000));
      await createNotification(prisma, {
        patientId,
        type: PatientNotificationType.APPOINTMENT_REMINDER,
        urgent: true,
        title: `Sắp đến giờ khám (${clock})`,
        body: `Còn khoảng ${minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60 ? `${minutes % 60} phút` : ''}`.trim() : `${minutes} phút`} nữa đến lịch hẹn ${appointment.appointment_code}. Vui lòng đến quầy tiếp nhận REC-101 để làm thủ tục.`,
        href: '/patient/appointments',
        dedupeKey: `REMINDER_SOON:${appointment.id}`,
      });
    }
  }
}

/* ─────────────────────────────── API cho bệnh nhân ─────────────────────────────── */

async function patientIdOfUser(userId: string) {
  const patient = await prisma.patient.findUnique({ where: { user_id: userId }, select: { id: true } });
  if (!patient) throw new AppError(404, 'Không tìm thấy hồ sơ bệnh nhân.');
  return patient.id;
}

/** Thông báo mới nhất của bệnh nhân đang đăng nhập (tạo nhắc lịch hẹn trước khi đọc). */
export async function findMyNotifications(userId: string) {
  const patientId = await patientIdOfUser(userId);
  await notifySafely(() => ensureAppointmentReminders(patientId));
  const [notifications, unreadCount] = await Promise.all([
    prisma.patientNotification.findMany({
      where: { patient_id: patientId },
      orderBy: { created_at: 'desc' },
      take: LIST_LIMIT,
      select: { id: true, type: true, title: true, body: true, href: true, urgent: true, read_at: true, created_at: true },
    }),
    prisma.patientNotification.count({ where: { patient_id: patientId, read_at: null } }),
  ]);
  return { unread_count: unreadCount, notifications };
}

export async function markMyNotificationRead(userId: string, notificationId: string) {
  const patientId = await patientIdOfUser(userId);
  const { count } = await prisma.patientNotification.updateMany({
    where: { id: notificationId, patient_id: patientId, read_at: null },
    data: { read_at: new Date() },
  });
  if (count === 0) {
    const exists = await prisma.patientNotification.findFirst({ where: { id: notificationId, patient_id: patientId }, select: { id: true } });
    if (!exists) throw new AppError(404, 'Không tìm thấy thông báo.');
  }
}

export async function markAllMyNotificationsRead(userId: string) {
  const patientId = await patientIdOfUser(userId);
  const { count } = await prisma.patientNotification.updateMany({ where: { patient_id: patientId, read_at: null }, data: { read_at: new Date() } });
  return count;
}
