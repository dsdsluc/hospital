"use client";

import { useState, type ComponentType } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPlus,
  DoorOpen,
  HeartPulse,
  LoaderCircle,
  Ruler,
  Stethoscope,
  Thermometer,
  Weight,
  Wind,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const examinationRooms = [
  { code: "GEN-201", name: "Khám tổng quát 1", function: "Khám tổng quát", floor: "Tầng 2" },
  { code: "GEN-202", name: "Khám tổng quát 2", function: "Khám tổng quát", floor: "Tầng 2" },
  { code: "INT-203", name: "Khám nội khoa", function: "Nội khoa", floor: "Tầng 2" },
  { code: "PED-204", name: "Khám nhi", function: "Nhi khoa", floor: "Tầng 2" },
  { code: "ENT-205", name: "Tai mũi họng", function: "Tai mũi họng", floor: "Tầng 2" },
  { code: "DER-206", name: "Da liễu", function: "Da liễu", floor: "Tầng 2" },
];

/** Dữ liệu ghi nhận tại quầy tiếp nhận (dạng chuỗi để bám sát ô nhập). */
export type ReceptionDraft = {
  temperature: string;
  bloodPressure: string;
  heartRate: string;
  spo2: string;
  height: string;
  weight: string;
  visitReason: string;
  receptionNote: string;
  room?: string;
};

type VitalKey = "temperature" | "bloodPressure" | "heartRate" | "spo2" | "height" | "weight";
type Flag = "LOW" | "NORMAL" | "HIGH";

export const vitalFields: Array<{ key: VitalKey; label: string; unit: string; icon: ComponentType<{ className?: string }>; placeholder: string; reference?: string }> = [
  { key: "temperature", label: "Nhiệt độ", unit: "°C", icon: Thermometer, placeholder: "36.8", reference: "36 – 37.5" },
  { key: "bloodPressure", label: "Huyết áp", unit: "mmHg", icon: Activity, placeholder: "120/80", reference: "90–139 / 60–89" },
  { key: "heartRate", label: "Nhịp tim", unit: "bpm", icon: HeartPulse, placeholder: "75", reference: "60 – 100" },
  { key: "spo2", label: "SpO₂", unit: "%", icon: Wind, placeholder: "98", reference: "≥ 95" },
  { key: "height", label: "Chiều cao", unit: "cm", icon: Ruler, placeholder: "168" },
  { key: "weight", label: "Cân nặng", unit: "kg", icon: Weight, placeholder: "62" },
];

function rangeFlag(value: number, low: number, high: number): Flag {
  return value < low ? "LOW" : value > high ? "HIGH" : "NORMAL";
}

/** Đánh giá nhanh chỉ số so với ngưỡng thông thường của người trưởng thành (chỉ để nhắc, không chẩn đoán). */
export function getVitalFlag(key: VitalKey, raw: string): Flag | null {
  const value = raw.trim();
  if (!value) return null;
  if (key === "bloodPressure") {
    const [systolic, diastolic] = value.split("/").map(Number);
    if (!systolic || !diastolic) return null;
    if (systolic > 139 || diastolic > 89) return "HIGH";
    if (systolic < 90 || diastolic < 60) return "LOW";
    return "NORMAL";
  }
  const number = Number(value.replace(",", "."));
  if (Number.isNaN(number)) return null;
  if (key === "temperature") return rangeFlag(number, 36, 37.5);
  if (key === "heartRate") return rangeFlag(number, 60, 100);
  if (key === "spo2") return number < 95 ? "LOW" : "NORMAL";
  return null;
}

export function getBmi(height: string, weight: string) {
  const h = Number(height.replace(",", ".")) / 100;
  const w = Number(weight.replace(",", "."));
  if (!h || !w) return null;
  const bmi = w / (h * h);
  const label = bmi < 18.5 ? "Thiếu cân" : bmi < 23 ? "Bình thường" : bmi < 25 ? "Thừa cân" : "Béo phì";
  return { value: bmi.toFixed(1), label, normal: bmi >= 18.5 && bmi < 23 };
}

export const flagStyle: Record<Flag, { label: string; className: string }> = {
  LOW: { label: "Thấp", className: "bg-sky-100 text-sky-700" },
  NORMAL: { label: "Bình thường", className: "bg-emerald-100 text-emerald-700" },
  HIGH: { label: "Cao", className: "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]" },
};

type Step = "VITALS" | "ROOM";

export function ReceptionMeasureDialog({
  value,
  onSave,
  onSaveAndStart,
  canStart,
  isStarting,
  readOnly,
  trigger,
}: {
  value: ReceptionDraft;
  onSave: (draft: ReceptionDraft) => void;
  onSaveAndStart: (draft: ReceptionDraft) => void;
  /** Bệnh nhân đã được xác nhận đến quầy. */
  canStart: boolean;
  isStarting: boolean;
  /** Lượt khám đã bắt đầu: chỉ xem. */
  readOnly: boolean;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("VITALS");
  const [draft, setDraft] = useState<ReceptionDraft>(value);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(value);
      setStep("VITALS");
    }
  }

  function update<K extends keyof ReceptionDraft>(key: K, next: ReceptionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  function validateVitals() {
    const error = validateReceptionVitals(draft);
    if (error) toast.error(error);
    return !error;
  }

  function save() {
    if (!validateVitals()) return;
    onSave(draft);
    setOpen(false);
    toast.success("Đã lưu thông tin tiếp nhận.");
  }

  function saveAndStart() {
    if (!validateVitals()) return;
    if (!draft.room) {
      toast.error("Vui lòng chọn phòng bác sĩ tiếp nhận.");
      return;
    }
    onSaveAndStart(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Stethoscope className="size-4 text-primary" /> Ghi nhận ban đầu & chuyển phòng</DialogTitle>
            {readOnly && <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">Chỉ xem</span>}
          </div>
          <DialogDescription className="text-sm">Chỉ ghi nhận chỉ số cơ bản và lý do đến khám, không đưa ra chẩn đoán tại phòng tiếp nhận.</DialogDescription>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <StepTab index={1} label="Sinh hiệu & lý do khám" active={step === "VITALS"} done={step === "ROOM"} onClick={() => setStep("VITALS")} />
            <span className="h-px w-8 bg-border" />
            <StepTab index={2} label="Phòng bác sĩ tiếp nhận" active={step === "ROOM"} done={Boolean(draft.room)} onClick={() => validateVitals() && setStep("ROOM")} />
          </div>
        </DialogHeader>

        {step === "VITALS"
          ? <VitalsForm draft={draft} onChange={update} readOnly={readOnly} className="px-6 py-6 sm:px-8" />
          : <RoomPicker value={draft.room} onChange={(code) => update("room", code)} readOnly={readOnly} className="px-6 py-6 sm:px-8" />}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4 sm:px-8">
          {step === "VITALS" ? (
            <>
              <p className="text-xs text-muted-foreground">Có thể bỏ trống chỉ số chưa đo được.</p>
              <Button type="button" onClick={() => validateVitals() && setStep("ROOM")} className="h-10 rounded-full px-5">Tiếp tục <ArrowRight /></Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep("VITALS")} className="h-10 rounded-full px-4"><ArrowLeft /> Quay lại</Button>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={save} className="h-10 rounded-full px-5">Lưu</Button>
                  <Button type="button" onClick={saveAndStart} disabled={!canStart || !draft.room || isStarting} className="h-10 rounded-full px-5">
                    {isStarting ? <LoaderCircle className="animate-spin" /> : <ClipboardPlus />} Lưu & bắt đầu lượt khám
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {step === "ROOM" && !readOnly && !canStart && (
          <p className="border-t px-6 py-2.5 text-xs text-amber-700 sm:px-8">Cần xác nhận bệnh nhân đã đến (mục 1) trước khi bắt đầu lượt khám.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Kiểm tra định dạng sinh hiệu; trả về thông báo lỗi hoặc null. */
export function validateReceptionVitals(draft: ReceptionDraft): string | null {
  const pressure = draft.bloodPressure.trim();
  if (pressure && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(pressure)) return "Huyết áp cần có định dạng tâm thu/tâm trương, ví dụ 120/80.";
  const numeric: VitalKey[] = ["temperature", "heartRate", "spo2", "height", "weight"];
  const invalid = numeric.find((key) => draft[key].trim() && Number.isNaN(Number(draft[key].replace(",", "."))));
  return invalid ? `${vitalFields.find((field) => field.key === invalid)?.label} phải là số.` : null;
}

/** Ô nhập sinh hiệu + BMI + lý do khám / ghi chú tiếp nhận (dùng chung cho dialog đo và tab tiếp nhận vãng lai). */
export function VitalsForm({ draft, onChange, readOnly, className }: { draft: ReceptionDraft; onChange: <K extends keyof ReceptionDraft>(key: K, value: ReceptionDraft[K]) => void; readOnly?: boolean; className?: string }) {
  const bmi = getBmi(draft.height, draft.weight);
  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {vitalFields.map((field) => {
          const flag = getVitalFlag(field.key, draft[field.key]);
          const Icon = field.icon;
          return (
            <label key={field.key} className={cn("rounded-2xl border bg-card p-3.5 transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20", flag && flag !== "NORMAL" && "border-[var(--brand-coral)]/40")}>
              <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Icon className="size-3.5 text-primary" /> {field.label}</span>
                {flag && <span className={cn("rounded-full px-1.5 py-px text-[0.65rem] font-semibold", flagStyle[flag].className)}>{flagStyle[flag].label}</span>}
              </span>
              <span className="mt-2 flex items-end gap-1.5">
                <Input
                  value={draft[field.key]}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  inputMode="decimal"
                  disabled={readOnly}
                  className="h-9 min-w-0 border-0 bg-transparent p-0 text-xl font-semibold tabular-nums shadow-none focus-visible:ring-0 disabled:opacity-100"
                />
                <span className="shrink-0 pb-1.5 text-xs text-muted-foreground">{field.unit}</span>
              </span>
              {field.reference && <span className="mt-1 block text-[0.65rem] text-muted-foreground">Thông thường: {field.reference}</span>}
            </label>
          );
        })}
      </div>

      {bmi && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">BMI</span>
          <span className="font-semibold tabular-nums">{bmi.value}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", bmi.normal ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{bmi.label}</span>
          <span className="text-xs text-muted-foreground">· tự tính từ chiều cao và cân nặng (chuẩn người châu Á)</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="measure-reason">Lý do đến khám</Label>
          <Textarea id="measure-reason" rows={4} value={draft.visitReason} disabled={readOnly} onChange={(event) => onChange("visitReason", event.target.value)} placeholder="Nhập lý do bệnh nhân đến khám..." className="min-h-28 resize-none rounded-xl p-3" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="measure-note">Ghi chú tiếp nhận</Label>
          <Textarea id="measure-note" rows={4} value={draft.receptionNote} disabled={readOnly} onChange={(event) => onChange("receptionNote", event.target.value)} placeholder="Lưu ý cho bác sĩ tại phòng khám đầu tiên..." className="min-h-28 resize-none rounded-xl p-3" />
        </div>
      </div>
    </div>
  );
}

/** Lưới chọn phòng bác sĩ tiếp nhận. */
export function RoomPicker({ value, onChange, readOnly, className }: { value?: string; onChange: (code: string) => void; readOnly?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-4 text-sm text-muted-foreground">Phòng này là phòng tiếp nhận chính của lượt khám, nơi bệnh nhân quay lại sau khi làm xét nghiệm hoặc chẩn đoán.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {examinationRooms.map((room) => {
          const active = value === room.code;
          return (
            <button
              key={room.code}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(room.code)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition disabled:cursor-default",
                active ? "border-primary bg-primary/[0.06] ring-2 ring-primary/15" : "enabled:hover:-translate-y-0.5 enabled:hover:border-primary/30 enabled:hover:shadow-sm",
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}><DoorOpen className="size-[1.1rem]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold tracking-wide text-primary">{room.code}</span>
                <span className="block truncate text-sm font-medium">{room.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{room.floor} · {room.function}</span>
              </span>
              {active && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepTab({ index, label, active, done, onClick }: { index: number; label: string; active: boolean; done?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center gap-1.5 font-medium transition", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
      <span className={cn("grid size-5 place-items-center rounded-full text-[0.65rem] font-bold", active ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
        {done && !active ? <Check className="size-3" /> : index}
      </span>
      {label}
    </button>
  );
}
