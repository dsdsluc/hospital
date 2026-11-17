"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ArrowLeft, CalendarDays, Check, CircleX, ClipboardList, ExternalLink, FileHeart, LoaderCircle, Route, UserRound } from "lucide-react";
import { isAxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appointmentService } from "@/services/appointment.service";
import { medicalVisitService } from "@/services/medical-visit.service";
import { getScheduleStatus, statusMeta } from "@/components/doctor/today-schedule-sheet";
import { Card, Empty, VisitSummarySections } from "@/components/doctor/visit-results-page";
import { Detail, DetailList } from "@/components/doctor/detail-ui";
import { CopyCode, formatGender, getAge, getInitials } from "@/components/doctor/queue/queue-ui";

/** Trang chi tiết một lịch hẹn (mở từ tab "Ca thường" của trang Hàng đợi): thông tin lịch, hành trình và kết quả lượt khám. */
export function AppointmentDetailPage({ code, backHref }: { code: string; backHref: string }) {
  const [now] = useState(() => new Date());
  const lookup = useQuery({
    queryKey: ["appointment-lookup", code],
    queryFn: () => appointmentService.lookupByCode(code),
    retry: (count, error) => !(isAxiosError(error) && error.response?.status && error.response.status < 500) && count < 2,
  });
  const appointment = lookup.data?.appointment;
  const visit = appointment?.medical_visits[0];
  const summary = useQuery({
    queryKey: ["medical-visit-summary", visit?.id],
    queryFn: () => medicalVisitService.getSummary(visit!.id),
    enabled: Boolean(visit),
  });

  if (lookup.isPending) return <PageState icon={<LoaderCircle className="animate-spin" />} text="Đang tải chi tiết lịch hẹn..." />;
  if (lookup.isError || !appointment) {
    const message = isAxiosError(lookup.error) && lookup.error.response?.status === 404 ? `Không tìm thấy lịch hẹn ${code}.` : "Không thể tải chi tiết lịch hẹn.";
    return <PageState icon={<FileHeart />} text={message} backHref={backHref} />;
  }

  const today = lookup.data.today;
  const dateKey = appointment.appointment_date.slice(0, 10);
  const time = appointment.appointment_time.slice(11, 16);
  const baseStatus = getScheduleStatus(appointment, dateKey, today, now.getHours() * 60 + now.getMinutes());
  const status = baseStatus === "WAITING" && dateKey > today
    ? { label: "Sắp tới", badge: "bg-sky-100 text-sky-700" }
    : statusMeta[baseStatus];
  const patient = appointment.patient;
  const fullPatient = summary.data?.patient;

  return (
    <main className="min-h-screen bg-muted/35 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 rounded-[1.6rem] border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-4">
            <Button render={<Link href={backHref} />} variant="outline" size="icon" className="mt-0.5 shrink-0 rounded-full" aria-label="Quay lại hàng đợi"><ArrowLeft /></Button>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">{getInitials(patient.full_name)}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Chi tiết lịch hẹn</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
              <p className="mt-1 text-sm capitalize text-muted-foreground">{format(new Date(`${dateKey}T00:00:00`), "EEEE, dd/MM/yyyy", { locale: vi })} · {time}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <CopyCode code={appointment.appointment_code} label="mã lịch hẹn" />
            <span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", status.badge)}>{status.label}</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <Card title="Thông tin bệnh nhân" icon={<UserRound />}>
            <DetailList columns={3}>
              <Detail label="Họ và tên" value={patient.full_name} />
              <Detail label="Mã bệnh nhân" value={patient.patient_code} />
              <Detail label="Giới tính · Tuổi" value={`${formatGender(patient.gender)} · ${getAge(patient.date_of_birth)}`} />
              <Detail label="Ngày sinh" value={patient.date_of_birth ? formatDay(patient.date_of_birth) : null} />
              <Detail label="Số điện thoại" value={patient.user.phone_number} />
              <Detail label="Email" value={fullPatient?.user.email} />
              {fullPatient && <>
                <Detail label="Chiều cao" value={fullPatient.height_cm ? `${fullPatient.height_cm} cm` : null} />
                <Detail label="Cân nặng" value={fullPatient.weight_kg ? `${fullPatient.weight_kg} kg` : null} />
                <Detail label="Địa chỉ" value={fullPatient.address} />
              </>}
            </DetailList>
          </Card>

          <Card title="Hành trình lịch hẹn" icon={<Route />}>
            <ol>
              <Step done label="Đặt lịch" detail={formatDateTime(appointment.created_at)} />
              {appointment.status === "CANCELLED" ? (
                <Step cancelled label="Đã hủy lịch" detail="Lịch hẹn không còn hiệu lực" last />
              ) : <>
                <Step done={Boolean(appointment.checked_in_at)} label="Đến quầy tiếp nhận" detail={appointment.checked_in_at ? formatDateTime(appointment.checked_in_at) : baseStatus === "NO_SHOW" ? "Không đến" : "Chưa đến"} />
                <Step done={Boolean(visit)} label="Bắt đầu lượt khám" detail={visit ? `${formatDateTime(visit.created_at)} · ${visit.receiving_room.room_code}` : "Chưa bắt đầu"} />
                <Step done={visit?.status === "COMPLETED"} label="Hoàn thành" detail={visit?.status === "COMPLETED" ? (summary.data ? formatDateTime(summary.data.updated_at) : "Đã hoàn thành") : visit ? "Đang khám" : "—"} last />
              </>}
            </ol>
          </Card>
        </section>

        <Card title="Thông tin lịch hẹn" icon={<CalendarDays />}>
          <DetailList columns={3}>
            <Detail label="Ngày hẹn" value={formatDay(`${dateKey}T00:00:00`)} />
            <Detail label="Giờ hẹn" value={time} />
            <Detail label="Thời điểm đặt" value={formatDateTime(appointment.created_at)} />
            <Detail label="Lượt khám" value={visit ? `${visit.visit_code} · ${visit.receiving_room.name}` : null} />
            <Detail label="Ghi chú của bệnh nhân" value={appointment.note} wide />
          </DetailList>
        </Card>

        {visit ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2 px-1 pt-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Kết quả lượt khám</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{visit.visit_code}</h2>
              </div>
              <Link href={`/doctor/visits/${visit.id}/results`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition hover:opacity-70">Mở trang kết quả <ExternalLink className="size-3.5" /></Link>
            </div>
            {summary.isPending ? (
              <Card title="Đang tải kết quả" icon={<LoaderCircle className="animate-spin" />}><Empty text="Đang tải kết quả lượt khám..." /></Card>
            ) : summary.isError || !summary.data ? (
              <Card title="Kết quả lượt khám" icon={<ClipboardList />}>
                <div className="text-center"><Empty text="Không thể tải kết quả lượt khám." /><Button variant="outline" className="mt-3 rounded-full" onClick={() => summary.refetch()}>Thử lại</Button></div>
              </Card>
            ) : (
              <VisitSummarySections visit={summary.data} />
            )}
          </>
        ) : (
          <Card title="Kết quả lượt khám" icon={<ClipboardList />}>
            <Empty text={appointment.status === "CANCELLED" ? "Lịch hẹn đã hủy nên không có kết quả khám." : baseStatus === "NO_SHOW" ? "Bệnh nhân không đến nên không có kết quả khám." : "Chưa có kết quả — bệnh nhân chưa được tiếp nhận vào lượt khám."} />
          </Card>
        )}
      </div>
    </main>
  );
}

function Step({ label, detail, done, cancelled, last }: { label: string; detail: string; done?: boolean; cancelled?: boolean; last?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <div className="relative z-10">
        <span className={cn(
          "grid size-7 place-items-center rounded-full border-2",
          cancelled ? "border-[var(--brand-coral)] bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]" : done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
        )}>
          {cancelled ? <CircleX className="size-3.5" /> : done ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
        </span>
        {!last && <span className={cn("absolute left-1/2 top-7 h-[calc(100%-0.25rem)] w-px -translate-x-1/2", done ? "bg-primary/40" : "bg-border")} />}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className={cn("text-sm font-medium", !done && !cancelled && "text-muted-foreground")}>{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

export function PageState({ icon, text, backHref }: { icon: React.ReactNode; text: string; backHref?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/35 px-4">
      <div className="text-center text-muted-foreground">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-card shadow-sm">{icon}</span>
        <p className="mt-3 text-sm">{text}</p>
        {backHref && <Button render={<Link href={backHref} />} className="mt-4 rounded-full">Quay lại hàng đợi</Button>}
      </div>
    </div>
  );
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
