import { prisma } from '../config/database.js';
import { MedicalVisitStatus, Prisma, VisitStepStatus } from '../generated/prisma/client.js';

/**
 * Tra cứu hồ sơ: gộp lượt khám thường (medical_visits) và ca cấp cứu (emergency_cases)
 * thành một danh sách "đợt điều trị" với trạng thái thống nhất.
 *
 * Trạng thái:
 * - IN_TREATMENT      đang khám / điều trị ở một phòng
 * - AWAITING_PAYMENT  có hóa đơn chưa thu, bệnh nhân ở quầy thu ngân CAS-103
 * - AWAITING_MEDICINE đã cho ra quầy thuốc PHM-105, quầy chưa cấp
 * - COMPLETED         khám xong (khám thường) / đã ra viện (cấp cứu)
 * - DECEASED          ca cấp cứu đóng do tử vong
 */
export type RecordStatus = 'IN_TREATMENT' | 'AWAITING_PAYMENT' | 'AWAITING_MEDICINE' | 'COMPLETED' | 'DECEASED';
export type RecordType = 'VISIT' | 'EMERGENCY';

export interface MedicalRecordItem {
  id: string;
  type: RecordType;
  code: string;
  status: RecordStatus;
  started_at: Date;
  ended_at: Date | null;
  patient: {
    full_name: string;
    patient_code: string | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    date_of_birth: Date | null;
    age: number | null;
    identity_number: string | null;
    phone_number: string | null;
  };
  location: { room_code: string; name: string | null } | null;
  reason: string | null;
  diagnosis: string | null;
  priority: string | null;
}

const PHARMACY_ROOM = 'PHM-105';
const CASHIER_ROOM = 'CAS-103';
/** Giới hạn mỗi nguồn cho một lần tra cứu. */
const SOURCE_LIMIT = 500;

export async function findMedicalRecords(input: { from: string; to: string; q?: string }) {
  const start = new Date(`${input.from}T00:00:00+07:00`);
  const end = new Date(new Date(`${input.to}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000);
  const q = input.q?.trim();

  // Có từ khóa thì tìm trên toàn bộ thời gian; không có thì theo khoảng ngày + mọi ca còn mở.
  const visitSearch: Prisma.MedicalVisitWhereInput | undefined = q ? {
    OR: [
      { visit_code: { contains: q, mode: 'insensitive' } },
      { appointment: { appointment_code: { contains: q, mode: 'insensitive' } } },
      { patient: { full_name: { contains: q, mode: 'insensitive' } } },
      { patient: { patient_code: { contains: q, mode: 'insensitive' } } },
      { patient: { identity_number: { contains: q } } },
      { patient: { user: { phone_number: { contains: q } } } },
      { patient: { phone_number: { contains: q } } },
    ],
  } : undefined;
  const emergencySearch: Prisma.EmergencyCaseWhereInput | undefined = q ? {
    OR: [
      { emergency_code: { contains: q, mode: 'insensitive' } },
      { full_name: { contains: q, mode: 'insensitive' } },
      { identity_number: { contains: q } },
      { phone_number: { contains: q } },
      { patient: { patient_code: { contains: q, mode: 'insensitive' } } },
    ],
  } : undefined;

  const [visits, cases, rooms] = await Promise.all([
    prisma.medicalVisit.findMany({
      where: visitSearch ?? { OR: [{ created_at: { gte: start, lt: end } }, { status: MedicalVisitStatus.IN_PROGRESS }, { invoice: { status: 'UNPAID' } }] },
      orderBy: { created_at: 'desc' },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        visit_code: true,
        status: true,
        created_at: true,
        updated_at: true,
        patient: { select: { full_name: true, patient_code: true, gender: true, date_of_birth: true, identity_number: true, phone_number: true, user: { select: { phone_number: true } } } },
        receiving_room: { select: { room_code: true, name: true } },
        reception_record: { select: { visit_reason: true } },
        invoice: { select: { status: true } },
        examination_record: { select: { final_diagnosis: true, preliminary_diagnosis: true } },
        steps: {
          where: { status: { in: [VisitStepStatus.IN_PROGRESS, VisitStepStatus.PENDING] } },
          orderBy: { created_at: 'asc' },
          select: { status: true, room: { select: { room_code: true, name: true } } },
        },
      },
    }),
    prisma.emergencyCase.findMany({
      where: emergencySearch ?? { OR: [{ arrived_at: { gte: start, lt: end } }, { status: { not: 'CLOSED' } }, { invoice: { status: 'UNPAID' } }] },
      orderBy: { arrived_at: 'desc' },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        emergency_code: true,
        full_name: true,
        gender: true,
        date_of_birth: true,
        age: true,
        identity_number: true,
        phone_number: true,
        arrived_at: true,
        updated_at: true,
        status: true,
        location: true,
        reason: true,
        priority: true,
        patient: { select: { patient_code: true } },
        invoice: { select: { status: true } },
        assessment: { select: { initial_assessment: true } },
        preparation: { select: { preliminary_diagnosis: true, suspected_diagnosis: true, icu_outcome: true, ward_outcome: true, emergency_prescription: { select: { dispensed_at: true } } } },
      },
    }),
    prisma.room.findMany({ select: { room_code: true, name: true } }),
  ]);

  const roomName = new Map(rooms.map((room) => [room.room_code, room.name]));

  const visitItems: MedicalRecordItem[] = visits.map((visit) => {
    const current = visit.steps.find((step) => step.status === VisitStepStatus.IN_PROGRESS) ?? visit.steps[0] ?? null;
    const completed = visit.status === MedicalVisitStatus.COMPLETED;
    const unpaid = visit.invoice?.status === 'UNPAID';
    const location = unpaid ? { room_code: CASHIER_ROOM, name: roomName.get(CASHIER_ROOM) ?? 'Quầy thu ngân' } : completed ? null : current ? current.room : visit.receiving_room;
    return {
      id: visit.id,
      type: 'VISIT',
      code: visit.visit_code,
      status: unpaid ? 'AWAITING_PAYMENT' : completed ? 'COMPLETED' : location?.room_code === PHARMACY_ROOM ? 'AWAITING_MEDICINE' : 'IN_TREATMENT',
      started_at: visit.created_at,
      ended_at: completed ? visit.updated_at : null,
      patient: {
        full_name: visit.patient.full_name,
        patient_code: visit.patient.patient_code,
        gender: visit.patient.gender,
        date_of_birth: visit.patient.date_of_birth,
        age: null,
        identity_number: visit.patient.identity_number,
        phone_number: visit.patient.user?.phone_number ?? visit.patient.phone_number,
      },
      location,
      reason: visit.reception_record?.visit_reason ?? null,
      diagnosis: visit.examination_record?.final_diagnosis ?? visit.examination_record?.preliminary_diagnosis ?? null,
      priority: null,
    };
  });

  const caseItems: MedicalRecordItem[] = cases.map((item) => {
    const closed = item.status === 'CLOSED';
    const deceased = closed && (item.preparation?.icu_outcome === 'DECEASED' || item.preparation?.ward_outcome === 'DECEASED');
    const unpaid = item.invoice?.status === 'UNPAID';
    const status: RecordStatus = deceased ? 'DECEASED' : unpaid ? 'AWAITING_PAYMENT' : closed ? 'COMPLETED' : item.location === PHARMACY_ROOM ? 'AWAITING_MEDICINE' : 'IN_TREATMENT';
    return {
      id: item.id,
      type: 'EMERGENCY',
      code: item.emergency_code,
      status,
      started_at: item.arrived_at,
      ended_at: closed ? (item.preparation?.emergency_prescription?.dispensed_at ?? item.updated_at) : null,
      patient: {
        full_name: item.full_name,
        patient_code: item.patient?.patient_code ?? null,
        gender: item.gender,
        date_of_birth: item.date_of_birth,
        age: item.age,
        identity_number: item.identity_number,
        phone_number: item.phone_number,
      },
      location: unpaid ? { room_code: CASHIER_ROOM, name: roomName.get(CASHIER_ROOM) ?? 'Quầy thu ngân' } : closed || !item.location ? null : { room_code: item.location, name: roomName.get(item.location) ?? null },
      reason: item.reason,
      diagnosis: item.preparation?.preliminary_diagnosis ?? item.preparation?.suspected_diagnosis ?? item.assessment?.initial_assessment ?? null,
      priority: item.priority,
    };
  });

  const records = [...visitItems, ...caseItems].sort((a, b) => b.started_at.getTime() - a.started_at.getTime());
  return { from: input.from, to: input.to, query: q ?? null, limited: visits.length >= SOURCE_LIMIT || cases.length >= SOURCE_LIMIT, records };
}
