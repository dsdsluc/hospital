"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDosageSuggestions } from "@/lib/dosage-suggestions";

const SLOTS = ["Sáng", "Trưa", "Chiều", "Tối"] as const;
type Slot = (typeof SLOTS)[number];
type Plan = { perDose: string; perDay: string; days: string; slots: Slot[] };
type Patch = { dosage?: string; usage?: string; quantity?: string };

/** Đọc ngược chuỗi liều đã có ("1 viên × 2 lần/ngày (sáng, tối) · 5 ngày") để điền sẵn bộ tính. */
function parseDosage(text: string): Partial<Plan> {
  const result: Partial<Plan> = {};
  const value = text.toLowerCase();
  const perDose = value.match(/^\s*(\d+(?:[.,]\d+)?)/);
  if (perDose) result.perDose = perDose[1];
  const perDay = value.match(/(\d+)\s*lần\s*\/\s*ngày/);
  if (perDay) result.perDay = perDay[1];
  else if (/^\s*\d+(?:[.,]\d+)?\s*\S+\s*\/\s*ngày/.test(value)) result.perDay = "1";
  const days = value.match(/[·×]\s*(\d+)\s*ngày/);
  if (days) result.days = days[1];
  const slots = SLOTS.filter((slot) => value.includes(slot.toLowerCase()));
  if (slots.length) result.slots = slots;
  return result;
}

function planText(plan: Plan, unit: string) {
  const per = plan.perDose || "1";
  const u = unit.trim().toLowerCase();
  let text = plan.perDay === "1" ? `${per} ${u}/ngày` : `${per} ${u} × ${plan.perDay} lần/ngày`;
  if (plan.slots.length) text += ` (${plan.slots.map((slot) => slot.toLowerCase()).join(", ")})`;
  if (plan.days) text += ` · ${plan.days} ngày`;
  return text;
}

/** Số lượng = liều/lần × lần/ngày × số ngày (làm tròn lên); thiếu một trong ba thì không tính. */
function planQuantity(plan: Plan) {
  const perDose = Number(plan.perDose.replace(",", "."));
  const perDay = Number(plan.perDay);
  const days = Number(plan.days);
  return perDose > 0 && perDay > 0 && days > 0 ? Math.ceil(perDose * perDay * days) : null;
}

/**
 * Hỗ trợ nhập liều cho một dòng thuốc:
 * - B. Bộ tính liều/lần × lần/ngày × số ngày + buổi dùng → ghép chữ liều dùng và tự tính số lượng.
 * - A. Chip gợi ý liều dùng / cách dùng theo hoạt chất và đơn vị.
 * Không chặn gì: lệch số lượng chỉ cảnh báo, mọi ô vẫn sửa tay được.
 */
export function DosageAssist({ name, unit, dosage, usage, quantity, onChange, className }: {
  name: string;
  unit: string;
  dosage: string;
  usage: string;
  quantity: string;
  onChange: (patch: Patch) => void;
  className?: string;
}) {
  const suggestions = getDosageSuggestions(name, unit);
  const [plan, setPlan] = useState<Plan>(() => ({ perDose: "1", perDay: "", days: "", slots: [], ...parseDosage(dosage) }));
  const expected = planQuantity(plan);
  const mismatch = expected !== null && Number(quantity) !== expected;
  const u = unit.trim().toLowerCase();

  function applyPlan(next: Plan) {
    setPlan(next);
    if (!next.perDay) return;
    const total = planQuantity(next);
    onChange({ dosage: planText(next, unit), ...(total !== null && { quantity: String(total) }) });
  }
  function toggleSlot(slot: Slot) {
    const slots = SLOTS.filter((s) => (s === slot ? !plan.slots.includes(s) : plan.slots.includes(s)));
    applyPlan({ ...plan, slots, perDay: slots.length ? String(slots.length) : plan.perDay });
  }
  function pickDosage(text: string) {
    onChange({ dosage: text });
    setPlan((current) => ({ ...current, ...parseDosage(text) }));
  }

  return <div className={cn("space-y-2 rounded-lg bg-muted/40 px-3 py-2.5", className)}>
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-xs text-muted-foreground">
      <Calculator className="size-3.5 text-primary" />
      <NumberBox label="Liều mỗi lần" value={plan.perDose} step="0.5" onChange={(value) => applyPlan({ ...plan, perDose: value })} />
      <span>{u}/lần ×</span>
      <NumberBox label="Số lần mỗi ngày" value={plan.perDay} onChange={(value) => applyPlan({ ...plan, perDay: value })} />
      <span>lần/ngày ×</span>
      <NumberBox label="Số ngày" value={plan.days} onChange={(value) => applyPlan({ ...plan, days: value })} />
      <span>ngày</span>
      <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
      {SLOTS.map((slot) => {
        const active = plan.slots.includes(slot);
        return <button key={slot} type="button" aria-pressed={active} onClick={() => toggleSlot(slot)} className={cn("rounded-full border px-2 py-px text-[0.7rem] font-medium transition", active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/40 hover:text-primary")}>{slot}</button>;
      })}
      {expected !== null && <span className="ml-auto font-medium text-foreground">= {expected} {u}</span>}
    </div>
    {mismatch && <p className="flex flex-wrap items-center gap-2 text-[0.7rem] text-amber-800">
      Số lượng ({quantity || 0}) khác liều × số ngày ({expected}).
      <button type="button" onClick={() => onChange({ quantity: String(expected) })} className="font-semibold text-primary hover:underline">Dùng {expected}</button>
    </p>}
    <ChipRow label="Liều" items={suggestions.dosage} current={dosage} onPick={pickDosage} />
    <ChipRow label="Cách dùng" items={suggestions.usage} current={usage} onPick={(text) => onChange({ usage: text })} />
  </div>;
}

function NumberBox({ label, value, step, onChange }: { label: string; value: string; step?: string; onChange: (value: string) => void }) {
  return <input type="number" min={0} step={step ?? "1"} inputMode="decimal" aria-label={label} placeholder="–" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-12 rounded-md border bg-background px-1.5 text-center text-xs tabular-nums text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15" />;
}

function ChipRow({ label, items, current, onPick }: { label: string; items: string[]; current: string; onPick: (text: string) => void }) {
  if (items.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-1.5">
    <span className="w-16 shrink-0 text-[0.7rem] text-muted-foreground">{label}</span>
    {items.map((text) => {
      const active = current.trim() === text;
      return <button key={text} type="button" aria-pressed={active} onClick={() => onPick(text)} className={cn("rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium transition", active ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary")}>{text}</button>;
    })}
  </div>;
}
