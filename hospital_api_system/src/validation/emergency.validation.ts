import { z } from 'zod';
import { validateBody } from './validate.js';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const nullableNumber = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();

export const createEmergencyCaseSchema = z.object({
  patient_id: z.uuid().nullable().optional(),
  full_name: z.string().trim().min(2).max(150),
  date_of_birth: z.iso.date().nullable().optional(),
  age: z.number().int().min(0).max(130).nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  identity_number: nullableText(30),
  phone_number: nullableText(20),
  address: nullableText(500),
  unidentified: z.boolean().optional(),
  arrival_mode: z.enum(['WALK_IN', 'AMBULANCE', 'TRANSFER', 'OTHER']),
  arrived_at: z.iso.datetime({ offset: true }).optional(),
  companion_name: nullableText(150),
  companion_phone: nullableText(20),
  reason: z.string().trim().min(2).max(2000),
  injury_mechanism: nullableText(2000),
  priority: z.enum(['RED', 'ORANGE', 'YELLOW', 'GREEN']),
  location: nullableText(100),
  intake_note: nullableText(2000),
  assessment: z.object({
    pulse_bpm: nullableNumber(0, 300),
    systolic_pressure: nullableNumber(0, 300),
    diastolic_pressure: nullableNumber(0, 200),
    spo2_percent: nullableNumber(0, 100),
    temperature_c: nullableNumber(25, 45),
    respiratory_rate: nullableNumber(0, 100),
    pain_score: nullableNumber(0, 10),
    consciousness: nullableText(100),
  }).optional(),
});

export const updateEmergencyAssessmentSchema = z.object({
  priority: z.enum(['RED', 'ORANGE', 'YELLOW', 'GREEN']).optional(),
  location: nullableText(100),
  pulse_bpm: nullableNumber(0, 300),
  systolic_pressure: nullableNumber(0, 300),
  diastolic_pressure: nullableNumber(0, 200),
  spo2_percent: nullableNumber(0, 100),
  temperature_c: nullableNumber(25, 45),
  respiratory_rate: nullableNumber(0, 100),
  pain_score: nullableNumber(0, 10),
  consciousness: nullableText(100),
  symptoms: nullableText(5000),
  initial_assessment: nullableText(5000),
  important_history: nullableText(2000),
  allergies: nullableText(2000),
});

export const createEmergencyInterventionSchema = z.object({
  intervention_type: z.enum(['IV_ACCESS', 'OXYGEN', 'MONITORING', 'BLEEDING_CONTROL', 'EMERGENCY_MEDICATION', 'CPR', 'AIRWAY', 'OTHER']),
  details: nullableText(5000),
  performed_at: z.iso.datetime({ offset: true }).optional(),
});

export const requestEmergencyPreparationSchema = z.object({
  urgency: z.enum(['IMMEDIATE', 'URGENT', 'EXPEDITED']),
  suspected_diagnosis: nullableText(3000),
  transport_condition: z.string().trim().min(2).max(2000),
  request_note: nullableText(3000),
  orders: z.array(z.enum(['BLOOD_TEST', 'ULTRASOUND', 'CT_SCAN'])).min(1).max(3),
});

export const completePreparationOrderSchema = z.object({
  result: z.string().trim().min(2).max(10000),
});

export const decidePreparationDispositionSchema = z.object({
  destination_room: z.enum(['OR-501', 'OR-502', 'ICU-505', 'IP-401', 'IP-402', 'OBS-403']),
  preliminary_diagnosis: z.string().trim().max(3000),
  pulse: z.string().trim().max(100),
  blood_pressure: z.string().trim().max(100),
  spo2: z.string().trim().max(100),
  temperature: z.string().trim().max(100),
  respiratory_rate: z.string().trim().max(100),
  consciousness: z.string().trim().max(100),
  disposition_note: nullableText(3000),
});

export const completeEmergencySurgerySchema = z.object({
  procedure_name: z.string().trim().max(2000),
  anesthesia_note: nullableText(5000),
  surgical_findings: z.string().trim().max(10000),
  surgery_note: nullableText(5000),
  surgical_approach: nullableText(500),
  incision_at: z.iso.datetime({ offset: true }).nullable().optional(),
  closure_at: z.iso.datetime({ offset: true }).nullable().optional(),
  estimated_blood_loss_ml: z.number().int().min(0).max(50000).nullable().optional(),
  transfusion_note: nullableText(3000),
  surgery_outcome: z.enum(['SUCCESSFUL', 'COMPLICATED', 'UNSUCCESSFUL']).nullable().optional(),
  surgeon_conclusion: nullableText(10000),
  postoperative_destination: z.enum(['REC-504', 'ICU-505']),
});

export const saveIntensiveCareProgressSchema = z.object({
  assessment: z.string().trim().max(10000),
  vital_signs: nullableText(3000),
  treatment: nullableText(5000),
});

export const saveEmergencyPrescriptionSchema = z.object({
  note: nullableText(3000),
  items: z.array(z.object({ medicine_id: z.uuid(), dosage: nullableText(500), quantity: z.number().int().min(1).max(10000), usage: nullableText(1000) })).max(30),
});

export const closeIntensiveCareSchema = z.object({
  final_assessment: z.string().trim().max(10000),
  outcome: z.enum(['PHARMACY_DISCHARGE', 'TRANSFERRED_TO_FLOOR_4', 'DECEASED']),
  destination_room: z.enum(['IP-401', 'IP-402', 'OBS-403']).optional(),
});

export const saveWardProgressSchema = saveIntensiveCareProgressSchema;

export const decideWardDispositionSchema = z.object({
  final_assessment: z.string().trim().max(10000),
  outcome: z.enum(['PHARMACY_DISCHARGE', 'TRANSFERRED_TO_WARD', 'RETURN_TO_ICU', 'SURGERY_PREPARATION', 'DECEASED']),
  destination_room: z.enum(['IP-401', 'IP-402', 'OBS-403']).optional(),
  preparation_orders: z.array(z.enum(['BLOOD_TEST', 'ULTRASOUND', 'CT_SCAN'])).min(1).max(3).optional(),
});

export type CreateEmergencyCaseInput = z.infer<typeof createEmergencyCaseSchema>;
export type UpdateEmergencyAssessmentInput = z.infer<typeof updateEmergencyAssessmentSchema>;
export type CreateEmergencyInterventionInput = z.infer<typeof createEmergencyInterventionSchema>;
export type RequestEmergencyPreparationInput = z.infer<typeof requestEmergencyPreparationSchema>;
export type CompletePreparationOrderInput = z.infer<typeof completePreparationOrderSchema>;
export type DecidePreparationDispositionInput = z.infer<typeof decidePreparationDispositionSchema>;
export type CompleteEmergencySurgeryInput = z.infer<typeof completeEmergencySurgerySchema>;
export type CloseIntensiveCareInput = z.infer<typeof closeIntensiveCareSchema>;
export type SaveIntensiveCareProgressInput = z.infer<typeof saveIntensiveCareProgressSchema>;
export type SaveEmergencyPrescriptionInput = z.infer<typeof saveEmergencyPrescriptionSchema>;
export type SaveWardProgressInput = z.infer<typeof saveWardProgressSchema>;
export type DecideWardDispositionInput = z.infer<typeof decideWardDispositionSchema>;

export const validateCreateEmergencyCase = validateBody(createEmergencyCaseSchema);
export const validateUpdateEmergencyAssessment = validateBody(updateEmergencyAssessmentSchema);
export const validateCreateEmergencyIntervention = validateBody(createEmergencyInterventionSchema);
export const validateRequestEmergencyPreparation = validateBody(requestEmergencyPreparationSchema);
export const validateCompletePreparationOrder = validateBody(completePreparationOrderSchema);
export const validateDecidePreparationDisposition = validateBody(decidePreparationDispositionSchema);
export const validateCompleteEmergencySurgery = validateBody(completeEmergencySurgerySchema);
export const validateCloseIntensiveCare = validateBody(closeIntensiveCareSchema);
export const validateSaveIntensiveCareProgress = validateBody(saveIntensiveCareProgressSchema);
export const validateSaveEmergencyPrescription = validateBody(saveEmergencyPrescriptionSchema);
export const validateSaveWardProgress = validateBody(saveWardProgressSchema);
export const validateDecideWardDisposition = validateBody(decideWardDispositionSchema);
