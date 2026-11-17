/**
 * Thêm các thuốc trong danh mục (prisma/data/medicine-catalog.ts) còn thiếu trong DB.
 *
 *   npm run db:seed:medicines
 *
 * Chỉ TẠO thuốc chưa có (theo medicine_code) và gán nhóm thuốc còn thiếu.
 * Không sửa tên / tồn kho / trạng thái của thuốc đã có — khác với `npm run db:seed` (đặt lại tồn kho).
 */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { MedicineCategoryStatus, MedicineStatus, PrismaClient } from '../src/generated/prisma/client.js';
import { MEDICINE_CATEGORIES, MEDICINES } from './data/medicine-catalog.js';

dotenv.config({ path: resolve(process.cwd(), 'src/.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Không tìm thấy DATABASE_URL trong file src/.env');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const categoryIds = new Map<string, string>();
  for (const category of MEDICINE_CATEGORIES) {
    const saved = await prisma.medicineCategory.upsert({
      where: { category_code: category.code },
      update: {},
      create: { category_code: category.code, name: category.name, description: category.description, status: MedicineCategoryStatus.ACTIVE },
      select: { id: true },
    });
    categoryIds.set(category.code, saved.id);
  }

  let created = 0;
  for (const medicine of MEDICINES) {
    const existing = await prisma.medicine.findUnique({ where: { medicine_code: medicine.code }, select: { id: true } });
    const saved = existing ?? await prisma.medicine.create({
      data: { medicine_code: medicine.code, name: medicine.name, unit: medicine.unit, stock_quantity: medicine.stock, status: MedicineStatus.AVAILABLE },
      select: { id: true },
    });
    if (!existing) {
      created += 1;
      console.log(`+ ${medicine.code}  ${medicine.name} (${medicine.stock} ${medicine.unit.toLowerCase()})`);
    }

    for (const code of medicine.categories) {
      const categoryId = categoryIds.get(code);
      if (!categoryId) throw new Error(`Không tìm thấy nhóm thuốc ${code}.`);
      await prisma.medicineCategoryAssignment.upsert({
        where: { medicine_id_category_id: { medicine_id: saved.id, category_id: categoryId } },
        update: {},
        create: { medicine_id: saved.id, category_id: categoryId },
      });
    }
  }
  console.log(`Đã thêm ${created} thuốc mới (danh mục có ${MEDICINES.length} thuốc).`);
}

main()
  .catch((error: unknown) => {
    console.error('Thêm thuốc thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
