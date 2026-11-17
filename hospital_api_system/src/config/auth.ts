import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), 'src/.env') });

const developmentSecret = 'development-only-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET là bắt buộc trong môi trường production');
}

export const JWT_SECRET = process.env.JWT_SECRET ?? developmentSecret;
export const JWT_EXPIRES_IN = '1h';
