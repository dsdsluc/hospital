import { prisma } from "../config/database.js";
import { AppError } from "../errors/app.error.js";
import type { CreateAlertInput, CreateHandoverInput, CreateTaskInput, RecordVitalInput, SaveCarePlanInput, UpdateAlertInput, UpdateTaskInput } from "../validation/nursing.validation.js";

const floor4Rooms = ["IP-401", "IP-402", "OBS-403", "ISO-404"];
const nursingInclude = {
  emergency_case: { include: { isolation_episode: { select: { status: true, isolation_type: true, ppe_requirements: true } } } },
  nursing_care_plan: true,
  nursing_tasks: { orderBy: { scheduled_at: "asc" as const } },
  nursing_vitals: { orderBy: { recorded_at: "desc" as const }, take: 10 },
  nursing_alerts: { orderBy: { created_at: "desc" as const } },
  nursing_handovers: { orderBy: { created_at: "desc" as const }, take: 10 },
};
export function findNursingDashboard() { return prisma.emergencyPreparation.findMany({ where: { emergency_case: { location: { in: floor4Rooms }, status: { not: "CLOSED" } } }, include: nursingInclude, orderBy: { emergency_case: { updated_at: "desc" } } }); }
async function requirePatient(id: string) { const row = await prisma.emergencyPreparation.findUnique({ where: { id }, include: { emergency_case: true } }); if (!row || !row.emergency_case.location || !floor4Rooms.includes(row.emergency_case.location)) throw new AppError(404, "Không tìm thấy bệnh nhân đang điều trị tại tầng 4."); return row; }
export async function saveCarePlan(id: string, input: SaveCarePlanInput) { await requirePatient(id); return prisma.nursingCarePlan.upsert({ where: { preparation_id: id }, create: { preparation_id: id, ...input }, update: input }); }
const taskLabels: Record<string, string> = { VITAL_SIGNS: "Đo sinh hiệu", MEDICATION: "Cho thuốc", DRESSING: "Thay băng", DRAIN_CARE: "Chăm sóc dẫn lưu", INTAKE_OUTPUT: "Theo dõi vào/ra", SPECIMEN: "Lấy mẫu", HYGIENE: "Vệ sinh", OTHER: "Công việc khác" };
/** Không nhập tên thì lấy theo loại việc; không chọn giờ thì lấy giờ hiện tại. */
export async function createTask(id: string, input: CreateTaskInput) { await requirePatient(id); return prisma.nursingTask.create({ data: { preparation_id: id, ...input, title: input.title?.trim() || taskLabels[input.task_type], scheduled_at: input.scheduled_at ? new Date(input.scheduled_at) : new Date() } }); }
export async function updateTask(id: string, input: UpdateTaskInput) { const task = await prisma.nursingTask.findUnique({ where: { id } }); if (!task) throw new AppError(404, "Không tìm thấy nhiệm vụ điều dưỡng."); return prisma.nursingTask.update({ where: { id }, data: { ...input, completed_at: input.status === "COMPLETED" ? new Date() : null } }); }
export async function recordVital(id: string, input: RecordVitalInput) { await requirePatient(id); return prisma.nursingVital.create({ data: { preparation_id: id, ...input } }); }
export async function createAlert(id: string, input: CreateAlertInput) { await requirePatient(id); return prisma.nursingAlert.create({ data: { preparation_id: id, ...input, reason: input.reason?.trim() || "Cần bác sĩ đánh giá" } }); }
export async function updateAlert(id: string, input: UpdateAlertInput) { const alert = await prisma.nursingAlert.findUnique({ where: { id } }); if (!alert) throw new AppError(404, "Không tìm thấy cảnh báo."); const now = new Date(); return prisma.nursingAlert.update({ where: { id }, data: { ...input, acknowledged_at: alert.acknowledged_at ?? now, ...(input.status === "RESOLVED" && { resolved_at: now }) } }); }
export async function createHandover(id: string, input: CreateHandoverInput) { await requirePatient(id); return prisma.nursingHandover.create({ data: { preparation_id: id, ...input, outgoing_nurse_name: input.outgoing_nurse_name?.trim() || "", incoming_nurse_name: input.incoming_nurse_name?.trim() || "", current_condition: input.current_condition?.trim() || "" } }); }
