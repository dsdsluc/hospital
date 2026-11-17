import { randomInt } from 'node:crypto';
import { prisma } from '../config/database.js';

export async function generateUniqueVisitCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `VIS-${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
    const existingVisit = await prisma.medicalVisit.findUnique({
      where: { visit_code: code },
      select: { id: true },
    });
    if (!existingVisit) return code;
  }

  throw new Error('Không thể tạo visit_code duy nhất.');
}
