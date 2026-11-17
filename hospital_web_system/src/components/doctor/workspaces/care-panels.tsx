"use client";

/**
 * Thành phần dùng chung cho các phòng điều trị sau cấp cứu (ICU-505, REC-504, IP-401, IP-402, OBS-403):
 * bàn giao phẫu thuật, diễn biến điều trị, đơn thuốc (kê / sửa) và các khối hiển thị nhỏ.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, LoaderCircle, NotebookPen, Pill, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { EmergencyPreparation, SurgeryOutcome } from "@/services/emergency.service";
import { medicalVisitService, type AvailableMedicine } from "@/services/medical-visit.service";
import { DosageAssist } from "@/components/doctor/workspaces/dosage-assist";
import { SectionTitle } from "@/components/doctor/workspaces/surgery-workspace";

export type WardRoom = "IP-401" | "IP-402" | "OBS-403";
export const wardRooms: Array<{ code: WardRoom; name: string }> = [
  { code: "IP-401", name: "Phòng bệnh 1" },
  { code: "IP-402", name: "Phòng bệnh 2" },
  { code: "OBS-403", name: "Phòng theo dõi" },
];

type SaveResult = Promise<{ message: string }>;
type ProgressPayload = { assessment: string; vital_signs: string | null; treatment: string | null };
type PrescriptionPayload = { note: string | null; items: Array<{ medicine_id: string; dosage: string | null; quantity: number; usage: string | null }> };
type ProgressNote = { id: string; assessment: string; vital_signs: string | null; treatment: string | null; created_at: string; room_code?: string };
type DraftItem = { key: string; medicine_id: string; name: string; code: string; unit: string; dosage: string; quantity: string; usage: string };

/* ───────── Tiện ích ───────── */

export function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
export function minutesSince(value: string, now: number) { return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000)); }
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} phút`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
  return `${Math.floor(minutes / 1440)} ngày ${Math.floor((minutes % 1440) / 60)} giờ`;
}
export function formatClock(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
export function formatDateTime(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }

/* ───────── Khối hiển thị nhỏ ───────── */

const surgeryOutcomeInfo: Record<SurgeryOutcome, { label: string; className: string }> = {
  SUCCESSFUL: { label: "Mổ thành công", className: "bg-emerald-100 text-emerald-700" },
  COMPLICATED: { label: "Mổ có biến chứng", className: "bg-amber-100 text-amber-800" },
  UNSUCCESSFUL: { label: "Mổ không thành công", className: "bg-red-100 text-red-700" },
};
export function OutcomeBadge({ value, small }: { value: SurgeryOutcome; small?: boolean }) {
  const info = surgeryOutcomeInfo[value];
  return <span className={cn("rounded-full font-semibold", small ? "px-2 py-0.5 text-[.62rem]" : "px-3 py-1 text-xs", info.className)}>{info.label}</span>;
}
export function Warning({ text }: { text: string }) { return <p className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"><TriangleAlert className="mt-px size-3.5 shrink-0" /> {text}</p>; }
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) { return <label className={cn("block space-y-1.5 text-sm font-medium", className)}><span className="block text-xs text-muted-foreground">{label}</span>{children}</label>; }
export function Fact({ label, value }: { label: string; value: ReactNode }) { return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium">{value || <span className="font-normal text-muted-foreground">Chưa ghi</span>}</dd></div>; }
export function TextBlock({ label, value }: { label: string; value: string | null | undefined }) { return <div className="rounded-xl border p-3.5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm">{value || <span className="text-muted-foreground">Chưa ghi</span>}</p></div>; }
export function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: ReactNode }) { return <div className="flex gap-3 px-5 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div></div>; }
export function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{String(value).padStart(2, "0")}</p></div>; }
export function Empty({ text, loading }: { text: string; loading?: boolean }) { return <div className="grid min-h-48 place-items-center p-6 text-center text-sm text-muted-foreground">{loading ? <div><LoaderCircle className="mx-auto mb-2 animate-spin" />{text}</div> : text}</div>; }
export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="relative mt-3">
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Tìm tên, mã ca hoặc chẩn đoán" className="h-10 rounded-xl pl-9 pr-9" />
    {value && <button type="button" onClick={() => onChange("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
  </div>;
}
export function matchesKeyword(item: EmergencyPreparation, keyword: string) {
  return !keyword || normalize([item.emergency_case?.full_name ?? "", item.emergency_case?.emergency_code ?? "", item.preliminary_diagnosis ?? ""].join(" ")).includes(keyword);
}
export function DialogHead({ icon: Icon, title, description, iconClassName }: { icon: typeof Clock3; title: string; description: string; iconClassName?: string }) {
  return <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Icon className={cn("size-4 text-primary", iconClassName)} /> {title}</DialogTitle>
      <span className="hidden h-4 w-px bg-border sm:block" />
      <DialogDescription className="text-sm">{description}</DialogDescription>
    </div>
  </DialogHeader>;
}

/* ───────── Bàn giao phẫu thuật: đủ biên bản mổ ───────── */

/** Lượng máu mất từ mức này trở lên thì tô cảnh báo (chỉ hiển thị). */
const HIGH_BLOOD_LOSS_ML = 500;

export function SurgeryHandover({ item }: { item: EmergencyPreparation }) {
  const duration = item.incision_at && item.closure_at ? Math.max(0, Math.round((new Date(item.closure_at).getTime() - new Date(item.incision_at).getTime()) / 60000)) : null;
  const timeRange = item.incision_at || item.closure_at
    ? `${item.incision_at ? formatClock(item.incision_at) : "?"} → ${item.closure_at ? formatClock(item.closure_at) : "?"}${duration !== null ? ` · ${formatDuration(duration)}` : ""}`
    : null;
  const bloodLoss = item.estimated_blood_loss_ml;
  const highBloodLoss = bloodLoss != null && bloodLoss >= HIGH_BLOOD_LOSS_ML;
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle title="Bàn giao phẫu thuật" description={`${item.destination_room ?? "Phòng mổ"} · hoàn tất ${item.surgery_completed_at ? formatDateTime(item.surgery_completed_at) : "—"}`} aside={item.surgery_outcome ? <OutcomeBadge value={item.surgery_outcome} /> : null} />
    <dl className="grid gap-x-5 gap-y-3 rounded-2xl bg-muted/45 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <Fact label="Phẫu thuật" value={item.procedure_name} />
      <Fact label="Phương pháp" value={item.surgical_approach} />
      <Fact label="Vô cảm" value={item.anesthesia_note} />
      <Fact label="Rạch da → đóng da" value={timeRange} />
      <Fact label="Máu mất ước tính" value={bloodLoss != null ? <span className={cn(highBloodLoss && "text-[oklch(0.55_0.16_35)]")}>{bloodLoss} ml{highBloodLoss ? " · mất máu nhiều" : ""}</span> : null} />
      <Fact label="Truyền máu / dịch" value={item.transfusion_note} />
    </dl>
    <div className="mt-3 grid gap-3 lg:grid-cols-3">
      <TextBlock label="Phát hiện trong mổ" value={item.surgical_findings} />
      <TextBlock label="Kết luận của bác sĩ" value={item.surgeon_conclusion} />
      <TextBlock label="Lưu ý hậu phẫu" value={item.surgery_note} />
    </div>
  </section>;
}

/* ───────── Diễn biến điều trị: dòng thời gian + dialog ghi ───────── */

const quickAssessments = ["Ổn định, tiếp tục theo dõi", "Cải thiện so với lần trước", "Diễn biến xấu hơn, tăng cường theo dõi"];

/**
 * @param place  tên nơi điều trị trong câu chữ, ví dụ "ICU" hoặc "IP-401".
 * @param currentRoom  khi có, đánh dấu những lần ghi ở phòng khác.
 */
export function ProgressPanel({ index, notes, patientName, place, currentRoom, save, onSaved }: {
  index: number;
  notes: ProgressNote[];
  patientName?: string;
  place: string;
  currentRoom?: string;
  save: (payload: ProgressPayload) => SaveResult;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? notes : notes.slice(0, 3);
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={index} title="Diễn biến điều trị" description={notes.length ? `${notes.length} lần ghi · lần cuối ${formatDateTime(notes[0].created_at)}` : "Chưa ghi diễn biến"} aside={<Button type="button" size="sm" onClick={() => setOpen(true)} className="rounded-full px-3.5"><NotebookPen /> Ghi diễn biến</Button>} />
    {notes.length === 0
      ? <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chưa có diễn biến. Ghi diễn biến không làm bệnh nhân rời {place}.</p>
      : <ol className="ml-1.5 space-y-4 border-l pl-5">{shown.map((entry, i) => <li key={entry.id} className="relative">
        <span className={cn("absolute -left-[1.6rem] top-1 size-2.5 rounded-full ring-4 ring-card", i === 0 ? "bg-primary" : "bg-muted-foreground/40")} />
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{formatDateTime(entry.created_at)}{currentRoom && entry.room_code && entry.room_code !== currentRoom && <span className="rounded-full bg-muted px-1.5 text-[0.62rem] font-medium">tại {entry.room_code}</span>}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium">{entry.assessment || <span className="font-normal text-muted-foreground">Không ghi đánh giá</span>}</p>
        {entry.vital_signs && <p className="mt-1 whitespace-pre-wrap text-xs"><span className="text-muted-foreground">Sinh hiệu · </span>{entry.vital_signs}</p>}
        {entry.treatment && <p className="mt-0.5 whitespace-pre-wrap text-xs"><span className="text-muted-foreground">Điều trị · </span>{entry.treatment}</p>}
      </li>)}</ol>}
    {notes.length > 3 && <button type="button" onClick={() => setShowAll(!showAll)} className="mt-3 text-xs font-semibold text-primary hover:underline">{showAll ? "Thu gọn" : `Xem tất cả ${notes.length} lần ghi`}</button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHead icon={NotebookPen} title={`Ghi diễn biến · ${place}`} description={`${patientName ?? ""} · bệnh nhân vẫn tiếp tục ở ${place}`} />
        {open && <ProgressForm place={place} save={save} onDone={() => setOpen(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  </section>;
}

function ProgressForm({ place, save, onDone, onSaved }: { place: string; save: (payload: ProgressPayload) => SaveResult; onDone: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ assessment: "", vital_signs: "", treatment: "" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: () => save({ assessment: form.assessment.trim(), vital_signs: form.vital_signs.trim() || null, treatment: form.treatment.trim() || null }),
    onSuccess: async (r) => { toast.success(r.message); onDone(); await onSaved(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể lưu diễn biến.")),
  });
  return <>
    <div className="space-y-4 px-6 py-5">
      <Field label="Đánh giá hiện tại">
        <Textarea rows={3} value={form.assessment} onChange={(e) => set("assessment", e.target.value)} placeholder="Tri giác, hô hấp, tuần hoàn, vết mổ / dẫn lưu..." className="rounded-xl" />
        <div className="flex flex-wrap gap-1.5">{quickAssessments.map((option) => <button key={option} type="button" onClick={() => set("assessment", form.assessment.trim() ? `${form.assessment.trim()}\n${option}` : option)} className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary">{option}</button>)}</div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sinh hiệu"><Textarea rows={3} value={form.vital_signs} onChange={(e) => set("vital_signs", e.target.value)} placeholder="M 88 · HA 120/80 · SpO₂ 97% · T 37,2 · NT 18" className="rounded-xl" /></Field>
        <Field label="Điều trị / đáp ứng"><Textarea rows={3} value={form.treatment} onChange={(e) => set("treatment", e.target.value)} placeholder="Thuốc, dịch truyền, chăm sóc, đáp ứng..." className="rounded-xl" /></Field>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
      <p className="text-xs text-muted-foreground">{form.assessment.trim() ? `Lưu xong bệnh nhân vẫn ở ${place}.` : "Chưa có đánh giá, vẫn có thể lưu."}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onDone} className="rounded-full px-4">Hủy</Button>
        <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="rounded-full px-5">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Lưu diễn biến</Button>
      </div>
    </div>
  </>;
}

/* ───────── Đơn thuốc: tóm tắt + dialog kê / sửa ───────── */

export function PrescriptionPanel({ index, item, title, place, save, onSaved }: {
  index: number;
  item: EmergencyPreparation;
  title: string;
  place: string;
  save: (payload: PrescriptionPayload) => SaveResult;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const prescription = item.emergency_prescription;
  const items = prescription?.items ?? [];
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={index} title={title} description={items.length ? `${items.length} thuốc · quầy PHM-105 cấp khi ra quầy · cập nhật ${formatDateTime(prescription!.confirmed_at)}` : "Quầy PHM-105 cấp đơn này khi bệnh nhân ra quầy"} aside={<Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="rounded-full px-3.5"><Pill /> {items.length ? "Sửa đơn" : "Kê đơn"}</Button>} />
    {items.length === 0
      ? <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chưa có thuốc. Có thể kê ở đây hoặc kê thêm khi chọn “Ra quầy thuốc” lúc rời {place}.</p>
      : <ul className="divide-y rounded-2xl border">{items.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5">
        <span className="min-w-0 flex-1 text-sm font-medium">{entry.medicine.name}</span>
        <span className="text-xs text-muted-foreground">{[entry.dosage, entry.usage].filter(Boolean).join(" · ") || "Chưa ghi liều / cách dùng"}</span>
        <span className="shrink-0 text-xs font-semibold tabular-nums">{entry.quantity} {entry.medicine.unit}</span>
      </li>)}</ul>}
    {prescription?.note && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/50 px-3.5 py-2.5 text-xs"><span className="text-muted-foreground">Lời dặn · </span>{prescription.note}</p>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="grid max-h-[calc(100vh-3rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHead icon={Pill} title={title} description={`${item.emergency_case?.full_name ?? ""} · tìm thuốc, nhập liều, số lượng, cách dùng`} />
        {open && <PrescriptionForm item={item} place={place} save={save} onDone={() => setOpen(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  </section>;
}

function toPayloadItems(items: DraftItem[]) {
  return items.map((d) => ({ medicine_id: d.medicine_id, dosage: d.dosage.trim() || null, quantity: Math.max(1, Math.round(Number(d.quantity)) || 1), usage: d.usage.trim() || null }));
}
function initialDraft(item: EmergencyPreparation): DraftItem[] {
  return (item.emergency_prescription?.items ?? []).map((x) => ({ key: x.id, medicine_id: x.medicine_id, name: x.medicine.name, code: x.medicine.medicine_code, unit: x.medicine.unit, dosage: x.dosage ?? "", quantity: String(x.quantity), usage: x.usage ?? "" }));
}

/** Trạng thái nháp đơn thuốc, dùng chung cho dialog "Kê / sửa đơn" và bước "Ra quầy thuốc" khi rời phòng. */
export function usePrescriptionDraft(item: EmergencyPreparation) {
  const medicines = useQuery({ queryKey: ["available-medicines"], queryFn: () => medicalVisitService.getAvailableMedicines() });
  const catalog = medicines.data ?? [];
  const hadItems = (item.emergency_prescription?.items.length ?? 0) > 0;
  const [items, setItems] = useState<DraftItem[]>(() => initialDraft(item));
  const [note, setNote] = useState(item.emergency_prescription?.note ?? "");
  const [search, setSearch] = useState("");
  const stockOf = (draft: DraftItem) => catalog.find((m) => m.id === draft.medicine_id)?.stock_quantity ?? null;
  const isOverStock = (draft: DraftItem) => { const stock = stockOf(draft); return stock !== null && (Number(draft.quantity) || 0) > stock; };
  const overStock = items.filter(isOverStock).length;
  const missing = items.filter((d) => !d.dosage.trim() || !d.usage.trim()).length;
  const payload: PrescriptionPayload = { note: note.trim() || null, items: toPayloadItems(items) };
  const dirty = JSON.stringify(payload) !== JSON.stringify({ note: item.emergency_prescription?.note?.trim() || null, items: toPayloadItems(initialDraft(item)) });
  const warnings = [
    overStock > 0 && `${overStock} thuốc vượt tồn kho hiện tại — quầy thuốc có thể không cấp đủ.`,
    missing > 0 && `${missing} thuốc chưa ghi đủ liều dùng / cách dùng.`,
    items.length === 0 && hadItems && "Đơn trống — lưu sẽ xóa toàn bộ thuốc đã kê.",
  ].filter(Boolean) as string[];

  function add(medicine: AvailableMedicine) {
    if (items.some((d) => d.medicine_id === medicine.id)) { toast.info("Thuốc này đã có trong đơn."); return; }
    setItems((current) => [...current, { key: crypto.randomUUID(), medicine_id: medicine.id, name: medicine.name, code: medicine.medicine_code, unit: medicine.unit, dosage: "", quantity: "1", usage: "" }]);
    setSearch("");
  }
  const update = (key: string, patch: Partial<DraftItem>) => setItems((current) => current.map((d) => d.key === key ? { ...d, ...patch } : d));
  const remove = (key: string) => setItems((current) => current.filter((d) => d.key !== key));
  return { medicines, catalog, items, note, setNote, search, setSearch, stockOf, isOverStock, warnings, payload, dirty, add, update, remove };
}
export type PrescriptionDraft = ReturnType<typeof usePrescriptionDraft>;

function PrescriptionForm({ item, place, save, onDone, onSaved }: { item: EmergencyPreparation; place: string; save: (payload: PrescriptionPayload) => SaveResult; onDone: () => void; onSaved: () => Promise<void> }) {
  const draft = usePrescriptionDraft(item);
  const mutation = useMutation({
    mutationFn: () => save(draft.payload),
    onSuccess: async (r) => { toast.success(r.message); onDone(); await onSaved(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể lưu đơn thuốc.")),
  });
  return <>
    <div className="scrollbar-thin min-h-0 overflow-y-auto px-6 py-5"><PrescriptionEditor draft={draft} autoFocus /></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
      <p className="text-xs text-muted-foreground">Lưu đơn không làm bệnh nhân rời {place}.</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onDone} className="rounded-full px-4">Hủy</Button>
        <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="rounded-full px-5">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Lưu đơn thuốc</Button>
      </div>
    </div>
  </>;
}

/** Ô tìm thuốc + danh sách thuốc trong đơn (kèm gợi ý / tính liều) + lời dặn + cảnh báo (không chặn). */
export function PrescriptionEditor({ draft, autoFocus }: { draft: PrescriptionDraft; autoFocus?: boolean }) {
  const { medicines, catalog, items, search, setSearch } = draft;
  const keyword = normalize(search.trim());
  const suggestions = keyword ? catalog.filter((m) => normalize(`${m.name} ${m.medicine_code}`).includes(keyword)).slice(0, 8) : [];
  return <div className="space-y-5">
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
        <Input autoFocus={autoFocus} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Gõ tên hoặc mã thuốc để thêm vào đơn..." className="h-11 rounded-xl bg-muted/35 pl-10" />
      </div>
      {keyword && <div className="mt-2 overflow-hidden rounded-xl border bg-popover shadow-md">
        {medicines.isPending ? <p className="p-4 text-center text-sm text-muted-foreground">Đang tải danh mục thuốc...</p>
          : suggestions.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Không tìm thấy thuốc phù hợp.</p>
          : suggestions.map((medicine) => {
            const added = items.some((d) => d.medicine_id === medicine.id);
            return <button key={medicine.id} type="button" disabled={added} onClick={() => draft.add(medicine)} className="flex w-full items-center justify-between gap-4 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-primary/5 disabled:opacity-50">
              <span><span className="block text-sm font-semibold">{medicine.name}</span><span className="block text-xs text-muted-foreground">{medicine.medicine_code} · còn {medicine.stock_quantity} {medicine.unit}</span></span>
              <span className="text-xs font-semibold text-primary">{added ? "Đã thêm" : "Thêm"}</span>
            </button>;
          })}
      </div>}
    </div>

    <div>
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Thuốc trong đơn</p><span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{items.length} thuốc</span></div>
      {items.length === 0
        ? <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Gõ tên thuốc ở ô tìm kiếm để thêm vào đơn.</p>
        : <div className="space-y-2">{items.map((d) => {
          const stock = draft.stockOf(d);
          const over = draft.isOverStock(d);
          return <div key={d.key} className={cn("grid items-center gap-2 rounded-xl border p-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto]", over && "border-amber-300 bg-amber-50/40")}>
            <div className="min-w-0"><p className="truncate text-sm font-medium">{d.name}</p><p className={cn("text-xs", over ? "font-medium text-amber-800" : "text-muted-foreground")}>{d.code}{stock !== null ? ` · còn ${stock} ${d.unit}` : ""}{over ? " · vượt tồn kho" : ""}</p></div>
            <Input value={d.dosage} onChange={(e) => draft.update(d.key, { dosage: e.target.value })} placeholder="Liều dùng" className={cn("h-9 rounded-lg", !d.dosage.trim() && "border-amber-300 bg-amber-50/50")} />
            <div className="relative"><Input type="number" min={1} value={d.quantity} onChange={(e) => draft.update(d.key, { quantity: e.target.value })} className="h-9 rounded-lg pr-8 tabular-nums" /><span className="pointer-events-none absolute right-2 top-1/2 max-w-7 -translate-y-1/2 truncate text-[0.65rem] text-muted-foreground">{d.unit}</span></div>
            <Input value={d.usage} onChange={(e) => draft.update(d.key, { usage: e.target.value })} placeholder="Cách dùng" className={cn("h-9 rounded-lg", !d.usage.trim() && "border-amber-300 bg-amber-50/50")} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Xóa thuốc" className="text-destructive" onClick={() => draft.remove(d.key)}><Trash2 /></Button>
            <DosageAssist name={d.name} unit={d.unit} dosage={d.dosage} usage={d.usage} quantity={d.quantity} onChange={(patch) => draft.update(d.key, patch)} className="md:col-span-5" />
          </div>;
        })}</div>}
    </div>

    <Field label="Lời dặn dùng thuốc"><Textarea rows={2} value={draft.note} onChange={(e) => draft.setNote(e.target.value)} placeholder="Lưu ý dùng thuốc, theo dõi tác dụng phụ..." className="rounded-xl" /></Field>
    {draft.warnings.map((text) => <Warning key={text} text={text} />)}
  </div>;
}

/* ───────── Thẻ lựa chọn trong dialog rời phòng ───────── */

export function ChoiceCard({ selected, onClick, icon: Icon, label, detail, tone = "primary" }: { selected: boolean; onClick: () => void; icon: typeof Clock3; label: string; detail: string; tone?: "primary" | "danger" }) {
  const danger = tone === "danger";
  return <button type="button" onClick={onClick} aria-pressed={selected} className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-left transition", selected ? (danger ? "border-red-300 bg-red-50 ring-2 ring-red-200" : "border-primary bg-primary/6 ring-2 ring-primary/15") : "hover:border-primary/30")}>
    <Icon className={cn("mt-0.5 size-4 shrink-0", selected ? (danger ? "text-red-700" : "text-primary") : "text-muted-foreground")} />
    <span><span className={cn("block text-sm", selected ? "font-semibold" : "font-medium")}>{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span>
  </button>;
}
export function RoomCard({ code, name, selected, onClick }: { code: string; name: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={selected} className={cn("rounded-2xl border p-3 text-left transition", selected ? "border-primary bg-primary/6 ring-2 ring-primary/15" : "hover:border-primary/30")}>
    <p className="text-xs font-medium text-primary">{code}</p>
    <p className={cn("mt-0.5 text-sm", selected ? "font-semibold" : "font-medium")}>{name}</p>
  </button>;
}
