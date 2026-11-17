import { z } from 'zod';
import { validateBody } from './validate.js';

export const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  email: z.email().trim().toLowerCase(),
  phone_number: z.string().trim().min(8).max(20).optional(),
  password: z.string().min(6).max(72),
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

export const updateAccountSchema = z.object({
  email: z.email().trim().toLowerCase().optional(),
  phone_number: z.string().trim().min(8).max(20).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Cần cung cấp ít nhất một trường để cập nhật.',
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const validateRegister = validateBody(registerSchema);
export const validateLogin = validateBody(loginSchema);
export const validateUpdateAccount = validateBody(updateAccountSchema);
