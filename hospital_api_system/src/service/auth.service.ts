import { prisma } from '../config/database.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  comparePassword,
  createAccessToken,
  hashPassword,
} from '../utils/auth.utils.js';
import type { LoginInput, RegisterInput, UpdateAccountInput } from '../validation/auth.validation.js';
import { AppError } from '../errors/app.error.js';
import { generateUniqueProfileCode } from '../utils/profile-code.utils.js';

const publicUserSelect = {
  id: true,
  email: true,
  phone_number: true,
  role: true,
  patient: {
    select: {
      id: true,
      patient_code: true,
      full_name: true,
    },
  },
  doctor: {
    select: {
      id: true,
      doctor_code: true,
      full_name: true,
    },
  },
} as const;

export async function registerUser(input: RegisterInput) {
  const existingUser = await prisma.user.findFirst({
    where: { email: input.email },
  });

  if (existingUser) {
    return null;
  }

  const [passwordHash, patientCode] = await Promise.all([
    hashPassword(input.password),
    generateUniqueProfileCode('patient'),
  ]);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phone_number: input.phone_number,
      password_hash: passwordHash,
      role: UserRole.PATIENT,
      patient: {
        create: {
          patient_code: patientCode,
          full_name: input.full_name,
        },
      },
    },
    select: publicUserSelect,
  });

  return {
    user,
    access_token: createAccessToken(user.id, user.role),
  };
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: { email: input.email },
    include: {
      patient: {
        select: { id: true, patient_code: true, full_name: true },
      },
      doctor: {
        select: { id: true, doctor_code: true, full_name: true },
      },
    },
  });

  if (
    !user?.password_hash ||
    !(await comparePassword(input.password, user.password_hash))
  ) {
    return null;
  }

  const { password_hash: _, ...publicUser } = user;

  return {
    user: publicUser,
    access_token: createAccessToken(user.id, user.role),
  };
}

export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
}

export async function updateCurrentUser(id: string, input: UpdateAccountInput) {
  if (input.email) {
    const duplicateEmail = await prisma.user.findFirst({
      where: { email: input.email, NOT: { id } },
      select: { id: true },
    });

    if (duplicateEmail) {
      throw new AppError(409, 'Email đã được sử dụng.');
    }
  }

  return prisma.user.update({
    where: { id },
    data: input,
    select: publicUserSelect,
  });
}
