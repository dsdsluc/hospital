"use client";

import type { FormEvent, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleCheck, ClipboardCheck, FlaskConical, LoaderCircle, Microscope, Syringe } from "lucide-react";

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
  /** Gọi sau khi bắt đầu lấy mẫu (để hàng đợi chuyển sang tab "Đang xét nghiệm"). */
  onStarted?: () => void;
};

const measurements = [
  ["wbc", "WBC", "G/L"], ["rbc", "RBC", "T/L"], ["hgb", "HGB", "g/dL"],
  ["hct", "HCT", "%"], ["plt", "PLT", "G/L"], ["neu", "NEU", "%"], ["lym", "LYM", "%"],
] as const;

export function LaboratoryWorkspace({ roomCode, roomName, roomFunction, appointment, onStarted }: Props) {
  const visit = appointment.medical_visits[0];
  const currentStep = visit?.steps?.find((step) => step.room.room_code === roomCode && (step.status === "PENDING" || step.status === "IN_PROGRESS"));
  const started = currentStep?.status === "IN_PROGRESS";
  const sourceRoom = visit?.receiving_room.room_code ?? "Phòng khám bác sĩ";
  const instruction = currentStep?.instruction || "Không có ghi chú bổ sung từ bác sĩ chỉ định.";
  const preliminaryDiagnosis = visit?.examination_record?.preliminary_diagnosis;
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
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu lấy mẫu.")),
  });

  const mutation = useMutation({
    mutationFn: (result: string) => medicalVisitService.completeVisitStep(currentStep!.id, { result }),
    onSuccess: async (response) => {
      await refreshQueues();
      toast.success(response.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể gửi kết quả xét nghiệm.")),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentStep) return toast.error("Không tìm thấy chỉ định xét nghiệm tại phòng này.");
    if (!started) return toast.error("Cần bắt đầu lấy mẫu trước khi gửi kết quả.");
    const data = new FormData(event.currentTarget);
    const conclusion = String(data.get("conclusion") ?? "").trim();
    if (!conclusion) return toast.error("Vui lòng nhập kết luận chuyên môn.");
    mutation.mutate(formatLaboratoryResult(data));
  }

  return <form onSubmit={handleSubmit} className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><FlaskConical className="size-4" /></span>
      <h2 className="text-[0.95rem] font-semibold">Phiếu kết quả xét nghiệm máu</h2><span className="hidden h-5 w-px bg-border sm:block" /><p className="min-w-0 flex-1 text-xs text-muted-foreground">{roomCode} · {roomName}</p>
      <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", started ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700")}><span className={cn("size-1.5 rounded-full", started ? "bg-violet-500" : "bg-amber-500")} /> {started ? "Đang xét nghiệm" : "Chờ lấy mẫu"}</span>
    </div>

    <div className="space-y-6 p-5">
      <section>
        <SectionTitle index={1} title="Yêu cầu chỉ định" description={`${roomFunction} · Chỉ định từ ${sourceRoom}`} />
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><ClipboardCheck className="size-[1.1rem]" /></span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{instruction}</p>
            {preliminaryDiagnosis && <p className="mt-1.5 text-xs text-muted-foreground">Chẩn đoán sơ bộ: <span className="font-medium text-foreground">{preliminaryDiagnosis}</span></p>}
            <p className="mt-1 text-xs text-muted-foreground">Mã lượt khám {visit?.visit_code ?? "—"}</p>
          </div>
        </div>
      </section>

      {!started ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Syringe className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold">Gọi bệnh nhân vào lấy mẫu</p>
            <p className="mt-1 text-xs text-muted-foreground">Bấm “Bắt đầu lấy mẫu” khi bệnh nhân đã vào phòng. Sau đó mới nhập được kết quả.</p>
          </div>
          <Button type="button" disabled={!currentStep || startMutation.isPending} onClick={() => startMutation.mutate()} className="h-10 rounded-full px-5">
            {startMutation.isPending ? <LoaderCircle className="animate-spin" /> : <Syringe />} Bắt đầu lấy mẫu
          </Button>
        </section>
      ) : (
        <section className="space-y-5">
          <SectionTitle index={2} title="Kết quả thực hiện" description="Mẫu bệnh phẩm, kỹ thuật và các chỉ số xét nghiệm" />
          <div className="grid gap-4 xl:grid-cols-2">
            <Field label="Loại xét nghiệm"><Input name="test_type" defaultValue="Tổng phân tích tế bào máu ngoại vi" className="h-11 rounded-xl" /></Field>
            <Field label="Mẫu bệnh phẩm"><Input name="specimen" defaultValue="Máu toàn phần" className="h-11 rounded-xl" /></Field>
            <Field label="Kỹ thuật / thiết bị" className="xl:col-span-2"><Input name="technique" placeholder="Ví dụ: Máy huyết học tự động" className="h-11 rounded-xl" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{measurements.map(([name, label, unit]) => <Measurement key={name} name={name} label={label} unit={unit} />)}</div>
          <Field label="Ghi chú kết quả"><Textarea name="findings" rows={4} placeholder="Ghi nhận thêm các bất thường hoặc nhận xét về mẫu xét nghiệm..." className="min-h-24 resize-none rounded-xl" /></Field>
          <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4"><div className="flex items-center gap-2"><Microscope className="size-4 text-primary" /><Label htmlFor="laboratory-conclusion">Kết luận chuyên môn</Label></div><Textarea id="laboratory-conclusion" name="conclusion" rows={4} placeholder="Ví dụ: Các chỉ số công thức máu trong giới hạn bình thường..." className="min-h-24 resize-none rounded-xl bg-background" /></div>
        </section>
      )}
    </div>

    <div className="flex items-center justify-between gap-3 border-t bg-muted/35 p-4 sm:px-5">
      <p className="hidden text-xs text-muted-foreground lg:block">{started ? "Kết quả sẽ được gửi về phòng bác sĩ tiếp nhận sau khi hoàn thành." : "Bắt đầu lấy mẫu để mở phiếu nhập kết quả."}</p>
      <Hint content="Lưu các chỉ số xét nghiệm và gửi kết quả về phòng bác sĩ tiếp nhận."><Button type="submit" disabled={!currentStep || !started || mutation.isPending} className="h-10 rounded-full px-5">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <CircleCheck />} {mutation.isPending ? "Đang gửi..." : "Hoàn thành & gửi kết quả"}</Button></Hint>
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
function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) { return <div className={`space-y-2 ${className ?? ""}`}><Label>{label}</Label>{children}</div>; }
function Measurement({ name, label, unit }: { name: string; label: string; unit: string }) { return <div className="rounded-xl bg-muted/60 p-3"><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1 flex items-end gap-1"><Input name={name} inputMode="decimal" className="h-8 border-0 bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0" placeholder="--" /><span className="pb-1 text-[0.65rem] text-muted-foreground">{unit}</span></div></div>; }
function Hint({ content, children }: { content: string; children: ReactNode }) { return <span className="group/hint relative inline-flex"><span className="inline-flex">{children}</span><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-64 -translate-x-1/2 translate-y-1 rounded-lg bg-foreground px-3 py-2 text-center text-xs font-medium leading-4 text-background opacity-0 shadow-xl transition group-hover/hint:translate-y-0 group-hover/hint:opacity-100 group-focus-within/hint:translate-y-0 group-focus-within/hint:opacity-100">{content}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" /></span></span>; }

function formatLaboratoryResult(data: FormData) {
  const read = (name: string) => String(data.get(name) ?? "").trim();
  const value = (name: string, label: string, unit: string) => read(name) && `${label}: ${read(name)} ${unit}`;
  return [
    read("test_type") && `Loại xét nghiệm: ${read("test_type")}`,
    read("specimen") && `Mẫu bệnh phẩm: ${read("specimen")}`,
    read("technique") && `Kỹ thuật / thiết bị: ${read("technique")}`,
    value("wbc", "WBC", "G/L"), value("rbc", "RBC", "T/L"), value("hgb", "HGB", "g/dL"),
    value("hct", "HCT", "%"), value("plt", "PLT", "G/L"), value("neu", "NEU", "%"), value("lym", "LYM", "%"),
    read("findings") && `Ghi chú kết quả: ${read("findings")}`,
    `Kết luận chuyên môn: ${read("conclusion")}`,
  ].filter(Boolean).join("\n");
}
