"use client";

import { Baby } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Thông tin riêng của khoa Nhi (PED-204), lưu trong `examination_records.specialty_data`.
 * Mọi trường đều không bắt buộc — bác sĩ ghi gì thì lưu nấy.
 */
export type PediatricData = {
  type: "PEDIATRICS";
  guardian: string;
  vaccination: "" | "FULL" | "INCOMPLETE" | "UNKNOWN";
  nutrition: "" | "BREASTFED" | "MIXED" | "WEANING" | "REGULAR";
  birth_term: "" | "FULL_TERM" | "PRETERM";
  birth_weight_kg: string;
  head_circumference_cm: string;
  allergies: string;
};

export const emptyPediatric: PediatricData = { type: "PEDIATRICS", guardian: "", vaccination: "", nutrition: "", birth_term: "", birth_weight_kg: "", head_circumference_cm: "", allergies: "" };

/** Đọc dữ liệu đã lưu; thiếu trường nào thì để trống. */
export function readPediatric(value: Record<string, unknown> | null | undefined): PediatricData {
  if (!value || value.type !== "PEDIATRICS") return emptyPediatric;
  const text = (key: keyof PediatricData) => (typeof value[key] === "string" ? (value[key] as string) : "");
  return {
    type: "PEDIATRICS",
    guardian: text("guardian"),
    vaccination: text("vaccination") as PediatricData["vaccination"],
    nutrition: text("nutrition") as PediatricData["nutrition"],
    birth_term: text("birth_term") as PediatricData["birth_term"],
    birth_weight_kg: text("birth_weight_kg"),
    head_circumference_cm: text("head_circumference_cm"),
    allergies: text("allergies"),
  };
}

/** Rỗng toàn bộ thì không cần lưu. */
export function isPediatricEmpty(data: PediatricData) {
  return Object.entries(data).every(([key, value]) => key === "type" || !String(value).trim());
}

/** Tuổi chính xác cho trẻ em: "18 tháng", "2 tuổi 3 tháng"; dưới 1 tháng thì tính theo ngày. */
export function formatChildAge(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getUTCFullYear()) * 12 + (now.getMonth() - birth.getUTCMonth());
  if (now.getDate() < birth.getUTCDate()) months -= 1;
  if (months < 1) return `${Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86_400_000))} ngày tuổi`;
  if (months < 24) return `${months} tháng tuổi`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} tuổi ${rest} tháng` : `${years} tuổi`;
}

function ageInMonths(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - birth.getUTCFullYear()) * 12 + (now.getMonth() - birth.getUTCMonth());
}

const vaccinationOptions: Array<[PediatricData["vaccination"], string]> = [["FULL", "Đủ theo lịch"], ["INCOMPLETE", "Chưa đủ"], ["UNKNOWN", "Không rõ"]];
const nutritionOptions: Array<[PediatricData["nutrition"], string]> = [["BREASTFED", "Bú mẹ hoàn toàn"], ["MIXED", "Bú mẹ + sữa công thức"], ["WEANING", "Ăn dặm"], ["REGULAR", "Ăn như người lớn"]];
const birthOptions: Array<[PediatricData["birth_term"], string]> = [["FULL_TERM", "Đủ tháng"], ["PRETERM", "Non tháng"]];

export function PediatricSection({ value, onChange, dateOfBirth }: { value: PediatricData; onChange: (next: PediatricData) => void; dateOfBirth: string | null | undefined }) {
  const set = <K extends keyof PediatricData>(key: K, next: PediatricData[K]) => onChange({ ...value, [key]: next });
  const age = formatChildAge(dateOfBirth);
  const months = ageInMonths(dateOfBirth);
  // Vòng đầu thường chỉ theo dõi ở trẻ dưới 3 tuổi; không rõ tuổi thì vẫn hiện.
  const showHead = months === null || months < 36;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700"><Baby className="size-3.5" /> {age ?? "Chưa có ngày sinh"}</span>
      <span className="text-muted-foreground">Các mục đều không bắt buộc.</span>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Người đưa trẻ đi khám">
        <Input value={value.guardian} onChange={(e) => set("guardian", e.target.value)} placeholder="Ví dụ: Mẹ — Nguyễn Thị B" className="h-9 rounded-lg bg-background" />
      </Field>
      <Field label="Dị ứng (thuốc, thức ăn)">
        <Input value={value.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Chưa ghi nhận" className="h-9 rounded-lg bg-background" />
      </Field>
    </div>

    <Chips label="Tiêm chủng" options={vaccinationOptions} value={value.vaccination} onChange={(next) => set("vaccination", next)} />
    <Chips label="Dinh dưỡng" options={nutritionOptions} value={value.nutrition} onChange={(next) => set("nutrition", next)} />

    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <Chips label="Tiền sử sinh" options={birthOptions} value={value.birth_term} onChange={(next) => set("birth_term", next)} />
      <Field label="Cân nặng lúc sinh" className="w-32">
        <Unit unit="kg"><Input type="number" min={0} step="0.1" inputMode="decimal" value={value.birth_weight_kg} onChange={(e) => set("birth_weight_kg", e.target.value)} placeholder="3.2" className="h-9 rounded-lg bg-background pr-8 tabular-nums" /></Unit>
      </Field>
      {showHead && <Field label="Vòng đầu" className="w-32">
        <Unit unit="cm"><Input type="number" min={0} step="0.1" inputMode="decimal" value={value.head_circumference_cm} onChange={(e) => set("head_circumference_cm", e.target.value)} placeholder="46" className="h-9 rounded-lg bg-background pr-9 tabular-nums" /></Unit>
      </Field>}
    </div>
  </div>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={cn("block space-y-1.5", className)}><span className="block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function Unit({ unit, children }: { unit: string; children: React.ReactNode }) {
  return <div className="relative">{children}<span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span></div>;
}

/** Nhóm chip chọn một; bấm lại chip đang chọn để bỏ chọn. */
function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: Array<[T, string]>; value: T | ""; onChange: (next: T | "") => void }) {
  return <div className="space-y-1.5">
    <span className="block text-xs font-medium text-muted-foreground">{label}</span>
    <div className="flex flex-wrap gap-1.5">{options.map(([key, text]) => {
      const active = value === key;
      return <button key={key} type="button" aria-pressed={active} onClick={() => onChange(active ? "" : key)} className={cn("h-9 rounded-full border px-3 text-xs font-medium transition", active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary")}>{text}</button>;
    })}</div>
  </div>;
}
