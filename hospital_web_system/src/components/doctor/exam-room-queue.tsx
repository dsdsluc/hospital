"use client";

import { Check, Hourglass } from "lucide-react";

import { getVitalFlag } from "@/components/doctor/workspaces/reception-measure-dialog";
import { cn } from "@/lib/utils";
import type { ReceptionQueueAppointment } from "@/types/api";

/**
 * Hàng đợi phòng khám (tầng 2) chia theo tiến trình khám — suy ra từ dữ liệu sẵn có, không cần backend:
 * - WAITING_EXAM: chưa có đánh giá ban đầu, chưa chỉ định → bệnh nhân mới chuyển từ tiếp nhận.
 * - WAITING_RESULTS: còn chỉ định phòng chức năng chưa xong → đang đi làm cận lâm sàng.
 * - NEED_CONCLUSION: chỉ định đã đủ kết quả, hoặc đã khám nhưng chưa có chỉ định đang chờ → gọi vào kết luận.
 */
export type ExamGroup = "NEED_CONCLUSION" | "WAITING_RESULTS" | "WAITING_EXAM";

export const examGroups: Array<{ value: ExamGroup; label: string; badge: string }> = [
  { value: "NEED_CONCLUSION", label: "Cần kết luận", badge: "bg-primary/10 text-primary" },
  { value: "WAITING_RESULTS", label: "Chờ kết quả", badge: "bg-sky-100 text-sky-700" },
  { value: "WAITING_EXAM", label: "Chờ khám", badge: "bg-amber-100 text-amber-700" },
];

/** Chờ quá số phút này thì tô cảnh báo. */
const LONG_WAIT_MINUTES = 30;

type QueueItem = ReceptionQueueAppointment & { assigned_step?: { created_at: string } };

export type ExamProgress = {
  group: ExamGroup;
  orders: Array<{ code: string; done: boolean }>;
  /** Mốc bắt đầu chờ: lúc vào phòng, hoặc lúc kết quả cuối cùng trả về. */
  waitingSince: string | null;
  hasAbnormalVitals: boolean;
};

export function getExamProgress(appointment: QueueItem): ExamProgress {
  const visit = appointment.medical_visits[0];
  const receivingRoomId = visit?.receiving_room.id;
  const orders = (visit?.steps ?? []).filter((step) =>
    step.status !== "CANCELLED"
    && step.room.room_code !== "REC-101"
    && step.room.room_code !== "PHM-105"
    && step.room.id !== receivingRoomId);
  const pending = orders.filter((step) => step.status === "PENDING" || step.status === "IN_PROGRESS");
  const exam = visit?.examination_record;
  const examined = Boolean(exam?.preliminary_diagnosis?.trim() || exam?.next_evaluation?.trim());

  const group: ExamGroup = pending.length > 0 ? "WAITING_RESULTS" : orders.length > 0 || examined ? "NEED_CONCLUSION" : "WAITING_EXAM";
  const lastResultAt = orders
    .map((step) => step.completed_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  const record = visit?.reception_record;
  const pressure = record?.systolic_blood_pressure && record.diastolic_blood_pressure ? `${record.systolic_blood_pressure}/${record.diastolic_blood_pressure}` : "";
  const hasAbnormalVitals = [
    getVitalFlag("temperature", record?.temperature_c != null ? String(record.temperature_c) : ""),
    getVitalFlag("bloodPressure", pressure),
    getVitalFlag("heartRate", record?.heart_rate != null ? String(record.heart_rate) : ""),
    getVitalFlag("spo2", record?.spo2 != null ? String(record.spo2) : ""),
  ].some((flag) => flag === "LOW" || flag === "HIGH");

  return {
    group,
    orders: orders.map((step) => ({ code: step.room.room_code, done: step.status === "COMPLETED" })),
    waitingSince: group === "NEED_CONCLUSION" && lastResultAt ? lastResultAt : appointment.assigned_step?.created_at ?? null,
    hasAbnormalVitals,
  };
}

export function minutesSince(value: string | null, now: number) {
  if (!value) return null;
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

export function ExamQueueCard({ appointment, progress, now, active, initials, onSelect }: {
  appointment: QueueItem;
  progress: ExamProgress;
  now: number;
  active: boolean;
  initials: string;
  onSelect: () => void;
}) {
  const visit = appointment.medical_visits[0];
  const meta = examGroups.find((item) => item.value === progress.group)!;
  const wait = minutesSince(progress.waitingSince, now);
  const longWait = wait !== null && wait >= LONG_WAIT_MINUTES && progress.group !== "WAITING_RESULTS";
  const summary = visit?.examination_record?.preliminary_diagnosis?.trim() || visit?.reception_record?.visit_reason || appointment.note || "Chưa có lý do khám";
  const doneCount = progress.orders.filter((order) => order.done).length;

  return (
    <button type="button" onClick={onSelect} className={cn("w-full rounded-2xl p-3 text-left transition", active ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/70")}>
      <div className="flex items-start gap-3">
        <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {initials}
          {progress.hasAbnormalVitals && <span title="Sinh hiệu bất thường" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-[var(--brand-coral)]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{appointment.patient.full_name}</span>
            <span className="shrink-0 text-[0.7rem] font-medium tracking-wide text-muted-foreground">{visit?.visit_code}</span>
          </span>
          {progress.waitingSince && wait !== null && (
            <span className={cn("mt-0.5 flex items-center gap-1 text-xs", longWait ? "font-medium text-[oklch(0.55_0.16_35)]" : "text-muted-foreground")}>
              {progress.group === "NEED_CONCLUSION" && progress.orders.length > 0 ? "Có kết quả" : "Đến phòng"} {formatClock(progress.waitingSince)} · chờ {formatWait(wait)}
            </span>
          )}
          <span className="mt-1 block truncate text-xs text-muted-foreground">{summary}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1">
            <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", meta.badge)}>{meta.label}</span>
            {progress.orders.map((order) => (
              <span key={order.code} className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium", order.done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                {order.done ? <Check className="size-2.5" /> : <Hourglass className="size-2.5" />} {order.code}
              </span>
            ))}
            {progress.orders.length > 1 && <span className="text-[0.65rem] text-muted-foreground">{doneCount}/{progress.orders.length}</span>}
          </span>
        </span>
      </div>
    </button>
  );
}

/**
 * Thẻ hàng đợi cho phòng chức năng (xét nghiệm): thay giờ hẹn / lý do khám bằng
 * thông tin chỉ định — từ phòng nào, lúc mấy giờ, đã chờ bao lâu, yêu cầu của bác sĩ.
 */
export function FunctionalQueueCard({ appointment, roomCode, now, active, initials, waitingLabel, inProgressLabel, onSelect, pharmacy = false }: {
  appointment: QueueItem & { assigned_step?: { created_at: string; started_at?: string | null; status?: string } };
  roomCode: string;
  now: number;
  active: boolean;
  initials: string;
  waitingLabel: string;
  inProgressLabel: string;
  onSelect: () => void;
  /** Nhà thuốc: hiện "Đơn từ …", chẩn đoán và số loại thuốc thay cho yêu cầu chỉ định. */
  pharmacy?: boolean;
}) {
  const visit = appointment.medical_visits[0];
  const medicineCount = visit?.prescription?.items.length ?? 0;
  const step = visit?.steps?.find((item) => item.room.room_code === roomCode && (item.status === "PENDING" || item.status === "IN_PROGRESS"));
  const inProgress = (appointment.assigned_step?.status ?? step?.status) === "IN_PROGRESS";
  const orderedAt = appointment.assigned_step?.created_at ?? null;
  const startedAt = appointment.assigned_step?.started_at ?? null;
  const wait = minutesSince(orderedAt, now);
  const longWait = !inProgress && wait !== null && wait >= LONG_WAIT_MINUTES;

  return (
    <button type="button" onClick={onSelect} className={cn("w-full rounded-2xl p-3 text-left transition", active ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/70")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{appointment.patient.full_name}</span>
            <span className="shrink-0 text-[0.7rem] font-medium tracking-wide text-muted-foreground">{visit?.visit_code}</span>
          </span>
          <span className={cn("mt-0.5 block text-xs", longWait ? "font-medium text-[oklch(0.55_0.16_35)]" : "text-muted-foreground")}>
            {inProgress && startedAt
              ? `Bắt đầu ${formatClock(startedAt)} · từ ${visit?.receiving_room.room_code ?? "phòng khám"}`
              : `${pharmacy ? "Đơn từ" : "Chỉ định từ"} ${visit?.receiving_room.room_code ?? "phòng khám"}${orderedAt ? ` lúc ${formatClock(orderedAt)}` : ""}${wait !== null ? ` · chờ ${formatWait(wait)}` : ""}`}
          </span>
          <span className="mt-1 block truncate text-xs text-foreground/80">{pharmacy ? `${medicineCount} loại thuốc${visit?.examination_record?.final_diagnosis ? ` · ${visit.examination_record.final_diagnosis}` : ""}` : step?.instruction?.trim() || "Không có yêu cầu thêm"}</span>
          <span className="mt-2 flex">
            <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", inProgress ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700")}>{inProgress ? inProgressLabel : waitingLabel}</span>
          </span>
        </span>
      </div>
    </button>
  );
}
