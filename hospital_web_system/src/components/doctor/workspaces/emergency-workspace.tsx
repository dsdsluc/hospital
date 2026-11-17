"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Bed, Brain, Check, Clock3, Gauge, HeartPulse, Hospital, LoaderCircle, Plus, Search, Send, Siren, Stethoscope, Thermometer, UserRound, Wind, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { emergencyService, type CreateEmergencyCasePayload, type EmergencyAssessment, type EmergencyCase, type EmergencyPriority, type InterventionType, type PreparationOrderType } from "@/services/emergency.service";
import { IsolationReferralPanel } from "@/components/doctor/workspaces/isolation-referral-panel";
import { getVitalFlag } from "@/components/doctor/workspaces/reception-measure-dialog";

const priorities: Record<EmergencyPriority, { label: string; color: string; dot: string }> = {
  RED: { label: "Đỏ · Nguy kịch", color: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-600" },
  ORANGE: { label: "Cam · Rất khẩn", color: "border-orange-200 bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  YELLOW: { label: "Vàng · Khẩn cấp", color: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  GREEN: { label: "Xanh · Ít khẩn", color: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};
const interventions: Array<[InterventionType, string]> = [["IV_ACCESS", "Thiết lập đường truyền tĩnh mạch"], ["OXYGEN", "Thở oxy"], ["MONITORING", "Theo dõi monitor liên tục"], ["BLEEDING_CONTROL", "Kiểm soát chảy máu"], ["EMERGENCY_MEDICATION", "Thuốc cấp cứu"], ["CPR", "Hồi sinh tim phổi"], ["AIRWAY", "Kiểm soát đường thở"], ["OTHER", "Xử trí khác"]];

/** Ca đang chờ (chưa xử trí) quá số phút này thì tô đỏ. */
const LONG_WAIT_MINUTES = 15;

/** Họ tên bệnh nhân cấp cứu dạng VIẾT HOA: "hà minh  phương" → "HÀ MINH PHƯƠNG". */
function toUpperName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("vi");
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function EmergencyWorkspace() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["emergency-cases"], queryFn: emergencyService.getCases, refetchInterval: 10_000 });
  const cases = query.data ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ASSESSMENT" | "INTERVENTION" | "ORDERS" | "DISPOSITION">("ASSESSMENT");
  const now = useNow();
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["emergency-cases"] });

  // 5. Tìm theo tên, mã ca, SĐT, CCCD (không phân biệt dấu).
  const keyword = normalize(search.trim());
  const visibleCases = keyword
    ? cases.filter((item) => normalize([item.full_name, item.emergency_code, item.phone_number ?? "", item.identity_number ?? ""].join(" ")).includes(keyword))
    : cases;

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Nguy kịch" value={cases.filter((x) => x.priority === "RED").length} icon={Siren} color="bg-red-100 text-red-700" /><Metric label="Đang xử trí" value={cases.filter((x) => x.status === "IN_TREATMENT").length} icon={Activity} color="bg-orange-100 text-orange-700" /><Metric label="Đang chờ" value={cases.filter((x) => x.status === "WAITING").length} icon={Clock3} color="bg-amber-100 text-amber-700" /><Metric label="Tổng ca" value={cases.length} icon={Bed} color="bg-emerald-100 text-emerald-700" /></div>
    <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-2"><div><h2 className="font-semibold">Danh sách cấp cứu</h2><p className="text-xs text-muted-foreground">{cases.length} ca · ưu tiên theo mức độ nguy hiểm</p></div><IntakeDialog onCreated={refresh} /></div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã ca, SĐT hoặc CCCD" className="h-10 rounded-xl pl-9 pr-9" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
          </div>
        </div>
        <div className="max-h-[42rem] space-y-2 overflow-y-auto p-2">
          {query.isPending ? <Empty text="Đang tải..." /> : query.isError ? <Empty text="Không thể tải danh sách cấp cứu." /> : cases.length === 0 ? <Empty text="Chưa có ca cấp cứu đang hoạt động." /> : visibleCases.length === 0 ? <Empty text={`Không tìm thấy ca phù hợp với “${search.trim()}”.`} /> : visibleCases.map((item) => <CaseRow key={item.id} item={item} now={now} active={item.id === selected?.id} onClick={() => setSelectedId(item.id)} />)}
        </div>
      </section>
      <section className="min-w-0 space-y-5">{selected ? <>
        <PatientHeader item={selected} now={now} />
        <EmergencyVitals item={selected} />
        <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
          <div className="flex gap-1 overflow-x-auto border-b px-3 pt-3">{([["ASSESSMENT", "Đánh giá ban đầu", Stethoscope], ["INTERVENTION", "Xử trí", HeartPulse], ["ORDERS", "Chỉ định khẩn", Hospital], ["DISPOSITION", "Hướng xử lý", Send]] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setTab(value)} className={cn("relative flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-medium", tab === value ? "bg-red-50 text-red-700" : "text-muted-foreground hover:bg-muted")}><Icon className="size-4" />{label}{tab === value && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-red-600" />}</button>)}</div>
          {tab === "ASSESSMENT" && <AssessmentForm key={`a-${selected.id}-${selected.assessment?.assessed_at ?? "new"}`} item={selected} onSaved={refresh} />}
          {tab === "INTERVENTION" && <InterventionForm key={`i-${selected.id}`} item={selected} onSaved={refresh} />}
          {tab === "ORDERS" && <PreparationRequestForm key={`p-${selected.id}`} item={selected} onSaved={refresh} />}
          {tab === "DISPOSITION" && <Pending text="Sau khi chuyển đến PRE-503, phòng chuẩn bị phẫu thuật sẽ hoàn tất chỉ định và quyết định phòng chuyển tiếp." />}
        </section>
      </> : <Empty text="Tiếp nhận một ca cấp cứu để bắt đầu." />}</section>
    </div>
  </div>;
}

/** Đồng hồ cập nhật mỗi phút để tính "đã ở cấp cứu". */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function IntakeDialog({ onCreated }: { onCreated: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false); const [anonymous, setAnonymous] = useState(false);
  const mutation = useMutation({ mutationFn: emergencyService.createCase, onSuccess: async (data) => { await onCreated(); setOpen(false); toast.success(data.message); }, onError: (e) => toast.error(getApiErrorMessage(e, "Không thể tiếp nhận ca cấp cứu.")) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const text = (n: string) => String(form.get(n) ?? "").trim(); const num = (n: string) => text(n) ? Number(text(n)) : null; const bp = text("blood_pressure").split("/"); const payload: CreateEmergencyCasePayload = { full_name: anonymous ? `Bệnh nhân chưa xác định ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : toUpperName(text("full_name")), age: num("age"), gender: (text("gender") || null) as CreateEmergencyCasePayload["gender"], identity_number: text("identity_number") || null, phone_number: text("phone_number") || null, unidentified: anonymous, arrival_mode: text("arrival_mode") as CreateEmergencyCasePayload["arrival_mode"], companion_name: text("companion_name") || null, companion_phone: text("companion_phone") || null, reason: text("reason"), injury_mechanism: text("injury_mechanism") || null, priority: text("priority") as EmergencyPriority, location: text("location") || null, assessment: { pulse_bpm: num("pulse"), systolic_pressure: bp[0] ? Number(bp[0]) : null, diastolic_pressure: bp[1] ? Number(bp[1]) : null, spo2_percent: num("spo2"), temperature_c: num("temperature"), respiratory_rate: num("respiratory_rate"), pain_score: num("pain_score"), consciousness: text("consciousness") || null } }; mutation.mutate(payload); }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button size="sm" className="rounded-full bg-red-600 hover:bg-red-700"><Plus /> Tiếp nhận</Button>} />
    <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
      <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Siren className="size-4 text-red-600" /> Tiếp nhận ca cấp cứu</DialogTitle>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <DialogDescription className="text-sm">Không yêu cầu lịch hẹn. Nhập thông tin hiện có và đánh giá nhanh.</DialogDescription>
        </div>
      </DialogHeader>
      <form onSubmit={submit}>
        <div className="space-y-6 px-6 py-5">
          <button type="button" onClick={() => setAnonymous((value) => !value)} aria-pressed={anonymous} className={cn("flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition", anonymous ? "border-amber-300 bg-amber-50 text-amber-900" : "hover:border-amber-300")}>
            <span className={cn("grid size-5 place-items-center rounded-md border", anonymous ? "border-amber-600 bg-amber-600 text-white" : "bg-background")}>{anonymous && <Check className="size-3.5" />}</span>
            Chưa xác định danh tính <span className="text-xs text-muted-foreground">(bệnh nhân bất tỉnh, không giấy tờ)</span>
          </button>
          <FormGroup index={1} title="Thông tin bệnh nhân"><Field label="Họ và tên"><Input name="full_name" required={!anonymous} disabled={anonymous} onBlur={(event) => { event.currentTarget.value = toUpperName(event.currentTarget.value); }} className="h-10 rounded-xl uppercase placeholder:normal-case" placeholder="Nguyễn Văn A" /></Field><Field label="Tuổi"><Input name="age" type="number" className="h-10 rounded-xl" /></Field><Field label="Giới tính"><Select name="gender"><option value="">Chưa rõ</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></Select></Field><Field label="CCCD"><Input name="identity_number" className="h-10 rounded-xl" /></Field><Field label="Số điện thoại"><Input name="phone_number" className="h-10 rounded-xl" /></Field><Field label="Người đưa đến"><Input name="companion_name" className="h-10 rounded-xl" /></Field><Field label="SĐT người đưa"><Input name="companion_phone" className="h-10 rounded-xl" /></Field></FormGroup>
          <FormGroup index={2} title="Thông tin đến viện"><Field label="Hình thức đến"><Select name="arrival_mode"><option value="WALK_IN">Tự đến</option><option value="AMBULANCE">Xe cấp cứu</option><option value="TRANSFER">Chuyển viện</option><option value="OTHER">Khác</option></Select></Field><Field label="Mức ưu tiên"><Select name="priority">{Object.entries(priorities).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field><Field label="Giường/Vị trí"><Input name="location" className="h-10 rounded-xl" /></Field><Field label="Lý do cấp cứu" wide><Textarea name="reason" required className="rounded-xl" /></Field><Field label="Cơ chế chấn thương" wide><Textarea name="injury_mechanism" className="rounded-xl" /></Field></FormGroup>
          <FormGroup index={3} title="Đánh giá nhanh"><Field label="Mạch (bpm)"><Input name="pulse" type="number" className="h-10 rounded-xl" /></Field><Field label="Huyết áp (mmHg)"><Input name="blood_pressure" placeholder="120/80" className="h-10 rounded-xl" /></Field><Field label="SpO₂ (%)"><Input name="spo2" type="number" className="h-10 rounded-xl" /></Field><Field label="Nhiệt độ (°C)"><Input name="temperature" type="number" step="0.1" className="h-10 rounded-xl" /></Field><Field label="Nhịp thở (lần/phút)"><Input name="respiratory_rate" type="number" className="h-10 rounded-xl" /></Field><Field label="Điểm đau (0–10)"><Input name="pain_score" type="number" min="0" max="10" className="h-10 rounded-xl" /></Field><Field label="Ý thức" wide><Input name="consciousness" placeholder="Tỉnh, tiếp xúc tốt / Lơ mơ / Hôn mê..." className="h-10 rounded-xl" /></Field></FormGroup>
        </div>
        <DialogFooter className="m-0 rounded-none border-t bg-muted/40 px-6 py-4"><Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit" disabled={mutation.isPending} className="rounded-full bg-red-600 hover:bg-red-700">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Siren />} Tạo ca cấp cứu</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function AssessmentForm({ item, onSaved }: { item: EmergencyCase; onSaved: () => Promise<unknown> }) {
  const a = item.assessment;
  const mutation = useMutation({ mutationFn: (payload: Partial<EmergencyAssessment> & { priority: EmergencyPriority; location: string | null }) => emergencyService.saveAssessment(item.id, payload), onSuccess: async (data) => { await onSaved(); toast.success(data.message); }, onError: (e) => toast.error(getApiErrorMessage(e, "Không thể lưu đánh giá.")) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); const t = (n: string) => String(f.get(n) ?? "").trim(); const n = (key: string) => t(key) ? Number(t(key)) : null; const bp = t("blood_pressure").split("/"); mutation.mutate({ priority: t("priority") as EmergencyPriority, location: t("location") || null, symptoms: t("symptoms") || null, initial_assessment: t("initial_assessment") || null, important_history: t("history") || null, allergies: t("allergies") || null, pulse_bpm: n("pulse"), systolic_pressure: bp[0] ? Number(bp[0]) : null, diastolic_pressure: bp[1] ? Number(bp[1]) : null, spo2_percent: n("spo2"), temperature_c: n("temperature"), respiratory_rate: n("respiratory_rate"), pain_score: n("pain_score"), consciousness: t("consciousness") || null }); }
  return <form onSubmit={submit}>
    <div className="space-y-6 p-5">
      <section>
        <SectionTitle index={1} title="Phân loại & vị trí" description="Mức ưu tiên có thể đổi theo diễn biến" />
        <div className="grid gap-4 lg:grid-cols-2"><Field label="Mức ưu tiên"><Select name="priority" defaultValue={item.priority}>{Object.entries(priorities).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field><Field label="Giường/Vị trí"><Input name="location" defaultValue={item.location ?? ""} className="h-10 rounded-xl" /></Field></div>
      </section>
      <section>
        <SectionTitle index={2} title="Bệnh cảnh" description="Triệu chứng, đánh giá ban đầu, tiền sử và dị ứng" />
        <div className="grid gap-4 lg:grid-cols-2"><Field label="Triệu chứng và diễn biến"><Textarea name="symptoms" rows={5} defaultValue={a?.symptoms ?? item.reason} className="rounded-xl" /></Field><Field label="Đánh giá ban đầu"><Textarea name="initial_assessment" rows={5} defaultValue={a?.initial_assessment ?? ""} className="rounded-xl" /></Field><Field label="Tiền sử quan trọng"><Input name="history" defaultValue={a?.important_history ?? ""} className="h-10 rounded-xl" /></Field><Field label="Dị ứng"><Input name="allergies" defaultValue={a?.allergies ?? ""} className="h-10 rounded-xl" /></Field></div>
      </section>
      <section>
        <SectionTitle index={3} title="Sinh hiệu" description="Lưu sẽ cập nhật sinh hiệu hiện tại" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Small name="pulse" label="Mạch (bpm)" value={a?.pulse_bpm} /><Small name="blood_pressure" label="Huyết áp (mmHg)" value={a?.systolic_pressure && a.diastolic_pressure ? `${a.systolic_pressure}/${a.diastolic_pressure}` : ""} /><Small name="spo2" label="SpO₂ (%)" value={a?.spo2_percent} /><Small name="temperature" label="Nhiệt độ (°C)" value={a?.temperature_c} /><Small name="respiratory_rate" label="Nhịp thở (lần/phút)" value={a?.respiratory_rate} /><Small name="pain_score" label="Điểm đau (0–10)" value={a?.pain_score} /><Field label="Ý thức" wide><Input name="consciousness" defaultValue={a?.consciousness ?? ""} className="h-10 rounded-xl" /></Field></div>
      </section>
    </div>
    <Footer pending={mutation.isPending} label="Lưu đánh giá ban đầu" />
  </form>;
}

function InterventionForm({ item, onSaved }: { item: EmergencyCase; onSaved: () => Promise<unknown> }) {
  const [selected, setSelected] = useState<InterventionType[]>([]);
  const mutation = useMutation({ mutationFn: ({ types, details }: { types: InterventionType[]; details: string }) => Promise.all(types.map((type) => emergencyService.addIntervention(item.id, { intervention_type: type, details: details || null }))), onSuccess: async () => { await onSaved(); setSelected([]); toast.success("Đã ghi nhận xử trí cấp cứu."); }, onError: (e) => toast.error(getApiErrorMessage(e, "Không thể lưu xử trí.")) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected.length) return toast.error("Chọn ít nhất một xử trí."); mutation.mutate({ types: selected, details: String(new FormData(event.currentTarget).get("details") ?? "").trim() }); }
  return <form onSubmit={submit}>
    <div className="space-y-6 p-5">
      <section>
        <SectionTitle index={1} title="Xử trí đã thực hiện" description="Chọn một hoặc nhiều xử trí" />
        <div className="grid gap-2.5 sm:grid-cols-2">{interventions.map(([type, label]) => <ToggleCard key={type} active={selected.includes(type)} onClick={() => setSelected((x) => x.includes(type) ? x.filter((i) => i !== type) : [...x, type])}>{label}</ToggleCard>)}</div>
      </section>
      <Field label="Chi tiết xử trí"><Textarea name="details" rows={4} placeholder="Liều thuốc, lưu lượng oxy, đáp ứng..." className="rounded-xl" /></Field>
      {item.interventions.length > 0 && <section>
        <SectionTitle index={2} title="Lịch sử xử trí" description={`${item.interventions.length} lần ghi nhận`} />
        <div className="space-y-2">{item.interventions.map((record) => <div key={record.id} className="rounded-xl bg-muted/55 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{interventions.find(([type]) => type === record.intervention_type)?.[1] ?? record.intervention_type}</p><span className="shrink-0 text-xs text-muted-foreground">{formatClock(record.performed_at)}</span></div>{record.details && <p className="mt-1 text-xs text-muted-foreground">{record.details}</p>}</div>)}</div>
      </section>}
    </div>
    <Footer pending={mutation.isPending} label="Ghi nhận xử trí" />
  </form>;
}

function PatientHeader({ item, now }: { item: EmergencyCase; now: number }) {
  return <article className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
    <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white [&_svg]:size-5"><UserRound /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{item.full_name}</h2><span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", priorities[item.priority].color)}>{priorities[item.priority].label}</span></div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.emergency_code} · {item.age ?? "?"} tuổi</p>
      </div>
      {/* 6. Điều phối cách ly: nút nhỏ + dialog */}
      <IsolationReferralPanel variant="compact" sourceRoom="ER-102" emergencyCaseId={item.id} defaultDiagnosis={item.assessment?.initial_assessment} />
    </div>
    <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Info icon={AlertTriangle} label="Lý do cấp cứu" value={item.reason} />
      <Info icon={Bed} label="Vị trí" value={item.location || "Chưa xếp giường"} />
      {/* 9. Thời gian ở cấp cứu tính từ lúc đến */}
      <Info icon={Clock3} label="Đã ở cấp cứu" value={`${formatDuration(minutesSince(item.arrived_at, now))} · đến lúc ${formatClock(item.arrived_at)}`} />
    </div>
  </article>;
}

/* ─────────── 8. Sinh hiệu có cờ Thấp/Cao + thời điểm đánh giá ─────────── */

type Flag = "LOW" | "NORMAL" | "HIGH";
const flagStyle: Record<Flag, string> = { LOW: "bg-sky-100 text-sky-700", NORMAL: "bg-emerald-100 text-emerald-700", HIGH: "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]" };

function respiratoryFlag(value: number | null | undefined): Flag | null {
  if (value == null) return null;
  return value < 12 ? "LOW" : value > 20 ? "HIGH" : "NORMAL";
}

/** Thẻ sinh hiệu hiện tại của ca cấp cứu (dùng chung ER-102 và PRE-503). */
export function EmergencyVitals({ item, title = "Dấu hiệu sinh tồn hiện tại" }: { item: EmergencyCase; title?: string }) {
  const a = item.assessment;
  const pressure = a?.systolic_pressure && a.diastolic_pressure ? `${a.systolic_pressure}/${a.diastolic_pressure}` : "";
  const pain = a?.pain_score;
  const painFlag: { label: string; flag: Flag } | null = pain == null ? null : pain >= 7 ? { label: "Đau nhiều", flag: "HIGH" } : pain >= 4 ? { label: "Đau vừa", flag: "HIGH" } : { label: "Đau nhẹ", flag: "NORMAL" };
  const tiles: Array<{ icon: typeof Activity; label: string; value: string | null; unit?: string; flag: Flag | null; flagLabel?: string }> = [
    { icon: HeartPulse, label: "Mạch", value: a?.pulse_bpm != null ? String(a.pulse_bpm) : null, unit: "bpm", flag: getVitalFlag("heartRate", a?.pulse_bpm != null ? String(a.pulse_bpm) : "") },
    { icon: Activity, label: "Huyết áp", value: pressure || null, unit: "mmHg", flag: getVitalFlag("bloodPressure", pressure) },
    { icon: Wind, label: "SpO₂", value: a?.spo2_percent != null ? String(a.spo2_percent) : null, unit: "%", flag: getVitalFlag("spo2", a?.spo2_percent != null ? String(a.spo2_percent) : "") },
    { icon: Thermometer, label: "Nhiệt độ", value: a?.temperature_c != null ? String(a.temperature_c) : null, unit: "°C", flag: getVitalFlag("temperature", a?.temperature_c != null ? String(a.temperature_c) : "") },
    { icon: Wind, label: "Nhịp thở", value: a?.respiratory_rate != null ? String(a.respiratory_rate) : null, unit: "/phút", flag: respiratoryFlag(a?.respiratory_rate) },
    { icon: Gauge, label: "Điểm đau", value: pain != null ? String(pain) : null, unit: "/10", flag: painFlag?.flag ?? null, flagLabel: painFlag?.label },
  ];
  const abnormal = tiles.filter((tile) => tile.flag === "LOW" || tile.flag === "HIGH").length;

  return <section className="rounded-[1.4rem] border bg-card p-4 shadow-sm sm:p-5">
    <SectionTitle index={0} title={title} description={a?.assessed_at ? `Đánh giá lúc ${formatClock(a.assessed_at)}` : "Chưa có đánh giá"} hideIndex aside={abnormal > 0 ? <span className="rounded-full bg-[var(--brand-coral-soft)] px-2.5 py-0.5 text-xs font-semibold text-[oklch(0.55_0.16_35)]">{abnormal} chỉ số bất thường</span> : null} />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map(({ icon: Icon, label, value, unit, flag, flagLabel }) => {
        const abnormalTile = flag === "LOW" || flag === "HIGH";
        return (
          <div key={label} className={cn("rounded-xl border px-3 py-2.5 transition", abnormalTile ? "border-[var(--brand-coral)]/35 bg-[var(--brand-coral-soft)]/40" : "border-transparent bg-muted/55")}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={cn("size-3.5 shrink-0", abnormalTile ? "text-[oklch(0.55_0.16_35)]" : "text-red-600/70")} />
              <span className="truncate">{label}</span>
              {abnormalTile && <span className={cn("ml-auto shrink-0 rounded-full px-1.5 text-[0.6rem] font-semibold leading-4", flagStyle[flag])}>{flagLabel ?? (flag === "LOW" ? "Thấp" : "Cao")}</span>}
            </div>
            <p className="mt-1 whitespace-nowrap text-lg font-semibold leading-tight tabular-nums">
              {value ?? <span className="text-sm font-normal text-muted-foreground">—</span>}
              {value && unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
            </p>
          </div>
        );
      })}
    </div>
    <div className="mt-2 flex items-start gap-2 rounded-xl bg-muted/55 px-3 py-2.5 text-sm">
      <Brain className="mt-0.5 size-3.5 shrink-0 text-red-600/70" />
      <span className="shrink-0 text-xs text-muted-foreground">Ý thức</span>
      <span className="min-w-0 flex-1 font-medium leading-5">{a?.consciousness || <span className="font-normal text-muted-foreground">Chưa ghi nhận</span>}</span>
    </div>
  </section>;
}

function CaseRow({ item, now, active, onClick }: { item: EmergencyCase; now: number; active: boolean; onClick: () => void }) {
  const p = priorities[item.priority];
  const minutes = minutesSince(item.arrived_at, now);
  const longWait = item.status === "WAITING" && minutes >= LONG_WAIT_MINUTES;
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-primary/25 bg-primary/[.055]" : "border-transparent hover:bg-muted")}>
    <div className="flex gap-3"><span className={cn("mt-1 size-2.5 shrink-0 rounded-full", p.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{item.full_name}</p><span className={cn("shrink-0 text-xs", longWait ? "font-semibold text-destructive" : "text-muted-foreground")} title={item.status === "WAITING" ? "Chờ xử trí" : "Đã ở cấp cứu"}>{formatDuration(minutes)}</span></div>
        <p className="text-xs text-muted-foreground">{item.emergency_code} · {item.age ?? "?"} tuổi · đến {formatClock(item.arrived_at)}</p>
        <p className="mt-2 line-clamp-2 text-xs">{item.reason}</p>
        <div className="mt-2 flex flex-wrap gap-1.5"><span className={cn("inline-block rounded-full border px-2 py-0.5 text-[.62rem] font-semibold", p.color)}>{p.label}</span>{item.status === "WAITING" && <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[.62rem] font-semibold text-amber-700">Chờ xử trí</span>}</div>
      </div>
    </div>
  </button>;
}

/* ─────────── Thành phần chung ─────────── */

function SectionTitle({ index, title, description, aside, hideIndex }: { index: number; title: string; description: string; aside?: ReactNode; hideIndex?: boolean }) {
  return <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
    {!hideIndex && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-red-100 text-[0.7rem] font-bold text-red-700">{index}</span>}
    <h3 className="text-sm font-semibold">{title}</h3>
    <span className="hidden h-4 w-px bg-border sm:block" />
    <p className="text-xs text-muted-foreground">{description}</p>
    {aside && <span className="ml-auto">{aside}</span>}
  </div>;
}
function ToggleCard({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition", active ? "border-red-300 bg-red-50 font-medium text-red-800" : "hover:border-red-200 hover:bg-red-50/40")}>
    <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", active ? "border-red-600 bg-red-600 text-white" : "bg-background")}>{active && <Check className="size-3.5" />}</span>
    {children}
  </button>;
}
function Metric({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Siren; color: string }) { return <div className="flex items-center gap-3 rounded-2xl border bg-card p-4"><span className={cn("grid size-10 place-items-center rounded-xl", color)}><Icon /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{String(value).padStart(2, "0")}</p></div></div>; }
function FormGroup({ index, title, children }: { index: number; title: string; children: ReactNode }) { return <section><div className="mb-3 flex items-center gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-red-100 text-[0.7rem] font-bold text-red-700">{index}</span><h3 className="text-sm font-semibold">{title}</h3></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div></section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={cn("space-y-1.5 text-sm font-medium", wide && "col-span-full")}><span className="block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition hover:border-primary/40 focus:border-ring focus:ring-3 focus:ring-ring/20" />; }
function Small({ name, label, value }: { name: string; label: string; value: unknown }) { return <Field label={label}><Input name={name} defaultValue={String(value ?? "")} className="h-10 rounded-xl tabular-nums" /></Field>; }
function Footer({ pending, label }: { pending: boolean; label: string }) { return <div className="flex justify-end border-t bg-muted/35 p-4"><Button type="submit" disabled={pending} className="rounded-full bg-red-600 hover:bg-red-700">{pending ? <LoaderCircle className="animate-spin" /> : <Check />}{label}</Button></div>; }
function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="flex gap-3 px-5 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-red-600" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-40 place-items-center p-6 text-center text-sm text-muted-foreground">{text}</div>; }
function Pending({ text }: { text: string }) { return <div className="p-10 text-center"><Hospital className="mx-auto text-muted-foreground" /><p className="mt-3 font-medium">Chưa kết nối nghiệp vụ</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>; }
function minutesSince(value: string, now: number) { return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000)); }
function formatDuration(minutes: number) { return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`; }
function formatClock(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }

function PreparationRequestForm({ item, onSaved }: { item: EmergencyCase; onSaved: () => Promise<unknown> }) {
  const [orders, setOrders] = useState<PreparationOrderType[]>(["BLOOD_TEST"]);
  const mutation = useMutation({ mutationFn: (payload: { urgency: "IMMEDIATE" | "URGENT" | "EXPEDITED"; suspected_diagnosis: string | null; transport_condition: string; request_note: string | null; orders: PreparationOrderType[] }) => emergencyService.requestPreparation(item.id, payload), onSuccess: async (data) => { await onSaved(); toast.success(data.message); }, onError: (error) => toast.error(getApiErrorMessage(error, "Không thể chuyển ca đến PRE-503.")) });
  if (item.preparation || item.status === "AWAITING_PREPARATION" || item.status === "IN_PREPARATION") return <div className="p-8 text-center"><Hospital className="mx-auto size-8 text-primary" /><h3 className="mt-3 font-semibold">Đã chuyển yêu cầu đến PRE-503</h3><p className="mt-1 text-sm text-muted-foreground">Các chỉ định được thực hiện tại phòng chuẩn bị phẫu thuật tầng 5.</p></div>;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!orders.length) return toast.error("Chọn ít nhất một chỉ định tại PRE-503."); const data = new FormData(event.currentTarget); mutation.mutate({ urgency: String(data.get("urgency")) as "IMMEDIATE" | "URGENT" | "EXPEDITED", suspected_diagnosis: String(data.get("suspected_diagnosis") ?? "").trim() || null, transport_condition: String(data.get("transport_condition") ?? "").trim(), request_note: String(data.get("request_note") ?? "").trim() || null, orders }); }
  const choices: Array<[PreparationOrderType, string]> = [["BLOOD_TEST", "Xét nghiệm máu"], ["ULTRASOUND", "Siêu âm tại chỗ"], ["CT_SCAN", "CT tại chỗ"]];
  return <form onSubmit={submit}>
    <div className="space-y-6 p-5">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-semibold text-red-800">Chuyển thẳng đến PRE-503 · Tầng 5</p><p className="mt-1 text-xs text-red-700">Không cần đi qua phòng chức năng tầng 3.</p></div>
      <section>
        <SectionTitle index={1} title="Thông tin chuyển" description="Mức độ phẫu thuật, chẩn đoán nghi ngờ, tình trạng vận chuyển" />
        <div className="grid gap-4 md:grid-cols-2"><Field label="Mức độ phẫu thuật"><Select name="urgency"><option value="IMMEDIATE">Tối khẩn</option><option value="URGENT">Khẩn</option><option value="EXPEDITED">Xử lý sớm</option></Select></Field><Field label="Chẩn đoán nghi ngờ"><Input name="suspected_diagnosis" className="h-10 rounded-xl" /></Field><Field label="Tình trạng vận chuyển" wide><Textarea name="transport_condition" required className="rounded-xl" /></Field></div>
      </section>
      <section>
        <SectionTitle index={2} title="Chỉ định tại PRE-503" description="Chọn một hoặc nhiều" />
        <div className="grid gap-2.5 md:grid-cols-3">{choices.map(([type, label]) => <ToggleCard key={type} active={orders.includes(type)} onClick={() => setOrders((current) => current.includes(type) ? current.filter((value) => value !== type) : [...current, type])}>{label}</ToggleCard>)}</div>
      </section>
      <Field label="Ghi chú bàn giao"><Textarea name="request_note" rows={3} className="rounded-xl" /></Field>
    </div>
    <Footer pending={mutation.isPending} label="Chuyển đến PRE-503" />
  </form>;
}
