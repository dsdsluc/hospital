import { z } from 'zod';
import { validateBody } from './validate.js';

export const createAppointmentSchema = z.object({
  appointment_date: z.iso.date(),
  appointment_time: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .refine((value) => {
      const [hour, minute] = value.split(':').map(Number);
      return hour >= 7 && hour <= 20 && (minute === 0 || minute === 30) && !(hour === 20 && minute > 0);
    }, 'Giờ khám phải từ 07:00 đến 20:00 và cách nhau 30 phút.'),
  note: z.string().trim().max(1000).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const validateCreateAppointment = validateBody(createAppointmentSchema);
