import { z } from 'zod';
import { BloodType, Gender } from '../generated/prisma/client.js';
import { validateBody } from './validate.js';

const optionalDate = z.iso.date().nullable().optional();

export const createPatientSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  date_of_birth: optionalDate,
  gender: z.enum(Gender).nullable().optional(),
  blood_type: z.enum(BloodType).nullable().optional(),
  identity_number: z.string().trim().min(3).max(30).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  weight_kg: z.number().positive().max(500).nullable().optional(),
  height_cm: z.number().positive().max(300).nullable().optional(),
});

export const updatePatientSchema = createPatientSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Cần cung cấp ít nhất một trường để cập nhật.' },
);

export const updatePatientByDoctorSchema = createPatientSchema.partial().extend({
  email: z.email().max(255).nullable().optional(),
  phone_number: z.string().trim().min(8).max(20).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Cần cung cấp ít nhất một trường để cập nhật.' },
);

export const createDoctorSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  date_of_birth: optionalDate,
  gender: z.enum(Gender).optional(),
  specialization: z.string().trim().min(2).max(100),
  years_of_experience: z.number().int().min(0).max(80).optional(),
});

export const updateDoctorSchema = createDoctorSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Cần cung cấp ít nhất một trường để cập nhật.' },
);

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type UpdatePatientByDoctorInput = z.infer<typeof updatePatientByDoctorSchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

export const validateCreatePatient = validateBody(createPatientSchema);
export const validateUpdatePatient = validateBody(updatePatientSchema);
export const validateUpdatePatientByDoctor = validateBody(updatePatientByDoctorSchema);
export const validateCreateDoctor = validateBody(createDoctorSchema);
export const validateUpdateDoctor = validateBody(updateDoctorSchema);
