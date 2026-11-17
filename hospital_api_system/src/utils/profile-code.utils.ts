import { randomInt } from 'node:crypto';
import { prisma } from '../config/database.js';

type ProfileType = 'patient' | 'doctor';

export async function generateUniqueProfileCode(type: ProfileType): Promise<string> {
  const prefix = type === 'patient' ? 'PAT' : 'DOC';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `${prefix}-${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
    const existingProfile = type === 'patient'
      ? await prisma.patient.findUnique({ where: { patient_code: code } })
      : await prisma.doctor.findUnique({ where: { doctor_code: code } });

    if (!existingProfile) {
      return code;
    }
  }

  throw new Error(`Không thể tạo ${type}_code duy nhất.`);
}
