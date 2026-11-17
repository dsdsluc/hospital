import { randomInt } from "node:crypto";
import { prisma } from "../config/database.js";
import { generateEmergencyInvoice } from "./invoice.service.js";
import { AppError } from "../errors/app.error.js";
import { MedicalVisitStatus, VisitStepStatus } from "../generated/prisma/client.js";
import type { CreateIsolationMonitoringInput, CreateIsolationReferralInput, ReleaseIsolationInput } from "../validation/isolation.validation.js";

const include = {
  emergency_case: { include: { preparation: { include: { emergency_prescription: { include: { items: { include: { medicine: true } } } } } } } },
  medical_visit: { include: { patient: true, prescription: { include: { items: true } } } },
  monitoring_records: { orderBy: { recorded_at: "desc" as const } },
};
const WARD_ROOMS = ["IP-401", "IP-402", "OBS-403"];

export async function createIsolationReferral(input: CreateIsolationReferralInput) {
  if (input.emergency_case_id) { const c = await prisma.emergencyCase.findUnique({ where: { id: input.emergency_case_id }, include: { isolation_episode: true } }); if (!c) throw new AppError(404, "Không tìm thấy ca cấp cứu."); if (c.isolation_episode && !["RELEASED", "DECEASED"].includes(c.isolation_episode.status)) throw new AppError(409, "Bệnh nhân đã có yêu cầu cách ly đang hoạt động."); }
  if (input.medical_visit_id) { const v = await prisma.medicalVisit.findUnique({ where: { id: input.medical_visit_id }, include: { isolation_episode: true } }); if (!v) throw new AppError(404, "Không tìm thấy lượt khám."); if (v.isolation_episode && !["RELEASED", "DECEASED"].includes(v.isolation_episode.status)) throw new AppError(409, "Bệnh nhân đã có yêu cầu cách ly đang hoạt động."); }
  return prisma.isolationEpisode.create({ data: input, include });
}

export function findIsolationEpisodes() { return prisma.isolationEpisode.findMany({ where: { status: { in: ["REQUESTED", "ACTIVE"] } }, include, orderBy: { requested_at: "asc" } }); }

async function newEmergencyCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `ER-${new Date().getFullYear().toString().slice(-2)}${randomInt(10000, 100000)}`;
    if (!await prisma.emergencyCase.findUnique({ where: { emergency_code: candidate }, select: { id: true } })) return candidate;
  }
  throw new AppError(500, "Không thể tạo mã hồ sơ điều trị.");
}

/**
 * Tiếp nhận vào ISO-404. Mọi bệnh nhân sau khi vào ISO-404 đều có hồ sơ điều trị tầng 4
 * (emergency_case + preparation) để dùng chung luồng: kê đơn, điều dưỡng NUR-405, chuyển phòng tầng 4, quầy thuốc.
 * - Bệnh nhân khám thường (medical_visit): tạo hồ sơ mới giống khi chuyển OBS-403, kết thúc lượt khám ngoại trú.
 * - Ca cấp cứu chưa có preparation (ví dụ từ ER-102): tạo preparation tối thiểu.
 */
export async function admitIsolation(id: string) {
  const e = await prisma.isolationEpisode.findUnique({
    where: { id },
    include: { emergency_case: { include: { preparation: true } }, medical_visit: { include: { patient: true } } },
  });
  if (!e) throw new AppError(404, "Không tìm thấy yêu cầu cách ly.");
  if (e.status !== "REQUESTED") throw new AppError(409, "Yêu cầu không còn ở trạng thái chờ tiếp nhận.");
  const code = !e.emergency_case_id && e.medical_visit ? await newEmergencyCode() : null;

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const preparationData = { urgency: "EXPEDITED" as const, suspected_diagnosis: e.diagnosis, transport_condition: e.transport_condition, request_note: e.handoff_note, status: "COMPLETED" as const, started_at: now, completed_at: now, decided_at: now, destination_room: "ISO-404", preliminary_diagnosis: e.diagnosis, pretransfer_assessed_at: now, pretransfer_consciousness: e.vital_signs };
    let emergencyCaseId = e.emergency_case_id;

    if (!emergencyCaseId && e.medical_visit && code) {
      const visit = e.medical_visit;
      const created = await tx.emergencyCase.create({
        data: {
          emergency_code: code, patient_id: visit.patient_id, source_medical_visit_id: visit.id,
          full_name: visit.patient.full_name, date_of_birth: visit.patient.date_of_birth, gender: visit.patient.gender, address: visit.patient.address,
          unidentified: false, arrival_mode: "TRANSFER", arrived_at: now, reason: e.reason, priority: "YELLOW", status: "TRANSFERRED", location: "ISO-404", intake_note: e.handoff_note,
          preparation: { create: preparationData },
        },
      });
      emergencyCaseId = created.id;
      await tx.visitStep.updateMany({ where: { medical_visit_id: visit.id, status: { in: [VisitStepStatus.PENDING, VisitStepStatus.IN_PROGRESS] } }, data: { status: VisitStepStatus.CANCELLED, completed_at: now } });
      await tx.medicalVisit.update({ where: { id: visit.id }, data: { status: MedicalVisitStatus.COMPLETED } });
      await tx.examinationRecord.upsert({ where: { medical_visit_id: visit.id }, create: { medical_visit_id: visit.id, final_diagnosis: e.diagnosis, treatment_direction: "Chuyển ISO-404 cách ly", conclusion: e.reason }, update: { treatment_direction: "Chuyển ISO-404 cách ly" } });
    } else if (emergencyCaseId) {
      if (!e.emergency_case?.preparation) await tx.emergencyPreparation.create({ data: { emergency_case_id: emergencyCaseId, ...preparationData } });
      await tx.emergencyCase.update({ where: { id: emergencyCaseId }, data: { location: "ISO-404", status: "TRANSFERRED" } });
    }

    return tx.isolationEpisode.update({ where: { id }, data: { status: "ACTIVE", admitted_at: now, ...(emergencyCaseId && !e.emergency_case_id && { emergency_case_id: emergencyCaseId }) }, include });
  });
}

export async function addIsolationMonitoring(id: string, input: CreateIsolationMonitoringInput) {
  const e = await prisma.isolationEpisode.findUnique({ where: { id } });
  if (!e || e.status !== "ACTIVE") throw new AppError(409, "Bệnh nhân chưa được tiếp nhận vào ISO-404.");
  return prisma.isolationMonitoring.create({ data: { isolation_episode_id: id, ...input } });
}

export async function releaseIsolation(id: string, input: ReleaseIsolationInput) {
  const e = await prisma.isolationEpisode.findUnique({ where: { id }, include: { emergency_case: { include: { preparation: true } } } });
  if (!e || e.status !== "ACTIVE") throw new AppError(409, "Hồ sơ cách ly không hoạt động.");
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const dead = input.destination_room === "DECEASED";
    const updated = await tx.isolationEpisode.update({ where: { id }, data: { status: dead ? "DECEASED" : "RELEASED", final_assessment: input.final_assessment, infection_risk_result: input.infection_risk_result, destination_room: dead ? "ISO-404" : input.destination_room, released_at: now }, include });
    if (e.emergency_case_id) {
      await tx.emergencyCase.update({ where: { id: e.emergency_case_id }, data: { location: dead ? "ISO-404" : input.destination_room, status: dead ? "CLOSED" : "TRANSFERRED" } });
      const preparation = e.emergency_case?.preparation;
      if (preparation) {
        if (input.destination_room === "ICU-505") await tx.emergencyPreparation.update({ where: { id: preparation.id }, data: { icu_discharged_at: null, icu_closed_at: null, icu_outcome: null } });
        // Về phòng tầng 4: ghi mốc vào phòng, bảo đảm hiện trong danh sách phòng đó.
        if (WARD_ROOMS.includes(input.destination_room)) await tx.emergencyPreparation.update({ where: { id: preparation.id }, data: { ward_admitted_at: now, ward_discharged_at: null } });
        // Ra quầy thuốc: không bắt buộc có đơn; chưa có thì tạo đơn trống để quầy PHM-105 vẫn thấy bệnh nhân.
        if (input.destination_room === "PHM-105") {
          await tx.emergencyPrescription.upsert({ where: { preparation_id: preparation.id }, create: { preparation_id: preparation.id }, update: {} });
          await tx.emergencyPreparation.update({ where: { id: preparation.id }, data: { ward_outcome: "PHARMACY_DISCHARGE", ward_discharged_at: now } });
        }
      }
      if (input.destination_room === "PHM-105") {
        // Ra viện qua quầy thuốc → lập hóa đơn cả đợt điều trị (CAS-103).
        await generateEmergencyInvoice(tx, e.emergency_case_id, "ISO-404");
      }
    }
    return updated;
  });
}
