"use client";

import { Activity, Droplet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Chips, Field, Group, MultiChips, Unit, str, strList } from "@/components/doctor/workspaces/specialty/ui";

/** Khám nội khoa / bệnh mạn tính (INT-203), lưu trong `specialty_data` với type "INTERNAL". */
export type InternalData = {
  type: "INTERNAL";
  conditions: string[];
  other_conditions: string;
  glucose_fasting: string;
  glucose_random: string;
  hba1c: string;
  home_bp: string;
  current_medications: string;
  adherence: string;
};

export const emptyInternal: InternalData = { type: "INTERNAL", conditions: [], other_conditions: "", glucose_fasting: "", glucose_random: "", hba1c: "", home_bp: "", current_medications: "", adherence: "" };

const conditionOptions = ["Tăng huyết áp", "Đái tháo đường", "Rối loạn mỡ máu", "Gout", "Bệnh thận mạn", "Suy tim", "Bệnh mạch vành", "COPD", "Hen phế quản", "Bệnh tuyến giáp"];
const adherenceOptions = ["Đều đặn", { value: "Không đều", warn: true }, { value: "Đã tự ngưng", warn: true }, "Chưa dùng thuốc"];

export function readInternal(value: Record<string, unknown> | null | undefined): InternalData {
  if (!value || value.type !== "INTERNAL") return emptyInternal;
  return {
    type: "INTERNAL", conditions: strList(value.conditions), other_conditions: str(value.other_conditions),
    glucose_fasting: str(value.glucose_fasting), glucose_random: str(value.glucose_random), hba1c: str(value.hba1c),
    home_bp: str(value.home_bp), current_medications: str(value.current_medications), adherence: str(value.adherence),
  };
}

export function isInternalEmpty(data: InternalData) {
  return JSON.stringify(data) === JSON.stringify(emptyInternal);
}

type Hint = { text: string; tone: "ok" | "warn" } | null;
const num = (value: string) => { const n = Number(value.replace(",", ".")); return value.trim() && !Number.isNaN(n) ? n : null; };

/** Nhận xét tham khảo so với mục tiêu thường dùng — chỉ hiển thị, không chặn. */
function fastingHint(value: string): Hint {
  const n = num(value); if (n === null) return null;
  return n < 3.9 ? { text: "Thấp", tone: "warn" } : n <= 7 ? { text: "Trong mục tiêu", tone: "ok" } : { text: "Trên mục tiêu", tone: "warn" };
}
function randomHint(value: string): Hint {
  const n = num(value); if (n === null) return null;
  return n < 3.9 ? { text: "Thấp", tone: "warn" } : n < 11.1 ? { text: "Chưa vượt ngưỡng", tone: "ok" } : { text: "≥ 11,1", tone: "warn" };
}
function hba1cHint(value: string): Hint {
  const n = num(value); if (n === null) return null;
  return n < 7 ? { text: "Trong mục tiêu", tone: "ok" } : { text: "Trên mục tiêu", tone: "warn" };
}

export function InternalSection({ value, onChange, clinicBp }: { value: InternalData; onChange: (next: InternalData) => void; clinicBp: { systolic: number | null; diastolic: number | null } }) {
  const set = <K extends keyof InternalData>(key: K, next: InternalData[K]) => onChange({ ...value, [key]: next });
  const hasHypertension = value.conditions.includes("Tăng huyết áp");
  const bpText = clinicBp.systolic && clinicBp.diastolic ? `${clinicBp.systolic}/${clinicBp.diastolic}` : null;
  const bpAbove = clinicBp.systolic != null && clinicBp.diastolic != null && (clinicBp.systolic >= 130 || clinicBp.diastolic >= 80);

  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">Mục tiêu chỉ để tham khảo. Các mục đều không bắt buộc.</p>

    <Group title="Bệnh mạn tính đang theo dõi">
      <MultiChips options={conditionOptions} value={value.conditions} onChange={(next) => set("conditions", next)} />
      <Field label="Bệnh khác"><Input value={value.other_conditions} onChange={(e) => set("other_conditions", e.target.value)} placeholder="Ví dụ: Viêm gan B, rung nhĩ..." className="h-9 rounded-lg" /></Field>
    </Group>

    <div className="grid gap-4 xl:grid-cols-2">
      <Group title="Huyết áp" aside={<Activity className="size-4 text-primary" />}>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/45 px-3 py-2.5 text-sm">
          <span className="text-xs text-muted-foreground">Đo tại tiếp nhận</span>
          <span className="font-semibold tabular-nums">{bpText ?? "—"}{bpText && <span className="ml-1 text-xs font-normal text-muted-foreground">mmHg</span>}</span>
          {bpText && hasHypertension && <HintBadge hint={bpAbove ? { text: "Trên mục tiêu < 130/80", tone: "warn" } : { text: "Trong mục tiêu", tone: "ok" }} />}
        </div>
        <Field label="Huyết áp tự đo ở nhà (gần đây)"><Input value={value.home_bp} onChange={(e) => set("home_bp", e.target.value)} placeholder="Ví dụ: 135–145 / 85–90, buổi sáng" className="h-9 rounded-lg" /></Field>
      </Group>

      <Group title="Đường huyết" aside={<Droplet className="size-4 text-primary" />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField label="Lúc đói" unit="mmol/L" value={value.glucose_fasting} onChange={(next) => set("glucose_fasting", next)} hint={fastingHint(value.glucose_fasting)} placeholder="6.5" />
          <NumberField label="Bất kỳ / mao mạch" unit="mmol/L" value={value.glucose_random} onChange={(next) => set("glucose_random", next)} hint={randomHint(value.glucose_random)} placeholder="8.2" />
          <NumberField label="HbA1c" unit="%" value={value.hba1c} onChange={(next) => set("hba1c", next)} hint={hba1cHint(value.hba1c)} placeholder="7.1" />
        </div>
      </Group>
    </div>

    <Group title="Thuốc đang dùng">
      <Textarea rows={3} value={value.current_medications} onChange={(e) => set("current_medications", e.target.value)} placeholder="Ví dụ: Amlodipin 5 mg 1 viên sáng; Metformin 850 mg 1 viên × 2 lần/ngày" className="rounded-xl" />
      <Chips label="Tuân thủ điều trị" options={adherenceOptions} value={value.adherence} onChange={(next) => set("adherence", next)} />
    </Group>
  </div>;
}

function NumberField({ label, unit, value, onChange, hint, placeholder }: { label: string; unit: string; value: string; onChange: (next: string) => void; hint: Hint; placeholder: string }) {
  return <Field label={label}>
    <Unit unit={unit}><Input type="number" min={0} step="0.1" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn("h-9 rounded-lg tabular-nums", unit.length > 2 ? "pr-16" : "pr-8", hint?.tone === "warn" && "border-amber-300")} /></Unit>
    {hint && <HintBadge hint={hint} />}
  </Field>;
}

function HintBadge({ hint }: { hint: NonNullable<Hint> }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-medium", hint.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800")}>{hint.text}</span>;
}
