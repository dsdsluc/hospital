import { prisma } from '../config/database.js';
import { AppError } from '../errors/app.error.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 500;

/* ------------------------------------------------------------------------------------------------
 * Nhóm phòng có lịch sử lưu ở bảng riêng (không qua visit_steps).
 * ---------------------------------------------------------------------------------------------- */
const EMERGENCY_ROOM = 'ER-102';
const PREPARATION_ROOM = 'PRE-503';
const SURGERY_ROOMS = ['OR-501', 'OR-502'];
const POSTOPERATIVE_ROOMS = ['REC-504', 'ICU-505'];
const WARD_ROOMS = ['IP-401', 'IP-402', 'OBS-403'];
const ISOLATION_ROOM = 'ISO-404';
const NURSING_ROOM = 'NUR-405';
const CASHIER_ROOM = 'CAS-103';

/**
 * Danh sách tầng → phòng (đang hoạt động), kèm số liệu lịch sử tại mỗi phòng:
 * - completed_steps: số bước khám / chỉ định đã hoàn thành tại phòng (visit_steps COMPLETED)
 * - received_visits: số lượt khám được tiếp nhận tại phòng
 * - handled_cases: số ca đã xử lý ở các phòng cấp cứu / phẫu thuật / nội trú / cách ly / điều dưỡng
 * - last_activity_at: thời điểm hoạt động gần nhất
 * Dùng cho mục "Lịch sử" của khu vực làm việc bác sĩ.
 */
export async function findRoomsWithHistory() {
  const [floors, stepStats, visitStats, special] = await Promise.all([
    prisma.floor.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { floor_number: 'asc' },
      select: {
        id: true,
        floor_code: true,
        floor_number: true,
        name: true,
        function: { select: { name: true } },
        rooms: {
          orderBy: { room_code: 'asc' },
          select: {
            id: true,
            room_code: true,
            name: true,
            status: true,
            function: { select: { function_code: true, name: true } },
            doctor: { select: { doctor_code: true, full_name: true } },
          },
        },
      },
    }),
    prisma.visitStep.groupBy({
      by: ['room_id'],
      where: { status: 'COMPLETED' },
      _count: { _all: true },
      _max: { completed_at: true },
    }),
    prisma.medicalVisit.groupBy({
      by: ['receiving_room_id'],
      _count: { _all: true },
      _max: { created_at: true },
    }),
    findSpecialRoomActivity(),
  ]);

  const steps = new Map(stepStats.map((row) => [row.room_id, row]));
  const visits = new Map(visitStats.map((row) => [row.receiving_room_id, row]));

  return floors.map((floor) => ({
    id: floor.id,
    floor_code: floor.floor_code,
    floor_number: floor.floor_number,
    name: floor.name,
    function_name: floor.function.name,
    rooms: floor.rooms.map((room) => {
      const step = steps.get(room.id);
      const visit = visits.get(room.id);
      const extra = special.get(room.room_code);
      const times = [step?._max.completed_at, visit?._max.created_at, extra?.last].filter((value): value is Date => value instanceof Date);
      return {
        id: room.id,
        room_code: room.room_code,
        name: room.name,
        status: room.status,
        function_code: room.function.function_code,
        function_name: room.function.name,
        doctor: room.doctor,
        completed_steps: step?._count._all ?? 0,
        received_visits: visit?._count._all ?? 0,
        handled_cases: extra?.count ?? 0,
        last_activity_at: times.length ? new Date(Math.max(...times.map((time) => time.getTime()))) : null,
      };
    }),
  }));
}

/** Số ca đã xử lý + thời điểm gần nhất cho các phòng lưu lịch sử ở bảng riêng. */
async function findSpecialRoomActivity() {
  const [emergency, preparation, surgery, postoperative, ward, isolation, nursing, invoices] = await Promise.all([
    prisma.emergencyCase.aggregate({ _count: { _all: true }, _max: { arrived_at: true } }),
    prisma.emergencyPreparation.aggregate({ _count: { _all: true }, _max: { requested_at: true } }),
    prisma.emergencyPreparation.groupBy({ by: ['destination_room'], where: { destination_room: { in: SURGERY_ROOMS }, surgery_status: { not: null } }, _count: { _all: true }, _max: { surgery_completed_at: true, surgery_started_at: true } }),
    prisma.emergencyPreparation.groupBy({ by: ['postoperative_destination'], where: { postoperative_destination: { in: POSTOPERATIVE_ROOMS } }, _count: { _all: true }, _max: { surgery_completed_at: true, icu_closed_at: true } }),
    prisma.emergencyWardProgress.groupBy({ by: ['room_code'], where: { room_code: { in: WARD_ROOMS } }, _count: { _all: true }, _max: { created_at: true } }),
    prisma.isolationEpisode.aggregate({ where: { admitted_at: { not: null } }, _count: { _all: true }, _max: { admitted_at: true, released_at: true } }),
    prisma.nursingTask.aggregate({ where: { status: 'COMPLETED' }, _count: { _all: true }, _max: { completed_at: true } }),
    prisma.invoice.aggregate({ _count: { _all: true }, _max: { created_at: true, paid_at: true } }),
  ]);

  const latest = (...values: Array<Date | null | undefined>) => {
    const dates = values.filter((value): value is Date => value instanceof Date);
    return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
  };
  const result = new Map<string, { count: number; last: Date | null }>();
  result.set(EMERGENCY_ROOM, { count: emergency._count._all, last: emergency._max.arrived_at });
  result.set(PREPARATION_ROOM, { count: preparation._count._all, last: preparation._max.requested_at });
  for (const row of surgery) if (row.destination_room) result.set(row.destination_room, { count: row._count._all, last: latest(row._max.surgery_completed_at, row._max.surgery_started_at) });
  for (const row of postoperative) if (row.postoperative_destination) result.set(row.postoperative_destination, { count: row._count._all, last: latest(row._max.icu_closed_at, row._max.surgery_completed_at) });
  for (const row of ward) result.set(row.room_code, { count: row._count._all, last: row._max.created_at });
  result.set(ISOLATION_ROOM, { count: isolation._count._all, last: latest(isolation._max.admitted_at, isolation._max.released_at) });
  result.set(NURSING_ROOM, { count: nursing._count._all, last: nursing._max.completed_at });
  result.set(CASHIER_ROOM, { count: invoices._count._all, last: latest(invoices._max.created_at, invoices._max.paid_at) });
  return result;
}

/* ------------------------------------------------------------------------------------------------
 * Lịch sử thực hiện của một phòng.
 * ---------------------------------------------------------------------------------------------- */

export type HistoryEventStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'CANCELLED' | 'INFO';

export interface RoomHistoryEvent {
  id: string;
  /** Nhóm sự kiện để lọc ở giao diện. */
  category: 'RECEPTION' | 'EXAMINATION' | 'PROCEDURE' | 'DISPENSE' | 'EMERGENCY' | 'SURGERY' | 'MONITORING' | 'NURSING' | 'PAYMENT';
  occurred_at: Date;
  title: string;
  detail: string | null;
  status: HistoryEventStatus;
  patient: { name: string; code: string | null };
  /** Bản ghi gốc để mở trang chi tiết. */
  ref: { type: 'visit'; id: string; code: string } | { type: 'emergency'; id: string; code: string } | { type: 'invoice'; id: string; code: string } | null;
}

const interventionLabels: Record<string, string> = {
  IV_ACCESS: 'Thiết lập đường truyền tĩnh mạch',
  OXYGEN: 'Thở oxy',
  MONITORING: 'Theo dõi monitor liên tục',
  BLEEDING_CONTROL: 'Kiểm soát chảy máu',
  EMERGENCY_MEDICATION: 'Thuốc cấp cứu',
  CPR: 'Hồi sinh tim phổi',
  AIRWAY: 'Kiểm soát đường thở',
  OTHER: 'Xử trí khác',
};
const orderLabels: Record<string, string> = { BLOOD_TEST: 'Xét nghiệm máu', ULTRASOUND: 'Siêu âm', CT_SCAN: 'Chụp CT' };

/** Viết thường chữ cái đầu, giữ nguyên chữ viết tắt ("Chụp CT" → "chụp CT"). */
function lowerFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function excerpt(value: string | null | undefined, length = 220) {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** Khoảng [from, to] theo ngày Việt Nam → [start, end). */
function toRange(from: string, to: string) {
  return { gte: new Date(`${from}T00:00:00+07:00`), lt: new Date(new Date(`${to}T00:00:00+07:00`).getTime() + DAY_MS) };
}

const emergencyCaseRef = { select: { id: true, emergency_code: true, full_name: true, patient: { select: { patient_code: true } } } } as const;

function emergencyRef(item: { id: string; emergency_code: string; full_name: string; patient: { patient_code: string | null } | null }) {
  return {
    patient: { name: item.full_name, code: item.patient?.patient_code ?? item.emergency_code },
    ref: { type: 'emergency' as const, id: item.id, code: item.emergency_code },
  };
}

export async function findRoomHistory(roomCode: string, from: string, to: string) {
  const room = await prisma.room.findUnique({
    where: { room_code: roomCode },
    select: { id: true, room_code: true, name: true, function: { select: { name: true } }, floor: { select: { name: true } } },
  });
  if (!room) throw new AppError(404, `Không tìm thấy phòng ${roomCode}.`);

  const range = toRange(from, to);
  const events: RoomHistoryEvent[] = [];
  const code = room.room_code;

  // 1) Các bước khám / chỉ định thực hiện tại phòng (mọi phòng).
  const stepCategory: RoomHistoryEvent['category'] = code === 'REC-101' ? 'RECEPTION' : code.startsWith('PHM-') ? 'DISPENSE' : /^(GEN|INT|PED|ENT|DER)-/.test(code) ? 'EXAMINATION' : 'PROCEDURE';
  const steps = await prisma.visitStep.findMany({
    where: {
      room_id: room.id,
      status: { not: 'PENDING' },
      OR: [{ completed_at: range }, { completed_at: null, started_at: range }, { status: 'CANCELLED', updated_at: range }],
    },
    orderBy: { updated_at: 'desc' },
    take: HISTORY_LIMIT,
    select: {
      id: true, status: true, instruction: true, started_at: true, completed_at: true, updated_at: true,
      clinical_result: { select: { result: true } },
      medical_visit: {
        select: {
          id: true, visit_code: true,
          patient: { select: { full_name: true, patient_code: true } },
          reception_record: { select: { visit_reason: true } },
          examination_record: { select: { final_diagnosis: true, preliminary_diagnosis: true } },
        },
      },
    },
  });
  for (const step of steps) {
    const visit = step.medical_visit;
    const done = step.status === 'COMPLETED';
    const title = stepCategory === 'RECEPTION' ? (done ? 'Hoàn tất tiếp nhận' : 'Đang tiếp nhận')
      : stepCategory === 'DISPENSE' ? (done ? 'Đã cấp phát thuốc' : 'Đang cấp phát thuốc')
      : stepCategory === 'EXAMINATION' ? (done ? 'Hoàn thành khám' : 'Đang khám')
      : step.status === 'CANCELLED' ? `Hủy chỉ định ${lowerFirst(room.function.name)}` : done ? `Hoàn thành ${lowerFirst(room.function.name)}` : `Đang thực hiện ${lowerFirst(room.function.name)}`;
    const detail = stepCategory === 'EXAMINATION'
      ? excerpt(visit.examination_record?.final_diagnosis ?? visit.examination_record?.preliminary_diagnosis ?? step.clinical_result?.result)
      : stepCategory === 'RECEPTION' ? excerpt(visit.reception_record?.visit_reason ?? step.clinical_result?.result)
      : excerpt(step.clinical_result?.result ?? step.instruction);
    events.push({
      id: `step-${step.id}`,
      category: stepCategory,
      occurred_at: step.completed_at ?? step.started_at ?? step.updated_at,
      title,
      detail,
      status: step.status === 'COMPLETED' ? 'COMPLETED' : step.status === 'CANCELLED' ? 'CANCELLED' : 'IN_PROGRESS',
      patient: { name: visit.patient.full_name, code: visit.patient.patient_code },
      ref: { type: 'visit', id: visit.id, code: visit.visit_code },
    });
  }

  // 2) Lượt khám được tiếp nhận vào phòng.
  const receivedVisits = await prisma.medicalVisit.findMany({
    where: { receiving_room_id: room.id, created_at: range },
    orderBy: { created_at: 'desc' },
    take: HISTORY_LIMIT,
    select: { id: true, visit_code: true, status: true, created_at: true, patient: { select: { full_name: true, patient_code: true } }, reception_record: { select: { visit_reason: true } } },
  });
  for (const visit of receivedVisits) {
    events.push({
      id: `visit-${visit.id}`,
      category: 'RECEPTION',
      occurred_at: visit.created_at,
      title: 'Nhận lượt khám vào phòng',
      detail: excerpt(visit.reception_record?.visit_reason),
      status: visit.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      patient: { name: visit.patient.full_name, code: visit.patient.patient_code },
      ref: { type: 'visit', id: visit.id, code: visit.visit_code },
    });
  }

  // 3) Phòng cấp cứu: tiếp nhận ca + các lần xử trí.
  if (code === EMERGENCY_ROOM) {
    const [cases, interventions] = await Promise.all([
      prisma.emergencyCase.findMany({ where: { arrived_at: range }, orderBy: { arrived_at: 'desc' }, take: HISTORY_LIMIT, select: { id: true, emergency_code: true, full_name: true, status: true, arrived_at: true, reason: true, priority: true, patient: { select: { patient_code: true } } } }),
      prisma.emergencyIntervention.findMany({ where: { performed_at: range }, orderBy: { performed_at: 'desc' }, take: HISTORY_LIMIT, select: { id: true, intervention_type: true, details: true, performed_at: true, emergency_case: emergencyCaseRef } }),
    ]);
    const priorityLabels: Record<string, string> = { RED: 'Đỏ', ORANGE: 'Cam', YELLOW: 'Vàng', GREEN: 'Xanh' };
    for (const item of cases) {
      events.push({
        id: `er-case-${item.id}`, category: 'EMERGENCY', occurred_at: item.arrived_at,
        title: `Tiếp nhận ca cấp cứu · mức ${priorityLabels[item.priority] ?? item.priority}`,
        detail: excerpt(item.reason),
        status: item.status === 'TRANSFERRED' || item.status === 'CLOSED' ? 'COMPLETED' : item.status === 'WAITING' ? 'PENDING' : 'IN_PROGRESS',
        ...emergencyRef(item),
      });
    }
    for (const item of interventions) {
      events.push({
        id: `er-int-${item.id}`, category: 'EMERGENCY', occurred_at: item.performed_at,
        title: interventionLabels[item.intervention_type] ?? 'Xử trí cấp cứu',
        detail: excerpt(item.details), status: 'COMPLETED', ...emergencyRef(item.emergency_case),
      });
    }
  }

  // 4) Phòng chuẩn bị phẫu thuật: yêu cầu, kết quả chỉ định, điều phối.
  if (code === PREPARATION_ROOM) {
    const preparations = await prisma.emergencyPreparation.findMany({
      where: { OR: [{ requested_at: range }, { completed_at: range }, { orders: { some: { completed_at: range } } }] },
      orderBy: { requested_at: 'desc' },
      take: HISTORY_LIMIT,
      select: {
        id: true, status: true, requested_at: true, completed_at: true, destination_room: true, suspected_diagnosis: true, preliminary_diagnosis: true,
        orders: { where: { completed_at: range }, select: { id: true, order_type: true, result: true, completed_at: true } },
        emergency_case: emergencyCaseRef,
      },
    });
    for (const item of preparations) {
      const base = emergencyRef(item.emergency_case);
      if (item.requested_at >= range.gte && item.requested_at < range.lt) {
        events.push({ id: `pre-req-${item.id}`, category: 'SURGERY', occurred_at: item.requested_at, title: 'Nhận yêu cầu chuẩn bị phẫu thuật', detail: excerpt(item.suspected_diagnosis), status: item.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS', ...base });
      }
      for (const order of item.orders) {
        if (order.completed_at) events.push({ id: `pre-order-${order.id}`, category: 'PROCEDURE', occurred_at: order.completed_at, title: `Có kết quả ${lowerFirst(orderLabels[order.order_type] ?? order.order_type)}`, detail: excerpt(order.result), status: 'COMPLETED', ...base });
      }
      if (item.completed_at && item.completed_at >= range.gte && item.completed_at < range.lt) {
        events.push({ id: `pre-done-${item.id}`, category: 'SURGERY', occurred_at: item.completed_at, title: `Điều phối chuyển ${item.destination_room ?? 'phòng tiếp theo'}`, detail: excerpt(item.preliminary_diagnosis), status: 'COMPLETED', ...base });
      }
    }
  }

  // 5) Phòng mổ: bắt đầu / hoàn thành phẫu thuật.
  if (SURGERY_ROOMS.includes(code)) {
    const surgeries = await prisma.emergencyPreparation.findMany({
      where: { destination_room: code, OR: [{ surgery_started_at: range }, { surgery_completed_at: range }] },
      orderBy: { surgery_started_at: 'desc' },
      take: HISTORY_LIMIT,
      select: { id: true, surgery_status: true, surgery_started_at: true, surgery_completed_at: true, procedure_name: true, surgical_findings: true, surgeon_conclusion: true, postoperative_destination: true, preliminary_diagnosis: true, emergency_case: emergencyCaseRef },
    });
    for (const item of surgeries) {
      const base = emergencyRef(item.emergency_case);
      if (item.surgery_completed_at && item.surgery_completed_at >= range.gte && item.surgery_completed_at < range.lt) {
        events.push({ id: `or-done-${item.id}`, category: 'SURGERY', occurred_at: item.surgery_completed_at, title: `Hoàn thành phẫu thuật${item.procedure_name ? `: ${item.procedure_name}` : ''}`, detail: excerpt(item.surgeon_conclusion ?? item.surgical_findings ?? (item.postoperative_destination ? `Chuyển ${item.postoperative_destination}` : null)), status: 'COMPLETED', ...base });
      }
      if (item.surgery_started_at && item.surgery_started_at >= range.gte && item.surgery_started_at < range.lt) {
        events.push({ id: `or-start-${item.id}`, category: 'SURGERY', occurred_at: item.surgery_started_at, title: 'Bắt đầu phẫu thuật', detail: excerpt(item.preliminary_diagnosis), status: item.surgery_status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS', ...base });
      }
    }
  }

  // 6) Hồi tỉnh / hồi sức: diễn biến và kết thúc theo dõi.
  if (POSTOPERATIVE_ROOMS.includes(code)) {
    const items = await prisma.emergencyPreparation.findMany({
      where: { postoperative_destination: code, OR: [{ surgery_completed_at: range }, { icu_closed_at: range }, { icu_progress_notes: { some: { created_at: range } } }] },
      take: HISTORY_LIMIT,
      select: {
        id: true, surgery_completed_at: true, icu_closed_at: true, icu_outcome: true, icu_final_assessment: true, procedure_name: true,
        icu_progress_notes: { where: { created_at: range }, select: { id: true, assessment: true, created_at: true } },
        emergency_case: emergencyCaseRef,
      },
    });
    for (const item of items) {
      const base = emergencyRef(item.emergency_case);
      if (item.surgery_completed_at && item.surgery_completed_at >= range.gte && item.surgery_completed_at < range.lt) {
        events.push({ id: `icu-in-${item.id}`, category: 'MONITORING', occurred_at: item.surgery_completed_at, title: 'Nhận bệnh nhân sau phẫu thuật', detail: excerpt(item.procedure_name), status: item.icu_closed_at ? 'COMPLETED' : 'IN_PROGRESS', ...base });
      }
      for (const note of item.icu_progress_notes) events.push({ id: `icu-note-${note.id}`, category: 'MONITORING', occurred_at: note.created_at, title: 'Ghi nhận diễn biến hồi sức', detail: excerpt(note.assessment), status: 'INFO', ...base });
      if (item.icu_closed_at && item.icu_closed_at >= range.gte && item.icu_closed_at < range.lt) {
        events.push({ id: `icu-close-${item.id}`, category: 'MONITORING', occurred_at: item.icu_closed_at, title: 'Kết thúc theo dõi hồi sức', detail: excerpt(item.icu_final_assessment), status: 'COMPLETED', ...base });
      }
    }
  }

  // 7) Nội trú / theo dõi: diễn biến điều trị và ra phòng.
  if (WARD_ROOMS.includes(code)) {
    const [notes, discharged] = await Promise.all([
      prisma.emergencyWardProgress.findMany({ where: { room_code: code, created_at: range }, orderBy: { created_at: 'desc' }, take: HISTORY_LIMIT, select: { id: true, assessment: true, treatment: true, created_at: true, preparation: { select: { emergency_case: emergencyCaseRef } } } }),
      prisma.emergencyPreparation.findMany({ where: { destination_room: code, ward_discharged_at: range }, take: HISTORY_LIMIT, select: { id: true, ward_discharged_at: true, ward_final_assessment: true, emergency_case: emergencyCaseRef } }),
    ]);
    for (const note of notes) events.push({ id: `ward-note-${note.id}`, category: 'MONITORING', occurred_at: note.created_at, title: 'Ghi nhận diễn biến điều trị', detail: excerpt(note.assessment), status: 'INFO', ...emergencyRef(note.preparation.emergency_case) });
    for (const item of discharged) {
      if (item.ward_discharged_at) events.push({ id: `ward-out-${item.id}`, category: 'MONITORING', occurred_at: item.ward_discharged_at, title: 'Bệnh nhân rời phòng', detail: excerpt(item.ward_final_assessment), status: 'COMPLETED', ...emergencyRef(item.emergency_case) });
    }
  }

  // 8) Phòng cách ly: nhận vào, theo dõi, rời phòng.
  if (code === ISOLATION_ROOM) {
    const episodes = await prisma.isolationEpisode.findMany({
      where: { OR: [{ admitted_at: range }, { released_at: range }, { monitoring_records: { some: { recorded_at: range } } }] },
      take: HISTORY_LIMIT,
      select: {
        id: true, admitted_at: true, released_at: true, reason: true, final_assessment: true, isolation_type: true,
        monitoring_records: { where: { recorded_at: range }, select: { id: true, symptoms: true, recorded_at: true } },
        emergency_case: emergencyCaseRef,
        medical_visit: { select: { id: true, visit_code: true, patient: { select: { full_name: true, patient_code: true } } } },
      },
    });
    for (const episode of episodes) {
      const base = episode.emergency_case
        ? emergencyRef(episode.emergency_case)
        : episode.medical_visit
          ? { patient: { name: episode.medical_visit.patient.full_name, code: episode.medical_visit.patient.patient_code }, ref: { type: 'visit' as const, id: episode.medical_visit.id, code: episode.medical_visit.visit_code } }
          : { patient: { name: 'Không rõ', code: null }, ref: null };
      if (episode.admitted_at && episode.admitted_at >= range.gte && episode.admitted_at < range.lt) {
        events.push({ id: `iso-in-${episode.id}`, category: 'MONITORING', occurred_at: episode.admitted_at, title: 'Nhận vào phòng cách ly', detail: excerpt(episode.reason), status: episode.released_at ? 'COMPLETED' : 'IN_PROGRESS', ...base });
      }
      for (const record of episode.monitoring_records) events.push({ id: `iso-mon-${record.id}`, category: 'MONITORING', occurred_at: record.recorded_at, title: 'Theo dõi cách ly', detail: excerpt(record.symptoms), status: 'INFO', ...base });
      if (episode.released_at && episode.released_at >= range.gte && episode.released_at < range.lt) {
        events.push({ id: `iso-out-${episode.id}`, category: 'MONITORING', occurred_at: episode.released_at, title: 'Rời phòng cách ly', detail: excerpt(episode.final_assessment), status: 'COMPLETED', ...base });
      }
    }
  }

  // 10) Quầy thu ngân: mỗi hóa đơn là một giao dịch (chờ thanh toán / đã thanh toán).
  if (code === CASHIER_ROOM) {
    const methodLabels: Record<string, string> = { CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản', CARD: 'Thẻ' };
    const vnd = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;
    const invoices = await prisma.invoice.findMany({
      where: { OR: [{ created_at: range }, { paid_at: range }] },
      orderBy: { created_at: 'desc' },
      take: HISTORY_LIMIT,
      select: { id: true, invoice_code: true, status: true, total_amount: true, patient_amount: true, insurance_applied: true, insurance_amount: true, payment_method: true, patient_name: true, patient_code: true, record_code: true, source_room: true, created_at: true, paid_at: true },
    });
    for (const inv of invoices) {
      const paid = inv.status === 'PAID';
      const amount = paid ? (inv.patient_amount ?? inv.total_amount - inv.insurance_amount) : inv.total_amount;
      events.push({
        id: `inv-${inv.id}`,
        category: 'PAYMENT',
        occurred_at: paid && inv.paid_at ? inv.paid_at : inv.created_at,
        title: paid ? `Đã thanh toán ${vnd(amount)}` : `Chờ thanh toán ${vnd(amount)}`,
        detail: [inv.invoice_code, `lượt ${inv.record_code}`, inv.source_room && `từ ${inv.source_room}`, paid && inv.payment_method && methodLabels[inv.payment_method], inv.insurance_applied && `BHYT chi trả ${vnd(inv.insurance_amount)}`].filter(Boolean).join(' · '),
        status: paid ? 'COMPLETED' : 'PENDING',
        patient: { name: inv.patient_name, code: inv.patient_code ?? inv.record_code },
        ref: { type: 'invoice', id: inv.id, code: inv.invoice_code },
      });
    }
  }

  // 9) Trạm điều dưỡng: việc chăm sóc đã làm, cảnh báo, bàn giao ca.
  if (code === NURSING_ROOM) {
    const preparationRef = { select: { emergency_case: emergencyCaseRef } } as const;
    const [tasks, alerts, handovers] = await Promise.all([
      prisma.nursingTask.findMany({ where: { status: 'COMPLETED', completed_at: range }, orderBy: { completed_at: 'desc' }, take: HISTORY_LIMIT, select: { id: true, title: true, result: true, completed_at: true, preparation: preparationRef } }),
      prisma.nursingAlert.findMany({ where: { created_at: range }, orderBy: { created_at: 'desc' }, take: HISTORY_LIMIT, select: { id: true, reason: true, status: true, created_at: true, preparation: preparationRef } }),
      prisma.nursingHandover.findMany({ where: { created_at: range }, orderBy: { created_at: 'desc' }, take: HISTORY_LIMIT, select: { id: true, shift: true, outgoing_nurse_name: true, incoming_nurse_name: true, current_condition: true, created_at: true, preparation: preparationRef } }),
    ]);
    for (const task of tasks) if (task.completed_at) events.push({ id: `nur-task-${task.id}`, category: 'NURSING', occurred_at: task.completed_at, title: task.title, detail: excerpt(task.result), status: 'COMPLETED', ...emergencyRef(task.preparation.emergency_case) });
    for (const alert of alerts) events.push({ id: `nur-alert-${alert.id}`, category: 'NURSING', occurred_at: alert.created_at, title: 'Cảnh báo điều dưỡng', detail: excerpt(alert.reason), status: alert.status === 'RESOLVED' ? 'COMPLETED' : 'PENDING', ...emergencyRef(alert.preparation.emergency_case) });
    for (const handover of handovers) events.push({ id: `nur-ho-${handover.id}`, category: 'NURSING', occurred_at: handover.created_at, title: `Bàn giao ca: ${handover.outgoing_nurse_name} → ${handover.incoming_nurse_name}`, detail: excerpt(handover.current_condition), status: 'INFO', ...emergencyRef(handover.preparation.emergency_case) });
  }

  events.sort((left, right) => right.occurred_at.getTime() - left.occurred_at.getTime());
  return {
    room: { room_code: room.room_code, name: room.name, function_name: room.function.name, floor_name: room.floor.name },
    from,
    to,
    truncated: events.length > HISTORY_LIMIT,
    events: events.slice(0, HISTORY_LIMIT),
  };
}
