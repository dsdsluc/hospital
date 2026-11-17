"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CheckCircle2, ClipboardCheck, Clock3, Eye, FlaskConical, HeartPulse, LoaderCircle, Maximize2, Play, ScanLine, Scissors, Search, Stethoscope, Thermometer, UserRound, Wind, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { emergencyService, type EmergencyPreparation, type PostoperativeDestination, type PreparationOrder, type SurgeryOutcome } from "@/services/emergency.service";
import { getVitalFlag } from "@/components/doctor/workspaces/reception-measure-dialog";

export type OrRoom = "OR-501" | "OR-502";

/** Đường dẫn màn hình tập trung ca mổ; `returnTo` là URL workspace để quay lại khi xong. */
export function surgeryFocusHref(preparationId: string, roomCode: OrRoom, roomName: string) {
  const returnTo = typeof window === "undefined" ? "/doctor" : `${window.location.pathname}${window.location.search}`;
  return `/doctor/surgery/${preparationId}?${new URLSearchParams({ room: roomCode, roomName, returnTo }).toString()}`;
}

const orderInfo = { BLOOD_TEST: { label: "Xét nghiệm máu", icon: FlaskConical }, ULTRASOUND: { label: "Siêu âm tại chỗ", icon: Activity }, CT_SCAN: { label: "CT tại chỗ", icon: ScanLine } } as const;
const urgencyOrder = { IMMEDIATE: 0, URGENT: 1, EXPEDITED: 2 } as const;
export const urgencyStyle: Record<EmergencyPreparation["urgency"], string> = { IMMEDIATE: "bg-red-100 text-red-700", URGENT: "bg-orange-100 text-orange-700", EXPEDITED: "bg-amber-100 text-amber-700" };
/** Ca chờ mổ quá số phút này thì tô đỏ. */
const LONG_WAIT_MINUTES = 15;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function SurgeryWorkspace({ roomCode, roomName }: { roomCode: OrRoom; roomName: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["surgical-transfers", roomCode], queryFn: () => emergencyService.getSurgicalTransfers(roomCode), refetchInterval: 10_000 });
  // 7. Đang mổ lên đầu, sau đó tối khẩn → khẩn → xử lý sớm, cùng mức thì ca đến trước.
  const cases = [...(query.data ?? [])].sort((a, b) =>
    Number(b.surgery_status === "IN_PROGRESS") - Number(a.surgery_status === "IN_PROGRESS")
    || urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    || (a.completed_at ?? "").localeCompare(b.completed_at ?? ""));
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const now = useNow();
  const keyword = normalize(search.trim());
  const visible = keyword ? cases.filter((item) => normalize([item.emergency_case?.full_name ?? "", item.emergency_case?.emergency_code ?? "", item.preliminary_diagnosis ?? ""].join(" ")).includes(keyword)) : cases;
  const selected = cases.find((x) => x.id === selectedId) ?? cases[0];
  const refresh = async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ["surgical-transfers", roomCode] }), client.invalidateQueries({ queryKey: ["or-load"] })]);
  };

  return <div className="space-y-5">
    {/* 8. Bỏ ô "Phòng hiện tại" (đã có trên tiêu đề), thay bằng số ca tối khẩn */}
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Ca đang chờ" value={cases.filter((x) => x.surgery_status === "WAITING").length} /><Metric label="Đang phẫu thuật" value={cases.filter((x) => x.surgery_status === "IN_PROGRESS").length} /><Metric label="Tối khẩn" value={cases.filter((x) => x.urgency === "IMMEDIATE").length} /></div>
    <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Danh sách ca phẫu thuật</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{cases.length} ca · điều phối từ PRE-503</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã ca hoặc chẩn đoán" className="h-10 rounded-xl pl-9 pr-9" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
          </div>
        </div>
        <div className="space-y-2 p-2">{query.isPending ? <Empty text="Đang tải..." /> : cases.length === 0 ? <Empty text={`Chưa có ca tại ${roomCode}.`} /> : visible.length === 0 ? <Empty text={`Không tìm thấy ca phù hợp với “${search.trim()}”.`} /> : visible.map((item) => <CaseRow key={item.id} item={item} now={now} active={item.id === selected?.id} onClick={() => setSelectedId(item.id)} />)}</div>
      </section>
      <section className="min-w-0 space-y-5">{selected ? <CaseDetails key={selected.id} item={selected} now={now} roomCode={roomCode} roomName={roomName} onSaved={refresh} /> : <Empty text="Chọn một ca để làm việc." />}</section>
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

function CaseDetails({ item, now, roomCode, roomName, onSaved }: { item: EmergencyPreparation; now: number; roomCode: OrRoom; roomName: string; onSaved: () => Promise<void> }) {
  const patient = item.emergency_case!;
  const inSurgery = item.surgery_status === "IN_PROGRESS";
  return <>
    {/* Thẻ bệnh nhân: gộp chẩn đoán, thời điểm chuyển, thời gian mổ và ghi chú bàn giao */}
    <article className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white [&_svg]:size-5"><UserRound /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{patient.full_name}</h2><span className={cn("rounded-full px-3 py-1 text-xs font-semibold", urgencyStyle[item.urgency])}>{urgencyLabel(item.urgency)}</span><Status value={item.surgery_status} /></div>
          <p className="mt-0.5 text-xs text-muted-foreground">{patient.emergency_code} · {patient.age ?? "?"} tuổi · {roomCode} · {roomName}</p>
        </div>
      </div>
      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Info icon={Stethoscope} label="Chẩn đoán trước chuyển" value={item.preliminary_diagnosis || "Chưa ghi"} />
        <Info icon={Clock3} label="Chuyển từ PRE-503" value={item.completed_at ? `${formatClock(item.completed_at)} · ${formatDuration(minutesSince(item.completed_at, now))} trước` : "—"} />
        {/* 6. Đồng hồ thời gian mổ */}
        <Info icon={Scissors} label={inSurgery ? "Đã mổ" : "Trạng thái"} value={inSurgery && item.surgery_started_at ? <span className="text-red-700">{formatDuration(minutesSince(item.surgery_started_at, now))} · từ {formatClock(item.surgery_started_at)}</span> : "Chưa bắt đầu"} />
      </div>
      {item.disposition_note && <div className="border-t px-5 py-3 text-xs"><span className="text-muted-foreground">Bàn giao từ PRE-503: </span><span className="whitespace-pre-wrap">{item.disposition_note}</span></div>}
    </article>

    <PretransferVitals item={item} />
    <OrdersSummary orders={item.orders} />
    <SurgeryPanel item={item} now={now} roomCode={roomCode} roomName={roomName} onSaved={onSaved} />
  </>;
}

/* ───────── 5. Sinh hiệu trước chuyển: có cờ Thấp/Cao ───────── */

function respiratoryFlag(value: string): "LOW" | "NORMAL" | "HIGH" | null {
  const n = Number(value.trim());
  if (!value.trim() || Number.isNaN(n)) return null;
  return n < 12 ? "LOW" : n > 20 ? "HIGH" : "NORMAL";
}

export function PretransferVitals({ item }: { item: EmergencyPreparation }) {
  const tiles = [
    { icon: HeartPulse, label: "Mạch", value: item.pretransfer_pulse, unit: "bpm", flag: getVitalFlag("heartRate", item.pretransfer_pulse ?? "") },
    { icon: Activity, label: "Huyết áp", value: item.pretransfer_blood_pressure, unit: "mmHg", flag: getVitalFlag("bloodPressure", item.pretransfer_blood_pressure ?? "") },
    { icon: Wind, label: "SpO₂", value: item.pretransfer_spo2, unit: "%", flag: getVitalFlag("spo2", item.pretransfer_spo2 ?? "") },
    { icon: Thermometer, label: "Nhiệt độ", value: item.pretransfer_temperature, unit: "°C", flag: getVitalFlag("temperature", item.pretransfer_temperature ?? "") },
    { icon: Wind, label: "Nhịp thở", value: item.pretransfer_respiratory_rate, unit: "/phút", flag: respiratoryFlag(item.pretransfer_respiratory_rate ?? "") },
  ];
  const abnormal = tiles.filter((tile) => tile.flag === "LOW" || tile.flag === "HIGH").length;
  // Chia cột theo độ rộng của chính thẻ (container query), để hiển thị đúng cả ở cột hẹp của màn hình ca mổ.
  return <section className="@container rounded-[1.4rem] border bg-card p-4 shadow-sm sm:p-5">
    <SectionTitle title="Sinh hiệu trước chuyển" description="Ghi nhận tại PRE-503" aside={abnormal > 0 ? <span className="rounded-full bg-[var(--brand-coral-soft)] px-2.5 py-0.5 text-xs font-semibold text-[oklch(0.55_0.16_35)]">{abnormal} chỉ số bất thường</span> : null} />
    <div className="grid grid-cols-2 gap-1.5 @lg:grid-cols-3 @3xl:grid-cols-5">
      {tiles.map(({ icon: Icon, label, value, unit, flag }) => {
        const bad = flag === "LOW" || flag === "HIGH";
        return <div key={label} className={cn("rounded-lg border px-2.5 py-2", bad ? "border-[var(--brand-coral)]/30 bg-[var(--brand-coral-soft)]/35" : "border-transparent bg-muted/50")}>
          <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground"><Icon className={cn("size-3 shrink-0", bad ? "text-[oklch(0.55_0.16_35)]" : "text-red-600/60")} /><span className="truncate">{label}</span>{bad && <span className={cn("ml-auto shrink-0 rounded-full px-1.5 text-[0.58rem] font-medium leading-4", flag === "LOW" ? "bg-sky-100 text-sky-700" : "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]")}>{flag === "LOW" ? "Thấp" : "Cao"}</span>}</div>
          <p className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums">{value || <span className="text-xs font-normal text-muted-foreground">—</span>}{value && <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">{unit}</span>}</p>
        </div>;
      })}
    </div>
    <p className="mt-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs leading-5"><span className="text-muted-foreground">Ý thức · </span>{item.pretransfer_consciousness || <span className="text-muted-foreground">Chưa ghi</span>}</p>
  </section>;
}

/* ───────── 3. Kết quả PRE-503: danh sách gọn, xem trong dialog ───────── */

export function OrdersSummary({ orders }: { orders: PreparationOrder[] }) {
  const [viewing, setViewing] = useState<PreparationOrder>();
  const done = orders.filter((order) => order.status === "COMPLETED").length;
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={1} title="Kết quả tại PRE-503" description={`${done}/${orders.length} chỉ định đã có kết quả`} />
    <ul className="divide-y rounded-2xl border">{orders.map((order) => {
      const meta = orderInfo[order.order_type];
      const Icon = meta.icon;
      const completed = order.status === "COMPLETED";
      return <li key={order.id} className="flex flex-wrap items-center gap-3 p-3.5">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", completed ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{meta.label}</p><p className="truncate text-xs text-muted-foreground">{completed ? (order.result?.split("\n").find((line) => line.trim()) ?? "Đã có kết quả") : "Chuyển phòng khi chưa có kết quả"}</p></div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", completed ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}>{completed ? "Có kết quả" : "Chưa có kết quả"}</span>
        {completed && <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={() => setViewing(order)}><Eye /> Xem</Button>}
      </li>;
    })}</ul>
    <Dialog open={Boolean(viewing)} onOpenChange={(open) => { if (!open) setViewing(undefined); }}>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="text-[0.95rem] font-semibold">{viewing ? orderInfo[viewing.order_type].label : ""}</DialogTitle>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <DialogDescription className="text-sm">Kết quả tại PRE-503{viewing?.completed_at ? ` lúc ${formatClock(viewing.completed_at)}` : ""}</DialogDescription>
          </div>
        </DialogHeader>
        <p className="whitespace-pre-wrap px-6 py-5 text-sm leading-6">{viewing?.result}</p>
      </DialogContent>
    </Dialog>
  </section>;
}

/* ───────── Ca mổ: thẻ tóm tắt + biên bản trong dialog ───────── */

function SurgeryPanel({ item, now, roomCode, roomName, onSaved }: { item: EmergencyPreparation; now: number; roomCode: OrRoom; roomName: string; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const start = useMutation({
    mutationFn: () => emergencyService.startSurgery(item.id, roomCode),
    onSuccess: async (r) => {
      toast.success(r.message);
      await onSaved();
      // Bắt đầu mổ → chuyển sang màn hình tập trung (không header / sidebar).
      router.push(surgeryFocusHref(item.id, roomCode, roomName));
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu ca mổ.")),
  });

  if (item.surgery_status === "WAITING") return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={2} title="Ca mổ" description="Xác nhận ê-kíp và thiết bị trước khi bắt đầu" />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><Scissors className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Sẵn sàng phẫu thuật</p><p className="mt-0.5 text-xs text-muted-foreground">Chờ mổ {item.completed_at ? formatDuration(minutesSince(item.completed_at, now)) : "—"}</p></div>
      <Button type="button" disabled={start.isPending} onClick={() => start.mutate()} className="shrink-0 rounded-full bg-red-600 px-5 hover:bg-red-700">{start.isPending ? <LoaderCircle className="animate-spin" /> : <Play />} Bắt đầu ca mổ</Button>
    </div>
  </section>;

  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={2} title="Biên bản & bàn giao sau mổ" description="Ghi biên bản phẫu thuật và chọn nơi tiếp nhận sau mổ" />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><Scissors className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Đang phẫu thuật · {item.surgery_started_at ? formatDuration(minutesSince(item.surgery_started_at, now)) : "—"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Bắt đầu lúc {item.surgery_started_at ? formatClock(item.surgery_started_at) : "—"}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className="rounded-full px-4"><ClipboardCheck /> Ghi biên bản nhanh</Button>
        <Button type="button" onClick={() => router.push(surgeryFocusHref(item.id, roomCode, roomName))} className="rounded-full px-5"><Maximize2 /> Mở màn hình ca mổ</Button>
      </div>
    </div>
    <SurgeryReportDialog item={item} roomCode={roomCode} open={open} onOpenChange={setOpen} onSaved={onSaved} />
  </section>;
}

function SurgeryReportDialog({ item, roomCode, open, onOpenChange, onSaved }: { item: EmergencyPreparation; roomCode: OrRoom; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
      <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><ClipboardCheck className="size-4 text-primary" /> Biên bản phẫu thuật</DialogTitle>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <DialogDescription className="text-sm">{item.emergency_case?.full_name} · {roomCode} · bắt đầu {item.surgery_started_at ? formatClock(item.surgery_started_at) : "—"}</DialogDescription>
        </div>
      </DialogHeader>
      <SurgeryReportForm item={item} roomCode={roomCode} onCompleted={async () => { onOpenChange(false); await onSaved(); }} />
    </DialogContent>
  </Dialog>;
}

const approachOptions = ["Mổ mở", "Nội soi", "Nội soi chuyển mổ mở"];
const outcomeOptions: Array<{ value: SurgeryOutcome; label: string; detail: string; className: string }> = [
  { value: "SUCCESSFUL", label: "Thành công", detail: "Đạt mục tiêu phẫu thuật", className: "border-emerald-300 bg-emerald-50 text-emerald-800 ring-emerald-200" },
  { value: "COMPLICATED", label: "Thành công, có biến chứng", detail: "Đạt mục tiêu nhưng có biến chứng / sự cố", className: "border-amber-300 bg-amber-50 text-amber-900 ring-amber-200" },
  { value: "UNSUCCESSFUL", label: "Không thành công", detail: "Không đạt mục tiêu / phải dừng mổ", className: "border-red-300 bg-red-50 text-red-800 ring-red-200" },
];
/** Lượng máu mất từ mức này trở lên thì nhắc (không chặn). */
const HIGH_BLOOD_LOSS_ML = 500;

/** "HH:mm" theo ngày của một mốc thời gian → ISO; rỗng → null. */
function timeToIso(time: string, base: string | null) {
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  const date = base ? new Date(base) : new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}
function isoToTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Biên bản phẫu thuật + nơi tiếp nhận sau mổ. Dùng trong dialog (workspace) và trang tập trung ca mổ. */
export function SurgeryReportForm({ item, roomCode, onCompleted, className }: { item: EmergencyPreparation; roomCode: OrRoom; onCompleted: () => Promise<void> | void; className?: string }) {
  const [form, setForm] = useState({
    procedure_name: item.procedure_name ?? "",
    surgical_approach: item.surgical_approach ?? "",
    anesthesia_note: item.anesthesia_note ?? "",
    incision_time: isoToTime(item.incision_at ?? item.surgery_started_at),
    closure_time: isoToTime(item.closure_at),
    surgical_findings: item.surgical_findings ?? "",
    blood_loss: item.estimated_blood_loss_ml != null ? String(item.estimated_blood_loss_ml) : "",
    transfusion_note: item.transfusion_note ?? "",
    surgery_outcome: (item.surgery_outcome ?? null) as SurgeryOutcome | null,
    surgeon_conclusion: item.surgeon_conclusion ?? "",
    surgery_note: item.surgery_note ?? "",
    postoperative_destination: item.postoperative_destination ?? "REC-504" as PostoperativeDestination,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const complete = useMutation({
    mutationFn: () => emergencyService.completeSurgery(item.id, roomCode, {
      procedure_name: form.procedure_name,
      surgical_approach: form.surgical_approach.trim() || null,
      anesthesia_note: form.anesthesia_note.trim() || null,
      incision_at: timeToIso(form.incision_time, item.surgery_started_at),
      closure_at: timeToIso(form.closure_time, item.surgery_started_at),
      surgical_findings: form.surgical_findings,
      estimated_blood_loss_ml: form.blood_loss.trim() && !Number.isNaN(Number(form.blood_loss)) ? Math.round(Number(form.blood_loss)) : null,
      transfusion_note: form.transfusion_note.trim() || null,
      surgery_outcome: form.surgery_outcome,
      surgeon_conclusion: form.surgeon_conclusion.trim() || null,
      surgery_note: form.surgery_note.trim() || null,
      postoperative_destination: form.postoperative_destination,
    }),
    onSuccess: async (r) => { toast.success(r.message); await onCompleted(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể hoàn tất ca mổ.")),
  });
  const destinations: Array<{ code: PostoperativeDestination; name: string; detail: string }> = [
    { code: "REC-504", name: "Phòng hồi tỉnh", detail: "Theo dõi sau mổ thông thường" },
    { code: "ICU-505", name: "Hồi sức tích cực", detail: "Cần hồi sức, theo dõi sát" },
  ];
  const duration = (() => {
    if (!form.incision_time || !form.closure_time) return null;
    const [h1, m1] = form.incision_time.split(":").map(Number);
    const [h2, m2] = form.closure_time.split(":").map(Number);
    let minutes = h2 * 60 + m2 - (h1 * 60 + m1);
    if (minutes < 0) minutes += 24 * 60;
    return minutes;
  })();
  const bloodLoss = Number(form.blood_loss);
  const highBloodLoss = form.blood_loss.trim() !== "" && !Number.isNaN(bloodLoss) && bloodLoss >= HIGH_BLOOD_LOSS_ML;

  return <div className={className}>
    <div className="space-y-6 px-6 py-5">
      <section>
        <SectionTitle index={1} title="Thông tin ca mổ" description="Tên, phương pháp, vô cảm và thời gian" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên phẫu thuật *"><Input value={form.procedure_name} onChange={(e) => set("procedure_name", e.target.value)} className="h-10 rounded-xl" /></Field>
          <Field label="Phương pháp vô cảm"><Input value={form.anesthesia_note} onChange={(e) => set("anesthesia_note", e.target.value)} placeholder="Gây mê nội khí quản, tê tủy sống..." className="h-10 rounded-xl" /></Field>
          <div className="space-y-1.5 sm:col-span-2">
            <span className="block text-xs font-medium text-muted-foreground">Phương pháp phẫu thuật</span>
            <Input value={form.surgical_approach} onChange={(e) => set("surgical_approach", e.target.value)} placeholder="Ví dụ: Mổ mở đường trắng giữa trên dưới rốn" className="h-10 rounded-xl" />
            <div className="flex flex-wrap gap-1.5">{approachOptions.map((option) => <button key={option} type="button" onClick={() => set("surgical_approach", option)} aria-pressed={form.surgical_approach === option} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium transition", form.surgical_approach === option ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/40 hover:text-primary")}>{option}</button>)}</div>
          </div>
          <Field label="Giờ rạch da"><Input type="time" value={form.incision_time} onChange={(e) => set("incision_time", e.target.value)} className="h-10 rounded-xl tabular-nums" /></Field>
          <Field label="Giờ đóng da">
            <div className="flex gap-2">
              <Input type="time" value={form.closure_time} onChange={(e) => set("closure_time", e.target.value)} className="h-10 flex-1 rounded-xl tabular-nums" />
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-3 text-xs" onClick={() => set("closure_time", isoToTime(new Date().toISOString()))}>Bây giờ</Button>
            </div>
          </Field>
          {duration !== null && <p className="text-xs text-muted-foreground sm:col-span-2">Thời gian phẫu thuật: <span className="font-semibold text-foreground">{formatDuration(duration)}</span></p>}
        </div>
      </section>

      <section>
        <SectionTitle index={2} title="Diễn biến trong mổ" description="Phát hiện, lượng máu mất và truyền máu / dịch" />
        <div className="space-y-4">
          <Field label="Phát hiện trong mổ *"><Textarea rows={4} value={form.surgical_findings} onChange={(e) => set("surgical_findings", e.target.value)} placeholder="Tổn thương, vị trí, mức độ..." className="rounded-xl" /></Field>
          <div className="grid items-start gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <Field label="Lượng máu mất ước tính">
              <div className="relative">
                <Input type="number" min={0} inputMode="numeric" value={form.blood_loss} onChange={(e) => set("blood_loss", e.target.value)} placeholder="300" className={cn("h-10 rounded-xl pr-11 tabular-nums", highBloodLoss && "border-[var(--brand-coral)]/60")} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ml</span>
              </div>
            </Field>
            <Field label="Truyền máu / dịch trong mổ"><Input value={form.transfusion_note} onChange={(e) => set("transfusion_note", e.target.value)} placeholder="Ví dụ: 2 đơn vị khối hồng cầu, 2000 ml Ringer lactate" className="h-10 rounded-xl" /></Field>
          </div>
          {highBloodLoss && <p className="rounded-lg bg-[var(--brand-coral-soft)]/60 px-3 py-2 text-xs font-medium text-[oklch(0.55_0.16_35)]">Mất máu nhiều (≥ {HIGH_BLOOD_LOSS_ML} ml) — lưu ý ghi truyền máu / dịch.</p>}
        </div>
      </section>

      <section>
        <SectionTitle index={3} title="Kết quả & kết luận" description="Trạng thái ca mổ và kết luận của phẫu thuật viên" />
        <div className="grid gap-2.5 sm:grid-cols-3">{outcomeOptions.map((option) => {
          const selected = form.surgery_outcome === option.value;
          return <button key={option.value} type="button" onClick={() => set("surgery_outcome", selected ? null : option.value)} aria-pressed={selected} className={cn("rounded-2xl border p-3 text-left transition", selected ? cn(option.className, "ring-2") : "hover:border-primary/30")}>
            <p className={cn("text-sm", selected ? "font-semibold" : "font-medium")}>{option.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{option.detail}</p>
          </button>;
        })}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Kết luận của bác sĩ"><Textarea rows={4} value={form.surgeon_conclusion} onChange={(e) => set("surgeon_conclusion", e.target.value)} placeholder="Đánh giá chung ca mổ, tiên lượng..." className="rounded-xl" /></Field>
          <Field label="Diễn biến / lưu ý hậu phẫu"><Textarea rows={4} value={form.surgery_note} onChange={(e) => set("surgery_note", e.target.value)} placeholder="Theo dõi dẫn lưu, kháng sinh, nhịn ăn..." className="rounded-xl" /></Field>
        </div>
      </section>

      <section>
        <SectionTitle index={4} title="Nơi tiếp nhận sau mổ" description="Bệnh nhân được chuyển ngay khi hoàn tất" />
        <div className="grid gap-2.5 sm:grid-cols-2">{destinations.map((room) => {
          const selected = form.postoperative_destination === room.code;
          return <button key={room.code} type="button" onClick={() => set("postoperative_destination", room.code)} aria-pressed={selected} className={cn("rounded-2xl border p-3.5 text-left transition", selected ? "border-primary bg-primary/[.06] ring-2 ring-primary/15" : "hover:border-primary/30")}>
            <p className="text-xs font-medium text-primary">{room.code}</p>
            <p className={cn("mt-0.5 text-sm", selected ? "font-semibold" : "font-medium")}>{room.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{room.detail}</p>
          </button>;
        })}</div>
      </section>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
      <p className="text-xs text-muted-foreground">{form.surgery_outcome ? "" : "Chưa chọn trạng thái ca mổ. "}Các mục có dấu * cần nhập để hoàn tất.</p>
      {/* Điều kiện khóa nút giữ nguyên như trước (chưa thay đổi theo quy tắc không tự thêm ràng buộc) */}
      <Button type="button" disabled={complete.isPending || !form.procedure_name.trim() || !form.surgical_findings.trim()} onClick={() => complete.mutate()} className="rounded-full px-5">{complete.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Hoàn tất & chuyển {form.postoperative_destination}</Button>
    </div>
  </div>;
}

/* ───────── 7. Danh sách ca ───────── */

function CaseRow({ item, now, active, onClick }: { item: EmergencyPreparation; now: number; active: boolean; onClick: () => void }) {
  const inSurgery = item.surgery_status === "IN_PROGRESS";
  const since = inSurgery ? item.surgery_started_at : item.completed_at;
  const minutes = since ? minutesSince(since, now) : null;
  const longWait = !inSurgery && minutes !== null && minutes >= LONG_WAIT_MINUTES;
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-red-300 bg-red-50" : "border-transparent hover:bg-muted")}>
    <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{item.emergency_case?.full_name}</p>{minutes !== null && <span className={cn("shrink-0 text-xs", longWait ? "font-semibold text-destructive" : "text-muted-foreground")}>{inSurgery ? "mổ " : "chờ "}{formatDuration(minutes)}</span>}</div>
    <p className="mt-0.5 text-xs text-muted-foreground">{item.emergency_case?.emergency_code}</p>
    <p className="mt-1.5 line-clamp-1 text-xs">{item.preliminary_diagnosis || "Chưa có chẩn đoán"}</p>
    <div className="mt-2 flex flex-wrap gap-1.5"><span className={cn("rounded-full px-2 py-0.5 text-[.62rem] font-semibold", urgencyStyle[item.urgency])}>{urgencyLabel(item.urgency)}</span><Status value={item.surgery_status} small /></div>
  </button>;
}

/* ───────── Thành phần chung ───────── */

function Status({ value, small }: { value: EmergencyPreparation["surgery_status"]; small?: boolean }) { return <span className={cn("rounded-full font-semibold", small ? "px-2 py-0.5 text-[.62rem]" : "px-3 py-1 text-xs", value === "IN_PROGRESS" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>{value === "IN_PROGRESS" ? "Đang phẫu thuật" : "Chờ phẫu thuật"}</span>; }
export function SectionTitle({ index, title, description, aside }: { index?: number; title: string; description: string; aside?: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
    {index !== undefined && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.7rem] font-bold text-primary">{index}</span>}
    <h3 className="text-sm font-semibold">{title}</h3>
    <span className="hidden h-4 w-px bg-border sm:block" />
    <p className="text-xs text-muted-foreground">{description}</p>
    {aside && <span className="ml-auto">{aside}</span>}
  </div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1.5 text-sm font-medium"><span className="block text-xs text-muted-foreground">{label}</span>{children}</label>; }
function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: ReactNode }) { return <div className="flex gap-3 px-5 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-red-600" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{String(value).padStart(2, "0")}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center p-6 text-center text-sm text-muted-foreground">{text}</div>; }
export function urgencyLabel(value: EmergencyPreparation["urgency"]) { return value === "IMMEDIATE" ? "Tối khẩn" : value === "URGENT" ? "Khẩn" : "Xử lý sớm"; }
function minutesSince(value: string, now: number) { return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000)); }
function formatDuration(minutes: number) { return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`; }
function formatClock(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
