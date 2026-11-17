import { prisma } from '../config/database.js';
import { generateVisitInvoice } from './invoice.service.js';
import { AppError } from '../errors/app.error.js';
import { AppointmentStatus, MedicalVisitStatus, Prisma, VisitStepStatus } from '../generated/prisma/client.js';
import { generateUniqueVisitCode } from '../utils/visit-code.utils.js';
import { notifyAfterStepCompleted, notifySafely, notifyVisitOrders, notifyVisitStarted } from './notification.service.js';
import { withUserContact } from '../utils/patient-contact.utils.js';
import { parseClinicalResult } from '../utils/clinical-result.utils.js';
import { randomInt } from 'node:crypto';
import type { CompleteVisitStepInput, CreateVisitOrdersInput, EscalateToObservationInput, SaveConclusionInput, SaveInitialExaminationInput, SavePrescriptionInput, StartMedicalVisitInput, StartWalkInVisitInput } from '../validation/medical-visit.validation.js';

/**
 * Lượt khám không có lịch hẹn (tab "Không có lịch hẹn" tại REC-101).
 * - `patient_id`: dùng hồ sơ có sẵn (tra theo mã bệnh nhân).
 * - `new_patient`: tạo hồ sơ vãng lai mới, không có tài khoản (user_id = null) và không có mã bệnh nhân
 *   (mã bệnh nhân chỉ được tạo khi bệnh nhân đăng ký tài khoản).
 * Sau đó tạo lượt khám giống luồng có lịch hẹn: REC-101 hoàn tất → phòng bác sĩ đang khám.
 */
export async function startWalkInVisit(input: StartWalkInVisitInput) {
  const [receptionRoom, receivingRoom] = await Promise.all([
    prisma.room.findUnique({ where: { room_code: 'REC-101' } }),
    prisma.room.findUnique({ where: { room_code: input.receiving_room_code } }),
  ]);
  if (!receptionRoom) throw new AppError(404, 'Không tìm thấy phòng tiếp nhận REC-101.');
  if (!receivingRoom) throw new AppError(404, 'Không tìm thấy phòng bác sĩ đã chọn.');
  if (receivingRoom.id === receptionRoom.id) throw new AppError(400, 'Phòng bác sĩ tiếp nhận phải khác phòng REC-101.');

  if (input.patient_id) {
    const patient = await prisma.patient.findUnique({ where: { id: input.patient_id }, select: { id: true, medical_visits: { where: { status: MedicalVisitStatus.IN_PROGRESS }, select: { visit_code: true }, take: 1 } } });
    if (!patient) throw new AppError(404, 'Không tìm thấy hồ sơ bệnh nhân.');
    if (patient.medical_visits[0]) throw new AppError(409, `Bệnh nhân đang có lượt khám ${patient.medical_visits[0].visit_code} chưa kết thúc.`);
  }
  if (!input.patient_id && !input.new_patient) throw new AppError(400, 'Cần chọn hồ sơ có sẵn hoặc nhập thông tin bệnh nhân mới.');

  const visitCode = await generateUniqueVisitCode();
  const now = new Date();

  const createdVisit = await prisma.$transaction(async (transaction) => {
    const patientId = input.patient_id ?? (await transaction.patient.create({
      data: {
        full_name: input.new_patient!.full_name,
        date_of_birth: input.new_patient!.date_of_birth ? new Date(`${input.new_patient!.date_of_birth}T00:00:00.000Z`) : null,
        gender: input.new_patient!.gender ?? null,
        phone_number: input.new_patient!.phone_number ?? null,
        identity_number: input.new_patient!.identity_number ?? null,
        address: input.new_patient!.address ?? null,
      },
      select: { id: true },
    })).id;

    const visit = await transaction.medicalVisit.create({
      data: {
        visit_code: visitCode,
        patient_id: patientId,
        receiving_room_id: receivingRoom.id,
        reception_record: { create: { temperature_c: input.temperature_c, systolic_blood_pressure: input.systolic_blood_pressure, diastolic_blood_pressure: input.diastolic_blood_pressure, heart_rate: input.heart_rate, spo2: input.spo2, height_cm: input.height_cm, weight_kg: input.weight_kg, visit_reason: input.visit_reason, reception_note: input.reception_note } },
        steps: { create: [
          { room_id: receptionRoom.id, status: VisitStepStatus.COMPLETED, started_at: now, completed_at: now },
          { room_id: receivingRoom.id, status: VisitStepStatus.IN_PROGRESS, started_at: now },
        ] },
      },
      include: { patient: { select: { patient_code: true, full_name: true } }, receiving_room: true },
    });
    if (input.height_cm !== undefined || input.weight_kg !== undefined) {
      await transaction.patient.update({ where: { id: patientId }, data: { height_cm: input.height_cm, weight_kg: input.weight_kg } });
    }
    return visit;
  });

  // Thông báo cho bệnh nhân (chỉ khi hồ sơ có tài khoản): mời đến phòng bác sĩ.
  await notifySafely(() => notifyVisitStarted(prisma, createdVisit.id));
  return createdVisit;
}

export async function startMedicalVisit(input: StartMedicalVisitInput) {
  const [appointment, receptionRoom, receivingRoom] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id: input.appointment_id },
      include: { medical_visits: { select: { id: true }, take: 1 } },
    }),
    prisma.room.findUnique({ where: { room_code: 'REC-101' } }),
    prisma.room.findUnique({ where: { room_code: input.receiving_room_code } }),
  ]);

  if (!appointment) throw new AppError(404, 'Không tìm thấy lịch hẹn.');
  if (appointment.status !== AppointmentStatus.BOOKED) {
    throw new AppError(409, 'Lịch hẹn không còn hiệu lực.');
  }
  if (appointment.medical_visits.length > 0) {
    throw new AppError(409, 'Lịch hẹn này đã được bắt đầu trước đó.');
  }
  if (!receptionRoom) throw new AppError(404, 'Không tìm thấy phòng tiếp nhận REC-101.');
  if (!receivingRoom) throw new AppError(404, 'Không tìm thấy phòng bác sĩ đã chọn.');
  if (receivingRoom.id === receptionRoom.id) {
    throw new AppError(400, 'Phòng bác sĩ tiếp nhận phải khác phòng REC-101.');
  }

  const visitCode = await generateUniqueVisitCode();
  const now = new Date();

  const createdVisit = await prisma.$transaction(async (transaction) => {
    const visit = await transaction.medicalVisit.create({
      data: {
        visit_code: visitCode,
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        receiving_room_id: receivingRoom.id,
        reception_record: {
          create: {
            temperature_c: input.temperature_c,
            systolic_blood_pressure: input.systolic_blood_pressure,
            diastolic_blood_pressure: input.diastolic_blood_pressure,
            heart_rate: input.heart_rate,
            spo2: input.spo2,
            height_cm: input.height_cm,
            weight_kg: input.weight_kg,
            visit_reason: input.visit_reason,
            reception_note: input.reception_note,
          },
        },
        steps: {
          create: [
            {
              room_id: receptionRoom.id,
              status: VisitStepStatus.COMPLETED,
              started_at: now,
              completed_at: now,
            },
            {
              room_id: receivingRoom.id,
              status: VisitStepStatus.IN_PROGRESS,
              started_at: now,
            },
          ],
        },
      },
      include: {
        receiving_room: true,
        reception_record: true,
        steps: { include: { room: true }, orderBy: { created_at: 'asc' } },
      },
    });

    if (input.height_cm !== undefined || input.weight_kg !== undefined) {
      await transaction.patient.update({
        where: { id: appointment.patient_id },
        data: {
          height_cm: input.height_cm,
          weight_kg: input.weight_kg,
        },
      });
    }

    return visit;
  });

  // Thông báo cho bệnh nhân: mời đến phòng bác sĩ (không chặn nghiệp vụ nếu lỗi).
  await notifySafely(() => notifyVisitStarted(prisma, createdVisit.id));
  return createdVisit;
}

const CASHIER_ROOM = 'CAS-103';

/**
 * Lượt khám hiện tại của bệnh nhân: đang khám, hoặc đã khám xong nhưng hóa đơn chưa thanh toán
 * (để vẫn hướng dẫn bệnh nhân tới quầy thu ngân CAS-103).
 */
export async function findCurrentPatientVisit(userId: string) {
  const visit = await prisma.medicalVisit.findFirst({
    where: {
      patient: { user_id: userId },
      OR: [{ status: MedicalVisitStatus.IN_PROGRESS }, { status: MedicalVisitStatus.COMPLETED, invoice: { status: 'UNPAID' } }],
    },
    include: {
      appointment: {
        select: {
          appointment_code: true,
          appointment_date: true,
          appointment_time: true,
        },
      },
      receiving_room: {
        include: {
          floor: true,
          function: true,
        },
      },
      steps: {
        include: {
          room: {
            include: {
              floor: true,
              function: true,
            },
          },
        },
        orderBy: { created_at: 'asc' },
      },
      invoice: { select: { invoice_code: true, status: true, total_amount: true, next_destination: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  if (!visit) return null;
  const cashier_room = visit.invoice?.status === 'UNPAID'
    ? await prisma.room.findUnique({ where: { room_code: CASHIER_ROOM }, include: { floor: true, function: true } })
    : null;
  return { ...visit, cashier_room };
}

export async function findCurrentPatientNavigation(userId: string) {
  const visit = await findCurrentPatientVisit(userId);
  if (!visit) return null;

  // Hóa đơn chưa thanh toán → đến quầy thu ngân trước (rồi mới sang PHM-105 nhận thuốc).
  if (visit.cashier_room) return buildNavigation(visit, visit.cashier_room);

  // Bước tại phòng bác sĩ tiếp nhận luôn "đang thực hiện" cho tới khi hoàn tất khám,
  // nên ưu tiên các phòng khác (cận lâm sàng, nhà thuốc) trước; hết mới quay về phòng bác sĩ.
  const activeSteps = visit.steps.filter((step) => step.status === VisitStepStatus.IN_PROGRESS || step.status === VisitStepStatus.PENDING);
  const otherSteps = activeSteps.filter((step) => step.room_id !== visit.receiving_room_id);
  const destinationStep = otherSteps.find((step) => step.status === VisitStepStatus.IN_PROGRESS)
    ?? otherSteps.find((step) => step.status === VisitStepStatus.PENDING)
    ?? activeSteps.find((step) => step.room_id === visit.receiving_room_id);
  if (!destinationStep) return null;

  return buildNavigation(visit, destinationStep.room);
}

type NavigationVisit = NonNullable<Awaited<ReturnType<typeof findCurrentPatientVisit>>>;
type NavigationRoom = NavigationVisit['receiving_room'];

function buildNavigation(visit: NavigationVisit, destination: NavigationRoom) {
  const completedSteps = visit.steps.filter((step) => step.status === VisitStepStatus.COMPLETED);
  const origin = completedSteps.at(-1)?.room ?? visit.receiving_room;
  const floorDifference = destination.floor.floor_number - origin.floor.floor_number;
  const instructions = [
    `Rời ${origin.room_code} và đi theo biển chỉ dẫn đến khu thang máy trung tâm.`,
    floorDifference === 0
      ? `Tiếp tục trên ${destination.floor.name}.`
      : `${floorDifference > 0 ? 'Đi lên' : 'Đi xuống'} tầng ${destination.floor.floor_number} bằng thang máy hoặc cầu thang.`,
    `Tìm khu ${destination.function.name}, phòng ${destination.room_code}.`,
    `Chờ trước cửa ${destination.name} và theo dõi thông báo gọi lượt.`,
  ];

  return {
    visit_id: visit.id,
    visit_code: visit.visit_code,
    updated_at: new Date().toISOString(),
    origin,
    destination,
    floor_difference: floorDifference,
    estimated_minutes: Math.max(2, 2 + Math.abs(floorDifference) * 2),
    instructions,
  };
}

export async function findPatientMedicalVisits(userId: string) {
  return prisma.medicalVisit.findMany({
    where: { patient: { user_id: userId } },
    include: {
      appointment: true,
      receiving_room: { include: { floor: true, function: true } },
      reception_record: true,
      examination_record: true,
      steps: {
        include: {
          room: { include: { floor: true, function: true } },
          clinical_result: true,
        },
        orderBy: { created_at: 'asc' },
      },
      prescription: { include: { items: { include: { medicine: true } } } },
      invoice: { include: { items: { orderBy: { sort_order: 'asc' } } } },
      escalated_emergency_cases: { select: { emergency_code: true, invoice: { include: { items: { orderBy: { sort_order: 'asc' } } } } } },
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  });
}

export async function findPatientMedicalVisit(userId: string, medicalVisitId: string) {
  const visit = await prisma.medicalVisit.findFirst({
    where: { id: medicalVisitId, patient: { user_id: userId } },
    include: {
      appointment: true,
      receiving_room: { include: { floor: true, function: true } },
      reception_record: true,
      examination_record: true,
      steps: { include: { room: { include: { floor: true, function: true } }, clinical_result: true }, orderBy: { created_at: 'asc' } },
      prescription: { include: { items: { include: { medicine: true } } } },
      invoice: { include: { items: { orderBy: { sort_order: 'asc' } } } },
      escalated_emergency_cases: { select: { emergency_code: true, invoice: { include: { items: { orderBy: { sort_order: 'asc' } } } } } },
    },
  });
  if (!visit) throw new AppError(404, 'Không tìm thấy lượt khám của bệnh nhân.');
  return visit;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chi tiết một kết quả phòng chức năng của bệnh nhân: thông số đã tách, kết luận và hướng xử lý. */
export async function findPatientClinicalResult(userId: string, medicalVisitId: string, visitStepId: string) {
  if (!UUID_PATTERN.test(medicalVisitId) || !UUID_PATTERN.test(visitStepId)) {
    throw new AppError(404, 'Không tìm thấy kết quả này.');
  }

  const step = await prisma.visitStep.findFirst({
    where: {
      id: visitStepId,
      medical_visit: { id: medicalVisitId, patient: { user_id: userId } },
    },
    include: {
      room: { include: { floor: true, function: true } },
      clinical_result: true,
      medical_visit: { include: { examination_record: true } },
    },
  });

  if (!step) throw new AppError(404, 'Không tìm thấy kết quả này.');
  if (!step.clinical_result) throw new AppError(404, 'Phòng chức năng chưa trả kết quả.');

  const exam = step.medical_visit.examination_record;

  return {
    visit_step_id: step.id,
    medical_visit_id: step.medical_visit_id,
    visit_code: step.medical_visit.visit_code,
    room: {
      id: step.room.id,
      room_code: step.room.room_code,
      name: step.room.name,
      floor_name: step.room.floor.name,
      function_name: step.room.function.name,
    },
    status: step.status,
    instruction: step.instruction,
    started_at: step.started_at,
    completed_at: step.completed_at,
    recorded_at: step.clinical_result.created_at,
    updated_at: step.clinical_result.updated_at,
    ...parseClinicalResult(step.clinical_result.result),
    raw_result: step.clinical_result.result,
    treatment: {
      final_diagnosis: exam?.final_diagnosis ?? null,
      treatment_direction: exam?.treatment_direction ?? null,
      doctor_advice: exam?.doctor_advice ?? null,
    },
  };
}

export async function findRoomVisitQueue(roomCode: string) {
  const room = await prisma.room.findUnique({
    where: { room_code: roomCode },
    select: { id: true, room_code: true, name: true },
  });
  if (!room) throw new AppError(404, 'Không tìm thấy phòng làm việc.');

  const steps = await prisma.visitStep.findMany({
    where: {
      room_id: room.id,
      status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] },
      medical_visit: { status: MedicalVisitStatus.IN_PROGRESS },
    },
    include: {
      medical_visit: {
        include: {
          appointment: {
            include: {
              doctor: {
                select: { id: true, doctor_code: true, full_name: true, specialization: true },
              },
            },
          },
          patient: {
            include: {
              user: { select: { email: true, phone_number: true } },
            },
          },
          receiving_room: {
            select: { id: true, room_code: true, name: true },
          },
          reception_record: true,
          examination_record: true,
          invoice: { select: { invoice_code: true, status: true, total_amount: true } },
          prescription: {
            include: { items: { include: { medicine: true } } },
          },
          steps: {
            include: {
              room: { include: { floor: true, function: true } },
              clinical_result: true,
            },
            orderBy: { created_at: 'asc' },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  return steps.map((step) => ({
    visit_step: {
      id: step.id,
      status: step.status,
      started_at: step.started_at,
      created_at: step.created_at,
    },
    medical_visit: { ...step.medical_visit, patient: withUserContact(step.medical_visit.patient) },
  }));
}

export async function findMedicalVisitSummary(medicalVisitId: string) {
  const visit = await prisma.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    include: {
      appointment: true,
      patient: { include: { user: { select: { email: true, phone_number: true } } } },
      receiving_room: { include: { floor: true, function: true } },
      reception_record: true,
      examination_record: true,
      steps: {
        include: {
          room: { include: { floor: true, function: true } },
          clinical_result: true,
        },
        orderBy: { created_at: 'asc' },
      },
      prescription: { include: { items: { include: { medicine: true } } } },
    },
  });
  if (!visit) throw new AppError(404, 'Không tìm thấy lượt khám.');
  return { ...visit, patient: withUserContact(visit.patient) };
}

export async function createVisitOrders(medicalVisitId: string, input: CreateVisitOrdersInput) {
  const visit = await prisma.medicalVisit.findUnique({ where: { id: medicalVisitId }, select: { id: true, status: true } });
  if (!visit) throw new AppError(404, 'Không tìm thấy lượt khám.');
  if (visit.status !== MedicalVisitStatus.IN_PROGRESS) throw new AppError(409, 'Lượt khám đã hoàn thành.');

  const rooms = await prisma.room.findMany({
    where: { room_code: { in: input.room_codes } },
    select: { id: true, room_code: true },
  });
  if (rooms.length === 0) throw new AppError(404, 'Không tìm thấy phòng được chỉ định.');

  const existingSteps = await prisma.visitStep.findMany({
    where: { medical_visit_id: medicalVisitId, room_id: { in: rooms.map((room) => room.id) }, status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] } },
    select: { room_id: true },
  });
  const existingRoomIds = new Set(existingSteps.map((step) => step.room_id));
  const newRooms = rooms.filter((room) => !existingRoomIds.has(room.id));

  if (newRooms.length > 0) {
    const created = await prisma.visitStep.createManyAndReturn({
      data: newRooms.map((room) => ({
        medical_visit_id: medicalVisitId,
        room_id: room.id,
        status: VisitStepStatus.PENDING,
        instruction: input.instruction,
      })),
      select: { id: true },
    });
    // Thông báo cho bệnh nhân: mời đến phòng cận lâm sàng đầu tiên.
    await notifySafely(() => notifyVisitOrders(prisma, medicalVisitId, created.map((step) => step.id)));
  }

  return prisma.visitStep.findMany({
    where: { medical_visit_id: medicalVisitId, room_id: { in: rooms.map((room) => room.id) } },
    include: { room: true },
    orderBy: { created_at: 'asc' },
  });
}

/**
 * Bắt đầu thực hiện một chỉ định tại phòng chức năng (vd. gọi bệnh nhân vào lấy mẫu):
 * bước khám chuyển PENDING → IN_PROGRESS và ghi started_at. Gọi lại khi đã bắt đầu thì trả về nguyên trạng.
 */
export async function startVisitStep(visitStepId: string) {
  const step = await prisma.visitStep.findUnique({
    where: { id: visitStepId },
    select: { id: true, status: true, medical_visit: { select: { status: true } } },
  });
  if (!step) throw new AppError(404, 'Không tìm thấy bước khám.');
  if (step.medical_visit.status !== MedicalVisitStatus.IN_PROGRESS) throw new AppError(409, 'Lượt khám đã hoàn thành.');
  if (step.status === VisitStepStatus.CANCELLED) throw new AppError(409, 'Chỉ định này đã bị hủy.');
  if (step.status === VisitStepStatus.COMPLETED) throw new AppError(409, 'Chỉ định này đã có kết quả.');

  if (step.status === VisitStepStatus.IN_PROGRESS) {
    return prisma.visitStep.findUniqueOrThrow({ where: { id: visitStepId }, include: { room: true } });
  }

  return prisma.visitStep.update({
    where: { id: visitStepId },
    data: { status: VisitStepStatus.IN_PROGRESS, started_at: new Date() },
    include: { room: true },
  });
}

export async function completeVisitStep(visitStepId: string, input: CompleteVisitStepInput) {
  const step = await prisma.visitStep.findUnique({
    where: { id: visitStepId },
    select: { id: true, status: true, started_at: true, medical_visit: { select: { status: true } } },
  });
  if (!step) throw new AppError(404, 'Không tìm thấy bước khám.');
  if (step.medical_visit.status !== MedicalVisitStatus.IN_PROGRESS) {
    throw new AppError(409, 'Lượt khám đã hoàn thành.');
  }
  if (step.status === VisitStepStatus.CANCELLED) {
    throw new AppError(409, 'Bước khám này đã bị hủy.');
  }

  const now = new Date();
  const completed = await prisma.$transaction(async (transaction) => {
    const clinicalResult = await transaction.clinicalResult.upsert({
      where: { visit_step_id: visitStepId },
      create: { visit_step_id: visitStepId, result: input.result },
      update: { result: input.result },
    });
    const visitStep = await transaction.visitStep.update({
      where: { id: visitStepId },
      data: {
        status: VisitStepStatus.COMPLETED,
        started_at: step.started_at ?? now,
        completed_at: now,
      },
      include: { room: true, clinical_result: true },
    });
    return { visit_step: visitStep, clinical_result: clinicalResult };
  });

  // Thông báo cho bệnh nhân: phòng tiếp theo, hoặc quay về phòng bác sĩ nếu đã đủ kết quả.
  await notifySafely(() => notifyAfterStepCompleted(prisma, visitStepId));
  return completed;
}

export async function dispenseVisitPrescription(visitStepId: string) {
  const step = await prisma.visitStep.findUnique({
    where: { id: visitStepId },
    include: {
      room: { select: { room_code: true } },
      medical_visit: {
        include: { prescription: { include: { items: { include: { medicine: true } } } }, invoice: { select: { status: true } } },
      },
    },
  });
  if (!step) throw new AppError(404, 'Không tìm thấy bước cấp thuốc.');
  // Chưa thanh toán tại CAS-103 thì không cấp thuốc (lượt khám cũ chưa có hóa đơn vẫn cấp bình thường).
  if (step.medical_visit.invoice?.status === 'UNPAID') throw new AppError(409, 'Bệnh nhân chưa thanh toán tại quầy thu ngân CAS-103, chưa thể cấp thuốc.');
  if (step.room.room_code !== 'PHM-105') throw new AppError(400, 'Bước này không thuộc nhà thuốc.');
  if (step.medical_visit.status !== MedicalVisitStatus.IN_PROGRESS) throw new AppError(409, 'Lượt khám đã hoàn thành.');
  if (step.status !== VisitStepStatus.PENDING && step.status !== VisitStepStatus.IN_PROGRESS) throw new AppError(409, 'Bước cấp thuốc không còn hiệu lực.');
  const prescription = step.medical_visit.prescription;
  if (!prescription || prescription.items.length === 0) throw new AppError(409, 'Lượt khám chưa có đơn thuốc để cấp.');

  return prisma.$transaction(async (transaction) => {
    for (const item of prescription.items) {
      const updated = await transaction.medicine.updateMany({
        where: { id: item.medicine_id, status: 'AVAILABLE', stock_quantity: { gte: item.quantity } },
        data: { stock_quantity: { decrement: item.quantity } },
      });
      if (updated.count === 0) throw new AppError(409, `Thuốc ${item.medicine.name} không đủ tồn kho để cấp.`);
    }
    const now = new Date();
    const visitStep = await transaction.visitStep.update({
      where: { id: visitStepId },
      data: { status: VisitStepStatus.COMPLETED, started_at: step.started_at ?? now, completed_at: now },
      include: { room: true },
    });
    await transaction.medicalVisit.update({
      where: { id: step.medical_visit_id },
      data: { status: MedicalVisitStatus.COMPLETED },
    });
    return visitStep;
  });
}

export async function saveVisitConclusion(medicalVisitId: string, input: SaveConclusionInput) {
  const visit = await prisma.medicalVisit.findUnique({ where: { id: medicalVisitId }, select: { id: true } });
  if (!visit) throw new AppError(404, 'Không tìm thấy lượt khám.');

  return prisma.examinationRecord.upsert({
    where: { medical_visit_id: medicalVisitId },
    create: { medical_visit_id: medicalVisitId, ...input },
    update: input,
  });
}

export async function saveInitialExamination(medicalVisitId: string, input: SaveInitialExaminationInput) {
  const visit = await prisma.medicalVisit.findUnique({ where: { id: medicalVisitId }, select: { id: true } });
  if (!visit) throw new AppError(404, 'Không tìm thấy lượt khám.');

  // JSON: null → xóa dữ liệu chuyên khoa; không gửi → giữ nguyên.
  const { specialty_data, ...rest } = input;
  const data = {
    ...rest,
    ...(specialty_data !== undefined && { specialty_data: specialty_data === null ? Prisma.JsonNull : (specialty_data as Prisma.InputJsonValue) }),
  };
  return prisma.examinationRecord.upsert({
    where: { medical_visit_id: medicalVisitId },
    create: { medical_visit_id: medicalVisitId, ...data },
    update: data,
  });
}

export async function saveVisitPrescription(medicalVisitId: string, input: SavePrescriptionInput) {
  const visit = await prisma.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    select: { id: true, receiving_room_id: true, status: true },
  });
  if (!visit) throw new AppError(404, 'Không tìm thấy lượt khám.');
  if (visit.status !== MedicalVisitStatus.IN_PROGRESS) throw new AppError(409, 'Lượt khám đã hoàn thành.');

  const medicineIds = [...new Set(input.items.map((item) => item.medicine_id))];
  const medicines = await prisma.medicine.findMany({ where: { id: { in: medicineIds } }, select: { id: true } });
  if (medicines.length !== medicineIds.length) throw new AppError(400, 'Đơn thuốc chứa thuốc không tồn tại.');

  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const prescription = await transaction.prescription.upsert({
      where: { medical_visit_id: medicalVisitId },
      create: { medical_visit_id: medicalVisitId, note: input.note, confirmed_at: now },
      update: { note: input.note, confirmed_at: now },
    });
    await transaction.prescriptionItem.deleteMany({ where: { prescription_id: prescription.id } });
    if (input.items.length > 0) {
      await transaction.prescriptionItem.createMany({
        data: input.items.map((item) => ({ prescription_id: prescription.id, ...item })),
      });
    }

    const pharmacy = await transaction.room.findUnique({ where: { room_code: 'PHM-105' }, select: { id: true } });
    if (input.items.length > 0 && !pharmacy) throw new AppError(404, 'Không tìm thấy phòng cấp thuốc PHM-105.');

    await transaction.visitStep.updateMany({
      where: {
        medical_visit_id: medicalVisitId,
        room_id: visit.receiving_room_id,
        status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] },
      },
      data: { status: VisitStepStatus.COMPLETED, completed_at: now },
    });

    const retainedRoomIds = [visit.receiving_room_id];
    if (pharmacy && input.items.length > 0) retainedRoomIds.push(pharmacy.id);
    await transaction.visitStep.updateMany({
      where: {
        medical_visit_id: medicalVisitId,
        room_id: { notIn: retainedRoomIds },
        status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] },
      },
      data: { status: VisitStepStatus.CANCELLED, completed_at: now },
    });

    if (pharmacy && input.items.length > 0) {
      const existingPharmacyStep = await transaction.visitStep.findFirst({
        where: { medical_visit_id: medicalVisitId, room_id: pharmacy.id, status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] } },
        select: { id: true },
      });
      if (!existingPharmacyStep) {
        await transaction.visitStep.create({ data: { medical_visit_id: medicalVisitId, room_id: pharmacy.id, status: VisitStepStatus.PENDING } });
      }
    } else {
      await transaction.medicalVisit.update({
        where: { id: medicalVisitId },
        data: { status: MedicalVisitStatus.COMPLETED },
      });
    }

    // Hoàn tất khám → lập hóa đơn để bệnh nhân thanh toán tại CAS-103 (trước khi nhận thuốc).
    await generateVisitInvoice(transaction, medicalVisitId);

    return transaction.prescription.findUnique({
      where: { id: prescription.id },
      include: { items: { include: { medicine: true } } },
    });
  });
}

export function findAvailableMedicines() {
  return prisma.medicine.findMany({
    where: { status: 'AVAILABLE', stock_quantity: { gt: 0 } },
    orderBy: { name: 'asc' },
  });
}

export async function escalateVisitToObservation(medicalVisitId: string, input: EscalateToObservationInput) {
  const visit = await prisma.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    include: { patient: true, reception_record: true, receiving_room: true, escalated_emergency_cases: { take: 1 } },
  });
  if (!visit) throw new AppError(404, 'Không tìm thấy lượt khám.');
  if (visit.status !== MedicalVisitStatus.IN_PROGRESS) throw new AppError(409, 'Lượt khám không còn hoạt động.');
  if (visit.escalated_emergency_cases.length > 0) throw new AppError(409, 'Bệnh nhân đã được chuyển lên tầng 4.');
  let emergencyCode = '';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `ER-${new Date().getFullYear().toString().slice(-2)}${randomInt(10000, 100000)}`;
    if (!await prisma.emergencyCase.findUnique({ where: { emergency_code: candidate }, select: { id: true } })) { emergencyCode = candidate; break; }
  }
  if (!emergencyCode) throw new AppError(500, 'Không thể tạo mã hồ sơ theo dõi.');
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const emergencyCase = await transaction.emergencyCase.create({
      data: {
        emergency_code: emergencyCode, patient_id: visit.patient_id, source_medical_visit_id: visit.id,
        full_name: visit.patient.full_name, date_of_birth: visit.patient.date_of_birth, gender: visit.patient.gender,
        phone_number: null, address: visit.patient.address, unidentified: false, arrival_mode: 'TRANSFER', arrived_at: now,
        reason: input.reason, priority: 'YELLOW', status: 'TRANSFERRED', location: 'OBS-403', intake_note: input.handoff_note,
        preparation: { create: { urgency: 'EXPEDITED', suspected_diagnosis: input.preliminary_diagnosis, transport_condition: input.transport_condition, request_note: input.handoff_note, status: 'COMPLETED', started_at: now, completed_at: now, destination_room: 'OBS-403', decided_at: now, preliminary_diagnosis: input.preliminary_diagnosis, pretransfer_assessed_at: now, pretransfer_consciousness: input.vital_signs } },
      }, include: { preparation: true },
    });
    await transaction.visitStep.updateMany({ where: { medical_visit_id: visit.id, status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] } }, data: { status: VisitStepStatus.CANCELLED, completed_at: now } });
    await transaction.medicalVisit.update({ where: { id: visit.id }, data: { status: MedicalVisitStatus.COMPLETED } });
    await transaction.examinationRecord.upsert({ where: { medical_visit_id: visit.id }, create: { medical_visit_id: visit.id, final_diagnosis: input.preliminary_diagnosis, treatment_direction: 'Chuyển OBS-403 theo dõi bệnh nặng', conclusion: input.reason, doctor_advice: input.handoff_note }, update: { final_diagnosis: input.preliminary_diagnosis, treatment_direction: 'Chuyển OBS-403 theo dõi bệnh nặng', conclusion: input.reason, doctor_advice: input.handoff_note } });
    return emergencyCase;
  });
}

/**
 * Danh sách lượt khám của một ngày (theo giờ Việt Nam) kèm hành trình qua các phòng.
 * Nếu `date` là hôm nay thì gộp thêm các lượt khám của ngày trước vẫn đang mở (carried_over = true).
 * Mỗi lượt có `current_step`: bước đang thực hiện, hoặc bước đầu tiên còn chờ, kèm thời điểm bắt đầu chờ.
 * Dùng cho mục "Lượt khám" của khu vực làm việc bác sĩ.
 */
export async function findMedicalVisitList(date: string, today: string) {
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const visits = await prisma.medicalVisit.findMany({
    where: date === today
      ? { OR: [{ created_at: { gte: start, lt: end } }, { status: MedicalVisitStatus.IN_PROGRESS, created_at: { lt: start } }, { invoice: { status: 'UNPAID' }, created_at: { lt: start } }] }
      : { created_at: { gte: start, lt: end } },
    orderBy: { created_at: 'desc' },
    take: 500,
    select: {
      id: true,
      visit_code: true,
      status: true,
      created_at: true,
      updated_at: true,
      patient: { select: { id: true, patient_code: true, full_name: true, gender: true, date_of_birth: true } },
      receiving_room: { select: { room_code: true, name: true } },
      appointment: { select: { appointment_code: true } },
      reception_record: { select: { visit_reason: true } },
      examination_record: { select: { final_diagnosis: true, preliminary_diagnosis: true } },
      prescription: { select: { confirmed_at: true, _count: { select: { items: true } } } },
      invoice: { select: { status: true, total_amount: true } },
      steps: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          status: true,
          created_at: true,
          started_at: true,
          completed_at: true,
          room: { select: { room_code: true, name: true, function: { select: { name: true } } } },
          clinical_result: { select: { id: true } },
        },
      },
    },
  });

  return visits.map((visit) => {
    const steps = visit.steps.map((step) => ({
      id: step.id,
      status: step.status,
      created_at: step.created_at,
      started_at: step.started_at,
      completed_at: step.completed_at,
      room: { room_code: step.room.room_code, name: step.room.name, function_name: step.room.function.name },
      has_result: Boolean(step.clinical_result),
    }));

    const inProgress = steps.find((step) => step.status === VisitStepStatus.IN_PROGRESS);
    const pending = steps.find((step) => step.status === VisitStepStatus.PENDING);
    const current = inProgress ?? pending ?? null;
    let waitingSince: Date | null = null;
    if (current?.status === VisitStepStatus.IN_PROGRESS) {
      waitingSince = current.started_at ?? current.created_at;
    } else if (current) {
      // Chờ tính từ lúc được chỉ định hoặc lúc xong bước liền trước (lấy mốc muộn hơn).
      const previousDone = steps
        .filter((step) => step.completed_at && step.completed_at <= new Date())
        .map((step) => step.completed_at!.getTime());
      waitingSince = new Date(Math.max(current.created_at.getTime(), ...previousDone.filter((time) => time <= Date.now())));
    }

    return {
      id: visit.id,
      visit_code: visit.visit_code,
      status: visit.status,
      created_at: visit.created_at,
      updated_at: visit.updated_at,
      carried_over: visit.created_at < start,
      patient: visit.patient,
      receiving_room: visit.receiving_room,
      appointment_code: visit.appointment?.appointment_code ?? null,
      visit_reason: visit.reception_record?.visit_reason ?? null,
      diagnosis: visit.examination_record?.final_diagnosis ?? visit.examination_record?.preliminary_diagnosis ?? null,
      prescription_items: visit.prescription?._count.items ?? 0,
      /** Hóa đơn: UNPAID → bệnh nhân đang ở quầy thu ngân CAS-103. */
      invoice_status: visit.invoice?.status ?? null,
      invoice_total: visit.invoice?.total_amount ?? null,
      steps,
      current_step: current ? { id: current.id, status: current.status, room: current.room, waiting_since: waitingSince } : null,
    };
  });
}

/** Ngày (giờ Việt Nam) gần nhất trước hoặc bằng `date` có lượt khám — để gợi ý khi ngày đang xem trống. */
export async function findLatestVisitDate(date: string) {
  const end = new Date(new Date(`${date}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000);
  const latest = await prisma.medicalVisit.findFirst({ where: { created_at: { lt: end } }, orderBy: { created_at: 'desc' }, select: { created_at: true } });
  return latest
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(latest.created_at)
    : null;
}
