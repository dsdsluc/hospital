"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO, startOfToday } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  ClipboardPen,
  Clock3,
  Copy,
  DoorOpen,
  FileText,
  Info,
  LoaderCircle,
  Stethoscope,
  Ticket,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppointmentDialog } from "@/components/patient/appointment-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { appointmentService } from "@/services/appointment.service";
import { medicalVisitService } from "@/services/medical-visit.service";

const preparationTips = [
  "Mang theo CCCD và thẻ bảo hiểm y tế.",
  "Có mặt trước giờ hẹn khoảng 15 phút.",
  "Mang theo đơn thuốc và kết quả khám cũ nếu có.",
];

const bookingSteps = [
  { icon: CalendarClock, title: "Chọn ngày & giờ", description: "Khung giờ từ 07:00 đến 20:00." },
  { icon: ClipboardPen, title: "Mô tả tình trạng", description: "Giúp bệnh viện chuẩn bị trước." },
  { icon: Ticket, title: "Nhận mã lịch hẹn", description: "Đọc mã khi đến quầy tiếp nhận." },
];

function describeCountdown(days: number) {
  if (days <= 0) return "Hôm nay";
  if (days === 1) return "Ngày mai";
  return `Còn ${days} ngày`;
}

export function UpcomingAppointmentCard() {
  const queryClient = useQueryClient();
  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "me"],
    queryFn: appointmentService.getMine,
  });
  const currentVisitQuery = useQuery({
    queryKey: ["my-current-medical-visit"],
    queryFn: medicalVisitService.getMyCurrentVisit,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
  const cancelAppointment = useMutation({
    mutationFn: appointmentService.cancel,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "me"] });
      toast.success(result.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể hủy lịch khám.")),
  });

  if (appointmentsQuery.isPending || currentVisitQuery.isPending) {
    return <div className="grid min-h-96 place-items-center rounded-[1.75rem] bg-primary text-primary-foreground shadow-xl shadow-primary/15"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /><p className="mt-2 text-sm text-white/75">Đang tải lịch khám...</p></div></div>;
  }

  if (appointmentsQuery.isError) {
    return <div className="rounded-[1.75rem] border border-destructive/20 bg-card p-8"><p className="font-semibold text-destructive">Không thể tải lịch khám</p><p className="mt-1 text-sm text-muted-foreground">Vui lòng kiểm tra kết nối và thử lại.</p><Button variant="outline" onClick={() => appointmentsQuery.refetch()} className="mt-4 rounded-full">Thử lại</Button></div>;
  }

  const upcomingAppointments = appointmentsQuery.data
    .filter((item) => item.status === "BOOKED"
      && !item.medical_visits?.length
      && item.appointment_code !== currentVisitQuery.data?.appointment?.appointment_code
      && parseISO(item.appointment_date.slice(0, 10)) >= startOfToday())
    .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`));
  const upcomingAppointment = upcomingAppointments[0];
  const otherUpcomingCount = upcomingAppointments.length - 1;

  if (!upcomingAppointment && currentVisitQuery.data) {
    return null;
  }

  if (!upcomingAppointment) {
    return (
      <section id="appointments" className="rounded-[1.75rem] border border-dashed border-primary/25 bg-card px-6 py-12 text-center shadow-sm sm:px-10 sm:py-14">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary"><CalendarPlus className="size-7" /></span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Bạn chưa có lịch khám sắp tới</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Đặt lịch trước để được tiếp nhận nhanh hơn và không phải chờ lâu khi đến bệnh viện.</p>
        <div className="mt-6 flex justify-center"><AppointmentDialog /></div>
        <ol className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
          {bookingSteps.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl bg-muted/50 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-sm"><Icon className="size-[1.1rem]" /></span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-muted-foreground">Bước {index + 1}</span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const appointmentDate = parseISO(upcomingAppointment.appointment_date.slice(0, 10));
  const appointmentTime = upcomingAppointment.appointment_time.slice(11, 16);
  const daysLeft = differenceInCalendarDays(appointmentDate, startOfToday());
  const doctor = upcomingAppointment.doctor;

  async function copyAppointmentCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Đã sao chép mã lịch hẹn.");
    } catch {
      toast.error("Không thể sao chép mã lịch hẹn.");
    }
  }

  return (
    <section id="appointments" className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-xl shadow-primary/10 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Cột trái: thông tin chính */}
      <div className="relative flex flex-col overflow-hidden bg-primary p-6 text-primary-foreground sm:p-9">
        <div className="absolute -right-16 -top-20 size-72 rounded-full bg-white/8" />
        <div className="absolute -bottom-28 right-20 size-56 rounded-full border-[30px] border-white/5" />
        <div className="relative flex flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold tracking-wide text-white/75">LỊCH KHÁM SẮP TỚI</p>
            <Badge className="rounded-full border-0 bg-white/15 px-3 text-white hover:bg-white/15"><CalendarCheck className="size-3.5" /> Đã đặt thành công</Badge>
          </div>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="grid size-28 shrink-0 place-items-center rounded-3xl bg-white text-primary shadow-lg">
              <span className="text-center leading-none">
                <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">{format(appointmentDate, "'Tháng' M", { locale: vi })}</span>
                <span className="mt-2 block text-5xl font-bold">{format(appointmentDate, "dd")}</span>
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm capitalize text-white/75">{format(appointmentDate, "EEEE, dd/MM/yyyy", { locale: vi })}</p>
              <p className="mt-1 flex items-center gap-2 text-4xl font-semibold tracking-tight tabular-nums"><Clock3 className="size-7 text-white/70" /> {appointmentTime}</p>
              <span className={cn("mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", daysLeft <= 1 ? "bg-[var(--brand-coral)] text-white" : "bg-white/15 text-white")}>
                <CalendarClock className="size-3.5" /> {describeCountdown(daysLeft)}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <span className="text-sm text-white/70">Mã lịch hẹn</span>
            <span className="text-xl font-bold tracking-[0.18em]">{upcomingAppointment.appointment_code}</span>
            <span className="group/appointment-tip relative inline-flex">
              <button type="button" aria-label="Hướng dẫn sử dụng mã lịch khám" className="grid size-7 place-items-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"><Info className="size-4" /></button>
              <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 translate-y-1 rounded-xl bg-foreground px-3 py-2.5 text-center text-xs font-medium leading-5 text-background opacity-0 shadow-xl transition group-hover/appointment-tip:translate-y-0 group-hover/appointment-tip:opacity-100 group-focus-within/appointment-tip:translate-y-0 group-focus-within/appointment-tip:opacity-100">Đọc mã <strong>{upcomingAppointment.appointment_code}</strong> cho nhân viên tiếp nhận khi bạn đến bệnh viện.<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" /></span>
            </span>
            <Button type="button" onClick={() => copyAppointmentCode(upcomingAppointment.appointment_code)} className="ml-auto h-8 rounded-full bg-white/15 px-3 text-xs text-white hover:bg-white/25"><Copy className="size-3.5" /> Sao chép</Button>
          </div>

          <div className="min-h-8 flex-1" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5">
            <p className="text-xs text-white/60">Cần đổi lịch? Hủy lịch này và đặt lịch mới.</p>
            <AlertDialog>
              <AlertDialogTrigger render={<Button className="h-10 rounded-full bg-white/10 px-5 text-white hover:bg-white/20" />}><XCircle /> Hủy lịch</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia><XCircle className="text-destructive" /></AlertDialogMedia>
                  <AlertDialogTitle>Hủy lịch khám này?</AlertDialogTitle>
                  <AlertDialogDescription>Lịch #{upcomingAppointment.appointment_code} vào {appointmentTime}, {format(appointmentDate, "dd/MM/yyyy")} sẽ được chuyển sang trạng thái đã hủy.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Giữ lịch</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={cancelAppointment.isPending} onClick={() => cancelAppointment.mutate(upcomingAppointment.id)}>{cancelAppointment.isPending ? <LoaderCircle className="animate-spin" /> : <XCircle />} Xác nhận hủy</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Cột phải: chi tiết + chuẩn bị */}
      <div className="flex flex-col p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Chi tiết lịch hẹn</p>
        <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <DetailItem icon={Stethoscope} label="Bác sĩ">
            {doctor ? <>{doctor.full_name}<span className="block text-xs font-normal text-muted-foreground">{doctor.specialization}</span></> : <span className="font-normal text-muted-foreground">Phân công khi tiếp nhận</span>}
          </DetailItem>
          <DetailItem icon={DoorOpen} label="Phòng khám">
            <span className="font-normal text-muted-foreground">Phân công khi tiếp nhận</span>
          </DetailItem>
          <DetailItem icon={CalendarCheck} label="Đặt lúc">
            {format(parseISO(upcomingAppointment.created_at), "HH:mm, dd/MM/yyyy")}
          </DetailItem>
          <DetailItem icon={Clock3} label="Nên có mặt">
            Trước {format(new Date(2000, 0, 1, Number(appointmentTime.slice(0, 2)), Number(appointmentTime.slice(3, 5)) - 15), "HH:mm")}
          </DetailItem>
          <DetailItem icon={FileText} label="Tình trạng đã khai báo" className="sm:col-span-2">
            {upcomingAppointment.note ? <span className="font-normal">{upcomingAppointment.note}</span> : <span className="font-normal text-muted-foreground">Không có ghi chú.</span>}
          </DetailItem>
        </dl>

        <div className="mt-7 rounded-2xl bg-[var(--brand-coral-soft)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-coral)]">Chuẩn bị trước khi đến viện</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {preparationTips.map((tip) => (
              <li key={tip} className="flex gap-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-card text-primary"><Check className="size-3" /></span>{tip}</li>
            ))}
          </ul>
        </div>

        {otherUpcomingCount > 0 && (
          <Link href="/patient/appointments" className="group mt-5 flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition hover:border-primary/30 hover:bg-primary/[0.03]">
            <span>Bạn còn <strong>{otherUpcomingCount}</strong> lịch khám khác sắp tới</span>
            <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        )}
      </div>
    </section>
  );
}

function DetailItem({ icon: Icon, label, className, children }: { icon: ComponentType<{ className?: string }>; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold">{children}</dd>
      </div>
    </div>
  );
}
