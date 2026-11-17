"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  FileSearch,
  FlaskConical,
  HeartPulse,
  Info,
  LoaderCircle,
  Maximize2,
  Microscope,
  Stethoscope,
} from "lucide-react";

import { Paragraphs } from "@/components/patient/paragraphs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { medicalVisitService, type MeasurementFlag, type PatientClinicalResult } from "@/services/medical-visit.service";

const flagMeta: Record<MeasurementFlag, { label: string; className: string; icon?: ComponentType<{ className?: string }> }> = {
  LOW: { label: "Thấp", className: "bg-sky-500/10 text-sky-700", icon: ArrowDown },
  NORMAL: { label: "Bình thường", className: "bg-primary/10 text-primary" },
  HIGH: { label: "Cao", className: "bg-[var(--brand-coral)]/12 text-[oklch(0.55_0.16_35)]", icon: ArrowUp },
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

export function ClinicalResultDialog({ medicalVisitId, visitStepId, roomName }: { medicalVisitId: string; visitStepId: string; roomName: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["my-clinical-result", medicalVisitId, visitStepId],
    queryFn: () => medicalVisitService.getMyClinicalResult(medicalVisitId, visitStepId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" />}>
        <Maximize2 className="size-3.5" /> Chi tiết
      </DialogTrigger>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-6 pr-14 sm:px-8 sm:py-7">
          <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><FlaskConical className="size-5" /></div>
          <DialogTitle className="text-xl font-semibold tracking-tight">{query.data?.room.name ?? roomName}</DialogTitle>
          <DialogDescription>
            {query.data
              ? <>{query.data.room.room_code} · {query.data.room.floor_name} · Trả kết quả lúc {formatDateTime(query.data.completed_at ?? query.data.recorded_at)}</>
              : "Chi tiết thông số và hướng xử lý của kết quả này."}
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? (
          <div className="grid min-h-60 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>
        ) : query.isError ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">Không thể tải chi tiết kết quả lúc này.</p>
            <Button variant="outline" onClick={() => query.refetch()} className="mt-4 rounded-full">Thử lại</Button>
          </div>
        ) : (
          <ResultBody result={query.data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultBody({ result }: { result: PatientClinicalResult }) {
  const { measurements, details, findings, conclusion, instruction, treatment } = result;
  const hasTreatment = Boolean(treatment.final_diagnosis || treatment.treatment_direction || treatment.doctor_advice);
  const abnormalCount = measurements.filter((item) => item.flag === "LOW" || item.flag === "HIGH").length;

  return (
    <div className="space-y-7 px-6 py-7 sm:px-8 sm:py-8">
      {details.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-2">
          {details.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-medium break-words">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {measurements.length > 0 && (
        <Block icon={Microscope} title="Thông số" aside={abnormalCount > 0 ? <span className="rounded-full bg-[var(--brand-coral)]/12 px-2.5 py-0.5 text-xs font-semibold text-[oklch(0.55_0.16_35)]">{abnormalCount} chỉ số ngoài khoảng tham chiếu</span> : <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Trong khoảng tham chiếu</span>}>
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Chỉ số</th>
                  <th className="px-4 py-2.5 text-right font-medium">Kết quả</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Tham chiếu</th>
                  <th className="px-4 py-2.5 text-right font-medium">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {measurements.map((item) => {
                  const meta = item.flag ? flagMeta[item.flag] : null;
                  const FlagIcon = meta?.icon;
                  return (
                    <tr key={item.label}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", item.flag && item.flag !== "NORMAL" && "font-semibold")}>
                        {item.value} <span className="text-xs text-muted-foreground">{item.unit}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-right text-xs text-muted-foreground tabular-nums sm:table-cell">{item.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {meta ? <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", meta.className)}>{FlagIcon && <FlagIcon className="size-3" />}{meta.label}</span> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> Khoảng tham chiếu chung cho người trưởng thành, chỉ mang tính tham khảo. Bác sĩ sẽ đánh giá dựa trên tình trạng cụ thể của bạn.</p>
        </Block>
      )}

      {findings && (
        <Block icon={FileSearch} title="Mô tả kết quả">
          <Paragraphs text={findings} className="text-sm leading-6 text-foreground/85" />
        </Block>
      )}

      {conclusion && (
        <Block icon={ClipboardList} title="Kết luận chuyên môn">
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
            <Paragraphs text={conclusion} className="text-sm font-medium leading-6" />
          </div>
        </Block>
      )}

      <Block icon={Stethoscope} title="Hướng xử lý">
        {hasTreatment ? (
          <div className="space-y-3 rounded-2xl bg-[var(--brand-coral-soft)] p-4">
            {treatment.final_diagnosis && <TreatmentItem label="Chẩn đoán của bác sĩ điều trị" text={treatment.final_diagnosis} />}
            {treatment.treatment_direction && <TreatmentItem label="Hướng điều trị" text={treatment.treatment_direction} />}
            {treatment.doctor_advice && <TreatmentItem label="Lời dặn" text={treatment.doctor_advice} />}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Bác sĩ điều trị chưa đưa ra hướng xử lý cho lượt khám này.</p>
        )}
      </Block>

      {instruction && (
        <p className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground"><HeartPulse className="mt-0.5 size-3.5 shrink-0" /> Chỉ định từ bác sĩ: {instruction}</p>
      )}
    </div>
  );
}

function Block({ icon: Icon, title, aside, children }: { icon: ComponentType<{ className?: string }>; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" /> {title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function TreatmentItem({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Paragraphs text={text} className="mt-1 text-sm leading-6" />
    </div>
  );
}
