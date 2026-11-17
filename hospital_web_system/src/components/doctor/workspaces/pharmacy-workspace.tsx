"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ClipboardCheck, HandHelping, LoaderCircle, PackageCheck, Pill, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/services/price.service";
import { getApiErrorMessage } from "@/lib/api-client";
import { medicalVisitService } from "@/services/medical-visit.service";
import type { ReceptionQueueAppointment } from "@/types/api";

type Props = {
  roomCode: string;
  roomName: string;
  appointment: ReceptionQueueAppointment;
  /** Gọi sau khi bắt đầu cấp thuốc (để hàng đợi chuyển sang tab "Đang cấp thuốc"). */
  onStarted?: () => void;
};

export function PharmacyWorkspace({ roomCode, roomName, appointment, onStarted }: Props) {
  const visit = appointment.medical_visits[0];
  const prescription = visit?.prescription;
  const items = prescription?.items ?? [];
  const currentStep = visit?.steps?.find((step) => step.room.room_code === roomCode && (step.status === "PENDING" || step.status === "IN_PROGRESS"));
  const started = currentStep?.status === "IN_PROGRESS";
  // Hóa đơn chưa thu → chưa được xác nhận cấp thuốc (backend cũng chặn).
  const unpaid = visit?.invoice?.status === "UNPAID";
  const [preparedItems, setPreparedItems] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const allPrepared = items.length > 0 && preparedItems.length === items.length;
  const hasInsufficientStock = items.some((item) => item.medicine.stock_quantity < item.quantity);
  const startMutation = useMutation({
    mutationFn: () => medicalVisitService.startVisitStep(currentStep!.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["room-visit-queue", roomCode] }),
        queryClient.invalidateQueries({ queryKey: ["my-current-medical-visit"] }),
      ]);
      onStarted?.();
      toast.success("Đã bắt đầu cấp thuốc.", { description: `${appointment.patient.full_name} · ${visit?.visit_code ?? ""}` });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu cấp thuốc.")),
  });
  const mutation = useMutation({
    mutationFn: () => medicalVisitService.dispensePrescription(currentStep!.id),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["room-visit-queue", roomCode] }),
        queryClient.invalidateQueries({ queryKey: ["my-current-medical-visit"] }),
        queryClient.invalidateQueries({ queryKey: ["my-medical-visits"] }),
      ]);
      toast.success(result.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể hoàn thành cấp thuốc.")),
  });

  function togglePrepared(id: string) {
    setPreparedItems((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <div className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><Pill className="size-4" /></span>
      <h2 className="text-[0.95rem] font-semibold">Cấp thuốc theo đơn</h2><span className="hidden h-5 w-px bg-border sm:block" /><p className="min-w-0 flex-1 text-xs text-muted-foreground">{roomCode} · {roomName}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Trạng thái cấp thuốc */}
        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", started ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700")}><span className={cn("size-1.5 rounded-full", started ? "bg-orange-500" : "bg-amber-500")} /> {started ? "Đang cấp thuốc" : "Chờ nhận thuốc"}</span>
        {/* Trạng thái thanh toán (CAS-103) */}
        {visit?.invoice && (unpaid
          ? <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"><span className="size-1.5 rounded-full bg-red-500" /> Chưa thanh toán</span>
          : <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" /> Đã thanh toán</span>)}
      </div>
    </div>

    <div className="space-y-6 p-5">
      <section>
        <SectionTitle index={1} title="Đơn thuốc cần cấp" description={`Kê từ ${visit?.receiving_room.room_code ?? "phòng khám bác sĩ"} · ${items.length} loại thuốc`} />
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><ClipboardCheck className="size-[1.1rem]" /></span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">Mã lượt khám <span className="tracking-wide">{visit?.visit_code ?? "—"}</span> <span className="font-normal text-muted-foreground">(bệnh nhân đọc mã này khi nhận thuốc)</span></p>
            {visit?.examination_record?.final_diagnosis && <p className="mt-1.5 text-xs text-muted-foreground">Chẩn đoán: <span className="font-medium text-foreground">{visit.examination_record.final_diagnosis}</span></p>}
            {visit?.invoice && <p className={cn("mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", visit.invoice.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-800")}>{visit.invoice.status === "PAID" ? "Đã thanh toán tại CAS-103" : `Chưa thanh toán tại CAS-103 · ${formatVnd(visit.invoice.total_amount)}`}</p>}
          </div>
        </div>
      </section>

      {!started && (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-6 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-orange-100 text-orange-700"><HandHelping className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold">Gọi bệnh nhân đến quầy nhận thuốc</p>
            <p className="mt-1 text-xs text-muted-foreground">Đối chiếu mã lượt khám, rồi bấm “Bắt đầu cấp thuốc” để chuẩn bị từng thuốc.</p>
          </div>
          <Button type="button" disabled={!currentStep || startMutation.isPending} onClick={() => startMutation.mutate()} className="h-10 rounded-full px-5">
            {startMutation.isPending ? <LoaderCircle className="animate-spin" /> : <HandHelping />} Bắt đầu cấp thuốc
          </Button>
        </section>
      )}

      <section><div className="flex flex-wrap items-center justify-between gap-3 [&>div]:mb-0"><SectionTitle index={2} title="Danh sách thuốc cần cấp" description={started ? "Đối chiếu đúng thuốc, số lượng và đánh dấu từng thuốc sau khi chuẩn bị" : "Bắt đầu cấp thuốc để đánh dấu chuẩn bị"} /><span className="text-xs font-semibold text-primary">Đã chuẩn bị {preparedItems.length}/{items.length}</span></div>
        {items.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Lượt khám chưa có đơn thuốc.</div> : <div className="mt-4 space-y-3">{items.map((item) => {
          const prepared = preparedItems.includes(item.id);
          const enough = item.medicine.stock_quantity >= item.quantity;
          return <article key={item.id} className={cn("grid gap-4 rounded-2xl border p-4 transition md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center", prepared && "border-emerald-200 bg-emerald-50/45", !enough && "border-destructive/30 bg-destructive/[0.035]")}><button type="button" disabled={!started || !enough || mutation.isPending} onClick={() => togglePrepared(item.id)} className={cn("grid size-7 place-items-center rounded-full border-2", prepared ? "border-emerald-600 bg-emerald-600 text-white" : "border-border bg-background", enough && !prepared && "hover:border-primary")} aria-label={`Chuẩn bị ${item.medicine.name}`}>{prepared && <Check className="size-4" />}</button><div><p className="font-semibold">{item.medicine.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.medicine.medicine_code} · {item.dosage || "Chưa ghi liều dùng"}</p><p className="mt-1 text-xs text-muted-foreground">Cách dùng: {item.usage || "Chưa ghi"}</p></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Cần cấp</p><p className="mt-1 font-semibold">{item.quantity} {item.medicine.unit}</p></div><div><p className="text-xs text-muted-foreground">Tồn kho</p><p className={cn("mt-1 font-semibold", enough ? "text-emerald-700" : "text-destructive")}>{item.medicine.stock_quantity} {item.medicine.unit}</p></div></div><span className={cn("w-fit rounded-full px-3 py-1.5 text-xs font-semibold", enough ? prepared ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700" : "bg-destructive/10 text-destructive")}>{!enough ? "Không đủ kho" : prepared ? "Đã chuẩn bị" : "Chưa chuẩn bị"}</span></article>;
        })}</div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="rounded-2xl bg-primary/[0.045] p-4"><div className="flex items-center gap-2"><Stethoscope className="size-4 text-primary" /><h3 className="text-sm font-semibold">Lời dặn dùng thuốc</h3></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{prescription?.note || visit?.examination_record?.doctor_advice || "Bác sĩ chưa ghi lời dặn dùng thuốc."}</p></div><div className="rounded-2xl bg-muted/55 p-4"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h3 className="text-sm font-semibold">Kiểm tra bàn giao</h3></div><ul className="mt-4 space-y-3 text-xs text-muted-foreground"><CheckItem label="Đúng bệnh nhân" done /><CheckItem label="Đúng tên và số lượng thuốc" done={allPrepared} /><CheckItem label="Đã đọc hướng dẫn sử dụng" done={allPrepared} /></ul></div></section>

      {unpaid && <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-red-800"><TriangleAlert className="size-5 shrink-0" /><div><p className="text-sm font-semibold">Bệnh nhân chưa thanh toán</p><p className="mt-1 text-xs">Hướng dẫn bệnh nhân thanh toán tại quầy thu ngân CAS-103 ({formatVnd(visit!.invoice!.total_amount)}). Sau khi thanh toán mới xác nhận cấp thuốc được.</p></div></div>}

      {hasInsufficientStock && <div className="flex gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.045] p-4 text-destructive"><TriangleAlert className="size-5 shrink-0" /><div><p className="text-sm font-semibold">Không đủ tồn kho</p><p className="mt-1 text-xs">Cần bổ sung tồn kho trước khi có thể hoàn thành cấp thuốc.</p></div></div>}
    </div>

    <div className="flex flex-col gap-3 border-t bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs text-muted-foreground">{unpaid ? "Chưa thanh toán tại CAS-103 — chưa thể xác nhận cấp thuốc." : "Xác nhận sẽ trừ tồn kho, hoàn thành cấp thuốc và kết thúc lượt khám."}</p><Hint content={unpaid ? "Bệnh nhân cần thanh toán tại CAS-103 trước." : "Trừ số lượng thuốc trong kho và hoàn thành toàn bộ lượt khám."}><Button type="button" disabled={!currentStep || !started || !allPrepared || hasInsufficientStock || unpaid || mutation.isPending} onClick={() => mutation.mutate()} className="h-10 rounded-full px-6">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <PackageCheck />} {mutation.isPending ? "Đang cấp thuốc..." : "Xác nhận cấp thuốc"}</Button></Hint></div>
  </div>;
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
function CheckItem({ label, done }: { label: string; done: boolean }) { return <li className="flex items-center gap-2"><span className={cn("grid size-5 place-items-center rounded-full border", done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border bg-background")}>{done && <Check className="size-3" />}</span>{label}</li>; }
function Hint({ content, children }: { content: string; children: ReactNode }) { return <span className="group/hint relative inline-flex"><span className="inline-flex">{children}</span><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-64 -translate-x-1/2 translate-y-1 rounded-lg bg-foreground px-3 py-2 text-center text-xs font-medium leading-4 text-background opacity-0 shadow-xl transition group-hover/hint:translate-y-0 group-hover/hint:opacity-100 group-focus-within/hint:translate-y-0 group-focus-within/hint:opacity-100">{content}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" /></span></span>; }
