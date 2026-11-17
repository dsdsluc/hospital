"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarClock, CalendarX2, ChevronLeft, ChevronRight, LoaderCircle, Phone, StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { appointmentService, type DailyScheduleAppointment } from "@/services/appointment.service";

export type ScheduleStatus = "WAITING" | "LATE" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export const statusMeta: Record<ScheduleStatus, { label: string; badge: string; dot: string }> = {
  WAITING: { label: "Chờ tiếp nhận", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  LATE: { label: "Trễ hẹn", badge: "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]", dot: "bg-[var(--brand-coral)]" },
  IN_PROGRESS: { label: "Đang khám", badge: "bg-primary/10 text-primary", dot: "bg-primary" },
  COMPLETED: { label: "Đã khám xong", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  NO_SHOW: { label: "Không đến", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  CANCELLED: { label: "Đã hủy", badge: "bg-muted text-muted-foreground line-through", dot: "bg-muted-foreground/30" },
};

export const statusOrder: ScheduleStatus[] = ["WAITING", "LATE", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"];

/** Số phút trễ so với giờ hẹn thì coi là "Trễ hẹn". */
const LATE_AFTER_MINUTES = 15;

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function minutesOf(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function getScheduleStatus(appointment: DailyScheduleAppointment, dateKey: string, todayKey: string, nowMinutes: number): ScheduleStatus {
  if (appointment.status === "CANCELLED") return "CANCELLED";
  const visit = appointment.medical_visits[0];
  if (visit?.status === "IN_PROGRESS") return "IN_PROGRESS";
  if (visit?.status === "COMPLETED") return "COMPLETED";
  if (dateKey < todayKey) return "NO_SHOW";
  if (dateKey === todayKey && minutesOf(appointment.appointment_time.slice(11, 16)) + LATE_AFTER_MINUTES < nowMinutes) return "LATE";
  return "WAITING";
}

export function TodayScheduleSheet({
  selectableIds,
  onSelectAppointment,
}: {
  /** Id các lịch đang có trong hàng đợi tiếp nhận (chỉ những lịch này mới chọn được). */
  selectableIds: string[];
  onSelectAppointment: (appointmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [date, setDate] = useState(() => new Date());
  const [filter, setFilter] = useState<ScheduleStatus | "ALL">("ALL");

  const todayKey = toDateKey(now);
  const dateKey = toDateKey(date);
  const isToday = dateKey === todayKey;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const query = useQuery({
    queryKey: ["appointment-schedule", dateKey],
    queryFn: () => appointmentService.getDailySchedule(dateKey),
    enabled: open,
    refetchInterval: open && isToday ? 30_000 : false,
  });

  const items = useMemo(
    () => (query.data ?? []).map((appointment) => ({
      appointment,
      time: appointment.appointment_time.slice(11, 16),
      status: getScheduleStatus(appointment, dateKey, todayKey, nowMinutes),
    })),
    [query.data, dateKey, todayKey, nowMinutes],
  );

  const counts = useMemo(() => {
    const result = Object.fromEntries(statusOrder.map((status) => [status, 0])) as Record<ScheduleStatus, number>;
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  const slots = useMemo(() => {
    const visible = filter === "ALL" ? items : items.filter((item) => item.status === filter);
    const groups = new Map<string, typeof visible>();
    for (const item of visible) groups.set(item.time, [...(groups.get(item.time) ?? []), item]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items, filter]);

  // Vị trí chèn vạch "Bây giờ": trước khung giờ đầu tiên chưa tới.
  const nowIndex = isToday ? slots.findIndex(([time]) => minutesOf(time) > nowMinutes) : -1;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      const current = new Date();
      setNow(current);
      setDate(current);
      setFilter("ALL");
    }
  }

  function changeDate(offset: number) {
    setDate((current) => addDays(current, offset));
    setNow(new Date());
  }

  function select(appointmentId: string) {
    onSelectAppointment(appointmentId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="h-10 rounded-full px-4" />}>
        <CalendarClock /> Lịch hôm nay
      </DialogTrigger>
      <DialogContent className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-xl sm:rounded-l-3xl data-open:zoom-in-100 data-open:slide-in-from-right-10 data-closed:zoom-out-100 data-closed:slide-out-to-right-10">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><CalendarClock className="size-4 text-primary" /> Lịch khám</DialogTitle>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <DialogDescription className="text-sm">Toàn bộ lịch hẹn trong ngày, sắp theo khung giờ.</DialogDescription>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => changeDate(-1)} aria-label="Ngày trước"><ChevronLeft /></Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold capitalize">{format(date, "EEEE, dd/MM/yyyy", { locale: vi })}</p>
              <p className="text-xs text-muted-foreground">{isToday ? "Hôm nay" : dateKey < todayKey ? "Đã qua" : "Sắp tới"}</p>
            </div>
            <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => changeDate(1)} aria-label="Ngày sau"><ChevronRight /></Button>
            {!isToday && <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setDate(new Date())}>Hôm nay</Button>}          </div>

          <div className="scrollbar-hidden -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1">
            <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")} label="Tất cả" count={items.length} />
            {statusOrder.filter((status) => counts[status] > 0).map((status) => (
              <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)} label={statusMeta[status].label} count={counts[status]} dot={statusMeta[status].dot} />
            ))}
          </div>
        </DialogHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">
          {query.isPending ? (
            <div className="grid h-full place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>
          ) : query.isError ? (
            <div className="grid h-full place-items-center text-center">
              <div><p className="text-sm text-muted-foreground">Không thể tải lịch khám.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></div>
            </div>
          ) : slots.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div><CalendarX2 className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{items.length === 0 ? "Không có lịch khám nào trong ngày này." : "Không có lịch nào ở trạng thái này."}</p></div>
            </div>
          ) : (
            <ol className="relative">
              {slots.map(([time, slotItems], index) => (
                <li key={time}>
                  {index === nowIndex && <NowLine now={now} />}
                  <div className="grid grid-cols-[3.25rem_1fr] gap-3 pb-5">
                    <div className="pt-2.5 text-right">
                      <p className={cn("text-sm font-semibold tabular-nums", isToday && minutesOf(time) + 30 <= nowMinutes ? "text-muted-foreground" : "text-foreground")}>{time}</p>
                      <p className="text-[0.7rem] text-muted-foreground">{slotItems.length} lịch</p>
                    </div>
                    <div className="space-y-2 border-l pl-3">
                      {slotItems.map(({ appointment, status }) => {
                        const meta = statusMeta[status];
                        const selectable = isToday && selectableIds.includes(appointment.id);
                        const visit = appointment.medical_visits[0];
                        return (
                          <button
                            key={appointment.id}
                            type="button"
                            disabled={!selectable}
                            onClick={() => select(appointment.id)}
                            className={cn(
                              "group w-full rounded-2xl border bg-card p-3.5 text-left transition",
                              selectable ? "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md" : "cursor-default",
                              status === "CANCELLED" && "opacity-60",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{appointment.patient.full_name}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{appointment.patient.patient_code} · Lịch <span className="font-medium tracking-wide text-foreground">{appointment.appointment_code}</span></p>
                              </div>
                              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold", meta.badge)}>{meta.label}</span>
                            </div>
                            {(appointment.note || appointment.patient.user.phone_number || visit) && (
                              <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                                {appointment.note && <p className="flex items-start gap-1.5"><StickyNote className="mt-0.5 size-3 shrink-0" /><span className="line-clamp-2">{appointment.note}</span></p>}
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {appointment.patient.user.phone_number && <span className="flex items-center gap-1.5"><Phone className="size-3" /> {appointment.patient.user.phone_number}</span>}
                                  {visit && <span>Lượt khám {visit.visit_code} · {visit.receiving_room.name}</span>}
                                </div>
                              </div>
                            )}
                            {selectable && <p className="mt-2 text-[0.7rem] font-medium text-primary opacity-0 transition group-hover:opacity-100">Chọn để mở hồ sơ trong hàng đợi →</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </li>
              ))}
              {isToday && nowIndex === -1 && <li><NowLine now={now} /></li>}
            </ol>
          )}
        </div>

        <div className="border-t bg-muted/40 px-6 py-3 text-xs text-muted-foreground">
          {isToday
            ? "Bấm vào lịch đang chờ hoặc đang khám để mở hồ sơ trong hàng đợi. Tự làm mới mỗi 30 giây."
            : "Đang xem lịch của ngày khác — chỉ xem, không thao tác tiếp nhận được."}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border/80 text-muted-foreground hover:border-primary/35 hover:text-foreground",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", active ? "bg-primary-foreground" : dot)} />}
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground/80")}>{count}</span>
    </button>
  );
}

function NowLine({ now }: { now: Date }) {
  return (
    <div className="relative mb-5 flex items-center gap-2" aria-label="Thời điểm hiện tại">
      <span className="w-[3.25rem] shrink-0 text-right text-[0.7rem] font-semibold tabular-nums text-[var(--brand-coral)]">{format(now, "HH:mm")}</span>
      <span className="size-2 shrink-0 rounded-full bg-[var(--brand-coral)] ring-4 ring-[var(--brand-coral)]/20" />
      <span className="h-px flex-1 bg-[var(--brand-coral)]/60" />
      <span className="text-[0.7rem] font-semibold text-[var(--brand-coral)]">Bây giờ</span>
    </div>
  );
}
