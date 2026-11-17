"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, BedDouble, CheckCircle2, Clock3, HeartPulse, LoaderCircle, LogOut, Stethoscope, Store, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { emergencyService, type EmergencyPreparation } from "@/services/emergency.service";
import { IsolationReferralPanel } from "@/components/doctor/workspaces/isolation-referral-panel";
import { PretransferVitals, SectionTitle, urgencyLabel, urgencyStyle } from "@/components/doctor/workspaces/surgery-workspace";
import { ChoiceCard, DialogHead, Empty, Info, Metric, OutcomeBadge, PrescriptionEditor, PrescriptionPanel, ProgressPanel, RoomCard, SearchBox, SurgeryHandover, TextBlock, Warning, formatDateTime, formatDuration, matchesKeyword, minutesSince, normalize, useNow, usePrescriptionDraft, wardRooms, type WardRoom } from "@/components/doctor/workspaces/care-panels";

type WardOutcome = "TRANSFERRED_TO_WARD" | "PHARMACY_DISCHARGE";

/** Nguồn chuyển đến phòng hiện tại: phòng tầng 4 khác, ICU-505 hoặc PRE-503 (chuyển thẳng). */
function wardSource(item: EmergencyPreparation, roomCode: WardRoom) {
  const otherRoom = item.ward_progress_notes?.find((note) => note.room_code !== roomCode)?.room_code;
  if (otherRoom) return { short: `Từ ${otherRoom}`, long: `${otherRoom} · chuyển phòng tầng 4`, tone: "bg-slate-100 text-slate-700" };
  if (item.icu_outcome === "TRANSFERRED_TO_FLOOR_4") return { short: "Từ ICU", long: `ICU-505${item.surgery_status === "COMPLETED" ? " · sau phẫu thuật" : ""}`, tone: "bg-sky-100 text-sky-700" };
  return { short: "Từ PRE-503", long: "PRE-503 · chuyển thẳng", tone: "bg-violet-100 text-violet-700" };
}

/** 12. Mốc vào phòng: ưu tiên ward_admitted_at; ca cũ chưa có thì lấy lúc rời ICU / lúc PRE-503 bàn giao. */
function admittedAt(item: EmergencyPreparation) {
  return item.ward_admitted_at ?? (item.icu_outcome === "TRANSFERRED_TO_FLOOR_4" ? item.icu_discharged_at : item.completed_at);
}

export function ObservationWorkspace({ roomCode = "OBS-403", roomName = "Phòng theo dõi" }: { roomCode?: WardRoom; roomName?: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["ward-transfers", roomCode], queryFn: () => emergencyService.getWardTransfers(roomCode), refetchInterval: 10_000 });
  const cases = query.data ?? [];
  const isObservation = roomCode === "OBS-403";
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const now = useNow();
  const keyword = normalize(search.trim());
  const visible = cases.filter((item) => matchesKeyword(item, keyword));
  const selected = cases.find((x) => x.id === selectedId) ?? cases[0];
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["ward-transfers", roomCode] }); };

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label={isObservation ? "Đang theo dõi" : "Đang điều trị"} value={cases.length} />
      <Metric label="Chuyển từ ICU" value={cases.filter((x) => x.icu_outcome === "TRANSFERRED_TO_FLOOR_4").length} />
      <Metric label="Đã có đơn thuốc" value={cases.filter((x) => (x.emergency_prescription?.items.length ?? 0) > 0).length} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <div className="border-b p-4">
          {/* 11. Tiêu đề theo loại phòng */}
          <h2 className="font-semibold">{isObservation ? "Bệnh nhân đang theo dõi" : "Bệnh nhân điều trị nội trú"}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{cases.length} bệnh nhân · {isObservation ? "theo dõi sát" : "điều trị nội trú"} tại {roomCode}</p>
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <div className="space-y-2 p-2">
          {query.isPending ? <Empty loading text="Đang tải dữ liệu..." />
            : query.isError ? <Empty text="Không thể tải danh sách bệnh nhân." />
            : cases.length === 0 ? <Empty text={`Chưa có bệnh nhân được chuyển đến ${roomCode}.`} />
            : visible.length === 0 ? <Empty text={`Không tìm thấy bệnh nhân phù hợp với “${search.trim()}”.`} />
            : visible.map((item) => <CaseRow key={item.id} item={item} now={now} roomCode={roomCode} active={selected?.id === item.id} onClick={() => setSelectedId(item.id)} />)}
        </div>
      </section>
      <section className="min-w-0 space-y-5">{selected ? <WardCase key={selected.id} item={selected} now={now} roomCode={roomCode} roomName={roomName} onSaved={refresh} /> : <Empty text="Chọn bệnh nhân để làm việc." />}</section>
    </div>
  </div>;
}

/* ───────── Chi tiết bệnh nhân ───────── */

function WardCase({ item, now, roomCode, roomName, onSaved }: { item: EmergencyPreparation; now: number; roomCode: WardRoom; roomName: string; onSaved: () => Promise<void> }) {
  const patient = item.emergency_case!;
  const source = wardSource(item, roomCode);
  const admitted = admittedAt(item);
  const fromIcu = item.icu_outcome === "TRANSFERRED_TO_FLOOR_4";
  return <>
    <article className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5"><UserRound /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{patient.full_name}</h2>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", urgencyStyle[item.urgency])}>{urgencyLabel(item.urgency)}</span>
            {item.surgery_outcome && <OutcomeBadge value={item.surgery_outcome} />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{patient.emergency_code} · {patient.age ?? "?"} tuổi · {roomCode} · {roomName}</p>
        </div>
        <IsolationReferralPanel variant="compact" sourceRoom={roomCode} emergencyCaseId={item.emergency_case_id} defaultDiagnosis={item.preliminary_diagnosis} />
      </div>
      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Info icon={Stethoscope} label="Chẩn đoán" value={item.preliminary_diagnosis || item.suspected_diagnosis || "Chưa ghi"} />
        <Info icon={ArrowRightLeft} label="Nguồn chuyển" value={source.long} />
        <Info icon={Clock3} label={`Đã nằm ${roomCode}`} value={admitted ? `${formatDuration(minutesSince(admitted, now))} · từ ${formatDateTime(admitted)}` : "—"} />
      </div>
      {item.disposition_note && <div className="border-t px-5 py-3 text-xs"><span className="text-muted-foreground">Bàn giao từ PRE-503: </span><span className="whitespace-pre-wrap">{item.disposition_note}</span></div>}
    </article>

    {/* 7. + 13. Bàn giao từ trước: ICU, phẫu thuật, sinh hiệu PRE-503 */}
    {fromIcu && <IcuHandover item={item} />}
    {item.surgery_status === "COMPLETED" && <SurgeryHandover item={item} />}
    <PretransferVitals item={item} />

    <ProgressPanel index={1} notes={item.ward_progress_notes ?? []} patientName={patient.full_name} place={roomCode} currentRoom={roomCode} save={(payload) => emergencyService.saveWardProgress(item.id, roomCode, payload)} onSaved={onSaved} />
    <PrescriptionPanel index={2} item={item} title="Đơn thuốc" place={roomCode} save={(payload) => emergencyService.saveWardPrescription(item.id, roomCode, payload)} onSaved={onSaved} />
    <LeaveWardPanel item={item} roomCode={roomCode} onSaved={onSaved} />
  </>;
}

/* ───────── 13. Quá trình tại ICU (chỉ xem) ───────── */

function IcuHandover({ item }: { item: EmergencyPreparation }) {
  const [showNotes, setShowNotes] = useState(false);
  const notes = item.icu_progress_notes ?? [];
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle title="Bàn giao từ ICU-505" description={item.icu_discharged_at ? `Rời ICU ${formatDateTime(item.icu_discharged_at)}` : "Chuyển từ hồi sức tích cực"} aside={notes.length ? <button type="button" onClick={() => setShowNotes(!showNotes)} className="text-xs font-semibold text-primary hover:underline">{showNotes ? "Ẩn diễn biến ICU" : `Xem ${notes.length} lần ghi tại ICU`}</button> : null} />
    <TextBlock label="Đánh giá khi rời ICU" value={item.icu_final_assessment} />
    {showNotes && <ol className="ml-1.5 mt-4 space-y-3 border-l pl-5">{notes.map((entry) => <li key={entry.id} className="relative">
      <span className="absolute -left-[1.6rem] top-1 size-2.5 rounded-full bg-sky-400/70 ring-4 ring-card" />
      <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{entry.assessment || <span className="text-muted-foreground">Không ghi đánh giá</span>}</p>
      {entry.vital_signs && <p className="mt-1 whitespace-pre-wrap text-xs"><span className="text-muted-foreground">Sinh hiệu · </span>{entry.vital_signs}</p>}
      {entry.treatment && <p className="mt-0.5 whitespace-pre-wrap text-xs"><span className="text-muted-foreground">Điều trị · </span>{entry.treatment}</p>}
    </li>)}</ol>}
  </section>;
}

/* ───────── ③ Rời phòng: thẻ tóm tắt + dialog ───────── */

function LeaveWardPanel({ item, roomCode, onSaved }: { item: EmergencyPreparation; roomCode: WardRoom; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const rxCount = item.emergency_prescription?.items.length ?? 0;
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={3} title={`Rời ${roomCode}`} description="Chuyển phòng tầng 4 hoặc ra quầy thuốc chuẩn bị xuất viện" />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><LogOut className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Quyết định hướng xử lý tiếp theo</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.ward_progress_notes?.length ?? 0} lần ghi diễn biến · {rxCount ? `đơn ${rxCount} thuốc` : "chưa có đơn thuốc"}</p>
      </div>
      <Button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-amber-700 px-5 text-white hover:bg-amber-800"><LogOut /> Quyết định rời phòng</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHead icon={LogOut} iconClassName="text-amber-700" title={`Quyết định rời ${roomCode}`} description={`${item.emergency_case?.full_name ?? ""} · ${item.emergency_case?.emergency_code ?? ""}`} />
        {open && <LeaveWardForm item={item} roomCode={roomCode} onDone={() => setOpen(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  </section>;
}

// Đã xuống tầng 4 thì không đề xuất quay lại tầng 5 (ICU / chuẩn bị phẫu thuật); backend vẫn giữ các hướng đó.
const wardOutcomes: Array<{ value: WardOutcome; label: string; detail: string; icon: typeof BedDouble }> = [
  { value: "TRANSFERRED_TO_WARD", label: "Chuyển phòng tầng 4", detail: "Tiếp tục điều trị ở phòng khác", icon: BedDouble },
  { value: "PHARMACY_DISCHARGE", label: "Ra quầy thuốc PHM-105", detail: "Nhận thuốc, chuẩn bị xuất viện", icon: Store },
];

function LeaveWardForm({ item, roomCode, onDone, onSaved }: { item: EmergencyPreparation; roomCode: WardRoom; onDone: () => void; onSaved: () => Promise<void> }) {
  const otherRooms = wardRooms.filter((room) => room.code !== roomCode);
  const [outcome, setOutcome] = useState<WardOutcome>("TRANSFERRED_TO_WARD");
  const [destination, setDestination] = useState<WardRoom>(otherRooms[0].code);
  const [assessment, setAssessment] = useState("");
  const draft = usePrescriptionDraft(item);
  const latest = item.ward_progress_notes?.[0]?.assessment;
  const toWard = outcome === "TRANSFERRED_TO_WARD";
  const toPharmacy = outcome === "PHARMACY_DISCHARGE";
  const decide = useMutation({
    mutationFn: async () => {
      // Ra quầy thuốc: lưu đơn (nếu có thay đổi) rồi mới chuyển, để quầy cấp đúng bản cuối.
      if (toPharmacy && draft.dirty) await emergencyService.saveWardPrescription(item.id, roomCode, draft.payload);
      return emergencyService.decideWardDisposition(item.id, roomCode, { final_assessment: assessment.trim(), outcome, ...(toWard && { destination_room: destination }) });
    },
    onSuccess: async (r) => { toast.success(r.message); onDone(); await onSaved(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận hướng xử lý.")),
  });
  const warnings = [
    !assessment.trim() && "Chưa có đánh giá trước chuyển — vẫn có thể xác nhận.",
    toPharmacy && draft.items.length === 0 && "Đơn chưa có thuốc — hệ thống hiện yêu cầu có đơn thuốc trước khi ra quầy PHM-105.",
  ].filter(Boolean) as string[];
  const confirmLabel = toWard ? `Xác nhận chuyển ${destination}` : draft.dirty ? "Lưu đơn & chuyển PHM-105" : "Xác nhận chuyển PHM-105";

  return <>
    <div className="space-y-6 px-6 py-5">
      <section>
        <SectionTitle index={1} title="Hướng xử lý" description={`Bệnh nhân rời ${roomCode} ngay khi xác nhận`} />
        <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2">{wardOutcomes.map(({ value, label, detail, icon }) => <ChoiceCard key={value} selected={outcome === value} onClick={() => setOutcome(value)} icon={icon} label={label} detail={detail} />)}</div>
      </section>

      {toWard && <section>
        <SectionTitle index={2} title="Phòng tiếp nhận" description="Tầng 4" />
        <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2">{otherRooms.map((room) => <RoomCard key={room.code} code={room.code} name={room.name} selected={destination === room.code} onClick={() => setDestination(room.code)} />)}</div>
      </section>}
      {toPharmacy && <section>
        <SectionTitle index={2} title="Đơn thuốc ra quầy" description="Đơn đã kê ở mục ②, có thể kê thêm trước khi chuyển" aside={draft.dirty ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Có thay đổi · sẽ lưu khi xác nhận</span> : null} />
        <PrescriptionEditor draft={draft} />
      </section>}

      <section>
        <SectionTitle index={3} title="Đánh giá trước chuyển" description={`Tình trạng khi rời ${roomCode}`} aside={latest ? <button type="button" onClick={() => setAssessment(latest)} className="text-xs font-semibold text-primary hover:underline">Dùng đánh giá lần cuối</button> : null} />
        <Textarea rows={4} value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Tri giác, sinh hiệu, vết mổ, hướng theo dõi tiếp..." className="rounded-xl" />
      </section>

      {warnings.map((text) => <Warning key={text} text={text} />)}
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-6 py-4">
      <Button type="button" variant="outline" onClick={onDone} className="rounded-full px-4">Quay lại</Button>
      <Button type="button" disabled={decide.isPending} onClick={() => decide.mutate()} className="rounded-full px-5">{decide.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} {confirmLabel}</Button>
    </div>
  </>;
}

/* ───────── 8. Danh sách bệnh nhân ───────── */

function CaseRow({ item, now, roomCode, active, onClick }: { item: EmergencyPreparation; now: number; roomCode: WardRoom; active: boolean; onClick: () => void }) {
  const admitted = admittedAt(item);
  const source = wardSource(item, roomCode);
  const rxCount = item.emergency_prescription?.items.length ?? 0;
  const lastNote = item.ward_progress_notes?.[0];
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-primary/30 bg-primary/6" : "border-transparent hover:bg-muted")}>
    <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{item.emergency_case?.full_name}</p>{admitted && <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(minutesSince(admitted, now))}</span>}</div>
    <p className="mt-0.5 text-xs text-muted-foreground">{item.emergency_case?.emergency_code}</p>
    <p className="mt-1.5 line-clamp-1 text-xs">{item.preliminary_diagnosis || "Chưa có chẩn đoán"}</p>
    {lastNote && <p className="mt-1 line-clamp-1 text-[0.7rem] text-muted-foreground"><HeartPulse className="mr-1 inline size-3" />{formatDateTime(lastNote.created_at)} · {lastNote.assessment || "Không ghi đánh giá"}</p>}
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[.62rem] font-semibold", source.tone)}>{source.short}</span>
      {item.surgery_outcome && <OutcomeBadge value={item.surgery_outcome} small />}
      {rxCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[.62rem] font-semibold text-emerald-700">Có đơn thuốc</span>}
    </div>
  </button>;
}
