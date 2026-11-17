"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  CircleCheck,
  ClipboardCheck,
  FileImage,
  HeartPulse,
  ImagePlus,
  ListPlus,
  LoaderCircle,
  MonitorDot,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { medicalVisitService } from "@/services/medical-visit.service";
import type { ReceptionQueueAppointment } from "@/types/api";

type DiagnosticWorkspaceProps = {
  roomCode: string;
  roomName: string;
  roomFunction: string;
  appointment: ReceptionQueueAppointment;
  /** Gọi sau khi bắt đầu thực hiện (để hàng đợi chuyển sang tab "Đang chẩn đoán"). */
  onStarted?: () => void;
};

export type FindingTemplate = { label: string; area: string; text: string };

type DiagnosticConfig = {
  type: string;
  title: string;
  areaLabel: string;
  areaPlaceholder: string;
  findingPlaceholder: string;
  startLabel: string;
  icon: typeof Activity;
  templates?: FindingTemplate[];
};

/** Mẫu mô tả siêu âm theo cơ quan — bác sĩ chèn rồi sửa theo hình ảnh thực tế. */
const ultrasoundTemplates: FindingTemplate[] = [
  {
    label: "Ổ bụng tổng quát",
    area: "Ổ bụng tổng quát",
    text: [
      "Gan: kích thước bình thường, nhu mô đồng nhất, bờ đều, không thấy khối khu trú.",
      "Đường mật: đường mật trong và ngoài gan không giãn.",
      "Túi mật: thành mỏng, lòng không có sỏi.",
      "Tụy: kích thước bình thường, cấu trúc đồng nhất.",
      "Lách: kích thước bình thường, nhu mô đồng nhất.",
      "Thận phải: kích thước bình thường, không sỏi, không ứ nước.",
      "Thận trái: kích thước bình thường, không sỏi, không ứ nước.",
      "Bàng quang: thành đều, lòng không có sỏi.",
      "Dịch ổ bụng: không có dịch tự do.",
    ].join("\n"),
  },
  {
    label: "Tuyến giáp",
    area: "Tuyến giáp",
    text: [
      "Thùy phải: kích thước bình thường, nhu mô đồng nhất.",
      "Thùy trái: kích thước bình thường, nhu mô đồng nhất.",
      "Eo giáp: không dày.",
      "Nhân giáp: không thấy nhân khu trú.",
      "Hạch vùng cổ: không thấy hạch bất thường.",
    ].join("\n"),
  },
  {
    label: "Tim",
    area: "Siêu âm tim qua thành ngực",
    text: [
      "Các buồng tim: kích thước bình thường.",
      "Van tim: hình thái và hoạt động van bình thường, không hở hẹp đáng kể.",
      "Chức năng tâm thu thất trái: bảo tồn, EF ước tính ...%.",
      "Vận động thành tim: không thấy rối loạn vận động vùng.",
      "Màng ngoài tim: không có dịch.",
    ].join("\n"),
  },
];

/** Mẫu mô tả X-quang thường dùng — bác sĩ chèn rồi sửa theo phim thực tế. */
const xrayTemplates: FindingTemplate[] = [
  {
    label: "Ngực thẳng",
    area: "X-quang ngực thẳng",
    text: [
      "Tim: bóng tim không to, chỉ số tim – lồng ngực trong giới hạn bình thường.",
      "Trung thất: không giãn rộng, khí quản ở đường giữa.",
      "Hai trường phổi: sáng đều, không thấy đám mờ hay nốt mờ khu trú.",
      "Rốn phổi: hai bên không đậm.",
      "Góc sườn hoành: hai bên nhọn.",
      "Vòm hoành: hai bên đều, bờ rõ.",
      "Khung xương lồng ngực: chưa thấy bất thường.",
    ].join("\n"),
  },
  {
    label: "Bụng không chuẩn bị",
    area: "X-quang bụng không chuẩn bị (tư thế đứng)",
    text: [
      "Hơi tự do dưới hoành: không thấy.",
      "Mức nước – hơi: không thấy.",
      "Bóng hơi dạ dày: bình thường.",
      "Hơi trong khung đại tràng: phân bố bình thường.",
      "Cản quang bất thường: không thấy hình cản quang vùng thận – niệu quản – bàng quang.",
    ].join("\n"),
  },
  {
    label: "Cột sống thắt lưng",
    area: "X-quang cột sống thắt lưng (thẳng, nghiêng)",
    text: [
      "Đường cong sinh lý: còn bảo tồn.",
      "Thân đốt sống: chiều cao bình thường, không thấy xẹp lún.",
      "Khe khớp đĩa đệm: không hẹp.",
      "Gai xương: không thấy.",
      "Cung sau và mỏm gai: chưa thấy bất thường.",
    ].join("\n"),
  },
];

/** Mẫu mô tả CT thường dùng — bác sĩ chèn rồi sửa theo hình ảnh thực tế. */
export const ctTemplates: FindingTemplate[] = [
  {
    label: "Sọ não không cản quang",
    area: "CT sọ não không cản quang",
    text: [
      "Nhu mô não: không thấy ổ tăng hay giảm tỷ trọng bất thường.",
      "Hệ thống não thất: không giãn, cân đối hai bên.",
      "Đường giữa: không di lệch.",
      "Khoang dưới nhện: không thấy máu tụ.",
      "Xương sọ: chưa thấy đường vỡ.",
      "Các xoang cạnh mũi: thông thoáng.",
    ].join("\n"),
  },
  {
    label: "Ngực",
    area: "CT ngực",
    text: [
      "Nhu mô phổi: không thấy nốt hay đám đông đặc.",
      "Phế quản: thành không dày, lòng không giãn.",
      "Trung thất: không thấy khối.",
      "Hạch: không thấy hạch trung thất và rốn phổi to.",
      "Màng phổi: không có dịch, không dày.",
      "Tim và mạch máu lớn: kích thước bình thường.",
    ].join("\n"),
  },
  {
    label: "Bụng – chậu có cản quang",
    area: "CT bụng – chậu có tiêm thuốc cản quang",
    text: [
      "Gan: kích thước bình thường, ngấm thuốc đồng nhất, không thấy khối khu trú.",
      "Đường mật: không giãn.",
      "Tụy: kích thước và ngấm thuốc bình thường.",
      "Lách: kích thước bình thường.",
      "Thận: hai thận ngấm và thải thuốc bình thường, không sỏi, không ứ nước.",
      "Ống tiêu hóa: thành không dày, không thấy dấu hiệu tắc.",
      "Hạch ổ bụng: không thấy hạch to.",
      "Dịch tự do: không có dịch ổ bụng – chậu.",
    ].join("\n"),
  },
];

const configs: Record<string, DiagnosticConfig> = {
  US: {
    type: "ULTRASOUND",
    title: "Phiếu kết quả siêu âm",
    areaLabel: "Vùng siêu âm",
    areaPlaceholder: "Ví dụ: Ổ bụng tổng quát",
    findingPlaceholder: "Mô tả hình ảnh, kích thước, cấu trúc và bất thường quan sát được...",
    startLabel: "Gọi bệnh nhân vào siêu âm",
    icon: MonitorDot,
    templates: ultrasoundTemplates,
  },
  XR: {
    type: "X_RAY",
    title: "Phiếu kết quả X-quang",
    areaLabel: "Vị trí chụp",
    areaPlaceholder: "Ví dụ: X-quang ngực thẳng",
    findingPlaceholder: "Mô tả trường phổi, tim, trung thất và các dấu hiệu bất thường...",
    startLabel: "Gọi bệnh nhân vào chụp X-quang",
    icon: FileImage,
    templates: xrayTemplates,
  },
  CT: {
    type: "CT_SCAN",
    title: "Phiếu kết quả chụp CT",
    areaLabel: "Vùng khảo sát",
    areaPlaceholder: "Ví dụ: CT sọ não không cản quang",
    findingPlaceholder: "Mô tả mật độ, tổn thương, kích thước và vị trí trên hình ảnh CT...",
    startLabel: "Gọi bệnh nhân vào chụp CT",
    icon: ImagePlus,
    templates: ctTemplates,
  },
  ECG: {
    type: "ECG",
    title: "Phiếu kết quả điện tim",
    areaLabel: "Kỹ thuật thực hiện",
    areaPlaceholder: "Điện tâm đồ 12 chuyển đạo",
    findingPlaceholder: "Mô tả nhịp, tần số, trục tim, khoảng dẫn truyền và biến đổi ST-T...",
    startLabel: "Gọi bệnh nhân vào đo điện tim",
    icon: HeartPulse,
  },
};

export function DiagnosticWorkspace({ roomCode, roomName, roomFunction, appointment, onStarted }: DiagnosticWorkspaceProps) {
  const prefix = roomCode.split("-")[0];
  const config = configs[prefix] ?? configs.US;
  const Icon = config.icon;
  const visit = appointment.medical_visits[0];
  const currentStep = visit?.steps?.find((step) => step.room.room_code === roomCode && (step.status === "PENDING" || step.status === "IN_PROGRESS"));
  const started = currentStep?.status === "IN_PROGRESS";
  const instruction = currentStep?.instruction || "Không có ghi chú bổ sung từ bác sĩ chỉ định.";
  const sourceRoom = visit?.receiving_room.room_code ?? "Phòng khám bác sĩ";
  const preliminaryDiagnosis = visit?.examination_record?.preliminary_diagnosis;
  const [area, setArea] = useState("");
  const [findings, setFindings] = useState("");
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
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu thực hiện.")),
  });

  const completeMutation = useMutation({
    mutationFn: (result: string) => medicalVisitService.completeVisitStep(currentStep!.id, { result }),
    onSuccess: async (response) => {
      await refreshQueues();
      toast.success(response.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể gửi kết quả chẩn đoán.")),
  });

  function insertTemplate(template: FindingTemplate) {
    if (!area.trim()) setArea(template.area);
    setFindings((current) => current.trim() ? `${current.trimEnd()}\n\n${template.text}` : template.text);
    toast.success(`Đã chèn mẫu mô tả “${template.label}”.`, { description: "Chỉnh lại theo hình ảnh thực tế trước khi gửi." });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentStep) {
      toast.error("Không tìm thấy bước chẩn đoán của bệnh nhân tại phòng này.");
      return;
    }
    if (!started) {
      toast.error("Cần gọi bệnh nhân vào phòng trước khi gửi kết quả.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const conclusion = String(formData.get("conclusion") ?? "").trim();
    if (!conclusion) {
      toast.error("Vui lòng nhập kết luận chuyên môn.");
      return;
    }
    completeMutation.mutate(formatDiagnosticResult(formData, config));
  }

  return (
    <form className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700"><Icon className="size-4" /></span>
        <h2 className="text-[0.95rem] font-semibold">{config.title}</h2><span className="hidden h-5 w-px bg-border sm:block" /><p className="min-w-0 flex-1 text-xs text-muted-foreground">{roomCode} · {roomName}</p>
        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", started ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}><span className={cn("size-1.5 rounded-full", started ? "bg-sky-500" : "bg-amber-500")} /> {started ? "Đang thực hiện" : "Chờ thực hiện"}</span>
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
            <span className="grid size-11 place-items-center rounded-2xl bg-sky-100 text-sky-700"><UserRoundCheck className="size-5" /></span>
            <div>
              <p className="text-sm font-semibold">{config.startLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">Bấm khi bệnh nhân đã vào phòng. Sau đó mới nhập được kết quả.</p>
            </div>
            <Button type="button" disabled={!currentStep || startMutation.isPending} onClick={() => startMutation.mutate()} className="h-10 rounded-full px-5">
              {startMutation.isPending ? <LoaderCircle className="animate-spin" /> : <UserRoundCheck />} Bắt đầu thực hiện
            </Button>
          </section>
        ) : (
          <section className="space-y-4">
            <SectionTitle index={2} title="Kết quả thực hiện" description="Ghi nhận kết quả chuyên môn tại phòng chức năng" />
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="diagnostic-area">{config.areaLabel}</Label><Input id="diagnostic-area" name="area" value={area} onChange={(event) => setArea(event.target.value)} placeholder={config.areaPlaceholder} className="h-11 rounded-xl px-3" /></div>
              <div className="space-y-2"><Label htmlFor="diagnostic-technique">Kỹ thuật / thiết bị</Label><Input id="diagnostic-technique" name="technique" placeholder="Nhập kỹ thuật hoặc thiết bị sử dụng" className="h-11 rounded-xl px-3" /></div>
            </div>
            {config.type === "ECG" && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Measurement name="heart_rate" label="Tần số tim" unit="bpm" /><Measurement name="pr" label="PR" unit="ms" /><Measurement name="qrs" label="QRS" unit="ms" /><Measurement name="qt_qtc" label="QT/QTc" unit="ms" /></div>}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="diagnostic-findings">Mô tả kết quả</Label>
                {config.templates && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><ListPlus className="size-3.5" /> Chèn mẫu:</span>
                    {config.templates.map((template) => (
                      <button key={template.label} type="button" onClick={() => insertTemplate(template)} className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-primary transition hover:border-primary/40 hover:bg-primary/[0.05]">{template.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <Textarea id="diagnostic-findings" name="findings" rows={8} value={findings} onChange={(event) => setFindings(event.target.value)} placeholder={config.findingPlaceholder} className="min-h-40 resize-y rounded-xl p-3 leading-6" />
            </div>
            <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4"><div className="flex items-center gap-2"><Stethoscope className="size-4 text-primary" /><Label htmlFor="diagnostic-conclusion">Kết luận chuyên môn</Label></div><Textarea id="diagnostic-conclusion" name="conclusion" rows={4} placeholder="Nhập kết luận ngắn gọn để bác sĩ chỉ định xem kết quả..." className="min-h-24 resize-none rounded-xl bg-background p-3" /></div>
          </section>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="hidden text-xs text-muted-foreground lg:block">{started ? `Kết quả sẽ được gửi về phòng bác sĩ chỉ định (${sourceRoom}) sau khi hoàn thành.` : "Gọi bệnh nhân vào phòng để mở phiếu nhập kết quả."}</p>
        <div className="flex sm:ml-auto"><Hint content={`Lưu kết luận chuyên môn và gửi kết quả về ${sourceRoom}.`}><Button type="submit" className="h-10 rounded-full px-5" disabled={completeMutation.isPending || !currentStep || !started}>{completeMutation.isPending ? <LoaderCircle className="animate-spin" /> : <CircleCheck />} {completeMutation.isPending ? "Đang gửi..." : "Hoàn thành & gửi kết quả"}</Button></Hint></div>
      </div>
    </form>
  );
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

function Measurement({ name, label, unit }: { name: string; label: string; unit: string }) {
  return <div className="rounded-xl bg-muted/60 p-3"><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1 flex items-end gap-1"><Input name={name} className="h-8 border-0 bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0" placeholder="--" /><span className="pb-1 text-[0.65rem] text-muted-foreground">{unit}</span></div></div>;
}

function formatDiagnosticResult(formData: FormData, config: DiagnosticConfig) {
  const read = (name: string) => String(formData.get(name) ?? "").trim();
  const lines = [
    `Loại thực hiện: ${config.title.replace("Phiếu kết quả ", "")}`,
    read("area") && `${config.areaLabel}: ${read("area")}`,
    read("technique") && `Kỹ thuật / thiết bị: ${read("technique")}`,
    read("heart_rate") && `Tần số tim: ${read("heart_rate")} bpm`,
    read("pr") && `PR: ${read("pr")} ms`,
    read("qrs") && `QRS: ${read("qrs")} ms`,
    read("qt_qtc") && `QT/QTc: ${read("qt_qtc")} ms`,
    read("findings") && `Mô tả kết quả: ${read("findings")}`,
    `Kết luận chuyên môn: ${read("conclusion")}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function Hint({ content, children }: { content: string; children: ReactNode }) {
  return <span className="group/hint relative inline-flex"><span className="inline-flex">{children}</span><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-64 -translate-x-1/2 translate-y-1 rounded-lg bg-foreground px-3 py-2 text-center text-xs font-medium leading-4 text-background opacity-0 shadow-xl transition group-hover/hint:translate-y-0 group-hover/hint:opacity-100 group-focus-within/hint:translate-y-0 group-focus-within/hint:opacity-100">{content}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" /></span></span>;
}
