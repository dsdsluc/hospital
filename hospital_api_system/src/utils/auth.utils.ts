import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN, JWT_SECRET } from '../config/auth.js';
import { UserRole } from '../generated/prisma/client.js';

export function createAccessToken(id: string, role: UserRole): string {
  return jwt.sign({ role }, JWT_SECRET, {
    subject: id,
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
