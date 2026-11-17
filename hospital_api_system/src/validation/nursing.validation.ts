import { z } from "zod";
import { validateBody } from "./validate.js";

// Không có trường bắt buộc (trừ loại / mức / ca): điều dưỡng ghi gì lưu nấy.
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const saveCarePlanSchema = z.object({ bed_code: optionalText(30), assigned_nurse_name: optionalText(150), care_level: z.enum(["STANDARD", "HIGH", "CRITICAL"]), fall_risk: z.boolean(), pressure_injury_risk: z.boolean(), isolation_precaution: z.boolean(), care_note: optionalText(5000) });
export const createTaskSchema = z.object({ task_type: z.enum(["VITAL_SIGNS", "MEDICATION", "DRESSING", "DRAIN_CARE", "INTAKE_OUTPUT", "SPECIMEN", "HYGIENE", "OTHER"]), title: optionalText(200), instruction: optionalText(3000), scheduled_at: z.iso.datetime({ offset: true }).nullable().optional(), assigned_nurse_name: optionalText(150) });
export const updateTaskSchema = z.object({ status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "MISSED"]), result: optionalText(5000) });
export const recordVitalSchema = z.object({ pulse: optionalText(100), blood_pressure: optionalText(100), spo2: optionalText(100), temperature: optionalText(100), respiratory_rate: optionalText(100), consciousness: optionalText(100), pain_score: optionalText(100), note: optionalText(3000), recorded_by_name: optionalText(150) });
export const createAlertSchema = z.object({ priority: z.enum(["ROUTINE", "URGENT", "CRITICAL"]), reason: optionalText(5000), clinical_snapshot: optionalText(5000), created_by_name: optionalText(150) });
export const updateAlertSchema = z.object({ status: z.enum(["ACKNOWLEDGED", "RESOLVED"]), resolution_note: optionalText(5000) });
export const createHandoverSchema = z.object({ shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]), outgoing_nurse_name: optionalText(150), incoming_nurse_name: optionalText(150), current_condition: optionalText(10000), outstanding_work: optionalText(5000), safety_warning: optionalText(5000) });

export type SaveCarePlanInput = z.infer<typeof saveCarePlanSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type RecordVitalInput = z.infer<typeof recordVitalSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;
export type CreateHandoverInput = z.infer<typeof createHandoverSchema>;
export const validateSaveCarePlan = validateBody(saveCarePlanSchema);
export const validateCreateTask = validateBody(createTaskSchema);
export const validateUpdateTask = validateBody(updateTaskSchema);
export const validateRecordVital = validateBody(recordVitalSchema);
export const validateCreateAlert = validateBody(createAlertSchema);
export const validateUpdateAlert = validateBody(updateAlertSchema);
export const validateCreateHandover = validateBody(createHandoverSchema);
