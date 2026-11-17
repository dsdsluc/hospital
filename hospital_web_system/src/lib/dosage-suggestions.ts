/**
 * Gợi ý liều dùng / cách dùng khi kê đơn (chỉ là chip bấm nhanh, không tự điền, không chặn).
 * Dựa theo hoạt chất trong tên thuốc, sau đó bổ sung theo đơn vị (viên, gói, ống, chai...).
 */
export type DosageSuggestions = { dosage: string[]; usage: string[] };

const MAX_CHIPS = 4;

/** Gợi ý theo hoạt chất / nhóm thuốc nhận ra từ tên. */
const ingredientRules: Array<{ match: RegExp } & DosageSuggestions> = [
  {
    // Giảm đau, hạ sốt
    match: /paracetamol|acetaminophen|efferalgan|panadol|hapacol/,
    dosage: ["1 viên khi sốt > 38,5°C, cách ≥ 4–6 giờ", "1 viên × 3 lần/ngày"],
    usage: ["Uống khi đau / sốt", "Uống sau ăn"],
  },
  {
    // Kháng viêm giảm đau không steroid
    match: /ibuprofen|diclofenac|meloxicam|naproxen/,
    dosage: ["1 viên × 2 lần/ngày", "1 viên × 3 lần/ngày", "1 viên khi đau"],
    usage: ["Uống ngay sau ăn no", "Không dùng khi đau dạ dày"],
  },
  {
    // Kháng sinh dùng 1 lần/ngày
    match: /azithromycin/,
    dosage: ["1 viên/ngày", "1 viên/ngày × 3 ngày"],
    usage: ["Uống trước ăn 1 giờ hoặc sau ăn 2 giờ", "Uống đủ liệu trình, không tự ngưng"],
  },
  {
    // Kháng sinh
    match: /amoxicillin|augmentin|cef|ciprofloxacin|levofloxacin|metronidazol|clarithromycin/,
    dosage: ["1 viên × 2 lần/ngày, cách 12 giờ", "1 viên × 3 lần/ngày, cách 8 giờ"],
    usage: ["Uống đủ liệu trình, không tự ngưng", "Uống sau ăn"],
  },
  {
    // Ức chế bơm proton (dạ dày)
    match: /omeprazol|esomeprazol|pantoprazol|lansoprazol|rabeprazol/,
    dosage: ["1 viên/ngày", "1 viên × 2 lần/ngày"],
    usage: ["Uống trước ăn sáng 30 phút", "Uống trước ăn sáng và tối 30 phút"],
  },
  {
    // Kháng histamin (dị ứng)
    match: /loratadin|chlorpheniramin|cetirizin|fexofenadin|desloratadin/,
    dosage: ["1 viên/ngày", "1 viên × 2 lần/ngày"],
    usage: ["Uống buổi tối (có thể gây buồn ngủ)", "Không lái xe sau khi uống"],
  },
  {
    // Bù nước điện giải
    match: /oresol|\bors\b/,
    dosage: ["1 gói sau mỗi lần đi ngoài", "1 gói × 3 lần/ngày"],
    usage: ["Pha đúng 200 ml nước chín, dùng trong 24 giờ", "Uống từng ngụm nhỏ"],
  },
  {
    // Long đờm
    match: /acetylcystein|ambroxol|bromhexin|carbocistein/,
    dosage: ["1 gói × 3 lần/ngày", "1 viên × 3 lần/ngày"],
    usage: ["Pha với nước, uống sau ăn", "Uống nhiều nước"],
  },
  {
    // Giảm ho
    match: /dextromethorphan|codein|terpin/,
    dosage: ["1 viên × 3 lần/ngày", "1 viên trước khi ngủ"],
    usage: ["Uống sau ăn", "Dùng khi ho nhiều"],
  },
];

/** Gợi ý chung theo đơn vị thuốc. */
function unitSuggestions(unit: string): DosageSuggestions {
  const u = unit.trim().toLowerCase();
  if (/viên|vien|tablet|capsule/.test(u)) return {
    dosage: ["1 viên × 2 lần/ngày", "1 viên × 3 lần/ngày", "1 viên/ngày", "1 viên khi cần"],
    usage: ["Uống sau ăn", "Uống trước ăn 30 phút", "Uống buổi tối"],
  };
  if (/gói|goi|sachet/.test(u)) return {
    dosage: ["1 gói × 2 lần/ngày", "1 gói × 3 lần/ngày"],
    usage: ["Pha với 100–200 ml nước", "Uống sau ăn"],
  };
  if (/ống|lọ|ampoule|vial/.test(u)) return {
    dosage: [`1 ${u} × 2 lần/ngày`, `1 ${u}/ngày`],
    usage: ["Tiêm tĩnh mạch chậm", "Tiêm bắp", "Pha truyền tĩnh mạch"],
  };
  if (/chai|túi|tui|bag/.test(u)) return {
    dosage: [`1 ${u}/ngày`, `2 ${u}/ngày`],
    usage: ["Truyền tĩnh mạch XX giọt/phút"],
  };
  if (/tuýp|tuyp|tube/.test(u)) return {
    dosage: ["Bôi 2 lần/ngày", "Bôi 3 lần/ngày"],
    usage: ["Bôi lớp mỏng lên vùng tổn thương"],
  };
  if (/ml|siro|syrup/.test(u)) return {
    dosage: ["5 ml × 3 lần/ngày", "10 ml × 2 lần/ngày"],
    usage: ["Lắc đều trước khi uống", "Uống sau ăn"],
  };
  const label = u || "đơn vị";
  return { dosage: [`1 ${label} × 2 lần/ngày`, `1 ${label}/ngày`], usage: ["Theo hướng dẫn của bác sĩ"] };
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function getDosageSuggestions(name: string, unit: string): DosageSuggestions {
  const key = normalize(name);
  const byIngredient = ingredientRules.find((rule) => rule.match.test(key));
  const byUnit = unitSuggestions(unit);
  const merge = (first: string[] = [], second: string[]) => [...new Set([...first, ...second])].slice(0, MAX_CHIPS);
  return { dosage: merge(byIngredient?.dosage, byUnit.dosage), usage: merge(byIngredient?.usage, byUnit.usage) };
}
