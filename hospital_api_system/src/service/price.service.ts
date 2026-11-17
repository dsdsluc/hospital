import { prisma } from '../config/database.js';

/** Hôm nay (giờ Việt Nam) dạng Date 00:00 UTC — so sánh với cột @db.Date. */
export function todayDate() {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(`${key}T00:00:00.000Z`);
}

/** Điều kiện "đang có hiệu lực": effective_from <= hôm nay và (chưa có effective_to hoặc effective_to >= hôm nay). */
export function activeOn(date: Date) {
  return { effective_from: { lte: date }, OR: [{ effective_to: null }, { effective_to: { gte: date } }] };
}

/** Bảng giá dịch vụ đang áp dụng (mỗi mã dịch vụ lấy phiên bản giá mới nhất còn hiệu lực). */
export async function findCurrentServicePrices() {
  const today = todayDate();
  const rows = await prisma.servicePrice.findMany({
    where: activeOn(today),
    orderBy: [{ service_code: 'asc' }, { effective_from: 'desc' }],
    select: {
      id: true, service_code: true, name: true, category: true, unit: true, unit_price: true,
      effective_from: true, effective_to: true, note: true,
      room_function: { select: { function_code: true, name: true, rooms: { select: { room_code: true }, orderBy: { room_code: 'asc' } } } },
    },
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.service_code)) latest.set(row.service_code, row);
  return [...latest.values()].map((row) => ({
    id: row.id,
    service_code: row.service_code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    unit_price: row.unit_price,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    note: row.note,
    room_function: row.room_function
      ? { function_code: row.room_function.function_code, name: row.room_function.name, room_codes: row.room_function.rooms.map((room) => room.room_code) }
      : null,
  }));
}

/** Bảng giá thuốc đang áp dụng, kèm nhóm thuốc, tồn kho, trạng thái. Thuốc chưa có giá vẫn trả về với unit_price = null. */
export async function findCurrentMedicinePrices() {
  const today = todayDate();
  const medicines = await prisma.medicine.findMany({
    orderBy: { medicine_code: 'asc' },
    select: {
      id: true, medicine_code: true, name: true, unit: true, stock_quantity: true, status: true,
      categories: { select: { category: { select: { category_code: true, name: true } } } },
      prices: { where: activeOn(today), orderBy: { effective_from: 'desc' }, take: 1, select: { unit_price: true, effective_from: true, effective_to: true, note: true } },
    },
  });
  return medicines.map((medicine) => {
    const price = medicine.prices[0] ?? null;
    return {
      id: medicine.id,
      medicine_code: medicine.medicine_code,
      name: medicine.name,
      unit: medicine.unit,
      stock_quantity: medicine.stock_quantity,
      status: medicine.status,
      categories: medicine.categories.map((item) => item.category),
      unit_price: price?.unit_price ?? null,
      effective_from: price?.effective_from ?? null,
      effective_to: price?.effective_to ?? null,
      note: price?.note ?? null,
    };
  });
}
