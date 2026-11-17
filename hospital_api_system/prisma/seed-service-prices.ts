/**
 * Điền bảng giá dịch vụ (service_prices), đơn vị VND.
 *
 *   npm run db:seed:prices
 *
 * Chạy lại an toàn: upsert theo (service_code, effective_from) — chỉ cập nhật tên / đơn giá / ghi chú
 * của đúng phiên bản giá này, không đụng tới bảng khác.
 * Giá là giá tham khảo cho hệ thống, cần đối chiếu và cập nhật theo bảng giá chính thức của bệnh viện.
 */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ServiceCategory } from '../src/generated/prisma/client.js';

dotenv.config({ path: resolve(process.cwd(), 'src/.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Không tìm thấy DATABASE_URL trong file src/.env');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

/** Ngày bắt đầu hiệu lực của bảng giá này. */
const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

type PriceSeed = {
  code: string;
  name: string;
  category: ServiceCategory;
  /** function_code của RoomFunction (null = không gắn phòng cụ thể). */
  roomFunction: string | null;
  unit: string;
  price: number;
  note?: string;
};

const prices: PriceSeed[] = [
  // Khám bệnh ngoại trú (tầng 2)
  { code: 'EXAM-GENERAL', name: 'Khám tổng quát', category: 'EXAMINATION', roomFunction: 'GENERAL_EXAMINATION', unit: 'lần', price: 150_000 },
  { code: 'EXAM-INTERNAL', name: 'Khám nội khoa', category: 'EXAMINATION', roomFunction: 'INTERNAL_MEDICINE', unit: 'lần', price: 150_000 },
  { code: 'EXAM-PEDIATRICS', name: 'Khám nhi', category: 'EXAMINATION', roomFunction: 'PEDIATRICS', unit: 'lần', price: 150_000 },
  { code: 'EXAM-ENT', name: 'Khám tai mũi họng', category: 'EXAMINATION', roomFunction: 'ENT', unit: 'lần', price: 180_000 },
  { code: 'EXAM-DERMATOLOGY', name: 'Khám da liễu', category: 'EXAMINATION', roomFunction: 'DERMATOLOGY', unit: 'lần', price: 150_000 },

  // Chẩn đoán hình ảnh, xét nghiệm, thăm dò chức năng (tầng 1, 3)
  { code: 'IMG-ULTRASOUND', name: 'Siêu âm tổng quát', category: 'IMAGING', roomFunction: 'ULTRASOUND', unit: 'lần', price: 250_000 },
  { code: 'IMG-XRAY', name: 'Chụp X-quang (1 tư thế)', category: 'IMAGING', roomFunction: 'X_RAY', unit: 'lần', price: 150_000 },
  { code: 'IMG-CT', name: 'Chụp CT không tiêm thuốc cản quang', category: 'IMAGING', roomFunction: 'CT_SCAN', unit: 'lần', price: 1_200_000 },
  { code: 'LAB-SAMPLE', name: 'Lấy mẫu xét nghiệm', category: 'LABORATORY', roomFunction: 'SAMPLE_COLLECTION', unit: 'lần', price: 30_000 },
  { code: 'LAB-BLOOD', name: 'Xét nghiệm máu (công thức máu + sinh hóa cơ bản)', category: 'LABORATORY', roomFunction: 'BLOOD_TEST', unit: 'lần', price: 320_000 },
  { code: 'FUNC-ECG', name: 'Điện tim thường', category: 'FUNCTIONAL_TEST', roomFunction: 'ECG', unit: 'lần', price: 100_000 },

  // Cấp cứu (ER-102)
  { code: 'ER-EXAM', name: 'Khám cấp cứu', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 250_000 },
  { code: 'ER-INT-IV_ACCESS', name: 'Thiết lập đường truyền tĩnh mạch', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 120_000 },
  { code: 'ER-INT-OXYGEN', name: 'Thở oxy', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 80_000 },
  { code: 'ER-INT-MONITORING', name: 'Theo dõi monitor liên tục', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 200_000 },
  { code: 'ER-INT-BLEEDING_CONTROL', name: 'Kiểm soát chảy máu', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 300_000 },
  { code: 'ER-INT-EMERGENCY_MEDICATION', name: 'Tiêm / truyền thuốc cấp cứu', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 50_000, note: 'Chỉ là công thực hiện, tiền thuốc tính riêng theo đơn.' },
  { code: 'ER-INT-CPR', name: 'Hồi sinh tim phổi', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 1_500_000 },
  { code: 'ER-INT-AIRWAY', name: 'Kiểm soát đường thở (đặt nội khí quản)', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 900_000 },
  { code: 'ER-INT-OTHER', name: 'Thủ thuật cấp cứu khác', category: 'EMERGENCY', roomFunction: 'EMERGENCY', unit: 'lần', price: 150_000 },

  // Chỉ định khẩn trước mổ (PRE-503)
  { code: 'PREP-BLOOD_TEST', name: 'Xét nghiệm máu khẩn trước phẫu thuật', category: 'LABORATORY', roomFunction: 'PREOPERATIVE', unit: 'lần', price: 380_000 },
  { code: 'PREP-ULTRASOUND', name: 'Siêu âm khẩn', category: 'IMAGING', roomFunction: 'PREOPERATIVE', unit: 'lần', price: 300_000 },
  { code: 'PREP-CT_SCAN', name: 'Chụp CT khẩn', category: 'IMAGING', roomFunction: 'PREOPERATIVE', unit: 'lần', price: 1_500_000 },

  // Phẫu thuật, hồi sức, lưu trú (tầng 4, 5)
  { code: 'SURG-EMERGENCY', name: 'Phẫu thuật cấp cứu (gói cơ bản)', category: 'SURGERY', roomFunction: 'SURGERY', unit: 'ca', price: 12_000_000, note: 'Chưa gồm vật tư tiêu hao và thuốc.' },
  { code: 'BED-RECOVERY', name: 'Theo dõi hồi tỉnh sau phẫu thuật', category: 'BED_DAY', roomFunction: 'RECOVERY', unit: 'lượt', price: 600_000 },
  { code: 'BED-ICU', name: 'Giường hồi sức tích cực', category: 'BED_DAY', roomFunction: 'ICU', unit: 'ngày', price: 2_200_000 },
  { code: 'BED-INPATIENT', name: 'Giường điều trị nội trú', category: 'BED_DAY', roomFunction: 'INPATIENT', unit: 'ngày', price: 350_000 },
  { code: 'BED-OBSERVATION', name: 'Giường theo dõi', category: 'BED_DAY', roomFunction: 'OBSERVATION', unit: 'ngày', price: 300_000 },
  { code: 'BED-ISOLATION', name: 'Giường cách ly', category: 'BED_DAY', roomFunction: 'ISOLATION', unit: 'ngày', price: 650_000 },
];

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

async function main() {
  const functions = await prisma.roomFunction.findMany({ select: { id: true, function_code: true } });
  const functionIds = new Map(functions.map((item) => [item.function_code, item.id]));

  for (const item of prices) {
    const roomFunctionId = item.roomFunction ? functionIds.get(item.roomFunction) : null;
    if (item.roomFunction && !roomFunctionId) throw new Error(`Chưa có chức năng phòng ${item.roomFunction}. Hãy chạy \`npm run db:seed\` trước.`);

    const data = {
      name: item.name,
      category: item.category,
      room_function_id: roomFunctionId ?? null,
      unit: item.unit,
      unit_price: item.price,
      note: item.note ?? null,
    };
    await prisma.servicePrice.upsert({
      where: { service_code_effective_from: { service_code: item.code, effective_from: EFFECTIVE_FROM } },
      update: data,
      create: { service_code: item.code, effective_from: EFFECTIVE_FROM, ...data },
    });
    console.log(`${item.code.padEnd(30)} ${vnd.format(item.price).padStart(16)} / ${item.unit}`);
  }
  console.log(`Đã cập nhật ${prices.length} dịch vụ trong bảng giá.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed bảng giá thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
