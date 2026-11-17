"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, BedDouble, CheckCircle2, Clock3, LoaderCircle, LogOut, Scissors, Stethoscope, Store, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { emergencyService, type EmergencyPreparation, type PostoperativeDestination } from "@/services/emergency.service";
import { IsolationReferralPanel } from "@/components/doctor/workspaces/isolation-referral-panel";
import { getVitalFlag } from "@/components/doctor/workspaces/reception-measure-dialog";
import { PretransferVitals, SectionTitle, urgencyLabel, urgencyStyle } from "@/components/doctor/workspaces/surgery-workspace";
import { ChoiceCard, DialogHead, Empty, Info, Metric, OutcomeBadge, PrescriptionEditor, PrescriptionPanel, ProgressPanel, RoomCard, SearchBox, SurgeryHandover, Warning, formatDateTime, formatDuration, matchesKeyword, minutesSince, normalize, useNow, usePrescriptionDraft, wardRooms, type WardRoom } from "@/components/doctor/workspaces/care-panels";

type IcuOutcome = "TRANSFERRED_TO_FLOOR_4" | "PHARMACY_DISCHARGE";

/** Thời điểm bệnh nhân vào phòng: sau mổ thì lúc hoàn tất mổ, chuyển thẳng thì lúc PRE-503 bàn giao. */
function arrivedAt(item: EmergencyPreparation) {
  return item.surgery_status === "COMPLETED" ? item.surgery_completed_at : item.completed_at;
}

/** Cần theo dõi sát: sinh hiệu trước chuyển bất thường hoặc ca mổ có biến chứng / không thành công. */
function needsCloseWatch(item: EmergencyPreparation) {
  const flags = [
    getVitalFlag("heartRate", item.pretransfer_pulse ?? ""),
    getVitalFlag("bloodPressure", item.pretransfer_blood_pressure ?? ""),
    getVitalFlag("spo2", item.pretransfer_spo2 ?? ""),
    getVitalFlag("temperature", item.pretransfer_temperature ?? ""),
  ];
  return flags.some((flag) => flag === "LOW" || flag === "HIGH") || item.surgery_outcome === "COMPLICATED" || item.surgery_outcome === "UNSUCCESSFUL";
}

export function PostoperativeWorkspace({ roomCode, roomName }: { roomCode: PostoperativeDestination; roomName: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["postoperative-transfers", roomCode], queryFn: () => emergencyService.getPostoperativeTransfers(roomCode), refetchInterval: 10_000 });
  const cases = query.data ?? [];
  const isIcu = roomCode === "ICU-505";
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const now = useNow();
  const keyword = normalize(search.trim());
  const visible = cases.filter((item) => matchesKeyword(item, keyword));
  const selected = cases.find((x) => x.id === selectedId) ?? cases[0];
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["postoperative-transfers", roomCode] }); };

  return <div className="space-y-5">
    {/* 9. Bỏ ô "Phòng hiện tại" (đã có trên tiêu đề) */}
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Đang tiếp nhận" value={cases.length} />
      <Metric label="Sau phẫu thuật" value={cases.filter((x) => x.surgery_status === "COMPLETED").length} />
      {isIcu
        ? <Metric label="Đã có đơn thuốc" value={cases.filter((x) => (x.emergency_prescription?.items.length ?? 0) > 0).length} />
        : <Metric label="Cần theo dõi sát" value={cases.filter(needsCloseWatch).length} />}
    </div>
    <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Bệnh nhân được bàn giao</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{cases.length} bệnh nhân · {isIcu ? "theo dõi và hồi sức tích cực" : "theo dõi hồi tỉnh sau gây mê"}</p>
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <div className="space-y-2 p-2">
          {query.isPending ? <Empty loading text="Đang tải dữ liệu..." />
            : query.isError ? <Empty text="Không thể tải danh sách bàn giao." />
            : cases.length === 0 ? <Empty text={`Chưa có bệnh nhân tại ${roomCode}.`} />
            : visible.length === 0 ? <Empty text={`Không tìm thấy bệnh nhân phù hợp với “${search.trim()}”.`} />
            : visible.map((item) => <CaseRow key={item.id} item={item} now={now} isIcu={isIcu} active={selected?.id === item.id} onClick={() => setSelectedId(item.id)} />)}
        </div>
      </section>
      <section className="min-w-0 space-y-5">{selected ? <Details key={selected.id} item={selected} now={now} roomName={roomName} roomCode={roomCode} onSaved={refresh} /> : <Empty text="Chọn bệnh nhân để xem bàn giao." />}</section>
    </div>
  </div>;
}

/* ───────── Chi tiết bệnh nhân ───────── */

function Details({ item, now, roomName, roomCode, onSaved }: { item: EmergencyPreparation; now: number; roomName: string; roomCode: PostoperativeDestination; onSaved: () => Promise<void> }) {
  const patient = item.emergency_case!;
  const afterSurgery = item.surgery_status === "COMPLETED";
  const isIcu = roomCode === "ICU-505";
  const arrived = arrivedAt(item);
  return <>
    {/* Thẻ bệnh nhân: chẩn đoán, nguồn chuyển, 7. thời gian nằm phòng và ghi chú bàn giao */}
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
        {/* 5. Điều phối cách ly thu thành nút nhỏ */}
        {isIcu && <IsolationReferralPanel variant="compact" sourceRoom="ICU-505" emergencyCaseId={item.emergency_case_id} defaultDiagnosis={item.preliminary_diagnosis} />}
      </div>
      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Info icon={Stethoscope} label="Chẩn đoán" value={item.preliminary_diagnosis || item.suspected_diagnosis || "Chưa ghi"} />
        <Info icon={ArrowRightLeft} label="Nguồn chuyển" value={afterSurgery ? `${item.destination_room ?? "Phòng mổ"} · sau phẫu thuật` : "PRE-503 · chuyển hồi sức trực tiếp"} />
        <Info icon={Clock3} label={isIcu ? "Đã nằm ICU" : "Đã ở phòng hồi tỉnh"} value={arrived ? `${formatDuration(minutesSince(arrived, now))} · từ ${formatDateTime(arrived)}` : "—"} />
      </div>
      {item.disposition_note && <div className="border-t px-5 py-3 text-xs"><span className="text-muted-foreground">Bàn giao từ PRE-503: </span><span className="whitespace-pre-wrap">{item.disposition_note}</span></div>}
    </article>

    {afterSurgery && <SurgeryHandover item={item} />}
    <PretransferVitals item={item} />

    {isIcu && <>
      <ProgressPanel index={1} notes={item.icu_progress_notes ?? []} patientName={patient.full_name} place="ICU" save={(payload) => emergencyService.saveIntensiveCareProgress(item.id, payload)} onSaved={onSaved} />
      <PrescriptionPanel index={2} item={item} title="Đơn thuốc ICU" place="ICU" save={(payload) => emergencyService.saveEmergencyPrescription(item.id, payload)} onSaved={onSaved} />
      <LeaveIcuPanel item={item} onSaved={onSaved} />
    </>}
  </>;
}

/* ───────── ③ Rời ICU: thẻ tóm tắt + dialog chọn hướng xử lý ───────── */

function LeaveIcuPanel({ item, onSaved }: { item: EmergencyPreparation; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const rxCount = item.emergency_prescription?.items.length ?? 0;
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={3} title="Rời ICU" description="Chuyển tầng 4 hoặc ra quầy thuốc chuẩn bị xuất viện" />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><LogOut className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Quyết định hướng xử lý tiếp theo</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.icu_progress_notes.length} lần ghi diễn biến · {rxCount ? `đơn ${rxCount} thuốc` : "chưa có đơn thuốc"}</p>
      </div>
      <Button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-amber-700 px-5 text-white hover:bg-amber-800"><LogOut /> Quyết định rời ICU</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHead icon={LogOut} iconClassName="text-amber-700" title="Quyết định rời ICU" description={`${item.emergency_case?.full_name ?? ""} · ${item.emergency_case?.emergency_code ?? ""}`} />
        {open && <LeaveIcuForm item={item} onDone={() => setOpen(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  </section>;
}

const icuOutcomes: Array<{ value: IcuOutcome; label: string; detail: string; icon: typeof BedDouble }> = [
  { value: "TRANSFERRED_TO_FLOOR_4", label: "Chuyển tầng 4", detail: "Tiến triển tốt, tiếp tục điều trị nội trú", icon: BedDouble },
  { value: "PHARMACY_DISCHARGE", label: "Ra quầy thuốc PHM-105", detail: "Nhận thuốc, chuẩn bị xuất viện", icon: Store },
];
// 1. Bỏ ISO-404: backend chỉ nhận phòng tầng 4; chuyển cách ly dùng nút "Chuyển cách ly ISO-404".

function LeaveIcuForm({ item, onDone, onSaved }: { item: EmergencyPreparation; onDone: () => void; onSaved: () => Promise<void> }) {
  const [outcome, setOutcome] = useState<IcuOutcome>("TRANSFERRED_TO_FLOOR_4");
  const [destination, setDestination] = useState<WardRoom>("IP-401");
  const [assessment, setAssessment] = useState("");
  const draft = usePrescriptionDraft(item);
  const latest = item.icu_progress_notes[0]?.assessment;
  const toFloor = outcome === "TRANSFERRED_TO_FLOOR_4";
  const target = toFloor ? destination : "PHM-105";
  const close = useMutation({
    mutationFn: async () => {
      // Ra quầy thuốc: lưu đơn (nếu có thay đổi) rồi mới chuyển, để quầy cấp đúng bản cuối.
      if (!toFloor && draft.dirty) await emergencyService.saveEmergencyPrescription(item.id, draft.payload);
      return emergencyService.closeIntensiveCare(item.id, { final_assessment: assessment.trim(), outcome, ...(toFloor && { destination_room: destination }) });
    },
    onSuccess: async (r) => { toast.success(r.message); onDone(); await onSaved(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận rời ICU.")),
  });
  const warnings = [
    !assessment.trim() && "Chưa có đánh giá trước chuyển — vẫn có thể xác nhận.",
    !toFloor && draft.items.length === 0 && "Đơn chưa có thuốc — bệnh nhân sẽ qua PHM-105 với đơn trống để làm thủ tục.",
  ].filter(Boolean) as string[];

  return <>
    <div className="space-y-6 px-6 py-5">
      <section>
        <SectionTitle index={1} title="Hướng xử lý" description="Bệnh nhân rời ICU ngay khi xác nhận" />
        <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2">{icuOutcomes.map(({ value, label, detail, icon }) => <ChoiceCard key={value} selected={outcome === value} onClick={() => setOutcome(value)} icon={icon} label={label} detail={detail} />)}</div>
      </section>

      {toFloor ? <section>
        <SectionTitle index={2} title="Phòng tiếp nhận" description="Tầng 4 · nội trú" />
        <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-3">{wardRooms.map((room) => <RoomCard key={room.code} code={room.code} name={room.name} selected={destination === room.code} onClick={() => setDestination(room.code)} />)}</div>
      </section> : <section>
        <SectionTitle index={2} title="Đơn thuốc ra quầy" description="Đơn đã kê ở mục ②, có thể kê thêm trước khi chuyển" aside={draft.dirty ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Có thay đổi · sẽ lưu khi xác nhận</span> : null} />
        <PrescriptionEditor draft={draft} />
      </section>}

      <section>
        <SectionTitle index={3} title="Đánh giá trước chuyển" description="Tình trạng khi rời ICU" aside={latest ? <button type="button" onClick={() => setAssessment(latest)} className="text-xs font-semibold text-primary hover:underline">Dùng đánh giá lần cuối</button> : null} />
        <Textarea rows={4} value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Tri giác, sinh hiệu, hô hấp, vết mổ, hướng theo dõi tiếp..." className="rounded-xl" />
      </section>

      {warnings.map((text) => <Warning key={text} text={text} />)}
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-6 py-4">
      <Button type="button" variant="outline" onClick={onDone} className="rounded-full px-4">Quay lại</Button>
      <Button type="button" disabled={close.isPending} onClick={() => close.mutate()} className="rounded-full px-5">{close.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} {!toFloor && draft.dirty ? "Lưu đơn & chuyển PHM-105" : `Xác nhận chuyển ${target}`}</Button>
    </div>
  </>;
}

/* ───────── 8. Danh sách bệnh nhân ───────── */

function CaseRow({ item, now, isIcu, active, onClick }: { item: EmergencyPreparation; now: number; isIcu: boolean; active: boolean; onClick: () => void }) {
  const arrived = arrivedAt(item);
  const afterSurgery = item.surgery_status === "COMPLETED";
  const rxCount = item.emergency_prescription?.items.length ?? 0;
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-primary/30 bg-primary/6" : "border-transparent hover:bg-muted")}>
    <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{item.emergency_case?.full_name}</p>{arrived && <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(minutesSince(arrived, now))}</span>}</div>
    <p className="mt-0.5 text-xs text-muted-foreground">{item.emergency_case?.emergency_code}</p>
    <p className="mt-1.5 line-clamp-1 text-xs">{item.preliminary_diagnosis || "Chưa có chẩn đoán"}</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[.62rem] font-semibold", afterSurgery ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700")}>{afterSurgery ? <><Scissors className="size-2.5" /> Sau mổ</> : "Từ PRE-503"}</span>
      {item.surgery_outcome && <OutcomeBadge value={item.surgery_outcome} small />}
      {isIcu && rxCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[.62rem] font-semibold text-emerald-700">Có đơn thuốc</span>}
    </div>
  </button>;
}

