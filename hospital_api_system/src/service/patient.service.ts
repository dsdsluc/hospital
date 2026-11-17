import { prisma } from '../config/database.js';
import { generateUniqueProfileCode } from '../utils/profile-code.utils.js';
import type {
  CreatePatientInput,
  UpdatePatientInput,
  UpdatePatientByDoctorInput,
} from '../validation/profile.validation.js';
import { AppError } from '../errors/app.error.js';
import { withUserContact } from '../utils/patient-contact.utils.js';

function parseDate(date?: string | null): Date | null | undefined {
  if (date === null) return null;
  return date ? new Date(`${date}T00:00:00.000Z`) : undefined;
}

export async function createPatientProfile(userId: string, input: CreatePatientInput) {
  const existingProfile = await prisma.patient.findUnique({
    where: { user_id: userId },
  });

  if (existingProfile) {
    return null;
  }

  return prisma.patient.create({
    data: {
      ...input,
      date_of_birth: parseDate(input.date_of_birth),
      user_id: userId,
      patient_code: await generateUniqueProfileCode('patient'),
    },
  });
}

export function findPatientProfile(userId: string) {
  return prisma.patient.findUnique({ where: { user_id: userId } });
}

export async function updatePatientProfile(userId: string, input: UpdatePatientInput) {
  const existingProfile = await findPatientProfile(userId);

  if (!existingProfile) {
    return null;
  }

  return prisma.patient.update({
    where: { user_id: userId },
    data: {
      ...input,
      date_of_birth: parseDate(input.date_of_birth),
    },
  });
}

export async function updatePatientProfileByDoctor(
  patientId: string,
  input: UpdatePatientByDoctorInput,
) {
  const existingProfile = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, user_id: true },
  });

  if (!existingProfile) return null;

  const { email, phone_number, ...profileInput } = input;

  // Bệnh nhân vãng lai (không có tài khoản): SĐT lưu ở hồ sơ, không có email.
  if (!existingProfile.user_id) {
    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: { ...profileInput, date_of_birth: parseDate(profileInput.date_of_birth), ...(phone_number !== undefined && { phone_number }) },
      include: { user: { select: { email: true, phone_number: true } } },
    });
    return withUserContact(updated);
  }
  const userId = existingProfile.user_id;

  if (email) {
    const duplicateUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId },
      },
      select: { id: true },
    });
    if (duplicateUser) throw new AppError(409, 'Email đã được sử dụng bởi tài khoản khác.');
  }

  return prisma.$transaction(async (transaction) => {
    if (email !== undefined || phone_number !== undefined) {
      await transaction.user.update({
        where: { id: userId },
        data: { email, phone_number },
      });
    }

    return transaction.patient.update({
      where: { id: patientId },
      data: {
        ...profileInput,
        date_of_birth: parseDate(profileInput.date_of_birth),
      },
      include: {
        user: {
          select: { email: true, phone_number: true },
        },
      },
    });
  });
}

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Tra cứu hồ sơ bệnh nhân cho quầy tiếp nhận (bệnh nhân không có lịch hẹn).
 * Khớp CHÍNH XÁC theo số CCCD, số điện thoại hoặc mã bệnh nhân.
 * Mỗi hồ sơ kèm tình trạng để quầy tiếp nhận rẽ nhánh:
 * - active_visit: lượt khám đang diễn ra (chưa kết thúc)
 * - today_appointment: lịch BOOKED hôm nay chưa có lượt khám
 * - upcoming_appointment: lịch BOOKED gần nhất của ngày sau, chưa có lượt khám
 */
export async function searchPatientsForReception(query: string) {
  const raw = query.trim();
  const compact = raw.replace(/[\s.\-]/g, '');
  const today = new Date(`${todayInVietnam()}T00:00:00.000Z`);

  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { identity_number: { in: [raw, compact] } },
        { user: { phone_number: { in: [raw, compact] } } },
        { phone_number: { in: [raw, compact] } },
        { patient_code: { equals: raw, mode: 'insensitive' } },
      ],
    },
    take: 5,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      patient_code: true,
      full_name: true,
      gender: true,
      date_of_birth: true,
      identity_number: true,
      address: true,
      phone_number: true,
      user: { select: { phone_number: true, email: true } },
      medical_visits: {
        where: { status: 'IN_PROGRESS' },
        take: 1,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          visit_code: true,
          appointment_id: true,
          receiving_room: { select: { room_code: true, name: true } },
        },
      },
      appointments: {
        where: {
          status: 'BOOKED',
          appointment_date: { gte: today },
          medical_visits: { none: {} },
        },
        orderBy: [{ appointment_date: 'asc' }, { appointment_time: 'asc' }],
        select: {
          id: true,
          appointment_code: true,
          appointment_date: true,
          appointment_time: true,
          checked_in_at: true,
        },
      },
    },
  });

  return patients.map(({ user, medical_visits, appointments, ...patient }) => ({
    ...patient,
    phone_number: user?.phone_number ?? patient.phone_number,
    // Có tài khoản = hồ sơ gắn với một user (bệnh nhân vãng lai thì user_id = null).
    has_account: user !== null,
    active_visit: medical_visits[0] ?? null,
    today_appointment: appointments.find((item) => item.appointment_date.getTime() === today.getTime()) ?? null,
    upcoming_appointment: appointments.find((item) => item.appointment_date.getTime() > today.getTime()) ?? null,
  }));
}

/** Số bệnh nhân tối đa trả về cho một lần tra cứu. */
const PATIENT_DIRECTORY_LIMIT = 200;

/**
 * Danh bạ bệnh nhân cho mục "Tra cứu bệnh nhân" của bác sĩ: thông tin cơ bản + số lần khám.
 * Có `q` thì tìm theo tên / mã bệnh nhân / CCCD / SĐT (chứa chuỗi, không phân biệt hoa thường);
 * không có `q` thì trả các hồ sơ mới tạo gần nhất.
 */
export async function findPatientDirectory(query?: string) {
  const q = query?.trim();
  const where = q ? {
    OR: [
      { full_name: { contains: q, mode: 'insensitive' as const } },
      { patient_code: { contains: q, mode: 'insensitive' as const } },
      { identity_number: { contains: q } },
      { phone_number: { contains: q } },
      { user: { phone_number: { contains: q } } },
    ],
  } : {};

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: PATIENT_DIRECTORY_LIMIT,
      select: {
        id: true,
        patient_code: true,
        full_name: true,
        gender: true,
        date_of_birth: true,
        blood_type: true,
        identity_number: true,
        phone_number: true,
        address: true,
        height_cm: true,
        weight_kg: true,
        created_at: true,
        user_id: true,
        user: { select: { email: true, phone_number: true } },
        _count: { select: { medical_visits: true, emergency_cases: true, appointments: true } },
        medical_visits: { orderBy: { created_at: 'desc' }, take: 1, select: { id: true, visit_code: true, status: true, created_at: true } },
      },
    }),
  ]);

  return {
    query: q ?? null,
    total,
    limited: total > patients.length,
    patients: patients.map((patient) => {
      const lastVisit = patient.medical_visits[0] ?? null;
      return {
        id: patient.id,
        patient_code: patient.patient_code,
        full_name: patient.full_name,
        gender: patient.gender,
        date_of_birth: patient.date_of_birth,
        blood_type: patient.blood_type,
        identity_number: patient.identity_number,
        phone_number: patient.phone_number ?? patient.user?.phone_number ?? null,
        email: patient.user?.email ?? null,
        address: patient.address,
        height_cm: patient.height_cm,
        weight_kg: patient.weight_kg,
        created_at: patient.created_at,
        /** false = bệnh nhân vãng lai (không có tài khoản đăng nhập). */
        has_account: patient.user_id !== null,
        counts: { visits: patient._count.medical_visits, emergencies: patient._count.emergency_cases, appointments: patient._count.appointments },
        last_visit: lastVisit,
      };
    }),
  };
}
