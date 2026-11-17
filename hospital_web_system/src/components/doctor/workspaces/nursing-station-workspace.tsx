"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Biohazard, Check, LoaderCircle, ShieldAlert, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { nursingService, type NursingPatient, type NursingTask, type NursingVital } from "@/services/nursing.service";
import { getVitalFlag } from "@/components/doctor/workspaces/reception-measure-dialog";
import { SectionTitle } from "@/components/doctor/workspaces/surgery-workspace";
import { Empty, Field, Metric, SearchBox, formatDateTime, normalize, useNow } from "@/components/doctor/workspaces/care-panels";

/* ───────── Nhãn tiếng Việt ───────── */

const taskTypes: Array<[string, string]> = [["VITAL_SIGNS", "Đo sinh hiệu"], ["MEDICATION", "Cho thuốc"], ["DRESSING", "Thay băng"], ["DRAIN_CARE", "Chăm sóc dẫn lưu"], ["INTAKE_OUTPUT", "Theo dõi vào/ra"], ["SPECIMEN", "Lấy mẫu"], ["HYGIENE", "Vệ sinh"], ["OTHER", "Khác"]];
const taskTypeLabel = Object.fromEntries(taskTypes) as Record<string, string>;
const taskStatus: Record<NursingTask["status"], { label: string; className: string }> = {
  PENDING: { label: "Chờ làm", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "Đang làm", className: "bg-sky-100 text-sky-700" },
  COMPLETED: { label: "Đã xong", className: "bg-emerald-100 text-emerald-700" },
  MISSED: { label: "Bỏ lỡ", className: "bg-red-100 text-red-700" },
};
const careLevels: Array<["STANDARD" | "HIGH" | "CRITICAL", string, string]> = [["STANDARD", "Thông thường", "bg-slate-100 text-slate-700"], ["HIGH", "Chăm sóc cao", "bg-amber-100 text-amber-800"], ["CRITICAL", "Theo dõi sát", "bg-red-100 text-red-700"]];
const alertPriority: Record<string, { label: string; className: string }> = { ROUTINE: { label: "Thông thường", className: "bg-slate-100 text-slate-700" }, URGENT: { label: "Khẩn", className: "bg-amber-100 text-amber-800" }, CRITICAL: { label: "Tối khẩn", className: "bg-red-100 text-red-700" } };
const alertStatus: Record<string, string> = { NEW: "Mới", ACKNOWLEDGED: "Đã tiếp nhận", RESOLVED: "Đã xử lý" };
const shifts: Array<[string, string]> = [["MORNING", "Ca sáng"], ["AFTERNOON", "Ca chiều"], ["NIGHT", "Ca đêm"]];
const shiftLabel = Object.fromEntries(shifts) as Record<string, string>;
const ROOMS = ["IP-401", "IP-402", "OBS-403", "ISO-404"];

const isOpenTask = (t: NursingTask) => t.status === "PENDING" || t.status === "IN_PROGRESS";
const isOverdue = (t: NursingTask, now: number) => isOpenTask(t) && new Date(t.scheduled_at).getTime() < now;
function currentShift() { const h = new Date().getHours(); return h >= 6 && h < 14 ? "MORNING" : h >= 14 && h < 22 ? "AFTERNOON" : "NIGHT"; }
function useSave<T>(fn: (input: T) => Promise<{ message: string }>, refresh: () => Promise<void>, onDone?: () => void) {
  return useMutation({ mutationFn: fn, onSuccess: async (r) => { toast.success(r.message); onDone?.(); await refresh(); }, onError: (error) => toast.error(getApiErrorMessage(error, "Không thể lưu dữ liệu.")) });
}

/* ───────── Trang chính ───────── */

export function NursingStationWorkspace() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["nursing-dashboard"], queryFn: nursingService.dashboard, refetchInterval: 10_000 });
  const patients = query.data ?? [];
  const now = useNow();
  const [view, setView] = useState<"PATIENTS" | "TASKS">("PATIENTS");
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const selected = patients.find((x) => x.id === selectedId) ?? patients[0];
  const openTasks = patients.flatMap((p) => p.nursing_tasks.filter(isOpenTask));
  const overdue = openTasks.filter((t) => isOverdue(t, now)).length;
  const alerts = patients.flatMap((x) => x.nursing_alerts).filter((x) => x.status !== "RESOLVED");
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["nursing-dashboard"] }); };
  const keyword = normalize(search.trim());
  const visible = keyword ? patients.filter((p) => normalize([p.emergency_case.full_name, p.emergency_case.emergency_code, p.nursing_care_plan?.bed_code ?? "", p.preliminary_diagnosis ?? ""].join(" ")).includes(keyword)) : patients;

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Bệnh nhân tầng 4" value={patients.length} />
      <Metric label="Việc đang chờ" value={openTasks.length} />
      <Metric label="Việc quá hạn" value={overdue} />
      <Metric label="Cảnh báo chưa xử lý" value={alerts.length} />
    </div>

    <div className="flex gap-1 rounded-full bg-muted p-1 sm:w-fit">
      {([["PATIENTS", "Theo bệnh nhân", patients.length], ["TASKS", "Việc cần làm toàn tầng", openTasks.length]] as const).map(([value, label, count]) => (
        <button key={value} type="button" onClick={() => setView(value)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition sm:flex-none", view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {label}<span className={cn("tabular-nums", view === value ? "text-primary" : "")}>{count}</span>
        </button>
      ))}
    </div>

    {view === "TASKS" ? <FloorTaskBoard patients={patients} now={now} loading={query.isPending} refresh={refresh} onOpenPatient={(id) => { setSelectedId(id); setView("PATIENTS"); }} /> : (
      <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-semibold">Bệnh nhân cần chăm sóc</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{patients.length} bệnh nhân · IP-401 · IP-402 · OBS-403 · ISO-404</p>
            <SearchBox value={search} onChange={setSearch} />
          </div>
          <div className="space-y-3 p-2">
            {query.isPending ? <Empty loading text="Đang tải bảng điều phối..." />
              : query.isError ? <Empty text="Không thể tải bảng điều phối." />
              : patients.length === 0 ? <Empty text="Chưa có bệnh nhân tại tầng 4." />
              : visible.length === 0 ? <Empty text={`Không tìm thấy bệnh nhân phù hợp với “${search.trim()}”.`} />
              : ROOMS.map((room) => {
                const inRoom = visible.filter((p) => p.emergency_case.location === room);
                if (inRoom.length === 0) return null;
                return <div key={room}>
                  <p className="px-2 pb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{room} · {inRoom.length}</p>
                  <div className="space-y-1.5">{inRoom.map((p) => <PatientRow key={p.id} patient={p} now={now} active={selected?.id === p.id} onClick={() => setSelectedId(p.id)} />)}</div>
                </div>;
              })}
          </div>
        </section>
        <section className="min-w-0 space-y-5">{selected ? <PatientNursing key={selected.id} patient={selected} now={now} refresh={refresh} /> : <Empty text="Chọn bệnh nhân để điều phối chăm sóc." />}</section>
      </div>
    )}
  </div>;
}

function PatientRow({ patient, now, active, onClick }: { patient: NursingPatient; now: number; active: boolean; onClick: () => void }) {
  const plan = patient.nursing_care_plan;
  const level = careLevels.find(([v]) => v === (plan?.care_level ?? "STANDARD"))!;
  const overdue = patient.nursing_tasks.filter((t) => isOverdue(t, now)).length;
  const openAlerts = patient.nursing_alerts.filter((x) => x.status !== "RESOLVED").length;
  const isolation = patient.emergency_case.isolation_episode?.status === "ACTIVE";
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-primary/30 bg-primary/6" : "border-transparent hover:bg-muted")}>
    <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{patient.emergency_case.full_name}</p><span className="shrink-0 text-xs text-muted-foreground">{plan?.bed_code || "Chưa xếp giường"}</span></div>
    <p className="mt-0.5 truncate text-xs text-muted-foreground">{plan?.assigned_nurse_name || "Chưa phân công điều dưỡng"}</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[.62rem] font-semibold", level[2])}>{level[1]}</span>
      {isolation && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[.62rem] font-semibold text-amber-800"><Biohazard className="size-2.5" /> Cách ly</span>}
      {overdue > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[.62rem] font-semibold text-red-700">{overdue} việc quá hạn</span>}
      {openAlerts > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[.62rem] font-semibold text-white">{openAlerts} cảnh báo</span>}
    </div>
  </button>;
}

/* ───────── 16. Việc cần làm toàn tầng ───────── */

function FloorTaskBoard({ patients, now, loading, refresh, onOpenPatient }: { patients: NursingPatient[]; now: number; loading: boolean; refresh: () => Promise<void>; onOpenPatient: (id: string) => void }) {
  const rows = patients.flatMap((p) => p.nursing_tasks.filter(isOpenTask).map((task) => ({ task, patient: p }))).sort((a, b) => a.task.scheduled_at.localeCompare(b.task.scheduled_at));
  return <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
    <div className="border-b px-5 py-4"><SectionTitle title="Việc cần làm toàn tầng" description="Sắp theo giờ thực hiện · việc quá giờ tô đỏ" /></div>
    {loading ? <Empty loading text="Đang tải công việc..." /> : rows.length === 0 ? <Empty text="Không còn việc nào đang chờ." /> : <ul className="divide-y">
      {rows.map(({ task, patient }) => <li key={task.id} className={cn("px-5 py-3", isOverdue(task, now) && "bg-red-50/60")}>
        <TaskLine task={task} now={now} refresh={refresh} patientSlot={<button type="button" onClick={() => onOpenPatient(patient.id)} className="text-xs font-medium text-primary hover:underline">{patient.emergency_case.full_name} · {patient.emergency_case.location}{patient.nursing_care_plan?.bed_code ? ` · ${patient.nursing_care_plan.bed_code}` : ""}</button>} />
      </li>)}
    </ul>}
  </section>;
}

/** Một dòng công việc: giờ, loại, tên, người làm, trạng thái + nút Xong / Bỏ lỡ (Xong có thể ghi kết quả). */
function TaskLine({ task, now, refresh, patientSlot }: { task: NursingTask; now: number; refresh: () => Promise<void>; patientSlot?: ReactNode }) {
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState("");
  const update = useSave((input: { status: NursingTask["status"]; result: string | null }) => nursingService.updateTask(task.id, input), refresh, () => setFinishing(false));
  const overdue = isOverdue(task, now);
  const status = taskStatus[task.status];
  return <div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={cn("w-24 shrink-0 text-sm font-semibold tabular-nums", overdue ? "text-red-700" : "")}>{format(new Date(task.scheduled_at), "HH:mm dd/MM")}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm"><span className="font-medium">{task.title}</span> <span className="text-xs text-muted-foreground">· {taskTypeLabel[task.task_type] ?? task.task_type}</span></p>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">{patientSlot}<span>{task.assigned_nurse_name || "Chưa phân công"}</span>{task.instruction && <span className="truncate">· {task.instruction}</span>}{task.result && <span>· Kết quả: {task.result}</span>}</div>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-[.65rem] font-semibold", overdue ? "bg-red-100 text-red-700" : status.className)}>{overdue ? "Quá hạn" : status.label}</span>
      {isOpenTask(task) && !finishing && <div className="flex gap-1.5">
        <Button type="button" size="sm" className="h-8 rounded-full bg-emerald-600 px-3 text-xs hover:bg-emerald-700" onClick={() => setFinishing(true)}><Check /> Xong</Button>
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={update.isPending} onClick={() => update.mutate({ status: "MISSED", result: null })}><X /> Bỏ lỡ</Button>
      </div>}
    </div>
    {finishing && <div className="mt-2 flex flex-wrap gap-2 sm:pl-[6.75rem]">
      <Input autoFocus value={result} onChange={(e) => setResult(e.target.value)} placeholder="Kết quả (không bắt buộc), ví dụ: M 88, HA 120/80" className="h-8 min-w-0 flex-1 rounded-lg text-xs" />
      <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" disabled={update.isPending} onClick={() => update.mutate({ status: "COMPLETED", result: result.trim() || null })}>{update.isPending ? <LoaderCircle className="animate-spin" /> : <Check />} Xác nhận xong</Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full px-3 text-xs" onClick={() => setFinishing(false)}>Hủy</Button>
    </div>}
  </div>;
}

/* ───────── Chi tiết bệnh nhân ───────── */

type Tab = "CARE" | "TASKS" | "VITALS" | "ALERTS" | "HANDOVER";

function PatientNursing({ patient, now, refresh }: { patient: NursingPatient; now: number; refresh: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("TASKS");
  const plan = patient.nursing_care_plan;
  const level = careLevels.find(([v]) => v === (plan?.care_level ?? "STANDARD"))!;
  const isolation = patient.emergency_case.isolation_episode?.status === "ACTIVE" ? patient.emergency_case.isolation_episode : null;
  const openTasks = patient.nursing_tasks.filter(isOpenTask).length;
  const openAlerts = patient.nursing_alerts.filter((x) => x.status !== "RESOLVED").length;
  const tabs: Array<[Tab, string, number?]> = [["TASKS", "Công việc", openTasks], ["VITALS", "Sinh hiệu"], ["ALERTS", "Cảnh báo", openAlerts], ["CARE", "Kế hoạch chăm sóc"], ["HANDOVER", "Bàn giao ca"]];
  const risks = [plan?.fall_risk && "Nguy cơ té ngã", plan?.pressure_injury_risk && "Nguy cơ loét tỳ đè", plan?.isolation_precaution && "Phòng ngừa cách ly"].filter(Boolean) as string[];

  return <>
    <article className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5"><UserRound /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{patient.emergency_case.full_name}</h2><span className={cn("rounded-full px-3 py-1 text-xs font-semibold", level[2])}>{level[1]}</span></div>
          <p className="mt-0.5 text-xs text-muted-foreground">{patient.emergency_case.emergency_code} · {patient.emergency_case.location} · {plan?.bed_code || "Chưa xếp giường"} · {plan?.assigned_nurse_name || "Chưa phân công"}</p>
          <p className="mt-0.5 line-clamp-1 text-xs">{patient.preliminary_diagnosis || "Chưa ghi chẩn đoán"}</p>
        </div>
      </div>
      {(isolation || risks.length > 0) && <div className="flex flex-wrap gap-1.5 border-t px-5 py-2.5">
        {isolation && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"><Biohazard className="size-3" /> Đang cách ly · PPE: {isolation.ppe_requirements || "theo ISO-404"}</span>}
        {risks.map((r) => <span key={r} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"><AlertTriangle className="size-3" /> {r}</span>)}
      </div>}
      <div className="flex gap-1 overflow-x-auto border-t px-3 pt-2 scrollbar-hidden sm:px-5">
        {tabs.map(([value, label, count]) => <button key={value} type="button" onClick={() => setTab(value)} className={cn("relative flex shrink-0 items-center gap-1.5 rounded-t-xl px-3.5 py-2.5 text-sm font-medium transition", tab === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          {label}{count ? <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] text-primary-foreground">{count}</span> : null}
          {tab === value && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
        </button>)}
      </div>
    </article>
    {tab === "TASKS" && <Tasks patient={patient} now={now} refresh={refresh} />}
    {tab === "VITALS" && <Vitals patient={patient} refresh={refresh} />}
    {tab === "ALERTS" && <Alerts patient={patient} refresh={refresh} />}
    {tab === "CARE" && <CarePlan patient={patient} refresh={refresh} />}
    {tab === "HANDOVER" && <Handover patient={patient} now={now} refresh={refresh} />}
  </>;
}

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm"><SectionTitle title={title} description={description} />{children}</section>;
}
function SaveButton({ pending, label, onClick }: { pending: boolean; label: string; onClick: () => void }) {
  return <Button type="button" disabled={pending} onClick={onClick} className="rounded-full px-5">{pending ? <LoaderCircle className="animate-spin" /> : <Check />} {label}</Button>;
}
function Chips({ options, value, onChange }: { options: Array<[string, string]>; value: string; onChange: (v: string) => void }) {
  return <div className="flex flex-wrap gap-1.5">{options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={cn("h-8 rounded-full border px-3 text-xs font-medium transition", value === v ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary")}>{l}</button>)}</div>;
}

/* ───────── Công việc ───────── */

function Tasks({ patient, now, refresh }: { patient: NursingPatient; now: number; refresh: () => Promise<void> }) {
  const empty = { task_type: "VITAL_SIGNS", title: "", instruction: "", scheduled_at: "", assigned_nurse_name: patient.nursing_care_plan?.assigned_nurse_name ?? "" };
  const [f, setF] = useState(empty);
  const create = useSave(() => nursingService.createTask(patient.id, { task_type: f.task_type, title: f.title.trim() || null, instruction: f.instruction.trim() || null, scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null, assigned_nurse_name: f.assigned_nurse_name.trim() || null }), refresh, () => setF(empty));
  const sorted = [...patient.nursing_tasks].sort((a, b) => Number(isOpenTask(b)) - Number(isOpenTask(a)) || a.scheduled_at.localeCompare(b.scheduled_at));
  return <Card title="Công việc theo ca" description="Không chọn giờ thì lấy giờ hiện tại; không nhập tên thì lấy theo loại việc">
    <div className="space-y-3 rounded-2xl border p-4">
      <Chips options={taskTypes} value={f.task_type} onChange={(v) => setF({ ...f, task_type: v })} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem_12rem]">
        <Field label="Tên công việc"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={taskTypeLabel[f.task_type]} className="h-9 rounded-lg" /></Field>
        <Field label="Giờ thực hiện"><Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} className="h-9 rounded-lg" /></Field>
        <Field label="Điều dưỡng"><Input value={f.assigned_nurse_name} onChange={(e) => setF({ ...f, assigned_nurse_name: e.target.value })} placeholder="Tên điều dưỡng" className="h-9 rounded-lg" /></Field>
      </div>
      <Field label="Hướng dẫn"><Input value={f.instruction} onChange={(e) => setF({ ...f, instruction: e.target.value })} placeholder="Ví dụ: đo mỗi 4 giờ, báo bác sĩ nếu SpO₂ < 94%" className="h-9 rounded-lg" /></Field>
      <div className="flex justify-end"><SaveButton pending={create.isPending} label="Thêm công việc" onClick={() => create.mutate(undefined)} /></div>
    </div>
    {sorted.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chưa có công việc nào.</p>
      : <ul className="mt-4 divide-y rounded-2xl border">{sorted.map((t) => <li key={t.id} className={cn("px-4 py-3", isOverdue(t, now) && "bg-red-50/60", !isOpenTask(t) && "opacity-75")}><TaskLine task={t} now={now} refresh={refresh} /></li>)}</ul>}
  </Card>;
}

/* ───────── 17. Sinh hiệu có cờ ───────── */

type VitalForm = { pulse: string; blood_pressure: string; spo2: string; temperature: string; respiratory_rate: string; consciousness: string; pain_score: string; note: string; recorded_by_name: string };
function respiratoryFlag(value: string) { const n = Number(value.trim()); if (!value.trim() || Number.isNaN(n)) return null; return n < 12 ? "LOW" : n > 20 ? "HIGH" : "NORMAL"; }
function vitalFlags(v: Pick<VitalForm, "pulse" | "blood_pressure" | "spo2" | "temperature" | "respiratory_rate">) {
  return { pulse: getVitalFlag("heartRate", v.pulse), blood_pressure: getVitalFlag("bloodPressure", v.blood_pressure), spo2: getVitalFlag("spo2", v.spo2), temperature: getVitalFlag("temperature", v.temperature), respiratory_rate: respiratoryFlag(v.respiratory_rate) };
}
const vitalInputs: Array<[keyof ReturnType<typeof vitalFlags>, string, string, string]> = [["pulse", "Mạch", "bpm", "80"], ["blood_pressure", "Huyết áp", "mmHg", "120/80"], ["spo2", "SpO₂", "%", "97"], ["temperature", "Nhiệt độ", "°C", "37"], ["respiratory_rate", "Nhịp thở", "/ph", "18"]];
const consciousnessOptions: Array<[string, string]> = [["Tỉnh", "Tỉnh"], ["Đáp ứng lời nói", "Đáp ứng lời nói"], ["Đáp ứng đau", "Đáp ứng đau"], ["Không đáp ứng", "Không đáp ứng"]];

function FlagBadge({ flag }: { flag: string | null }) {
  if (flag !== "LOW" && flag !== "HIGH") return null;
  return <span className={cn("rounded-full px-1.5 text-[0.6rem] font-semibold leading-4", flag === "LOW" ? "bg-sky-100 text-sky-700" : "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]")}>{flag === "LOW" ? "Thấp" : "Cao"}</span>;
}

function Vitals({ patient, refresh }: { patient: NursingPatient; refresh: () => Promise<void> }) {
  const empty: VitalForm = { pulse: "", blood_pressure: "", spo2: "", temperature: "", respiratory_rate: "", consciousness: "", pain_score: "", note: "", recorded_by_name: patient.nursing_care_plan?.assigned_nurse_name ?? "" };
  const [f, setF] = useState(empty);
  const flags = vitalFlags(f);
  const save = useSave(() => nursingService.recordVital(patient.id, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]))), refresh, () => setF(empty));
  return <Card title="Sinh hiệu" description="Nhập số, hệ thống tự gắn cờ Thấp / Cao để tham khảo">
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{vitalInputs.map(([key, label, unit, placeholder]) => <label key={key} className="block space-y-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{label}<FlagBadge flag={flags[key]} /></span>
        <div className="relative"><Input value={f[key]} inputMode="decimal" onChange={(e) => setF({ ...f, [key]: e.target.value })} placeholder={placeholder} className={cn("h-9 rounded-lg pr-11 tabular-nums", (flags[key] === "LOW" || flags[key] === "HIGH") && "border-[var(--brand-coral)]/60")} /><span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.7rem] text-muted-foreground">{unit}</span></div>
      </label>)}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Ý thức</span><Chips options={consciousnessOptions} value={f.consciousness} onChange={(v) => setF({ ...f, consciousness: f.consciousness === v ? "" : v })} /></div>
        <div className="space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Điểm đau (0–10)</span><Chips options={Array.from({ length: 11 }, (_, i) => [String(i), String(i)] as [string, string])} value={f.pain_score} onChange={(v) => setF({ ...f, pain_score: f.pain_score === v ? "" : v })} /></div>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
        <Field label="Ghi chú"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ví dụ: sau cho thuốc hạ sốt 30 phút" className="h-9 rounded-lg" /></Field>
        <Field label="Người ghi"><Input value={f.recorded_by_name} onChange={(e) => setF({ ...f, recorded_by_name: e.target.value })} className="h-9 rounded-lg" /></Field>
      </div>
      <div className="flex justify-end"><SaveButton pending={save.isPending} label="Lưu sinh hiệu" onClick={() => save.mutate(undefined)} /></div>
    </div>
    <VitalHistory vitals={patient.nursing_vitals} />
  </Card>;
}

function VitalHistory({ vitals }: { vitals: NursingVital[] }) {
  if (vitals.length === 0) return <p className="mt-4 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chưa có lần đo nào.</p>;
  const cell = (value: string | null, flag: string | null) => <td className={cn("px-3 py-2 tabular-nums", (flag === "LOW" || flag === "HIGH") && "font-semibold text-[oklch(0.55_0.16_35)]")}>{value || "—"}</td>;
  return <div className="mt-4 overflow-x-auto rounded-2xl border">
    <table className="w-full min-w-[640px] text-left text-sm">
      <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Thời gian</th><th className="px-3 py-2 font-medium">Mạch</th><th className="px-3 py-2 font-medium">HA</th><th className="px-3 py-2 font-medium">SpO₂</th><th className="px-3 py-2 font-medium">Nhiệt</th><th className="px-3 py-2 font-medium">Nhịp thở</th><th className="px-3 py-2 font-medium">Ý thức</th><th className="px-3 py-2 font-medium">Đau</th><th className="px-3 py-2 font-medium">Người ghi</th></tr></thead>
      <tbody className="divide-y">{vitals.map((v) => {
        const flags = vitalFlags({ pulse: v.pulse ?? "", blood_pressure: v.blood_pressure ?? "", spo2: v.spo2 ?? "", temperature: v.temperature ?? "", respiratory_rate: v.respiratory_rate ?? "" });
        return <tr key={v.id} title={v.note ?? undefined}>
          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDateTime(v.recorded_at)}</td>
          {cell(v.pulse, flags.pulse)}{cell(v.blood_pressure, flags.blood_pressure)}{cell(v.spo2, flags.spo2)}{cell(v.temperature, flags.temperature)}{cell(v.respiratory_rate, flags.respiratory_rate)}
          <td className="px-3 py-2 text-xs">{v.consciousness || "—"}</td><td className="px-3 py-2 tabular-nums">{v.pain_score || "—"}</td><td className="px-3 py-2 text-xs text-muted-foreground">{v.recorded_by_name || "—"}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

/* ───────── Cảnh báo bác sĩ ───────── */

function Alerts({ patient, refresh }: { patient: NursingPatient; refresh: () => Promise<void> }) {
  const empty = { priority: "URGENT", reason: "", clinical_snapshot: "", created_by_name: patient.nursing_care_plan?.assigned_nurse_name ?? "" };
  const [f, setF] = useState(empty);
  const latest = patient.nursing_vitals[0];
  const create = useSave(() => nursingService.createAlert(patient.id, { priority: f.priority, reason: f.reason.trim() || null, clinical_snapshot: f.clinical_snapshot.trim() || null, created_by_name: f.created_by_name.trim() || null }), refresh, () => setF(empty));
  return <Card title="Cảnh báo bác sĩ" description="Báo bác sĩ khi bệnh nhân có diễn biến bất thường">
    <div className="space-y-3 rounded-2xl border p-4">
      <Chips options={Object.entries(alertPriority).map(([k, v]) => [k, v.label])} value={f.priority} onChange={(v) => setF({ ...f, priority: v })} />
      <Field label="Lý do gọi bác sĩ"><Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ví dụ: sốt 39,5°C không đáp ứng hạ sốt" className="rounded-xl" /></Field>
      <Field label="Sinh hiệu và tình trạng hiện tại">
        <Textarea rows={2} value={f.clinical_snapshot} onChange={(e) => setF({ ...f, clinical_snapshot: e.target.value })} className="rounded-xl" />
        {latest && <button type="button" onClick={() => setF({ ...f, clinical_snapshot: `M ${latest.pulse || "—"} · HA ${latest.blood_pressure || "—"} · SpO₂ ${latest.spo2 || "—"}% · T ${latest.temperature || "—"} · NT ${latest.respiratory_rate || "—"} (đo ${formatDateTime(latest.recorded_at)})` })} className="text-xs font-semibold text-primary hover:underline">Dùng sinh hiệu gần nhất</button>}
      </Field>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Điều dưỡng báo" className="w-64"><Input value={f.created_by_name} onChange={(e) => setF({ ...f, created_by_name: e.target.value })} className="h-9 rounded-lg" /></Field>
        <SaveButton pending={create.isPending} label="Gửi cảnh báo" onClick={() => create.mutate(undefined)} />
      </div>
    </div>
    {patient.nursing_alerts.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chưa có cảnh báo nào.</p>
      : <ul className="mt-4 space-y-2">{patient.nursing_alerts.map((a) => <AlertRow key={a.id} alert={a} refresh={refresh} />)}</ul>}
  </Card>;
}

function AlertRow({ alert, refresh }: { alert: NursingPatient["nursing_alerts"][number]; refresh: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const update = useSave((input: { status: "ACKNOWLEDGED" | "RESOLVED"; resolution_note: string | null }) => nursingService.updateAlert(alert.id, input), refresh);
  const p = alertPriority[alert.priority] ?? alertPriority.ROUTINE;
  const resolved = alert.status === "RESOLVED";
  return <li className={cn("rounded-2xl border p-3.5", !resolved && alert.priority === "CRITICAL" && "border-red-300 bg-red-50/60", !resolved && alert.priority === "URGENT" && "border-amber-300 bg-amber-50/60", resolved && "opacity-70")}>
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("rounded-full px-2 py-0.5 text-[.65rem] font-semibold", p.className)}>{p.label}</span>
      <span className="text-xs text-muted-foreground">{alertStatus[alert.status] ?? alert.status} · {formatDateTime(alert.created_at)}{alert.created_by_name ? ` · ${alert.created_by_name}` : ""}</span>
    </div>
    <p className="mt-1.5 text-sm font-medium">{alert.reason}</p>
    {alert.clinical_snapshot && <p className="mt-0.5 text-xs text-muted-foreground">{alert.clinical_snapshot}</p>}
    {alert.resolution_note && <p className="mt-1 text-xs"><span className="text-muted-foreground">Xử lý · </span>{alert.resolution_note}</p>}
    {!resolved && <div className="mt-2.5 flex flex-wrap gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú xử lý (không bắt buộc)" className="h-8 min-w-0 flex-1 rounded-lg bg-background text-xs" />
      {alert.status === "NEW" && <Button type="button" size="sm" variant="outline" className="h-8 rounded-full bg-background px-3 text-xs" disabled={update.isPending} onClick={() => update.mutate({ status: "ACKNOWLEDGED", resolution_note: note.trim() || null })}>Đã tiếp nhận</Button>}
      <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" disabled={update.isPending} onClick={() => update.mutate({ status: "RESOLVED", resolution_note: note.trim() || null })}><Check /> Đã xử lý</Button>
    </div>}
  </li>;
}

/* ───────── Kế hoạch chăm sóc ───────── */

function CarePlan({ patient, refresh }: { patient: NursingPatient; refresh: () => Promise<void> }) {
  const p = patient.nursing_care_plan;
  const [f, setF] = useState({ bed_code: p?.bed_code ?? "", assigned_nurse_name: p?.assigned_nurse_name ?? "", care_level: p?.care_level ?? "STANDARD", fall_risk: p?.fall_risk ?? false, pressure_injury_risk: p?.pressure_injury_risk ?? false, isolation_precaution: p?.isolation_precaution ?? false, care_note: p?.care_note ?? "" });
  const save = useSave(() => nursingService.saveCarePlan(patient.id, { ...f, bed_code: f.bed_code.trim() || null, assigned_nurse_name: f.assigned_nurse_name.trim() || null, care_note: f.care_note.trim() || null }), refresh);
  const risks = [["fall_risk", "Nguy cơ té ngã"], ["pressure_injury_risk", "Nguy cơ loét tỳ đè"], ["isolation_precaution", "Phòng ngừa cách ly"]] as const;
  return <Card title="Kế hoạch chăm sóc" description="Giường, điều dưỡng phụ trách, mức chăm sóc và nguy cơ">
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mã giường"><Input value={f.bed_code} onChange={(e) => setF({ ...f, bed_code: e.target.value })} placeholder="Ví dụ: G-03" className="h-9 rounded-lg" /></Field>
        <Field label="Điều dưỡng phụ trách"><Input value={f.assigned_nurse_name} onChange={(e) => setF({ ...f, assigned_nurse_name: e.target.value })} className="h-9 rounded-lg" /></Field>
      </div>
      <div className="space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Mức chăm sóc</span><Chips options={careLevels.map(([v, l]) => [v, l])} value={f.care_level} onChange={(v) => setF({ ...f, care_level: v as typeof f.care_level })} /></div>
      <div className="space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Nguy cơ</span>
        <div className="flex flex-wrap gap-1.5">{risks.map(([key, label]) => <button key={key} type="button" aria-pressed={f[key]} onClick={() => setF({ ...f, [key]: !f[key] })} className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition", f[key] ? "border-red-300 bg-red-50 text-red-700" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary")}>{f[key] && <ShieldAlert className="size-3.5" />}{label}</button>)}</div>
      </div>
      <Field label="Lưu ý chăm sóc"><Textarea rows={3} value={f.care_note} onChange={(e) => setF({ ...f, care_note: e.target.value })} placeholder="Chế độ ăn, tư thế, vận động, theo dõi đặc biệt..." className="rounded-xl" /></Field>
      <div className="flex justify-end"><SaveButton pending={save.isPending} label="Lưu kế hoạch" onClick={() => save.mutate(undefined)} /></div>
    </div>
  </Card>;
}

/* ───────── Bàn giao ca ───────── */

function Handover({ patient, now, refresh }: { patient: NursingPatient; now: number; refresh: () => Promise<void> }) {
  const empty = { shift: currentShift(), outgoing_nurse_name: patient.nursing_care_plan?.assigned_nurse_name ?? "", incoming_nurse_name: "", current_condition: "", outstanding_work: "", safety_warning: "" };
  const [f, setF] = useState(empty);
  const save = useSave(() => nursingService.createHandover(patient.id, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === "shift" ? v : v.trim() || null]))), refresh, () => setF(empty));
  const pending = patient.nursing_tasks.filter(isOpenTask);
  const plan = patient.nursing_care_plan;
  const risks = [plan?.fall_risk && "Nguy cơ té ngã", plan?.pressure_injury_risk && "Nguy cơ loét tỳ đè", plan?.isolation_precaution && "Phòng ngừa cách ly"].filter(Boolean) as string[];
  const latest = patient.nursing_vitals[0];
  return <Card title="Bàn giao ca trực" description="Các ô đều không bắt buộc; có nút điền nhanh từ dữ liệu sẵn có">
    <div className="space-y-3 rounded-2xl border p-4">
      <Chips options={shifts} value={f.shift} onChange={(v) => setF({ ...f, shift: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Người giao"><Input value={f.outgoing_nurse_name} onChange={(e) => setF({ ...f, outgoing_nurse_name: e.target.value })} className="h-9 rounded-lg" /></Field>
        <Field label="Người nhận"><Input value={f.incoming_nurse_name} onChange={(e) => setF({ ...f, incoming_nurse_name: e.target.value })} className="h-9 rounded-lg" /></Field>
      </div>
      <Field label="Tình trạng hiện tại">
        <Textarea rows={2} value={f.current_condition} onChange={(e) => setF({ ...f, current_condition: e.target.value })} className="rounded-xl" />
        {latest && <button type="button" onClick={() => setF({ ...f, current_condition: `Sinh hiệu ${formatDateTime(latest.recorded_at)}: M ${latest.pulse || "—"}, HA ${latest.blood_pressure || "—"}, SpO₂ ${latest.spo2 || "—"}%, T ${latest.temperature || "—"}${latest.consciousness ? `, ${latest.consciousness.toLowerCase()}` : ""}.` })} className="text-xs font-semibold text-primary hover:underline">Điền từ sinh hiệu gần nhất</button>}
      </Field>
      <Field label="Công việc chưa hoàn thành">
        <Textarea rows={2} value={f.outstanding_work} onChange={(e) => setF({ ...f, outstanding_work: e.target.value })} className="rounded-xl" />
        {pending.length > 0 && <button type="button" onClick={() => setF({ ...f, outstanding_work: pending.map((t) => `${format(new Date(t.scheduled_at), "HH:mm")} ${t.title}${isOverdue(t, now) ? " (quá hạn)" : ""}`).join("\n") })} className="text-xs font-semibold text-primary hover:underline">Lấy {pending.length} việc đang chờ</button>}
      </Field>
      <Field label="Cảnh báo an toàn">
        <Textarea rows={2} value={f.safety_warning} onChange={(e) => setF({ ...f, safety_warning: e.target.value })} className="rounded-xl" />
        {risks.length > 0 && <button type="button" onClick={() => setF({ ...f, safety_warning: risks.join(", ") })} className="text-xs font-semibold text-primary hover:underline">Lấy nguy cơ từ kế hoạch chăm sóc</button>}
      </Field>
      <div className="flex justify-end"><SaveButton pending={save.isPending} label="Xác nhận bàn giao" onClick={() => save.mutate(undefined)} /></div>
    </div>
    {patient.nursing_handovers.length > 0 && <ul className="mt-4 space-y-2">{patient.nursing_handovers.map((h) => <li key={h.id} className="rounded-2xl border p-3.5 text-sm">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{shiftLabel[h.shift] ?? h.shift}</span>{formatDateTime(h.created_at)}{(h.outgoing_nurse_name || h.incoming_nurse_name) && <span>· {h.outgoing_nurse_name || "?"} → {h.incoming_nurse_name || "?"}</span>}</p>
      {h.current_condition && <p className="mt-1.5 whitespace-pre-wrap">{h.current_condition}</p>}
      {h.outstanding_work && <p className="mt-1 whitespace-pre-wrap text-xs"><span className="text-muted-foreground">Còn lại · </span>{h.outstanding_work}</p>}
      {h.safety_warning && <p className="mt-0.5 whitespace-pre-wrap text-xs text-red-700"><span className="text-muted-foreground">An toàn · </span>{h.safety_warning}</p>}
    </li>)}</ul>}
  </Card>;
}


