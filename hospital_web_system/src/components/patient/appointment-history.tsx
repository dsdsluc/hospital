"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfToday } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarX2, Clock3, FileText, LoaderCircle, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appointmentService, type PatientAppointment } from "@/services/appointment.service";

type HistoryStatus = "UPCOMING" | "IN_VISIT" | "AWAITING_MEDICINE" | "VISITED" | "PAST" | "CANCELLED";
type HistoryFilter = "ALL" | HistoryStatus;

const statusMeta: Record<HistoryStatus, { label: string; className: string }> = {
  UPCOMING: { label: "Sắp tới", className: "bg-primary/10 text-primary" },
  IN_VISIT: { label: "Đang khám", className: "bg-sky-100 text-sky-700" },
  AWAITING_MEDICINE: { label: "Chờ nhận thuốc", className: "bg-amber-100 text-amber-700" },
  VISITED: { label: "Đã khám", className: "bg-emerald-100 text-emerald-700" },
  PAST: { label: "Không đến", className: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Đã hủy", className: "bg-destructive/10 text-destructive" },
};

const filters: Array<{ value: HistoryFilter; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "UPCOMING", label: "Sắp tới" },
  { value: "IN_VISIT", label: "Đang khám" },
  { value: "AWAITING_MEDICINE", label: "Chờ nhận thuốc" },
  { value: "VISITED", label: "Đã khám" },
  { value: "PAST", label: "Không đến" },
  { value: "CANCELLED", label: "Đã hủy" },
];

function getHistoryStatus(appointment: PatientAppointment): HistoryStatus {
  if (appointment.status === "CANCELLED") return "CANCELLED";
  // Lịch hẹn vẫn là BOOKED sau khi khám → dựa vào lượt khám gắn với lịch.
  const visit = appointment.medical_visits?.[0];
  if (visit?.status === "COMPLETED") return "VISITED";
  if (visit?.status === "IN_PROGRESS") return visit.steps?.length ? "AWAITING_MEDICINE" : "IN_VISIT";
  return parseISO(appointment.appointment_date.slice(0, 10)) >= startOfToday() ? "UPCOMING" : "PAST";
}

export function AppointmentHistory() {
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const query = useQuery({ queryKey: ["appointments", "me"], queryFn: appointmentService.getMine });

  if (query.isPending) {
    return <div className="grid min-h-72 place-items-center rounded-[1.75rem] border bg-card"><LoaderCircle className="size-6 animate-spin text-primary" /></div>;
  }

  if (query.isError) {
    return (
      <div className="rounded-[1.75rem] border border-destructive/20 bg-card p-8">
        <p className="font-semibold text-destructive">Không thể tải lịch sử đặt lịch</p>
        <p className="mt-1 text-sm text-muted-foreground">Vui lòng kiểm tra kết nối và thử lại.</p>
        <Button variant="outline" onClick={() => query.refetch()} className="mt-4 rounded-full">Thử lại</Button>
      </div>
    );
  }

  const appointments = query.data.map((item) => ({ ...item, historyStatus: getHistoryStatus(item) }));
  const counts = appointments.reduce<Record<HistoryFilter, number>>(
    (acc, item) => ({ ...acc, ALL: acc.ALL + 1, [item.historyStatus]: acc[item.historyStatus] + 1 }),
    { ALL: 0, UPCOMING: 0, IN_VISIT: 0, AWAITING_MEDICINE: 0, VISITED: 0, PAST: 0, CANCELLED: 0 },
  );
  const visible = filter === "ALL" ? appointments : appointments.filter((item) => item.historyStatus === filter);

  return (
    <section className="rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-full bg-muted/70 p-1" role="tablist" aria-label="Lọc theo trạng thái">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", filter === value ? "bg-primary/10 text-primary" : "bg-background/70")}>{counts[value]}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Sắp xếp theo ngày khám mới nhất</p>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed px-6 py-12 text-center">
          <CalendarX2 className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{filter === "ALL" ? "Bạn chưa đặt lịch khám nào." : "Không có lịch khám nào trong mục này."}</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-2xl border">
          {visible.map((appointment) => {
            const date = parseISO(appointment.appointment_date.slice(0, 10));
            const meta = statusMeta[appointment.historyStatus];
            const muted = appointment.historyStatus !== "UPCOMING" && appointment.historyStatus !== "IN_VISIT" && appointment.historyStatus !== "AWAITING_MEDICINE";
            return (
              <li key={appointment.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
                <div className={cn("grid size-16 shrink-0 place-items-center rounded-2xl", muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
                  <span className="text-center leading-none">
                    <span className="block text-[0.65rem] font-bold uppercase tracking-wider opacity-80">{format(date, "'Th' M", { locale: vi })}</span>
                    <span className="mt-1 block text-2xl font-bold">{format(date, "dd")}</span>
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-wide">{appointment.appointment_code}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.className)}>{meta.label}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5 capitalize"><Clock3 className="size-3.5" /> {appointment.appointment_time.slice(11, 16)}, {format(date, "EEEE dd/MM/yyyy", { locale: vi })}</span>
                    <span className="flex items-center gap-1.5"><Stethoscope className="size-3.5" /> {appointment.doctor ? appointment.doctor.full_name : "Chưa phân công bác sĩ"}</span>
                  </div>
                  {appointment.note && <p className="mt-2 flex items-start gap-1.5 text-sm"><FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> <span className="line-clamp-2">{appointment.note}</span></p>}
                </div>

                <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  Đặt lúc<br className="hidden sm:block" /> <span className="font-medium text-foreground">{format(parseISO(appointment.created_at), "HH:mm dd/MM/yyyy")}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
