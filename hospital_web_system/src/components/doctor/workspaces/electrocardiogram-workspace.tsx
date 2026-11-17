"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, CircleCheck, ClipboardCheck, HeartPulse, LoaderCircle, Stethoscope, UserRoundCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { medicalVisitService } from "@/services/medical-visit.service";
import type { ReceptionQueueAppointment } from "@/types/api";

type Props = {
  roomCode: string;
  roomName: string;
  roomFunction: string;
  appointment: ReceptionQueueAppointment;
  /** Gọi sau khi bắt đầu đo (để hàng đợi chuyển sang tab "Đang chẩn đoán"). */
  onStarted?: () => void;
};

type Flag = "LOW" | "NORMAL" | "HIGH";

/** Chọn nhanh — vẫn có thể sửa tay. */
const rhythmOptions = ["Nhịp xoang đều", "Nhịp nhanh xoang", "Nhịp chậm xoang", "Rung nhĩ", "Ngoại tâm thu"];
const axisOptions = ["Trục tim bình thường", "Trục lệch trái", "Trục lệch phải"];

/**
 * Thông số điện tim + khoảng tham chiếu (người trưởng thành, chỉ để nhắc).
 * Ngưỡng trùng với bộ tách kết quả ở backend (clinical-result.utils.ts) để phía bệnh nhân hiển thị giống hệt.
 */
const ecgMeasurements: Array<{ name: "heart_rate" | "pr" | "qrs" | "qt_qtc"; label: string; unit: string; reference: string; low?: number; high?: number; placeholder: string }> = [
  { name: "heart_rate", label: "Tần số tim", unit: "bpm", reference: "60 – 100", low: 60, high: 100, placeholder: "75" },
  { name: "pr", label: "PR", unit: "ms", reference: "120 – 200", low: 120, high: 200, placeholder: "160" },
  { name: "qrs", label: "QRS", unit: "ms", reference: "70 – 110", low: 70, high: 110, placeholder: "90" },
  { name: "qt_qtc", label: "QT/QTc", unit: "ms", reference: "QTc < 450", high: 450, placeholder: "380/410" },
];

const flagStyle: Record<Flag, { label: string; className: string }> = {
  LOW: { label: "Thấp", className: "bg-sky-100 text-sky-700" },
  NORMAL: { label: "Bình thường", className: "bg-emerald-100 text-emerald-700" },
  HIGH: { label: "Cao", className: "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]" },
};

function getFlag(measurement: (typeof ecgMeasurements)[number], raw: string): Flag | null {
  const value = raw.trim();
  if (!value) return null;
  // QT/QTc nhập dạng "QT/QTc": đánh giá theo QTc (số sau dấu "/").
  const numberText = measurement.name === "qt_qtc" ? value.split("/").at(-1)?.trim() ?? "" : value;
  const number = Number(numberText.replace(",", "."));
  if (!numberText || Number.isNaN(number)) return null;
  if (measurement.low !== undefined && number < measurement.low) return "LOW";
  if (measurement.high !== undefined && number > measurement.high) return "HIGH";
  return "NORMAL";
}

export function ElectrocardiogramWorkspace({ roomCode, roomName, roomFunction, appointment, onStarted }: Props) {
  const visit = appointment.medical_visits[0];
  const currentStep = visit?.steps?.find((step) => step.room.room_code === roomCode && (step.status === "PENDING" || step.status === "IN_PROGRESS"));
  const started = currentStep?.status === "IN_PROGRESS";
  const sourceRoom = visit?.receiving_room.room_code ?? "Phòng khám bác sĩ";
  const [values, setValues] = useState<Record<string, string>>({ heart_rate: "", pr: "", qrs: "", qt_qtc: "" });
  const [rhythm, setRhythm] = useState("");
  const [axis, setAxis] = useState("");
  const queryClient = useQueryClient();

  async function refreshQueues() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room-visit-queue", roomCode] }),
      queryClient.invalidateQueries({ queryKey: ["room-load"] }),
      queryClient.invalidateQueries({ queryKey: ["my-current-medical-visit"] }),
    ]);
  }

  const startMutation = useMutation({
    mutationFn: () => medicalVisitService.startVisitStep(currentStep!.id),
    onSuccess: async (response) => {
      await refreshQueues();
      onStarted?.();
      toast.success(response.message, { description: `${appointment.patient.full_name} · ${visit?.visit_code ?? ""}` });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu đo điện tim.")),
  });

  const mutation = useMutation({
    mutationFn: (result: string) => medicalVisitService.completeVisitStep(currentStep!.id, { result }),
    onSuccess: async (response) => {
      await refreshQueues();
      toast.success(response.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể gửi kết quả điện tim.")),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentStep) return toast.error("Không tìm thấy chỉ định điện tim tại phòng này.");
    if (!started) return toast.error("Cần gọi bệnh nhân vào phòng trước khi gửi kết quả.");
    const data = new FormData(event.currentTarget);
    if (!read(data, "conclusion")) return toast.error("Vui lòng nhập kết luận chuyên môn.");
    mutation.mutate(formatResult(data));
  }

  return <form onSubmit={handleSubmit} className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700"><HeartPulse className="size-4" /></span>
      <h2 className="text-[0.95rem] font-semibold">Phiếu kết quả điện tâm đồ</h2><span className="hidden h-5 w-px bg-border sm:block" /><p className="min-w-0 flex-1 text-xs text-muted-foreground">{roomCode} · {roomName}</p>
      <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", started ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}><span className={cn("size-1.5 rounded-full", started ? "bg-rose-500" : "bg-amber-500")} /> {started ? "Đang thực hiện" : "Chờ thực hiện"}</span>
    </div>

    <div className="space-y-6 p-5">
      <section>
        <SectionTitle index={1} title="Yêu cầu chỉ định" description={`${roomFunction} · Chỉ định từ ${sourceRoom}`} />
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><ClipboardCheck className="size-[1.1rem]" /></span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{currentStep?.instruction || "Không có ghi chú bổ sung từ bác sĩ chỉ định."}</p>
            {visit?.examination_record?.preliminary_diagnosis && <p className="mt-1.5 text-xs text-muted-foreground">Chẩn đoán sơ bộ: <span className="font-medium text-foreground">{visit.examination_record.preliminary_diagnosis}</span></p>}
            <p className="mt-1 text-xs text-muted-foreground">Mã lượt khám {visit?.visit_code ?? "—"}</p>
          </div>
        </div>
      </section>

      {!started ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-rose-100 text-rose-700"><UserRoundCheck className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold">Gọi bệnh nhân vào đo điện tim</p>
            <p className="mt-1 text-xs text-muted-foreground">Bấm khi bệnh nhân đã vào phòng. Sau đó mới nhập được kết quả.</p>
          </div>
          <Button type="button" disabled={!currentStep || startMutation.isPending} onClick={() => startMutation.mutate()} className="h-10 rounded-full px-5">
            {startMutation.isPending ? <LoaderCircle className="animate-spin" /> : <UserRoundCheck />} Bắt đầu thực hiện
          </Button>
        </section>
      ) : (
        <section className="space-y-5">
          <SectionTitle index={2} title="Kết quả thực hiện" description="Thông số và đặc điểm điện tâm đồ 12 chuyển đạo" />
          <div className="grid gap-4 md:grid-cols-2"><Field label="Kỹ thuật thực hiện"><Input name="technique" defaultValue="Điện tâm đồ 12 chuyển đạo, tốc độ 25 mm/s" className="h-11 rounded-xl" /></Field><Field label="Thiết bị"><Input name="device" placeholder="Nhập tên máy điện tim" className="h-11 rounded-xl" /></Field></div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {ecgMeasurements.map((measurement) => {
              const flag = getFlag(measurement, values[measurement.name] ?? "");
              return (
                <label key={measurement.name} className={cn("rounded-xl border border-transparent bg-muted/60 p-3 transition focus-within:border-ring", flag && flag !== "NORMAL" && "border-[var(--brand-coral)]/40 bg-card")}>
                  <span className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Activity className="size-3.5" /> {measurement.label}</span>
                    {flag && <span className={cn("rounded-full px-1.5 py-px text-[0.65rem] font-semibold", flagStyle[flag].className)}>{flagStyle[flag].label}</span>}
                  </span>
                  <span className="mt-1 flex items-end gap-1">
                    <Input name={measurement.name} value={values[measurement.name]} onChange={(event) => setValues((current) => ({ ...current, [measurement.name]: event.target.value }))} inputMode={measurement.name === "qt_qtc" ? "text" : "decimal"} className="h-8 border-0 bg-transparent p-0 text-base font-semibold tabular-nums shadow-none focus-visible:ring-0" placeholder={measurement.placeholder} />
                    <span className="pb-1 text-[0.65rem] text-muted-foreground">{measurement.unit}</span>
                  </span>
                  <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">Tham chiếu: {measurement.reference}</span>
                </label>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <QuickField label="Nhịp tim" name="rhythm" value={rhythm} onChange={setRhythm} options={rhythmOptions} placeholder="Ví dụ: Nhịp xoang đều" />
            <QuickField label="Trục tim" name="axis" value={axis} onChange={setAxis} options={axisOptions} placeholder="Ví dụ: Trục tim bình thường" />
          </div>
          <Field label="Biến đổi ST–T"><Textarea name="st_t" rows={3} placeholder="Mô tả đoạn ST, sóng T và các dấu hiệu bất thường..." className="min-h-20 resize-none rounded-xl" /></Field>
          <Field label="Mô tả kết quả"><Textarea name="findings" rows={4} placeholder="Mô tả tổng hợp hình thái điện tâm đồ..." className="min-h-24 resize-none rounded-xl" /></Field>
          <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4"><div className="flex items-center gap-2"><Stethoscope className="size-4 text-primary" /><Label htmlFor="ecg-conclusion">Kết luận chuyên môn</Label></div><Textarea id="ecg-conclusion" name="conclusion" rows={4} placeholder="Ví dụ: Nhịp xoang đều, chưa ghi nhận bất thường trên điện tâm đồ..." className="min-h-24 resize-none rounded-xl bg-background" /></div>
        </section>
      )}
    </div>

    <div className="flex items-center justify-between gap-3 border-t bg-muted/35 p-4 sm:px-5">
      <p className="hidden text-xs text-muted-foreground lg:block">{started ? `Kết quả sẽ được gửi về phòng bác sĩ chỉ định (${sourceRoom}) sau khi hoàn thành.` : "Gọi bệnh nhân vào phòng để mở phiếu nhập kết quả."}</p>
      <Hint content={`Lưu thông số điện tâm đồ và gửi kết quả về ${sourceRoom}.`}><Button type="submit" disabled={!currentStep || !started || mutation.isPending} className="h-10 rounded-full px-5">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <CircleCheck />} {mutation.isPending ? "Đang gửi..." : "Hoàn thành & gửi kết quả"}</Button></Hint>
    </div>
  </form>;
}

function SectionTitle({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.7rem] font-bold text-primary">{index}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="hidden h-4 w-px bg-border sm:block" />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/** Ô nhập kèm các lựa chọn nhanh bên dưới. */
function QuickField({ label, name, value, onChange, options, placeholder }: { label: string; name: string; value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input name={name} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-xl" />
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)} aria-pressed={value === option} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium transition", value === option ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/40 hover:text-primary")}>{option}</button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Hint({ content, children }: { content: string; children: ReactNode }) { return <span className="group/hint relative inline-flex"><span className="inline-flex">{children}</span><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-64 -translate-x-1/2 translate-y-1 rounded-lg bg-foreground px-3 py-2 text-center text-xs font-medium leading-4 text-background opacity-0 shadow-xl transition group-hover/hint:translate-y-0 group-hover/hint:opacity-100 group-focus-within/hint:translate-y-0 group-focus-within/hint:opacity-100">{content}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" /></span></span>; }
function read(data: FormData, name: string) { return String(data.get(name) ?? "").trim(); }
function formatResult(data: FormData) {
  const value = (name: string, label: string, unit = "") => read(data, name) && `${label}: ${read(data, name)}${unit ? ` ${unit}` : ""}`;
  return [value("technique", "Kỹ thuật thực hiện"), value("device", "Thiết bị"), value("heart_rate", "Tần số tim", "bpm"), value("rhythm", "Nhịp tim"), value("axis", "Trục tim"), value("pr", "PR", "ms"), value("qrs", "QRS", "ms"), value("qt_qtc", "QT/QTc", "ms"), value("st_t", "Biến đổi ST–T"), value("findings", "Mô tả kết quả"), `Kết luận chuyên môn: ${read(data, "conclusion")}`].filter(Boolean).join("\n");
}
