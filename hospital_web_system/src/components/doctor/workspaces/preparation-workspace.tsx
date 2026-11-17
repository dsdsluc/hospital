"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, Eye, FlaskConical, ListPlus, LoaderCircle, PenLine, RotateCcw, ScanLine, Search, Send, Stethoscope, Truck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { emergencyService, type EmergencyPreparation, type PreparationDestination, type PreparationOrder } from "@/services/emergency.service";
import { IsolationReferralPanel } from "@/components/doctor/workspaces/isolation-referral-panel";
import { EmergencyVitals } from "@/components/doctor/workspaces/emergency-workspace";
import { ctTemplates } from "@/components/doctor/workspaces/diagnostic-workspace";
import { getVitalFlag } from "@/components/doctor/workspaces/reception-measure-dialog";

const orderInfo = { BLOOD_TEST: { label: "Xét nghiệm máu", icon: FlaskConical }, ULTRASOUND: { label: "Siêu âm tại chỗ", icon: Activity }, CT_SCAN: { label: "CT tại chỗ", icon: ScanLine } } as const;
const destinations: Array<{ code: PreparationDestination; name: string; group: string }> = [
  { code: "OR-501", name: "Phòng phẫu thuật 1", group: "Phẫu thuật" }, { code: "OR-502", name: "Phòng phẫu thuật 2", group: "Phẫu thuật" },
  { code: "ICU-505", name: "Hồi sức tích cực", group: "Tầng 5" }, { code: "IP-401", name: "Phòng bệnh 1", group: "Tầng 4" },
  { code: "IP-402", name: "Phòng bệnh 2", group: "Tầng 4" }, { code: "OBS-403", name: "Phòng theo dõi", group: "Tầng 4" },
];

/** 3. Mẫu kết quả chèn nhanh cho từng loại chỉ định tại PRE-503 (điền số liệu thực tế vào chỗ "..."). */
const resultTemplates: Record<PreparationOrder["order_type"], Array<{ label: string; text: string }>> = {
  BLOOD_TEST: [{
    label: "Xét nghiệm khẩn",
    text: ["Hb: ... g/dL", "Hct: ... %", "Tiểu cầu: ... G/L", "Bạch cầu: ... G/L", "Nhóm máu: ... Rh(...)", "PT/INR: ...", "aPTT: ... giây", "Lactate: ... mmol/L", "Đường huyết: ... mmol/L", "Kết luận: ..."].join("\n"),
  }],
  ULTRASOUND: [
    {
      label: "FAST",
      text: ["Khoang Morison (gan – thận): không có dịch / có dịch ...", "Quanh lách (lách – thận): không có dịch / có dịch ...", "Túi cùng Douglas / quanh bàng quang: không có dịch / có dịch ...", "Màng ngoài tim: không có dịch / có dịch ...", "Kết luận FAST: Âm tính / Dương tính"].join("\n"),
    },
    {
      label: "eFAST (thêm phổi)",
      text: ["Khoang Morison (gan – thận): không có dịch / có dịch ...", "Quanh lách (lách – thận): không có dịch / có dịch ...", "Túi cùng Douglas / quanh bàng quang: không có dịch / có dịch ...", "Màng ngoài tim: không có dịch / có dịch ...", "Phổi phải: còn dấu trượt màng phổi / mất dấu trượt (nghi tràn khí)", "Phổi trái: còn dấu trượt màng phổi / mất dấu trượt (nghi tràn khí)", "Kết luận eFAST: ..."].join("\n"),
    },
  ],
  CT_SCAN: ctTemplates.filter((template) => template.label !== "Ngực").map((template) => ({ label: template.label, text: template.text })),
};

/** Thứ tự ưu tiên: tối khẩn → khẩn → xử lý sớm; cùng mức thì ai chờ lâu hơn trước. */
const urgencyOrder = { IMMEDIATE: 0, URGENT: 1, EXPEDITED: 2 } as const;
const urgencyStyle: Record<EmergencyPreparation["urgency"], string> = {
  IMMEDIATE: "bg-red-100 text-red-700",
  URGENT: "bg-orange-100 text-orange-700",
  EXPEDITED: "bg-amber-100 text-amber-700",
};
/** Ca chưa tiếp nhận chờ quá số phút này thì tô đỏ. */
const LONG_WAIT_MINUTES = 10;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function PreparationWorkspace() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["emergency-preparations"], queryFn: emergencyService.getPreparations, refetchInterval: 10_000 });
  const preparations = [...(query.data ?? [])].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || a.requested_at.localeCompare(b.requested_at));
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const now = useNow();
  const keyword = normalize(search.trim());
  const visible = keyword ? preparations.filter((item) => normalize([item.emergency_case?.full_name ?? "", item.emergency_case?.emergency_code ?? "", item.suspected_diagnosis ?? ""].join(" ")).includes(keyword)) : preparations;
  const selected = preparations.find((item) => item.id === selectedId) ?? preparations[0];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["emergency-preparations"] });
  const start = useMutation({ mutationFn: emergencyService.startPreparation, onSuccess: async (data) => { await refresh(); toast.success(data.message); }, onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu chuẩn bị.")) });

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Chờ tiếp nhận" value={preparations.filter((x) => x.status === "REQUESTED").length} /><Metric label="Đang chuẩn bị" value={preparations.filter((x) => x.status === "IN_PROGRESS").length} /><Metric label="Tối khẩn" value={preparations.filter((x) => x.urgency === "IMMEDIATE").length} /><Metric label="Tổng ca" value={preparations.length} /></div>
    <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Ca chờ tại PRE-503</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{preparations.length} ca · tối khẩn lên trước</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã ca hoặc chẩn đoán" className="h-10 rounded-xl pl-9 pr-9" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
          </div>
        </div>
        <div className="space-y-2 p-2">
          {query.isPending ? <Empty text="Đang tải..." /> : preparations.length === 0 ? <Empty text="Chưa có ca chờ chuẩn bị phẫu thuật." /> : visible.length === 0 ? <Empty text={`Không tìm thấy ca phù hợp với “${search.trim()}”.`} /> : visible.map((item) => <CaseRow key={item.id} item={item} now={now} active={item.id === selected?.id} onClick={() => setSelectedId(item.id)} />)}
        </div>
      </section>
      <section className="min-w-0 space-y-5">{selected ? <>
        <CaseHeader item={selected} now={now} />
        {selected.emergency_case && <EmergencyVitals item={selected.emergency_case} title="Sinh hiệu ghi nhận tại ER-102" />}
        {selected.status === "REQUESTED" ? (
          <div className="rounded-[1.4rem] border bg-card p-8 text-center shadow-sm">
            <ClipboardCheck className="mx-auto size-9 text-primary" />
            <h2 className="mt-3 text-lg font-semibold">Xác nhận tiếp nhận tại PRE-503</h2>
            <p className="mt-1 text-sm text-muted-foreground">Bắt đầu theo dõi và thực hiện các chỉ định tại chỗ.</p>
            <Button onClick={() => start.mutate(selected.id)} disabled={start.isPending} className="mt-5 rounded-full px-6">{start.isPending ? <LoaderCircle className="animate-spin" /> : <Stethoscope />} Bắt đầu chuẩn bị</Button>
          </div>
        ) : <><OrdersPanel preparation={selected} onSaved={refresh} /><DispositionPanel key={selected.id} preparation={selected} onSaved={refresh} /></>}
      </> : <Empty text="Chọn một ca để xử lý." />}</section>
    </div>
  </div>;
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/* ───────── ① Chỉ định tại PRE-503: danh sách gọn, nhập / xem kết quả trong dialog ───────── */

function OrdersPanel({ preparation, onSaved }: { preparation: EmergencyPreparation; onSaved: () => Promise<unknown> }) {
  const done = preparation.orders.filter((order) => order.status === "COMPLETED").length;
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={1} title="Chỉ định thực hiện tại PRE-503" description={`${done}/${preparation.orders.length} đã có kết quả · nhập trực tiếp, không chuyển phòng chức năng`} />
    <ul className="divide-y rounded-2xl border">{preparation.orders.map((order) => <OrderRow key={`${order.id}-${order.status}`} order={order} onSaved={onSaved} />)}</ul>
  </section>;
}

function OrderRow({ order, onSaved }: { order: PreparationOrder; onSaved: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const meta = orderInfo[order.order_type];
  const Icon = meta.icon;
  const completed = order.status === "COMPLETED";
  return <li className="flex flex-wrap items-center gap-3 p-3.5">
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", completed ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary")}><Icon className="size-4" /></span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">{meta.label}</p>
      <p className="truncate text-xs text-muted-foreground">{completed ? (order.result?.split("\n").find((line) => line.trim()) ?? "Đã có kết quả") : "Chưa có kết quả"}</p>
    </div>
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{completed ? <><CheckCircle2 className="size-3.5" /> Có kết quả{order.completed_at ? ` ${formatClock(order.completed_at)}` : ""}</> : "Đang chờ"}</span>
    <Button type="button" size="sm" variant={completed ? "ghost" : "default"} className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={() => setOpen(true)}>{completed ? <><Eye /> Xem</> : <><PenLine /> Nhập kết quả</>}</Button>
    <OrderResultDialog order={order} open={open} onOpenChange={setOpen} onSaved={onSaved} />
  </li>;
}

function OrderResultDialog({ order, open, onOpenChange, onSaved }: { order: PreparationOrder; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<unknown> }) {
  const meta = orderInfo[order.order_type];
  const Icon = meta.icon;
  const completed = order.status === "COMPLETED";
  const [result, setResult] = useState("");
  const mutation = useMutation({
    mutationFn: (value: string) => emergencyService.completePreparationOrder(order.id, value),
    onSuccess: async (data) => { await onSaved(); onOpenChange(false); toast.success(data.message); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể lưu kết quả.")),
  });
  function submit() {
    if (!result.trim()) return toast.error("Vui lòng nhập kết quả.");
    mutation.mutate(result.trim());
  }
  function insertTemplate(text: string) { setResult((current) => current.trim() ? `${current.trimEnd()}\n\n${text}` : text); }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
      <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Icon className="size-4 text-primary" /> {meta.label}</DialogTitle>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <DialogDescription className="text-sm">{completed ? `Kết quả lúc ${order.completed_at ? formatClock(order.completed_at) : "—"}` : "Nhập kết quả thực hiện tại PRE-503"}</DialogDescription>
        </div>
      </DialogHeader>
      <div className="px-6 py-5">
        {completed ? <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm leading-6">{order.result}</p> : <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><ListPlus className="size-3.5" /> Chèn mẫu:</span>
            {resultTemplates[order.order_type].map((template) => <button key={template.label} type="button" onClick={() => insertTemplate(template.text)} className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-primary transition hover:border-primary/40 hover:bg-primary/[0.05]">{template.label}</button>)}
          </div>
          <Textarea autoFocus rows={10} value={result} onChange={(event) => setResult(event.target.value)} placeholder={`Nhập kết quả ${meta.label.toLocaleLowerCase("vi")}...`} className="mt-2 min-h-56 resize-y rounded-xl leading-6" />
          <p className={cn("mt-2 text-xs", result.includes("...") ? "font-medium text-amber-700" : "text-muted-foreground")}>{result.includes("...") ? "Còn chỗ “...” chưa điền trong mẫu — vẫn có thể lưu." : "Điền số liệu vào các chỗ “...” và xóa lựa chọn không đúng."}</p>
        </>}
      </div>
      <div className="flex justify-end gap-2 border-t bg-muted/40 px-6 py-4">
        <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>{completed ? "Đóng" : "Hủy"}</Button>
        {!completed && <Button type="button" disabled={mutation.isPending} onClick={submit} className="rounded-full">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Hoàn thành kết quả</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}

type VitalKey = "pulse_bpm" | "blood_pressure" | "spo2_percent" | "temperature_c" | "respiratory_rate" | "consciousness";
const vitalInputs: Array<{ name: VitalKey; label: string; placeholder: string; wide?: boolean }> = [
  { name: "pulse_bpm", label: "Mạch (bpm)", placeholder: "Chỉ nhập số" },
  { name: "blood_pressure", label: "Huyết áp (mmHg)", placeholder: "120/80" },
  { name: "spo2_percent", label: "SpO₂ (%)", placeholder: "Chỉ nhập số" },
  { name: "temperature_c", label: "Nhiệt độ (°C)", placeholder: "Chỉ nhập số" },
  { name: "respiratory_rate", label: "Nhịp thở (lần/phút)", placeholder: "Chỉ nhập số" },
  { name: "consciousness", label: "Ý thức", placeholder: "Tỉnh táo, lơ mơ...", wide: true },
];

function vitalFlag(name: VitalKey, value: string): "LOW" | "NORMAL" | "HIGH" | null {
  if (!value.trim()) return null;
  if (name === "pulse_bpm") return getVitalFlag("heartRate", value);
  if (name === "blood_pressure") return getVitalFlag("bloodPressure", value);
  if (name === "spo2_percent") return getVitalFlag("spo2", value);
  if (name === "temperature_c") return getVitalFlag("temperature", value);
  if (name === "respiratory_rate") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n < 12 ? "LOW" : n > 20 ? "HIGH" : "NORMAL";
  }
  return null;
}

/** 5. Tình trạng phòng mổ: số ca đang mổ / chờ mổ ở OR-501, OR-502. */
function useOperatingRoomLoad() {
  const rooms = ["OR-501", "OR-502"] as const;
  const queries = useQueries({ queries: rooms.map((room) => ({ queryKey: ["or-load", room], queryFn: () => emergencyService.getSurgicalTransfers(room), refetchInterval: 15_000 })) });
  return new Map(rooms.map((room, index) => {
    const data = queries[index]?.data;
    return [room, data ? { operating: data.filter((item) => item.surgery_status === "IN_PROGRESS").length, waiting: data.filter((item) => item.surgery_status === "WAITING").length } : null] as const;
  }));
}

/* ───────── ② Đánh giá & chuyển phòng: thẻ tóm tắt trên trang, nhập liệu trong dialog 2 bước ───────── */

function DispositionPanel({ preparation, onSaved }: { preparation: EmergencyPreparation; onSaved: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const total = preparation.orders.length;
  const done = preparation.orders.filter((order) => order.status === "COMPLETED").length;
  const ready = done === total;
  const orLoad = useOperatingRoomLoad();
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={2} title="Đánh giá & chuyển phòng" description="Chẩn đoán sơ bộ, sinh hiệu đo lại và phòng chuyển tiếp" />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{ready ? <CheckCircle2 className="size-5" /> : <Clock3 className="size-5" />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{ready ? "Đã đủ kết quả để điều phối" : `Còn ${total - done} chỉ định chưa có kết quả · vẫn có thể chuyển phòng`}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Phòng mổ: {(["OR-501", "OR-502"] as const).map((room, index) => {
            const load = orLoad.get(room);
            return <span key={room}>{index > 0 && " · "}{room} {load ? (load.operating + load.waiting === 0 ? "trống" : `${load.operating} đang mổ, ${load.waiting} chờ`) : "…"}</span>;
          })}
        </p>
      </div>
      <Button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full px-5"><Send /> Đánh giá & chuyển phòng</Button>
    </div>
    <DispositionDialog preparation={preparation} open={open} onOpenChange={setOpen} onSaved={onSaved} orLoad={orLoad} />
  </section>;
}

type OrLoad = ReturnType<typeof useOperatingRoomLoad>;

function DispositionDialog({ preparation, open, onOpenChange, onSaved, orLoad }: { preparation: EmergencyPreparation; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<unknown>; orLoad: OrLoad }) {
  const [step, setStep] = useState<"ASSESS" | "ROOM">("ASSESS");
  const [diagnosis, setDiagnosis] = useState(preparation.suspected_diagnosis ?? "");
  const [destination, setDestination] = useState<PreparationDestination>();
  const [note, setNote] = useState("");
  const assessmentRef = preparation.emergency_case?.assessment;
  // Sinh hiệu tại ER chỉ là tham chiếu: ô nhập để trống để đo lại (hoặc chủ động dùng lại số đo ER).
  const erValues: Record<VitalKey, string> = {
    pulse_bpm: assessmentRef?.pulse_bpm != null ? String(assessmentRef.pulse_bpm) : "",
    blood_pressure: assessmentRef?.systolic_pressure && assessmentRef.diastolic_pressure ? `${assessmentRef.systolic_pressure}/${assessmentRef.diastolic_pressure}` : "",
    spo2_percent: assessmentRef?.spo2_percent != null ? String(assessmentRef.spo2_percent) : "",
    temperature_c: assessmentRef?.temperature_c != null ? String(assessmentRef.temperature_c) : "",
    respiratory_rate: assessmentRef?.respiratory_rate != null ? String(assessmentRef.respiratory_rate) : "",
    consciousness: assessmentRef?.consciousness ?? "",
  };
  const [vitals, setVitals] = useState<Record<VitalKey, string>>({ pulse_bpm: "", blood_pressure: "", spo2_percent: "", temperature_c: "", respiratory_rate: "", consciousness: "" });
  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof emergencyService.decideDisposition>[1]) => emergencyService.decideDisposition(preparation.id, payload),
    onSuccess: async (data) => { await onSaved(); onOpenChange(false); toast.success(data.message); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể chuyển phòng.")),
  });

  // Không chặn chuyển bước: thông tin còn thiếu chỉ được nhắc ở bước 2.
  const missingFields = [
    !diagnosis.trim() && "chẩn đoán sơ bộ",
    ...vitalInputs.filter((field) => !vitals[field.name].trim()).map((field) => field.label.replace(/ \(.*\)/, "").toLocaleLowerCase("vi")),
  ].filter(Boolean) as string[];
  function goToRoom() {
    setStep("ROOM");
  }
  function confirm() {
    if (!destination) return toast.error("Chọn phòng chuyển tiếp.");
    mutation.mutate({ destination_room: destination, preliminary_diagnosis: diagnosis.trim(), pulse: vitals.pulse_bpm.trim(), blood_pressure: vitals.blood_pressure.trim(), spo2: vitals.spo2_percent.trim(), temperature: vitals.temperature_c.trim(), respiratory_rate: vitals.respiratory_rate.trim(), consciousness: vitals.consciousness.trim(), disposition_note: note.trim() || null });
  }
  const abnormalCount = vitalInputs.filter((field) => { const flag = vitalFlag(field.name, vitals[field.name]); return flag === "LOW" || flag === "HIGH"; }).length;

  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (next) setStep("ASSESS"); }}>
    <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
      <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Send className="size-4 text-primary" /> Đánh giá & chuyển phòng</DialogTitle>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <DialogDescription className="text-sm">{preparation.emergency_case?.full_name} · {preparation.emergency_case?.emergency_code}</DialogDescription>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <StepDot index={1} label="Đánh giá trước chuyển" active={step === "ASSESS"} done={step === "ROOM"} onClick={() => setStep("ASSESS")} />
          <span className="h-px w-8 bg-border" />
          <StepDot index={2} label="Chọn phòng chuyển tiếp" active={step === "ROOM"} onClick={goToRoom} />
        </div>
      </DialogHeader>

      {step === "ASSESS" ? (
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2 xl:col-span-3"><span className="block text-xs text-muted-foreground">Chẩn đoán sơ bộ</span><Textarea rows={3} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="Tổng hợp kết quả và nhập chẩn đoán sơ bộ..." className="resize-none rounded-xl" /></label>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 sm:col-span-2 xl:col-span-3">
            <span>Đo lại sinh hiệu trước khi chuyển. Số đo tại ER{assessmentRef?.assessed_at ? ` lúc ${formatClock(assessmentRef.assessed_at)}` : ""} hiện dưới mỗi ô.</span>
            <button type="button" onClick={() => setVitals(erValues)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><RotateCcw className="size-3.5" /> Dùng lại số đo tại ER</button>
          </div>
          {vitalInputs.map((field) => <VitalInput key={field.name} {...field} value={vitals[field.name]} erValue={erValues[field.name]} flag={vitalFlag(field.name, vitals[field.name])} onChange={(value) => setVitals((current) => ({ ...current, [field.name]: value }))} />)}
        </div>
      ) : (
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground">Chẩn đoán sơ bộ</p>
            <p className="mt-0.5 font-medium">{diagnosis.trim() || <span className="font-normal text-muted-foreground">Chưa nhập</span>}</p>
            <p className="mt-2 text-xs text-muted-foreground">Sinh hiệu: {vitals.pulse_bpm || "—"} bpm · HA {vitals.blood_pressure || "—"} · SpO₂ {vitals.spo2_percent || "—"}% · {vitals.temperature_c || "—"}°C · thở {vitals.respiratory_rate || "—"}/phút{abnormalCount > 0 && <span className="ml-1.5 rounded-full bg-[var(--brand-coral-soft)] px-1.5 font-semibold text-[oklch(0.55_0.16_35)]">{abnormalCount} bất thường</span>}</p>
          </div>
          {preparation.orders.some((order) => order.status !== "COMPLETED") && (
            <p className="rounded-xl border border-destructive/25 bg-destructive/[0.05] px-3.5 py-2.5 text-xs text-destructive">
              Còn chưa có kết quả: {preparation.orders.filter((order) => order.status !== "COMPLETED").map((order) => orderInfo[order.order_type].label).join(", ")}. Sau khi chuyển sẽ không nhập kết quả tại PRE-503 được nữa; thông tin này được ghi tự động vào ghi chú bàn giao.
            </p>
          )}
          {missingFields.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <span>Chưa nhập: {missingFields.join(", ")}. Vẫn có thể chuyển phòng.</span>
              <button type="button" onClick={() => setStep("ASSESS")} className="font-medium text-primary hover:underline">Bổ sung</button>
            </p>
          )}
          <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{destinations.map((room) => {
            const load = room.code === "OR-501" || room.code === "OR-502" ? orLoad.get(room.code) : undefined;
            const free = load && load.operating === 0 && load.waiting === 0;
            const selected = destination === room.code;
            return <button key={room.code} type="button" onClick={() => setDestination(room.code)} aria-pressed={selected} className={cn("flex h-full flex-col items-start rounded-2xl border p-3.5 text-left transition", selected ? "border-primary bg-primary/[.06] ring-2 ring-primary/15" : "hover:border-primary/30")}>
              <p className="text-xs font-medium text-primary">{room.code} · {room.group}</p>
              <p className={cn("mt-0.5 text-sm", selected ? "font-semibold" : "font-medium")}>{room.name}</p>
              {/* Dòng trạng thái luôn chiếm chỗ để các ô cao bằng nhau */}
              <span className="mt-auto pt-1.5 text-[0.7rem]">
                {load === undefined ? <span className="text-muted-foreground">Nhận bệnh nhân chuyển tiếp</span>
                  : load === null ? <span className="inline-flex items-center gap-1 text-muted-foreground"><LoaderCircle className="size-3 animate-spin" /> Đang tải...</span>
                  : <span className={cn("inline-flex rounded-full px-2 py-0.5 font-medium", free ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{free ? "Đang trống" : `${load.operating} đang mổ · ${load.waiting} chờ mổ`}</span>}
              </span>
            </button>;
          })}</div>
          <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú bàn giao và tình trạng bệnh nhân..." className="resize-none rounded-xl" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
        {step === "ASSESS" ? <>
          <p className="text-xs text-muted-foreground">Có thể bổ sung sau; thông tin còn thiếu sẽ được nhắc ở bước 2.</p>
          <Button type="button" onClick={goToRoom} className="rounded-full px-5">Tiếp tục <ArrowRight /></Button>
        </> : <>
          <Button type="button" variant="ghost" onClick={() => setStep("ASSESS")} className="rounded-full px-4"><ArrowLeft /> Quay lại</Button>
          <Button type="button" disabled={!destination || mutation.isPending} onClick={confirm} className="rounded-full px-5">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <ArrowRight />} Xác nhận chuyển {destination ?? "phòng"}</Button>
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}

function StepDot({ index, label, active, done, onClick }: { index: number; label: string; active: boolean; done?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex items-center gap-1.5 font-medium transition", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
    <span className={cn("grid size-5 place-items-center rounded-full text-[0.65rem] font-bold", active ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{done && !active ? <CheckCircle2 className="size-3" /> : index}</span>
    {label}
  </button>;
}

function VitalInput({ name, label, placeholder, wide, value, erValue, flag, onChange }: { name: VitalKey; label: string; placeholder: string; wide?: boolean; value: string; erValue: string; flag: "LOW" | "NORMAL" | "HIGH" | null; onChange: (value: string) => void }) {
  const numeric = name !== "blood_pressure" && name !== "consciousness";
  const abnormal = flag === "LOW" || flag === "HIGH";
  return <label className={cn("space-y-1.5 text-sm font-medium", wide && "sm:col-span-2")}>
    <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{label}{abnormal && <span className={cn("rounded-full px-1.5 text-[0.6rem] font-semibold leading-4", flag === "LOW" ? "bg-sky-100 text-sky-700" : "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]")}>{flag === "LOW" ? "Thấp" : "Cao"}</span>}</span>
    <input name={name} value={value} onChange={(event) => onChange(event.target.value)} inputMode={numeric ? "decimal" : "text"} placeholder={placeholder} className={cn("h-10 w-full rounded-xl border border-input bg-background px-3 text-sm tabular-nums outline-none transition hover:border-primary/40 focus:border-ring focus:ring-3 focus:ring-ring/20", abnormal && "border-[var(--brand-coral)]/50")} />
    <span className="block truncate text-[0.7rem] font-normal text-muted-foreground">Tại ER: {erValue || "—"}</span>
  </label>;
}

function CaseHeader({ item, now }: { item: EmergencyPreparation; now: number }) {
  const patient = item.emergency_case!;
  return <article className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
    <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5"><UserRound /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{patient.full_name}</h2><span className={cn("rounded-full px-3 py-1 text-xs font-semibold", urgencyStyle[item.urgency])}>{urgencyLabel(item.urgency)}</span><StatusBadge status={item.status} /></div>
        <p className="mt-0.5 text-xs text-muted-foreground">{patient.emergency_code} · {patient.age ?? "?"} tuổi · Từ ER-102</p>
      </div>
      {/* Điều phối cách ly: nút nhỏ + dialog */}
      <IsolationReferralPanel variant="compact" sourceRoom="PRE-503" emergencyCaseId={item.emergency_case_id} defaultDiagnosis={item.preliminary_diagnosis || item.suspected_diagnosis} />
    </div>
    <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Info icon={Stethoscope} label="Chẩn đoán nghi ngờ" value={item.suspected_diagnosis || "Chưa ghi"} />
      <Info icon={Truck} label="Tình trạng vận chuyển" value={item.transport_condition || "Chưa ghi"} />
      <Info icon={Clock3} label="Chuyển lên lúc" value={`${formatClock(item.requested_at)} · ${formatDuration(minutesSince(item.requested_at, now))} trước`} />
    </div>
    {item.request_note && <p className="border-t px-5 py-3 text-xs text-muted-foreground">Ghi chú bàn giao từ ER: <span className="text-foreground">{item.request_note}</span></p>}
  </article>;
}

function CaseRow({ item, now, active, onClick }: { item: EmergencyPreparation; now: number; active: boolean; onClick: () => void }) {
  const patient = item.emergency_case!;
  const minutes = minutesSince(item.requested_at, now);
  const longWait = item.status === "REQUESTED" && minutes >= LONG_WAIT_MINUTES;
  const done = item.orders.filter((x) => x.status === "COMPLETED").length;
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-primary bg-primary/[.06]" : "border-transparent hover:bg-muted")}>
    <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{patient.full_name}</p><span className={cn("shrink-0 text-xs", longWait ? "font-semibold text-destructive" : "text-muted-foreground")}>{formatDuration(minutes)}</span></div>
    <p className="mt-0.5 text-xs text-muted-foreground">{patient.emergency_code} · lên lúc {formatClock(item.requested_at)}</p>
    {item.suspected_diagnosis && <p className="mt-1.5 line-clamp-1 text-xs">{item.suspected_diagnosis}</p>}
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[.62rem] font-semibold", urgencyStyle[item.urgency])}>{urgencyLabel(item.urgency)}</span>
      <StatusBadge status={item.status} small />
      <span className="text-[.65rem] text-muted-foreground">{done}/{item.orders.length} chỉ định</span>
    </div>
  </button>;
}

function StatusBadge({ status, small }: { status: EmergencyPreparation["status"]; small?: boolean }) {
  const meta = status === "REQUESTED" ? { label: "Chờ tiếp nhận", className: "bg-amber-100 text-amber-700" } : status === "IN_PROGRESS" ? { label: "Đang chuẩn bị", className: "bg-sky-100 text-sky-700" } : { label: "Đã điều phối", className: "bg-emerald-100 text-emerald-700" };
  return <span className={cn("rounded-full font-semibold", small ? "px-2 py-0.5 text-[.62rem]" : "px-3 py-1 text-xs", meta.className)}>{meta.label}</span>;
}

function SectionTitle({ index, title, description }: { index: number; title: string; description: string }) {
  return <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.7rem] font-bold text-primary">{index}</span>
    <h3 className="text-sm font-semibold">{title}</h3>
    <span className="hidden h-4 w-px bg-border sm:block" />
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{String(value).padStart(2, "0")}</p></div>; }
function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: ReactNode }) { return <div className="flex gap-3 px-5 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center rounded-[1.4rem] border bg-card p-8 text-center text-sm text-muted-foreground">{text}</div>; }
function urgencyLabel(value: EmergencyPreparation["urgency"]) { return value === "IMMEDIATE" ? "Tối khẩn" : value === "URGENT" ? "Khẩn" : "Xử lý sớm"; }
function minutesSince(value: string, now: number) { return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000)); }
function formatDuration(minutes: number) { return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`; }
function formatClock(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
