/**
 * Điền bảng giá thuốc (medicine_prices), đơn vị VND cho 1 đơn vị tính của thuốc (Viên, Gói...).
 *
 *   npm run db:seed:medicine-prices
 *
 * Chạy lại an toàn: upsert theo (medicine_id, effective_from) — chỉ cập nhật đơn giá / ghi chú của đúng
 * phiên bản giá này, không đụng tới bảng khác (kể cả tồn kho).
 * Giá là giá tham khảo cho hệ thống, cần đối chiếu và cập nhật theo bảng giá chính thức của nhà thuốc.
 */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

dotenv.config({ path: resolve(process.cwd(), 'src/.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Không tìm thấy DATABASE_URL trong file src/.env');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

/** Ngày bắt đầu hiệu lực của bảng giá này (trùng với bảng giá dịch vụ). */
const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

/** medicine_code → đơn giá (VND / đơn vị tính). */
const prices: Record<string, number> = {
  'MED-0001': 1_000, // Paracetamol 500mg — Viên
  'MED-0002': 2_000, // Ibuprofen 400mg — Viên
  'MED-0003': 500, // Chlorpheniramine 4mg — Viên
  'MED-0004': 2_500, // Loratadine 10mg — Viên
  'MED-0005': 2_000, // Omeprazole 20mg — Viên
  'MED-0006': 3_500, // Oresol ORS — Gói
  'MED-0007': 1_500, // Amoxicillin 500mg — Viên
  'MED-0008': 12_000, // Azithromycin 500mg — Viên
  'MED-0009': 800, // Dextromethorphan 15mg — Viên
  'MED-0010': 2_500, // Acetylcysteine 200mg — Gói
  'MED-0011': 1_500, // Cetirizine 10mg — Viên
  'MED-0012': 1_200, // Domperidone 10mg — Viên
  'MED-0013': 4_000, // Diosmectite 3g (Smecta) — Gói
  'MED-0014': 9_000, // Cefuroxime 500mg — Viên
  'MED-0015': 3_000, // Ciprofloxacin 500mg — Viên
  'MED-0016': 3_500, // Paracetamol 500mg sủi — Viên
  'MED-0017': 1_000, // Diclofenac 50mg — Viên
  'MED-0018': 1_200, // Ambroxol 30mg — Viên
  'MED-0019': 6_000, // Fexofenadine 180mg — Viên
  'MED-0020': 7_000, // Esomeprazole 40mg — Viên
};

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

async function main() {
  const medicines = await prisma.medicine.findMany({ orderBy: { medicine_code: 'asc' }, select: { id: true, medicine_code: true, name: true, unit: true } });
  const missing: string[] = [];

  for (const medicine of medicines) {
    const price = prices[medicine.medicine_code];
    if (price == null) {
      missing.push(`${medicine.medicine_code} (${medicine.name})`);
      continue;
    }
    await prisma.medicinePrice.upsert({
      where: { medicine_id_effective_from: { medicine_id: medicine.id, effective_from: EFFECTIVE_FROM } },
      update: { unit_price: price },
      create: { medicine_id: medicine.id, unit_price: price, effective_from: EFFECTIVE_FROM },
    });
    console.log(`${medicine.medicine_code}  ${medicine.name.padEnd(24)} ${vnd.format(price).padStart(10)} / ${medicine.unit}`);
  }

  console.log(`Đã cập nhật giá cho ${medicines.length - missing.length}/${medicines.length} thuốc.`);
  // Chỉ cảnh báo, không chặn: thuốc mới thêm mà chưa có giá thì bổ sung vào danh sách `prices` ở trên.
  if (missing.length) console.warn(`Chưa có giá: ${missing.join(', ')}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed bảng giá thuốc thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
