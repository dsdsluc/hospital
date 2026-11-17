/**
 * Tách kết quả phòng chức năng (lưu dạng văn bản "Nhãn: giá trị", mỗi dòng một mục)
 * thành dữ liệu có cấu trúc để hiển thị cho bệnh nhân.
 *
 * Định dạng văn bản do các workspace của bác sĩ tạo ra:
 * - laboratory-workspace.tsx  (xét nghiệm huyết học)
 * - electrocardiogram-workspace.tsx (điện tim)
 * - diagnostic-workspace.tsx (siêu âm, X-quang, CT, ...)
 */

export type MeasurementFlag = 'LOW' | 'NORMAL' | 'HIGH';

export interface ClinicalMeasurement {
  label: string;
  description: string;
  value: string;
  unit: string | null;
  reference: string | null;
  flag: MeasurementFlag | null;
}

export interface ClinicalDetail {
  label: string;
  value: string;
}

export interface ParsedClinicalResult {
  measurements: ClinicalMeasurement[];
  details: ClinicalDetail[];
  findings: string | null;
  conclusion: string | null;
}

interface MeasurementDefinition {
  description: string;
  unit: string;
  /** Khoảng tham chiếu chung cho người trưởng thành, chỉ mang tính tham khảo. */
  low?: number;
  high?: number;
  referenceText?: string;
}

const MEASUREMENTS: Record<string, MeasurementDefinition> = {
  WBC: { description: 'Số lượng bạch cầu', unit: 'G/L', low: 4, high: 10 },
  RBC: { description: 'Số lượng hồng cầu', unit: 'T/L', low: 3.8, high: 5.8 },
  HGB: { description: 'Lượng huyết sắc tố', unit: 'g/dL', low: 12, high: 17 },
  HCT: { description: 'Thể tích khối hồng cầu', unit: '%', low: 36, high: 50 },
  PLT: { description: 'Số lượng tiểu cầu', unit: 'G/L', low: 150, high: 400 },
  NEU: { description: 'Tỷ lệ bạch cầu trung tính', unit: '%', low: 40, high: 75 },
  LYM: { description: 'Tỷ lệ bạch cầu lympho', unit: '%', low: 20, high: 45 },
  'Tần số tim': { description: 'Số nhịp tim mỗi phút', unit: 'bpm', low: 60, high: 100 },
  PR: { description: 'Khoảng dẫn truyền nhĩ – thất', unit: 'ms', low: 120, high: 200 },
  QRS: { description: 'Thời gian khử cực thất', unit: 'ms', low: 70, high: 110 },
  'QT/QTc': { description: 'Khoảng QT và QT hiệu chỉnh', unit: 'ms', referenceText: 'QTc < 450 ms' },
};

const DETAIL_LABELS = new Set([
  'Loại xét nghiệm',
  'Mẫu bệnh phẩm',
  'Loại thực hiện',
  'Kỹ thuật / thiết bị',
  'Kỹ thuật thực hiện',
  'Thiết bị',
  'Vùng siêu âm',
  'Vị trí chụp',
  'Vùng khảo sát',
  'Nhịp tim',
  'Trục tim',
  'Biến đổi ST–T',
]);

const FINDINGS_LABELS = new Set(['Ghi chú kết quả', 'Mô tả kết quả']);
const CONCLUSION_LABEL = 'Kết luận chuyên môn';

const KNOWN_LABELS = new Set([
  ...Object.keys(MEASUREMENTS),
  ...DETAIL_LABELS,
  ...FINDINGS_LABELS,
  CONCLUSION_LABEL,
]);

function formatRange(definition: MeasurementDefinition) {
  if (definition.referenceText) return definition.referenceText;
  if (definition.low === undefined || definition.high === undefined) return null;
  return `${definition.low} – ${definition.high} ${definition.unit}`;
}

function toMeasurement(label: string, rawValue: string): ClinicalMeasurement {
  const definition = MEASUREMENTS[label]!;
  const value = rawValue.endsWith(` ${definition.unit}`)
    ? rawValue.slice(0, -definition.unit.length - 1).trim()
    : rawValue.trim();
  const numericValue = /^-?\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(',', '.')) : Number.NaN;
  let flag: MeasurementFlag | null = null;

  if (!Number.isNaN(numericValue) && definition.low !== undefined && definition.high !== undefined) {
    flag = numericValue < definition.low ? 'LOW' : numericValue > definition.high ? 'HIGH' : 'NORMAL';
  }

  return {
    label,
    description: definition.description,
    value,
    unit: definition.unit,
    reference: formatRange(definition),
    flag,
  };
}

export function parseClinicalResult(text: string): ParsedClinicalResult {
  // Gom các dòng thành từng mục; dòng không có nhãn đã biết là phần tiếp theo của mục trước
  // (ví dụ: mô tả kết quả nhiều dòng).
  const entries: Array<{ label: string | null; value: string }> = [];

  for (const line of text.split(/\r?\n/)) {
    const match = /^([^:]{1,40}):\s?(.*)$/.exec(line);
    const label = match?.[1]?.trim();

    if (match && label && KNOWN_LABELS.has(label)) {
      entries.push({ label, value: match[2] ?? '' });
    } else if (entries.length > 0) {
      entries[entries.length - 1]!.value += `\n${line}`;
    } else if (line.trim()) {
      entries.push({ label: null, value: line });
    }
  }

  const result: ParsedClinicalResult = { measurements: [], details: [], findings: null, conclusion: null };
  const unlabeled: string[] = [];

  for (const { label, value: rawValue } of entries) {
    const value = rawValue.trim();
    if (!value) continue;

    if (!label) unlabeled.push(value);
    else if (label in MEASUREMENTS) result.measurements.push(toMeasurement(label, value));
    else if (DETAIL_LABELS.has(label)) result.details.push({ label, value });
    else if (FINDINGS_LABELS.has(label)) result.findings = value;
    else if (label === CONCLUSION_LABEL) result.conclusion = value;
  }

  // Kết quả cũ hoặc nhập tự do không theo mẫu: hiển thị toàn bộ như phần mô tả.
  if (unlabeled.length > 0) {
    result.findings = [unlabeled.join('\n'), result.findings].filter(Boolean).join('\n');
  }

  return result;
}
