"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Biohazard, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isolationService } from "@/services/isolation.service";

type SourceRoom = "REC-101" | "ER-102" | "PRE-503" | "ICU-505" | "IP-401" | "IP-402" | "OBS-403";

type ReferralForm = {
  isolation_type: string;
  reason: string;
  diagnosis: string;
  transport_condition: string;
  vital_signs: string;
  ppe_requirements: string;
  handoff_note: string;
};

/**
 * Điều phối bệnh nhân vào phòng cách ly ISO-404.
 * - `variant="panel"` (mặc định): khung vàng, mở biểu mẫu ngay bên dưới.
 * - `variant="compact"`: chỉ một nút nhỏ, biểu mẫu mở trong dialog.
 */
export function IsolationReferralPanel({
  sourceRoom,
  emergencyCaseId,
  medicalVisitId,
  defaultDiagnosis,
  variant = "panel",
}: {
  sourceRoom: SourceRoom;
  emergencyCaseId?: string;
  medicalVisitId?: string;
  defaultDiagnosis?: string | null;
  variant?: "panel" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<ReferralForm>({
    isolation_type: "CONTACT",
    reason: "",
    diagnosis: defaultDiagnosis ?? "",
    transport_condition: "",
    vital_signs: "",
    ppe_requirements: "Găng tay, áo choàng, khẩu trang y tế",
    handoff_note: "",
  });
  const m = useMutation({
    mutationFn: () => isolationService.createReferral({ ...f, source_room: sourceRoom, ...(emergencyCaseId ? { emergency_case_id: emergencyCaseId } : { medical_visit_id: medicalVisitId }) }),
    onSuccess: (r) => { toast.success(r.message); setOpen(false); },
    onError: () => toast.error("Không thể gửi yêu cầu. Bệnh nhân có thể đã có hồ sơ cách ly."),
  });

  const form = <ReferralFields f={f} setF={setF} isPending={m.isPending} onSubmit={() => m.mutate()} />;

  if (variant === "compact") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100" />}
        >
          <Biohazard className="size-3.5" /> Chuyển cách ly ISO-404
        </DialogTrigger>
        <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Biohazard className="size-4 text-amber-700" /> Điều phối vào ISO-404</DialogTitle>
              <span className="hidden h-4 w-px bg-border sm:block" />
              <DialogDescription className="text-sm">Tạo hồ sơ bàn giao riêng, ISO-404 sẽ xác nhận tiếp nhận.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="px-6 py-5">{form}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <section className="rounded-[1.4rem] border border-amber-300 bg-amber-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Biohazard className="size-5 text-amber-700" />
          <div>
            <h2 className="font-semibold text-amber-950">Điều phối vào ISO-404</h2>
            <p className="text-xs text-amber-900/70">Tạo hồ sơ bàn giao riêng, ISO-404 sẽ xác nhận tiếp nhận.</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white">{open ? "Đóng biểu mẫu" : "Tạo yêu cầu cách ly"}</button>
      </div>
      {open && <div className="mt-5">{form}</div>}
    </section>
  );
}

function ReferralFields({ f, setF, isPending, onSubmit }: { f: ReferralForm; setF: (next: ReferralForm) => void; isPending: boolean; onSubmit: () => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Loại cách ly
        <select value={f.isolation_type} onChange={(e) => setF({ ...f, isolation_type: e.target.value })} className="mt-2 h-10 w-full rounded-xl border bg-white px-3">
          <option value="CONTACT">Tiếp xúc</option>
          <option value="DROPLET">Giọt bắn</option>
          <option value="AIRBORNE">Không khí</option>
          <option value="PROTECTIVE">Bảo vệ</option>
        </select>
      </label>
      <Field label="Chẩn đoán nghi ngờ/xác định" value={f.diagnosis} set={(v) => setF({ ...f, diagnosis: v })} />
      <Area label="Lý do cách ly *" value={f.reason} set={(v) => setF({ ...f, reason: v })} />
      <Area label="Tình trạng vận chuyển" value={f.transport_condition} set={(v) => setF({ ...f, transport_condition: v })} />
      <Area label="Sinh hiệu trước chuyển" value={f.vital_signs} set={(v) => setF({ ...f, vital_signs: v })} />
      <Area label="PPE bắt buộc" value={f.ppe_requirements} set={(v) => setF({ ...f, ppe_requirements: v })} />
      <label className="text-sm font-medium sm:col-span-2">Ghi chú bàn giao
        <textarea rows={3} value={f.handoff_note} onChange={(e) => setF({ ...f, handoff_note: e.target.value })} className="mt-2 w-full rounded-xl border bg-white p-3 font-normal" />
      </label>
      <button disabled={isPending || f.reason.trim().length < 2} onClick={onSubmit} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:ml-auto sm:w-48">
        {isPending && <LoaderCircle className="size-4 animate-spin" />}Gửi ISO-404
      </button>
    </div>
  );
}

function Field({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return <label className="text-sm font-medium">{label}<input value={value} onChange={(e) => set(e.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-white px-3 font-normal" /></label>;
}

function Area({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return <label className="text-sm font-medium">{label}<textarea rows={3} value={value} onChange={(e) => set(e.target.value)} className="mt-2 w-full rounded-xl border bg-white p-3 font-normal" /></label>;
}
