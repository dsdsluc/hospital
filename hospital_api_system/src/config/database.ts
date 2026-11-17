import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from './logger.js';

dotenv.config({ path: resolve(process.cwd(), 'src/.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Không tìm thấy DATABASE_URL trong file src/.env');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

export const prisma = new PrismaClient({ adapter });

export async function connectDatabase(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;

    logger.info('Kết nối database thành công.');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Không kết nối database thành công.');
    return false;
  }
}
