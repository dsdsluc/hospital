import { z } from 'zod';
import { validateBody } from './validate.js';

const optionalNumber = (schema: z.ZodNumber) => schema.nullable().optional();

export const startMedicalVisitSchema = z.object({
  appointment_id: z.uuid(),
  receiving_room_code: z.string().trim().min(2).max(20),
  temperature_c: optionalNumber(z.number().min(30).max(45)),
  systolic_blood_pressure: optionalNumber(z.number().int().min(50).max(300)),
  diastolic_blood_pressure: optionalNumber(z.number().int().min(30).max(200)),
  heart_rate: optionalNumber(z.number().int().min(20).max(250)),
  spo2: optionalNumber(z.number().min(50).max(100)),
  height_cm: optionalNumber(z.number().positive().max(300)),
  weight_kg: optionalNumber(z.number().positive().max(500)),
  visit_reason: z.string().trim().max(2000).nullable().optional(),
  reception_note: z.string().trim().max(2000).nullable().optional(),
});

export type StartMedicalVisitInput = z.infer<typeof startMedicalVisitSchema>;

/** Lượt khám không có lịch hẹn: dùng hồ sơ có sẵn (patient_id) hoặc tạo hồ sơ vãng lai mới (new_patient). */
export const startWalkInVisitSchema = startMedicalVisitSchema.omit({ appointment_id: true }).extend({
  patient_id: z.uuid().optional(),
  new_patient: z.object({
    full_name: z.string().trim().min(1).max(150),
    date_of_birth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
    phone_number: z.string().trim().max(20).nullable().optional(),
    identity_number: z.string().trim().max(30).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
  }).optional(),
});
export type StartWalkInVisitInput = z.infer<typeof startWalkInVisitSchema>;
export const validateStartWalkInVisit = validateBody(startWalkInVisitSchema);
export const validateStartMedicalVisit = validateBody(startMedicalVisitSchema);

export const createVisitOrdersSchema = z.object({
  room_codes: z.array(z.string().trim().min(2).max(20)).min(1),
  instruction: z.string().trim().max(2000).nullable().optional(),
});

export const saveConclusionSchema = z.object({
  final_diagnosis: z.string().trim().max(1000).nullable().optional(),
  treatment_direction: z.string().trim().max(1000).nullable().optional(),
  conclusion: z.string().trim().max(3000).nullable().optional(),
  doctor_advice: z.string().trim().max(3000).nullable().optional(),
});

export const saveInitialExaminationSchema = z.object({
  preliminary_diagnosis: z.string().trim().max(1000).nullable().optional(),
  next_evaluation: z.string().trim().max(1000).nullable().optional(),
  clinical_findings: z.string().trim().max(10000).nullable().optional(),
  specialty_data: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const savePrescriptionSchema = z.object({
  note: z.string().trim().max(3000).nullable().optional(),
  items: z.array(z.object({
    medicine_id: z.uuid(),
    dosage: z.string().trim().max(500).nullable().optional(),
    quantity: z.number().int().positive().max(10_000),
    usage: z.string().trim().max(1000).nullable().optional(),
  })),
});

export const completeVisitStepSchema = z.object({
  result: z.string().trim().min(1, 'Cần nhập kết quả thực hiện.').max(10_000),
});

export const escalateToObservationSchema = z.object({
  reason: z.string().trim().max(3000),
  preliminary_diagnosis: z.string().trim().max(3000),
  transport_condition: z.string().trim().max(3000),
  vital_signs: z.string().trim().max(3000),
  handoff_note: z.string().trim().max(5000).nullable().optional(),
});

export type CreateVisitOrdersInput = z.infer<typeof createVisitOrdersSchema>;
export type SaveConclusionInput = z.infer<typeof saveConclusionSchema>;
export type SaveInitialExaminationInput = z.infer<typeof saveInitialExaminationSchema>;
export type SavePrescriptionInput = z.infer<typeof savePrescriptionSchema>;
export type CompleteVisitStepInput = z.infer<typeof completeVisitStepSchema>;
export type EscalateToObservationInput = z.infer<typeof escalateToObservationSchema>;
export const validateCreateVisitOrders = validateBody(createVisitOrdersSchema);
export const validateSaveConclusion = validateBody(saveConclusionSchema);
export const validateSaveInitialExamination = validateBody(saveInitialExaminationSchema);
export const validateSavePrescription = validateBody(savePrescriptionSchema);
export const validateCompleteVisitStep = validateBody(completeVisitStepSchema);
export const validateEscalateToObservation = validateBody(escalateToObservationSchema);
