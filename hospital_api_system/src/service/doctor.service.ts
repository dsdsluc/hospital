import { prisma } from '../config/database.js';
import { generateUniqueProfileCode } from '../utils/profile-code.utils.js';
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
} from '../validation/profile.validation.js';

function parseDate(date?: string | null): Date | null | undefined {
  if (date === null) return null;
  return date ? new Date(`${date}T00:00:00.000Z`) : undefined;
}

export async function createDoctorProfile(userId: string, input: CreateDoctorInput) {
  const existingProfile = await prisma.doctor.findUnique({
    where: { user_id: userId },
  });

  if (existingProfile) {
    return null;
  }

  return prisma.doctor.create({
    data: {
      ...input,
      date_of_birth: parseDate(input.date_of_birth),
      user_id: userId,
      doctor_code: await generateUniqueProfileCode('doctor'),
    },
  });
}

export function findDoctorProfile(userId: string) {
  return prisma.doctor.findUnique({ where: { user_id: userId } });
}

export async function updateDoctorProfile(userId: string, input: UpdateDoctorInput) {
  const existingProfile = await findDoctorProfile(userId);

  if (!existingProfile) {
    return null;
  }

  return prisma.doctor.update({
    where: { user_id: userId },
    data: {
      ...input,
      date_of_birth: parseDate(input.date_of_birth),
    },
  });
}
