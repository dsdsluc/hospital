import { prisma } from '../config/database.js';
import { AppointmentStatus, VisitStepStatus } from '../generated/prisma/client.js';
import { generateUniqueAppointmentCode } from '../utils/appointment-code.utils.js';
import type { CreateAppointmentInput } from '../validation/appointment.validation.js';
import { AppError } from '../errors/app.error.js';

const appointmentInclude = {
  doctor: {
    select: {
      id: true,
      doctor_code: true,
      full_name: true,
      specialization: true,
    },
  },
  // Lượt khám gắn với lịch: để phía bệnh nhân biết lịch đã được khám (đang khám / đã khám xong),
  // vì trạng thái lịch hẹn vẫn là BOOKED sau khi khám.
  medical_visits: {
    select: {
      id: true,
      visit_code: true,
      status: true,
      // Bước nhà thuốc chưa cấp: bệnh nhân đã khám xong, chỉ còn chờ nhận thuốc.
      steps: {
        where: { room: { room_code: 'PHM-105' }, status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] as VisitStepStatus[] } },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { created_at: 'desc' as const },
    take: 1,
  },
} as const;

const receptionQueueInclude = {
  patient: {
    include: {
      user: {
        select: {
          email: true,
          phone_number: true,
        },
      },
    },
  },
  doctor: {
    select: {
      id: true,
      doctor_code: true,
      full_name: true,
      specialization: true,
    },
  },
  medical_visits: {
    where: { status: 'IN_PROGRESS' as const },
    take: 1,
    orderBy: { created_at: 'desc' as const },
    include: {
      receiving_room: {
        select: { id: true, room_code: true, name: true },
      },
      reception_record: true,
    },
  },
} as const;

export async function createAppointment(
  userId: string,
  input: CreateAppointmentInput,
) {
  const patient = await prisma.patient.findUnique({
    where: { user_id: userId },
    select: { id: true },
  });

  if (!patient) {
    return null;
  }

  const vietnamDateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) =>
    vietnamDateParts.find((part) => part.type === type)?.value ?? '';
  const todayInVietnam = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;

  if (input.appointment_date < todayInVietnam) {
    throw new AppError(400, 'Ngày khám không được nằm trong quá khứ.');
  }

  if (input.appointment_date === todayInVietnam) {
    const currentTimeInVietnam = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

    if (input.appointment_time <= currentTimeInVietnam) {
      throw new AppError(400, 'Giờ khám phải muộn hơn thời gian hiện tại.');
    }
  }

  const appointmentDate = new Date(`${input.appointment_date}T00:00:00.000Z`);
  const appointmentTime = new Date(`1970-01-01T${input.appointment_time}:00.000Z`);
  const duplicateAppointment = await prisma.appointment.findFirst({
    where: {
      patient_id: patient.id,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: AppointmentStatus.BOOKED,
    },
    select: { id: true },
  });

  if (duplicateAppointment) {
    throw new AppError(409, 'Bạn đã có lịch khám trong khung giờ này.');
  }

  return prisma.appointment.create({
    data: {
      appointment_code: await generateUniqueAppointmentCode(),
      patient_id: patient.id,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      note: input.note,
    },
    include: appointmentInclude,
  });
}

export async function findPatientAppointments(userId: string) {
  const patient = await prisma.patient.findUnique({
    where: { user_id: userId },
    select: { id: true },
  });

  if (!patient) {
    return null;
  }

  return prisma.appointment.findMany({
    where: { patient_id: patient.id },
    include: appointmentInclude,
    orderBy: [
      { appointment_date: 'desc' },
      { appointment_time: 'desc' },
    ],
  });
}

export async function findPatientAppointment(userId: string, appointmentId: string) {
  return prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      patient: { user_id: userId },
    },
    include: appointmentInclude,
  });
}

export async function cancelPatientAppointment(userId: string, appointmentId: string) {
  const appointment = await findPatientAppointment(userId, appointmentId);

  if (!appointment) {
    return null;
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    throw new AppError(409, 'Lịch khám này đã được hủy trước đó.');
  }

  return prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: AppointmentStatus.CANCELLED },
    include: appointmentInclude,
  });
}

export async function findReceptionQueue(appointmentDate: string) {
  const date = new Date(`${appointmentDate}T00:00:00.000Z`);

  return prisma.appointment.findMany({
    where: {
      appointment_date: date,
      status: AppointmentStatus.BOOKED,
    },
    include: receptionQueueInclude,
    orderBy: [
      { appointment_time: 'asc' },
      { created_at: 'asc' },
    ],
  });
}

/** Dữ liệu lịch hẹn cho phía bác sĩ: thông tin bệnh nhân + lượt khám mới nhất. */
const doctorAppointmentSelect = {
  id: true,
  appointment_code: true,
  appointment_date: true,
  appointment_time: true,
  note: true,
  status: true,
  checked_in_at: true,
  created_at: true,
  patient: {
    select: {
      id: true,
      patient_code: true,
      full_name: true,
      gender: true,
      date_of_birth: true,
      user: { select: { phone_number: true } },
    },
  },
  medical_visits: {
    select: {
      id: true,
      visit_code: true,
      status: true,
      created_at: true,
      receiving_room: { select: { room_code: true, name: true } },
    },
    orderBy: { created_at: 'desc' as const },
    take: 1,
  },
} as const;

function vietnamNowParts() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

/**
 * Xác nhận bệnh nhân đã đến quầy tiếp nhận.
 * - Lịch hôm nay: chỉ ghi `checked_in_at`.
 * - Lịch của ngày sau (đến sớm) và `moveToToday = true`: chuyển ngày khám sang hôm nay,
 *   giờ khám = giờ đến thực tế, đồng thời ghi `checked_in_at`.
 * Không tạo bản ghi nào khác — lượt khám chỉ được tạo khi bấm "Bắt đầu lượt khám".
 */
export async function checkInAppointment(appointmentId: string, moveToToday: boolean) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { medical_visits: { select: { id: true }, take: 1 } },
  });

  if (!appointment) throw new AppError(404, 'Không tìm thấy lịch hẹn.');
  if (appointment.status === AppointmentStatus.CANCELLED) throw new AppError(409, 'Lịch hẹn này đã bị hủy.');
  if (appointment.medical_visits.length > 0) throw new AppError(409, 'Lịch hẹn này đã có lượt khám.');

  const now = vietnamNowParts();
  const appointmentDate = appointment.appointment_date.toISOString().slice(0, 10);

  if (appointmentDate < now.date) throw new AppError(409, 'Lịch hẹn đã qua ngày, không thể tiếp nhận.');

  if (appointmentDate === now.date) {
    return prisma.appointment.update({
      where: { id: appointment.id },
      data: { checked_in_at: appointment.checked_in_at ?? new Date() },
      include: receptionQueueInclude,
    });
  }

  if (!moveToToday) throw new AppError(409, 'Lịch hẹn không phải hôm nay. Cần chuyển lịch sang hôm nay để tiếp nhận.');

  const today = new Date(`${now.date}T00:00:00.000Z`);
  const otherTodayAppointment = await prisma.appointment.findFirst({
    where: {
      id: { not: appointment.id },
      patient_id: appointment.patient_id,
      appointment_date: today,
      status: AppointmentStatus.BOOKED,
    },
    select: { appointment_code: true },
  });

  if (otherTodayAppointment) {
    throw new AppError(409, `Bệnh nhân đã có lịch ${otherTodayAppointment.appointment_code} hôm nay. Hãy tiếp nhận theo lịch đó.`);
  }

  return prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      appointment_date: today,
      appointment_time: new Date(`1970-01-01T${now.time}:00.000Z`),
      checked_in_at: new Date(),
    },
    include: receptionQueueInclude,
  });
}

/** Tra một lịch hẹn theo mã (mọi ngày, mọi trạng thái). Chỉ đọc. */
export async function findAppointmentByCode(appointmentCode: string) {
  return prisma.appointment.findUnique({
    where: { appointment_code: appointmentCode },
    select: doctorAppointmentSelect,
  });
}

/** Số lịch tối đa trả về cho một lần xem theo khoảng ngày. */
const SCHEDULE_RANGE_LIMIT = 1000;

/**
 * Lịch khám theo khoảng ngày `[from, to]` (bỏ `to` = không giới hạn về tương lai),
 * kể cả đã hủy, sắp theo ngày rồi giờ hẹn. Dùng cho trang "Hàng đợi" của bác sĩ.
 */
export async function findScheduleRange(from: string, to?: string) {
  return prisma.appointment.findMany({
    where: {
      appointment_date: {
        gte: new Date(`${from}T00:00:00.000Z`),
        ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
      },
    },
    select: doctorAppointmentSelect,
    orderBy: [
      { appointment_date: 'asc' },
      { appointment_time: 'asc' },
      { created_at: 'asc' },
    ],
    take: SCHEDULE_RANGE_LIMIT,
  });
}

/**
 * Toàn bộ lịch khám của một ngày (kể cả đã hủy) kèm lượt khám mới nhất,
 * dùng cho màn "Lịch hôm nay" của phòng tiếp nhận.
 */
export async function findDailySchedule(appointmentDate: string) {
  const date = new Date(`${appointmentDate}T00:00:00.000Z`);

  return prisma.appointment.findMany({
    where: { appointment_date: date },
    select: doctorAppointmentSelect,
    orderBy: [
      { appointment_time: 'asc' },
      { created_at: 'asc' },
    ],
  });
}
