"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, BedDouble, Biohazard, CheckCircle2, Clock3, DoorOpen, LoaderCircle, LogOut, NotebookPen, ShieldAlert, Stethoscope, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { EmergencyPreparation } from "@/services/emergency.service";
import { isolationService, type IsolationEpisode, type IsolationMonitoringPayload, type IsolationType } from "@/services/isolation.service";
import { SectionTitle } from "@/components/doctor/workspaces/surgery-workspace";
import { ChoiceCard, DialogHead, Empty, Field, Info, Metric, PrescriptionEditor, PrescriptionPanel, RoomCard, SearchBox, TextBlock, Warning, formatDateTime, formatDuration, minutesSince, normalize, useNow, usePrescriptionDraft, wardRooms, type WardRoom } from "@/components/doctor/workspaces/care-panels";

const typeInfo: Record<IsolationType, { label: string; detail: string; tone: string }> = {
  CONTACT: { label: "Tiếp xúc", detail: "Găng tay, áo choàng khi tiếp xúc", tone: "bg-amber-100 text-amber-800" },
  DROPLET: { label: "Giọt bắn", detail: "Khẩu trang y tế, giữ khoảng cách", tone: "bg-orange-100 text-orange-800" },
  AIRBORNE: { label: "Không khí", detail: "Khẩu trang N95, phòng áp lực âm", tone: "bg-red-100 text-red-700" },
  PROTECTIVE: { label: "Bảo vệ", detail: "Bảo vệ bệnh nhân suy giảm miễn dịch", tone: "bg-sky-100 text-sky-700" },
};

function patientName(e: IsolationEpisode) { return e.emergency_case?.full_name ?? e.medical_visit?.patient.full_name ?? "Bệnh nhân"; }
function patientCode(e: IsolationEpisode) { return e.emergency_case?.emergency_code ?? e.medical_visit?.visit_code ?? ""; }
function patientAge(e: IsolationEpisode) {
  const dob = e.emergency_case?.date_of_birth ?? e.medical_visit?.patient.date_of_birth;
  if (dob) return `${Math.max(0, new Date().getFullYear() - new Date(dob).getFullYear())} tuổi`;
  return e.emergency_case?.age != null ? `${e.emergency_case.age} tuổi` : "? tuổi";
}

export function IsolationWorkspace() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["isolation-episodes"], queryFn: isolationService.getEpisodes, refetchInterval: 10_000 });
  const episodes = query.data ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const now = useNow();
  const keyword = normalize(search.trim());
  const visible = keyword ? episodes.filter((e) => normalize([patientName(e), patientCode(e), e.reason, e.diagnosis ?? ""].join(" ")).includes(keyword)) : episodes;
  const selected = episodes.find((x) => x.id === selectedId) ?? episodes[0];
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["isolation-episodes"] }); };

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Chờ tiếp nhận" value={episodes.filter((x) => x.status === "REQUESTED").length} />
      <Metric label="Đang cách ly" value={episodes.filter((x) => x.status === "ACTIVE").length} />
      <Metric label="Lây qua không khí" value={episodes.filter((x) => x.isolation_type === "AIRBORNE").length} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Bệnh nhân cách ly</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{episodes.length} hồ sơ · yêu cầu từ các phòng và bệnh nhân đang cách ly</p>
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <div className="space-y-2 p-2">
          {query.isPending ? <Empty loading text="Đang tải hồ sơ cách ly..." />
            : query.isError ? <Empty text="Không thể tải hồ sơ cách ly." />
            : episodes.length === 0 ? <Empty text="Chưa có yêu cầu hoặc bệnh nhân cách ly." />
            : visible.length === 0 ? <Empty text={`Không tìm thấy hồ sơ phù hợp với “${search.trim()}”.`} />
            : visible.map((e) => <EpisodeRow key={e.id} episode={e} now={now} active={selected?.id === e.id} onClick={() => setSelectedId(e.id)} />)}
        </div>
      </section>
      <section className="min-w-0 space-y-5">{selected ? <EpisodeDetails key={selected.id} episode={selected} now={now} refresh={refresh} /> : <Empty text="Chọn hồ sơ để xử lý." />}</section>
    </div>
  </div>;
}

function EpisodeRow({ episode, now, active, onClick }: { episode: IsolationEpisode; now: number; active: boolean; onClick: () => void }) {
  const waiting = episode.status === "REQUESTED";
  const since = waiting ? episode.requested_at : episode.admitted_at;
  const type = typeInfo[episode.isolation_type];
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-amber-300 bg-amber-50/70" : "border-transparent hover:bg-muted")}>
    <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{patientName(episode)}</p>{since && <span className="shrink-0 text-xs text-muted-foreground">{waiting ? "chờ " : ""}{formatDuration(minutesSince(since, now))}</span>}</div>
    <p className="mt-0.5 text-xs text-muted-foreground">{patientCode(episode)} · từ {episode.source_room}</p>
    <p className="mt-1.5 line-clamp-1 text-xs">{episode.diagnosis || episode.reason}</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[.62rem] font-semibold", waiting ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700")}>{waiting ? "Chờ tiếp nhận" : "Đang cách ly"}</span>
      <span className={cn("rounded-full px-2 py-0.5 text-[.62rem] font-semibold", type.tone)}>{type.label}</span>
    </div>
  </button>;
}

/* ───────── Chi tiết hồ sơ ───────── */

function EpisodeDetails({ episode, now, refresh }: { episode: IsolationEpisode; now: number; refresh: () => Promise<void> }) {
  const type = typeInfo[episode.isolation_type];
  const active = episode.status === "ACTIVE";
  const preparation = episode.emergency_case?.preparation ?? null;
  const prepItem = preparation ? ({ ...preparation, emergency_case: { full_name: patientName(episode), emergency_code: patientCode(episode) } } as EmergencyPreparation) : null;
  return <>
    <article className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-600 text-white [&_svg]:size-5"><Biohazard /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{patientName(episode)}</h2>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700")}>{active ? "Đang cách ly" : "Chờ tiếp nhận"}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{patientCode(episode)} · {patientAge(episode)} · ISO-404 · Phòng cách ly</p>
        </div>
      </div>
      {/* 6. Loại cách ly + PPE đặt nổi bật */}
      <div className={cn("flex flex-wrap items-start gap-3 border-b px-5 py-3", type.tone)}>
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 text-sm"><p className="font-semibold">Cách ly {type.label.toLowerCase()} · {type.detail}</p><p className="mt-0.5 text-xs opacity-90">PPE bắt buộc: {episode.ppe_requirements || "Chưa ghi"}</p></div>
      </div>
      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Info icon={Stethoscope} label="Chẩn đoán" value={episode.diagnosis || "Chưa ghi"} />
        <Info icon={ArrowRightLeft} label="Nguồn chuyển" value={`${episode.source_room} · yêu cầu ${formatDateTime(episode.requested_at)}`} />
        <Info icon={Clock3} label={active ? "Đã cách ly" : "Đang chờ"} value={active && episode.admitted_at ? `${formatDuration(minutesSince(episode.admitted_at, now))} · từ ${formatDateTime(episode.admitted_at)}` : formatDuration(minutesSince(episode.requested_at, now))} />
      </div>
      <div className="grid gap-3 border-t p-4 sm:grid-cols-2">
        <TextBlock label="Lý do cách ly" value={episode.reason} />
        <TextBlock label="Sinh hiệu trước chuyển" value={episode.vital_signs} />
        <TextBlock label="Tình trạng vận chuyển" value={episode.transport_condition} />
        <TextBlock label="Ghi chú bàn giao" value={episode.handoff_note} />
      </div>
    </article>

    {active ? <>
      <MonitoringPanel episode={episode} refresh={refresh} />
      {prepItem && <PrescriptionPanel index={2} item={prepItem} title="Đơn thuốc" place="ISO-404" save={(payload) => isolationService.savePrescription(prepItem.id, payload)} onSaved={refresh} />}
      <ReleasePanel episode={episode} prepItem={prepItem} refresh={refresh} />
    </> : <AdmitPanel episode={episode} refresh={refresh} />}
  </>;
}

/* ───────── 7. Tiếp nhận ───────── */

function AdmitPanel({ episode, refresh }: { episode: IsolationEpisode; refresh: () => Promise<void> }) {
  const admit = useMutation({ mutationFn: () => isolationService.admit(episode.id), onSuccess: async (r) => { toast.success(r.message); await refresh(); }, onError: (error) => toast.error(getApiErrorMessage(error, "Không thể tiếp nhận.")) });
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle title="Tiếp nhận vào ISO-404" description="Xác nhận khi bệnh nhân đã đến phòng cách ly" />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><DoorOpen className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Bệnh nhân đang ở {episode.source_room}</p><p className="mt-0.5 text-xs text-muted-foreground">Sau khi tiếp nhận, vị trí bệnh nhân chuyển sang ISO-404{episode.medical_visit && !episode.emergency_case ? "; lượt khám ngoại trú được kết thúc và mở hồ sơ điều trị tầng 4" : ""}.</p></div>
      <Button type="button" disabled={admit.isPending} onClick={() => admit.mutate()} className="shrink-0 rounded-full bg-amber-700 px-5 text-white hover:bg-amber-800">{admit.isPending ? <LoaderCircle className="animate-spin" /> : <DoorOpen />} Tiếp nhận bệnh nhân</Button>
    </div>
  </section>;
}

/* ───────── 8. Diễn biến cách ly ───────── */

function MonitoringPanel({ episode, refresh }: { episode: IsolationEpisode; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const records = episode.monitoring_records;
  const shown = showAll ? records : records.slice(0, 3);
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={1} title="Diễn biến cách ly" description={records.length ? `${records.length} lần ghi · lần cuối ${formatDateTime(records[0].recorded_at)}` : "Chưa ghi diễn biến"} aside={<Button type="button" size="sm" onClick={() => setOpen(true)} className="rounded-full px-3.5"><NotebookPen /> Ghi diễn biến</Button>} />
    {records.length === 0
      ? <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chưa có diễn biến. Ghi diễn biến không làm bệnh nhân rời ISO-404.</p>
      : <ol className="ml-1.5 space-y-4 border-l pl-5">{shown.map((r, i) => <li key={r.id} className="relative">
        <span className={cn("absolute -left-[1.6rem] top-1 size-2.5 rounded-full ring-4 ring-card", i === 0 ? "bg-amber-500" : "bg-muted-foreground/40")} />
        <p className="text-xs text-muted-foreground">{formatDateTime(r.recorded_at)}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium">{r.symptoms || <span className="font-normal text-muted-foreground">Không ghi triệu chứng</span>}</p>
        {[["Sinh hiệu", r.vital_signs], ["Hỗ trợ hô hấp", r.respiratory_support], ["Điều trị", r.treatment_response], [r.test_name ? `XN ${r.test_name}` : "", r.test_name ? (r.test_result || "Đang chờ kết quả") : null], ["Nguy cơ lây", r.infection_note]].filter(([label, value]) => label && value).map(([label, value]) => <p key={label} className="mt-0.5 whitespace-pre-wrap text-xs"><span className="text-muted-foreground">{label} · </span>{value}</p>)}
      </li>)}</ol>}
    {records.length > 3 && <button type="button" onClick={() => setShowAll(!showAll)} className="mt-3 text-xs font-semibold text-primary hover:underline">{showAll ? "Thu gọn" : `Xem tất cả ${records.length} lần ghi`}</button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHead icon={NotebookPen} title="Ghi diễn biến · ISO-404" description={`${patientName(episode)} · bệnh nhân vẫn tiếp tục cách ly`} />
        {open && <MonitoringForm episode={episode} onDone={() => setOpen(false)} refresh={refresh} />}
      </DialogContent>
    </Dialog>
  </section>;
}

const respiratoryOptions = ["Thở khí trời", "Oxy kính mũi", "Oxy mặt nạ", "Thở máy không xâm nhập"];

function MonitoringForm({ episode, onDone, refresh }: { episode: IsolationEpisode; onDone: () => void; refresh: () => Promise<void> }) {
  const [f, setF] = useState({ symptoms: "", vital_signs: "", respiratory_support: "", treatment_response: "", test_name: "", test_result: "", infection_note: "" });
  const set = (key: keyof typeof f, value: string) => setF((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const payload = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) as Record<keyof typeof f, string | null>;
      return isolationService.monitor(episode.id, { ...payload, symptoms: f.symptoms.trim() } as IsolationMonitoringPayload);
    },
    onSuccess: async (r) => { toast.success(r.message); onDone(); await refresh(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể lưu diễn biến.")),
  });
  return <>
    <div className="space-y-4 px-6 py-5">
      <Field label="Triệu chứng hiện tại"><Textarea rows={3} value={f.symptoms} onChange={(e) => set("symptoms", e.target.value)} placeholder="Sốt, ho, khó thở, tiêu chảy, phát ban..." className="rounded-xl" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sinh hiệu"><Textarea rows={2} value={f.vital_signs} onChange={(e) => set("vital_signs", e.target.value)} placeholder="M 90 · HA 120/80 · SpO₂ 95% · T 38,2 · NT 22" className="rounded-xl" /></Field>
        <Field label="Hỗ trợ hô hấp">
          <Input value={f.respiratory_support} onChange={(e) => set("respiratory_support", e.target.value)} placeholder="Ví dụ: Oxy kính 3 l/phút" className="h-9 rounded-lg" />
          <div className="flex flex-wrap gap-1.5">{respiratoryOptions.map((o) => <button key={o} type="button" onClick={() => set("respiratory_support", o)} className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary">{o}</button>)}</div>
        </Field>
      </div>
      <Field label="Điều trị và đáp ứng"><Textarea rows={2} value={f.treatment_response} onChange={(e) => set("treatment_response", e.target.value)} placeholder="Thuốc, dịch truyền, đáp ứng..." className="rounded-xl" /></Field>
      <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <Field label="Xét nghiệm theo dõi"><Input value={f.test_name} onChange={(e) => set("test_name", e.target.value)} placeholder="PCR, test nhanh, cấy..." className="h-9 rounded-lg" /></Field>
        <Field label="Kết quả"><Input value={f.test_result} onChange={(e) => set("test_result", e.target.value)} placeholder="Để trống nếu đang chờ" className="h-9 rounded-lg" /></Field>
      </div>
      <Field label="Đánh giá nguy cơ lây nhiễm"><Textarea rows={2} value={f.infection_note} onChange={(e) => set("infection_note", e.target.value)} placeholder="Còn ho nhiều, tiếp tục cách ly giọt bắn..." className="rounded-xl" /></Field>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
      <p className="text-xs text-muted-foreground">{f.symptoms.trim() ? "Lưu xong bệnh nhân vẫn ở ISO-404." : "Chưa ghi triệu chứng, vẫn có thể lưu."}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onDone} className="rounded-full px-4">Hủy</Button>
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="rounded-full px-5">{save.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Lưu diễn biến</Button>
      </div>
    </div>
  </>;
}

/* ───────── 9. Rời cách ly ───────── */

function ReleasePanel({ episode, prepItem, refresh }: { episode: IsolationEpisode; prepItem: EmergencyPreparation | null; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={prepItem ? 3 : 2} title="Rời phòng cách ly" description="Chuyển phòng tầng 4 hoặc ra quầy thuốc chuẩn bị xuất viện" />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><LogOut className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Kết thúc cách ly</p><p className="mt-0.5 text-xs text-muted-foreground">{episode.monitoring_records.length} lần ghi diễn biến · kết luận nguy cơ lây nhiễm khi rời phòng</p></div>
      <Button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-emerald-700 px-5 text-white hover:bg-emerald-800"><LogOut /> Quyết định rời ISO-404</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHead icon={LogOut} iconClassName="text-emerald-700" title="Rời phòng cách ly ISO-404" description={`${patientName(episode)} · ${patientCode(episode)}`} />
        {open && <ReleaseForm episode={episode} prepItem={prepItem} onDone={() => setOpen(false)} refresh={refresh} />}
      </DialogContent>
    </Dialog>
  </section>;
}

const riskOptions = ["Hết nguy cơ lây nhiễm, ngừng cách ly", "Còn nguy cơ, tiếp tục phòng ngừa tại phòng mới", "Chưa đủ dữ liệu, cần theo dõi thêm"];

function ReleaseForm({ episode, prepItem, onDone, refresh }: { episode: IsolationEpisode; prepItem: EmergencyPreparation | null; onDone: () => void; refresh: () => Promise<void> }) {
  // 4. Chỉ đề xuất tầng 4 và quầy thuốc; ICU-505 / Tử vong ẩn trên giao diện (backend vẫn giữ).
  const [mode, setMode] = useState<"WARD" | "PHARMACY">("WARD");
  const [destination, setDestination] = useState<WardRoom>("IP-401");
  const [assessment, setAssessment] = useState("");
  const [risk, setRisk] = useState("");
  const latest = episode.monitoring_records[0];
  const toPharmacy = mode === "PHARMACY";
  const draft = usePrescriptionDraft(prepItem ?? ({ emergency_prescription: null } as EmergencyPreparation));
  const release = useMutation({
    mutationFn: async () => {
      if (toPharmacy && prepItem && draft.dirty) await isolationService.savePrescription(prepItem.id, draft.payload);
      return isolationService.release(episode.id, { final_assessment: assessment.trim(), infection_risk_result: risk.trim(), destination_room: toPharmacy ? "PHM-105" : destination });
    },
    onSuccess: async (r) => { toast.success(r.message); onDone(); await refresh(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận rời cách ly.")),
  });
  const warnings = [
    !assessment.trim() && "Chưa có đánh giá cuối — vẫn có thể xác nhận.",
    !risk.trim() && "Chưa kết luận nguy cơ lây nhiễm — vẫn có thể xác nhận.",
    toPharmacy && draft.items.length === 0 && "Đơn chưa có thuốc — bệnh nhân sẽ qua PHM-105 với đơn trống để làm thủ tục.",
  ].filter(Boolean) as string[];

  return <>
    <div className="space-y-6 px-6 py-5">
      <section>
        <SectionTitle index={1} title="Nơi đến" description="Bệnh nhân rời ISO-404 ngay khi xác nhận" />
        <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2">
          <ChoiceCard selected={mode === "WARD"} onClick={() => setMode("WARD")} icon={BedDouble} label="Chuyển phòng tầng 4" detail="Tiếp tục điều trị / theo dõi" />
          <ChoiceCard selected={mode === "PHARMACY"} onClick={() => setMode("PHARMACY")} icon={Store} label="Ra quầy thuốc PHM-105" detail="Nhận thuốc, chuẩn bị xuất viện" />
        </div>
        {mode === "WARD" && <div className="mt-2.5 grid auto-rows-fr gap-2.5 sm:grid-cols-3">{wardRooms.map((room) => <RoomCard key={room.code} code={room.code} name={room.name} selected={destination === room.code} onClick={() => setDestination(room.code)} />)}</div>}
      </section>

      {toPharmacy && prepItem && <section>
        <SectionTitle index={2} title="Đơn thuốc ra quầy" description="Có thể kê thêm trước khi chuyển" aside={draft.dirty ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Có thay đổi · sẽ lưu khi xác nhận</span> : null} />
        <PrescriptionEditor draft={draft} />
      </section>}

      <section>
        <SectionTitle index={toPharmacy && prepItem ? 3 : 2} title="Kết luận nguy cơ lây nhiễm" description="Ghi rõ để phòng tiếp nhận biết cách phòng ngừa" />
        <Textarea rows={2} value={risk} onChange={(e) => setRisk(e.target.value)} placeholder="Ví dụ: PCR âm tính 2 lần, hết nguy cơ lây nhiễm" className="rounded-xl" />
        <div className="mt-2 flex flex-wrap gap-1.5">{riskOptions.map((o) => <button key={o} type="button" onClick={() => setRisk(o)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium transition", risk === o ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/40 hover:text-primary")}>{o}</button>)}</div>
      </section>

      <section>
        <SectionTitle index={toPharmacy && prepItem ? 4 : 3} title="Đánh giá cuối" description="Tình trạng khi rời phòng cách ly" aside={latest?.symptoms ? <button type="button" onClick={() => setAssessment(latest.symptoms)} className="text-xs font-semibold text-primary hover:underline">Dùng diễn biến lần cuối</button> : null} />
        <Textarea rows={3} value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Triệu chứng, sinh hiệu, hướng theo dõi tiếp..." className="rounded-xl" />
      </section>

      {warnings.map((text) => <Warning key={text} text={text} />)}
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-6 py-4">
      <Button type="button" variant="outline" onClick={onDone} className="rounded-full px-4">Quay lại</Button>
      <Button type="button" disabled={release.isPending} onClick={() => release.mutate()} className="rounded-full px-5">{release.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} {toPharmacy ? (draft.dirty ? "Lưu đơn & chuyển PHM-105" : "Xác nhận chuyển PHM-105") : `Xác nhận chuyển ${destination}`}</Button>
    </div>
  </>;
}
