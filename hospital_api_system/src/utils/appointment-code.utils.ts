import { randomInt } from 'node:crypto';
import { prisma } from '../config/database.js';

const codeCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createRandomCode(): string {
  return Array.from(
    { length: 6 },
    () => codeCharacters[randomInt(0, codeCharacters.length)],
  ).join('');
}

export async function generateUniqueAppointmentCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const appointmentCode = createRandomCode();
    const existingAppointment = await prisma.appointment.findUnique({
      where: { appointment_code: appointmentCode },
      select: { id: true },
    });

    if (!existingAppointment) {
      return appointmentCode;
    }
  }

  throw new Error('Không thể tạo appointment_code duy nhất.');
}
