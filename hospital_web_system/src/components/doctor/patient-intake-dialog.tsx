"use client";

import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  ClipboardPlus,
  Clock3,
  FileText,
  History,
  Info,
  Link2,
  LoaderCircle,
  Search,
  Stethoscope,
  TriangleAlert,
  UserPlus,
  UserRound,
  UserRoundCheck,
  UserRoundSearch,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { appointmentService } from "@/services/appointment.service";
import { patientService, type ReceptionPatientSearchResult } from "@/services/patient.service";
import { medicalVisitService } from "@/services/medical-visit.service";
import { RoomPicker, VitalsForm, validateReceptionVitals, type ReceptionDraft } from "@/components/doctor/workspaces/reception-measure-dialog";
import type { ReceptionQueueAppointment } from "@/types/api";

/**
 * Dialog "Tiếp nhận bệnh nhân".
 * - Tab "Có lịch hẹn": tra mã qua API (mọi ngày). Xác nhận đã đến lưu `checked_in_at`;
 *   lịch của ngày sau có thể chuyển sang hôm nay rồi tiếp nhận.
 * - Tab "Không có lịch hẹn": tra cứu mã bệnh nhân (hoặc tạo hồ sơ vãng lai) → đo sinh hiệu → phân phòng → tạo lượt khám.
 */

export type IntakeTab = "CODE" | "WALK_IN";

const CODE_LENGTH = 6;
const CODE_CHARACTERS = /[^ABCDEFGHJKLMNPQRSTUVWXYZ2-9]/g;

type Gender = "MALE" | "FEMALE" | "OTHER";

const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];

function formatTime(value: string) {
  return value.slice(11, 16);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function PatientIntakeDialog({
  appointments,
  onSelectAppointment,
  defaultTab = "CODE",
  trigger,
}: {
  /** Hàng đợi tiếp nhận hôm nay. */
  appointments: ReceptionQueueAppointment[];
  onSelectAppointment: (appointmentId: string) => void;
  defaultTab?: IntakeTab;
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<IntakeTab>(defaultTab);
  /** Mã lịch hẹn điền sẵn khi chuyển từ tab "Không có lịch hẹn" sang "Có lịch hẹn". */
  const [prefillCode, setPrefillCode] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTab(defaultTab);
      setPrefillCode("");
    }
  }

  function finish(appointmentId?: string) {
    if (appointmentId) onSelectAppointment(appointmentId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button className="h-10 rounded-full px-4" />}>
        {!trigger && <><UserRound /> Tiếp nhận bệnh nhân</>}
      </DialogTrigger>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><UserRoundCheck className="size-4 text-primary" /> Tiếp nhận bệnh nhân</DialogTitle>
          </div>
          <DialogDescription className="text-sm">Xác nhận bệnh nhân đã đến quầy để bắt đầu lượt khám.</DialogDescription>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="tablist">
            <TabButton active={tab === "CODE"} onClick={() => setTab("CODE")} icon={CalendarCheck} label="Có lịch hẹn" />
            <TabButton active={tab === "WALK_IN"} onClick={() => setTab("WALK_IN")} icon={UserPlus} label="Không có lịch hẹn" />
          </div>
        </DialogHeader>

        {tab === "CODE"
          ? <CodeCheckIn key={prefillCode} initialCode={prefillCode} appointments={appointments} onDone={finish} onSwitchToWalkIn={() => setTab("WALK_IN")} />
          : <WalkInIntake appointments={appointments} onDone={finish} onUseAppointmentCode={(code) => { setPrefillCode(code); setTab("CODE"); }} />}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Tab 1: nhập mã lịch hẹn ───────────────────────── */

/** Dữ liệu tối thiểu để hiển thị một lịch hẹn (dùng chung cho kết quả tra mã và hàng đợi hôm nay). */
type SummaryAppointment = {
  id: string;
  appointment_code: string;
  appointment_date: string;
  appointment_time: string;
  note: string | null;
  status: "BOOKED" | "CANCELLED";
  checked_in_at: string | null;
  created_at: string;
  patient: { full_name: string; patient_code: string | null; gender?: "MALE" | "FEMALE" | "OTHER" | null; date_of_birth?: string | null; user: { phone_number: string | null } };
  medical_visits: Array<{ visit_code: string; status: "IN_PROGRESS" | "COMPLETED" }>;
};

type CheckInState =
  | { kind: "TODAY" }
  | { kind: "IN_PROGRESS" }
  | { kind: "EARLY"; days: number }
  | { kind: "EXPIRED"; days: number }
  | { kind: "CANCELLED" }
  | { kind: "COMPLETED" };

function getCheckInState(appointment: SummaryAppointment, todayKey: string): CheckInState {
  const visit = appointment.medical_visits[0];
  if (appointment.status === "CANCELLED") return { kind: "CANCELLED" };
  if (visit?.status === "COMPLETED") return { kind: "COMPLETED" };
  if (visit?.status === "IN_PROGRESS") return { kind: "IN_PROGRESS" };
  const days = differenceInCalendarDays(parseISO(appointment.appointment_date.slice(0, 10)), parseISO(todayKey));
  if (days > 0) return { kind: "EARLY", days };
  if (days < 0) return { kind: "EXPIRED", days: -days };
  return { kind: "TODAY" };
}

function describeDay(days: number) {
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Ngày mai";
  if (days === -1) return "Hôm qua";
  return days > 0 ? `${days} ngày nữa` : `${-days} ngày trước`;
}

function CodeCheckIn({ appointments, onDone, onSwitchToWalkIn, initialCode = "" }: { appointments: ReceptionQueueAppointment[]; onDone: (appointmentId?: string) => void; onSwitchToWalkIn: () => void; initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [focused, setFocused] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pickedId, setPickedId] = useState<string>();

  const codeComplete = code.length === CODE_LENGTH;
  const lookupQuery = useQuery({
    queryKey: ["appointment-lookup", code],
    queryFn: () => appointmentService.lookupByCode(code),
    enabled: !forgotMode && codeComplete,
    retry: false,
    staleTime: 10_000,
  });
  const notFound = lookupQuery.isError && isAxiosError(lookupQuery.error) && lookupQuery.error.response?.status === 404;
  const todayKey = lookupQuery.data?.today ?? format(new Date(), "yyyy-MM-dd");

  const picked: SummaryAppointment | undefined = forgotMode
    ? appointments.find((item) => item.id === pickedId)
    : codeComplete ? lookupQuery.data?.appointment : undefined;
  const state = picked ? getCheckInState(picked, todayKey) : undefined;
  const inQueue = picked ? appointments.some((item) => item.id === picked.id) : false;

  const keywordResults = useMemo(() => {
    const query = normalize(keyword.trim());
    if (query.length < 2) return [];
    return appointments.filter((item) => normalize([
      item.patient.full_name,
      item.patient.patient_code,
      item.patient.user.phone_number ?? "",
      item.patient.identity_number ?? "",
    ].join(" ")).includes(query)).slice(0, 5);
  }, [appointments, keyword]);

  const queryClient = useQueryClient();
  const checkInMutation = useMutation({
    mutationFn: ({ appointmentId, moveToToday }: { appointmentId: string; moveToToday: boolean }) =>
      appointmentService.checkIn(appointmentId, moveToToday),
    onSuccess: async (result, { moveToToday }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reception-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["appointment-schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["appointment-lookup"] }),
      ]);
      toast.success(result.message, {
        description: moveToToday
          ? `${result.appointment.patient.full_name} · Giờ khám mới ${formatTime(result.appointment.appointment_time)} hôm nay`
          : `${result.appointment.patient.full_name} · Lịch ${result.appointment.appointment_code}`,
      });
      onDone(result.appointment.id);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận bệnh nhân đã đến.")),
  });

  function confirm() {
    if (!picked || !state) return;
    if (state.kind === "IN_PROGRESS" || (state.kind === "TODAY" && picked.checked_in_at && inQueue)) {
      onDone(picked.id);
      return;
    }
    checkInMutation.mutate({ appointmentId: picked.id, moveToToday: state.kind === "EARLY" });
  }

  // Lịch hôm nay / đến sớm: gọi API check-in (hàng đợi sẽ tải lại). Đang khám: chỉ mở hồ sơ nên cần có sẵn trong hàng đợi.
  const canConfirm = state?.kind === "TODAY" || state?.kind === "EARLY" || (state?.kind === "IN_PROGRESS" && inQueue);

  return (
    <>
      <div className="space-y-5 px-6 py-6">
        {!forgotMode ? (
          <div>
            <Label className="text-xs text-muted-foreground">Mã lịch hẹn bệnh nhân đọc tại quầy</Label>
            <div className="relative mt-2">
              <input
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(CODE_CHARACTERS, "").slice(0, CODE_LENGTH))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-label="Mã lịch hẹn"
                autoComplete="off"
                spellCheck={false}
                className="absolute inset-0 z-10 w-full cursor-text opacity-0"
              />
              <div className="grid grid-cols-6 gap-2" aria-hidden>
                {Array.from({ length: CODE_LENGTH }, (_, index) => {
                  const char = code[index];
                  const active = focused && (index === code.length || (codeComplete && index === CODE_LENGTH - 1));
                  return (
                    <span
                      key={index}
                      className={cn(
                        "grid h-14 place-items-center rounded-xl border text-xl font-semibold tracking-wide transition",
                        char ? "border-primary/40 bg-primary/[0.04] text-foreground" : "border-input bg-background text-muted-foreground/40",
                        active && "border-ring ring-3 ring-ring/20",
                        codeComplete && notFound && "border-destructive/40 bg-destructive/[0.04]",
                      )}
                    >
                      {char ?? "•"}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Gồm chữ in hoa và số, ví dụ <span className="font-medium tracking-wide text-foreground">A7K2QP</span>.</span>
              <button type="button" onClick={() => { setForgotMode(true); setPickedId(undefined); }} className="shrink-0 font-medium text-primary hover:underline">Quên mã?</button>
            </div>

            {codeComplete && lookupQuery.isFetching && !lookupQuery.data && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Đang tra cứu lịch hẹn...</p>
            )}
            {codeComplete && notFound && (
              <Notice tone="error" title={`Không tìm thấy lịch hẹn ${code}.`} description="Kiểm tra lại mã với bệnh nhân.">
                <button type="button" onClick={onSwitchToWalkIn} className="mt-2 text-xs font-medium text-primary hover:underline">Tiếp nhận như bệnh nhân không đặt lịch →</button>
              </Notice>
            )}
            {codeComplete && lookupQuery.isError && !notFound && (
              <Notice tone="error" title="Không thể tra cứu lúc này." description="Vui lòng thử lại sau ít phút." />
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="intake-keyword" className="text-xs text-muted-foreground">Tìm lịch hôm nay theo SĐT, CCCD, tên hoặc mã bệnh nhân</Label>
              <button type="button" onClick={() => { setForgotMode(false); setKeyword(""); }} className="shrink-0 text-xs font-medium text-primary hover:underline">Nhập mã</button>
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="intake-keyword" autoFocus value={keyword} onChange={(event) => { setKeyword(event.target.value); setPickedId(undefined); }} placeholder="Ví dụ: 0912345678" className="h-11 rounded-xl pl-9" />
            </div>
            {keyword.trim().length >= 2 && (
              <div className="mt-3 space-y-1.5">
                {keywordResults.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Không có lịch hẹn hôm nay khớp với thông tin này.</p>
                ) : keywordResults.map((item) => (
                  <button key={item.id} type="button" onClick={() => setPickedId(item.id)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", pickedId === item.id ? "border-primary bg-primary/[0.05] ring-2 ring-primary/15" : "hover:border-primary/30")}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.patient.full_name}</span>
                      <span className="block text-xs text-muted-foreground">{item.patient.patient_code} · {formatTime(item.appointment_time)} · Lịch {item.appointment_code}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {picked && state && <AppointmentSummary appointment={picked} state={state} todayKey={todayKey} />}
        {picked && state && <StateNotice state={state} appointment={picked} inQueue={inQueue} onSwitchToWalkIn={onSwitchToWalkIn} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
        <p className="text-xs text-muted-foreground">{!picked ? "Nhập đủ 6 ký tự để tra cứu." : canConfirm ? "Kiểm tra đúng người trước khi xác nhận." : "Lịch hẹn này chưa thể tiếp nhận hôm nay."}</p>
        <Button type="button" disabled={!canConfirm || checkInMutation.isPending} onClick={confirm} className="h-10 rounded-full px-5">
          {checkInMutation.isPending ? <><LoaderCircle className="animate-spin" /> Đang xử lý...</>
            : <>{state?.kind === "EARLY" ? "Chuyển sang hôm nay & tiếp nhận" : state?.kind === "IN_PROGRESS" || picked?.checked_in_at ? "Mở hồ sơ" : "Xác nhận đã đến"} <ArrowRight /></>}
        </Button>
      </div>
    </>
  );
}

function AppointmentSummary({ appointment, state, todayKey }: { appointment: SummaryAppointment; state: CheckInState; todayKey: string }) {
  const date = parseISO(appointment.appointment_date.slice(0, 10));
  const days = differenceInCalendarDays(date, parseISO(todayKey));
  const visit = appointment.medical_visits[0];
  const badge: Record<CheckInState["kind"], { label: string; className: string }> = {
    TODAY: { label: "Lịch hôm nay", className: "bg-emerald-100 text-emerald-700" },
    IN_PROGRESS: { label: "Đang khám", className: "bg-primary/10 text-primary" },
    EARLY: { label: `Đến sớm ${state.kind === "EARLY" ? state.days : 0} ngày`, className: "bg-amber-100 text-amber-700" },
    EXPIRED: { label: "Lịch đã qua", className: "bg-muted text-muted-foreground" },
    CANCELLED: { label: "Đã hủy", className: "bg-destructive/10 text-destructive" },
    COMPLETED: { label: "Đã khám xong", className: "bg-muted text-muted-foreground" },
  };
  const meta = badge[state.kind];
  const age = appointment.patient.date_of_birth ? new Date().getFullYear() - new Date(appointment.patient.date_of_birth).getFullYear() : null;
  const genderLabel = appointment.patient.gender === "MALE" ? "Nam" : appointment.patient.gender === "FEMALE" ? "Nữ" : appointment.patient.gender === "OTHER" ? "Khác" : null;

  return (
    <div className={cn("rounded-2xl border p-4", state.kind === "TODAY" || state.kind === "IN_PROGRESS" ? "border-primary/20 bg-primary/[0.035]" : "border-border bg-muted/30")}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {appointment.patient.full_name.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{appointment.patient.full_name}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", meta.className)}>{meta.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[appointment.patient.patient_code, genderLabel, age !== null ? `${age} tuổi` : null, appointment.patient.user.phone_number].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-foreground/5 pt-4 text-sm sm:grid-cols-2">
        <SummaryItem icon={CalendarDays} label="Ngày khám">
          <span className="capitalize">{format(date, "EEEE, dd/MM/yyyy", { locale: vi })}</span>
          <span className={cn("ml-1.5 rounded-full px-1.5 py-px text-[0.65rem] font-semibold", days === 0 ? "bg-emerald-100 text-emerald-700" : days > 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>{describeDay(days)}</span>
        </SummaryItem>
        <SummaryItem icon={Clock3} label="Giờ hẹn">{formatTime(appointment.appointment_time)}</SummaryItem>
        <SummaryItem icon={CalendarCheck} label="Mã lịch hẹn"><span className="tracking-wide">{appointment.appointment_code}</span></SummaryItem>
        <SummaryItem icon={History} label="Đặt lúc">{format(parseISO(appointment.created_at), "HH:mm, dd/MM/yyyy")}</SummaryItem>
        {appointment.checked_in_at && <SummaryItem icon={UserRoundCheck} label="Đã đến quầy" className="sm:col-span-2">{format(parseISO(appointment.checked_in_at), "HH:mm, dd/MM/yyyy")}</SummaryItem>}
        <SummaryItem icon={FileText} label="Tình trạng đã khai" className="sm:col-span-2">
          <span className="font-normal">{appointment.note || "Bệnh nhân không ghi tình trạng."}</span>
        </SummaryItem>
        {visit && <SummaryItem icon={Stethoscope} label="Lượt khám" className="sm:col-span-2">{visit.visit_code} · {visit.status === "IN_PROGRESS" ? "Đang diễn ra" : "Đã hoàn thành"}</SummaryItem>}
      </dl>
    </div>
  );
}

function StateNotice({ state, appointment, inQueue, onSwitchToWalkIn }: { state: CheckInState; appointment: SummaryAppointment; inQueue: boolean; onSwitchToWalkIn: () => void }) {
  if (state.kind === "EARLY") {
    return (
      <Notice tone="warning" title={`Bệnh nhân đến sớm ${state.days} ngày so với lịch hẹn.`} description={`Khi tiếp nhận, lịch ngày ${format(parseISO(appointment.appointment_date.slice(0, 10)), "dd/MM")} lúc ${formatTime(appointment.appointment_time)} sẽ được chuyển sang hôm nay, giờ khám là giờ đến thực tế. Lịch cũ sẽ không còn.`} />
    );
  }
  if (state.kind === "EXPIRED") {
    return (
      <Notice tone="warning" title={`Lịch hẹn đã qua ${state.days} ngày.`} description="Lịch cũ không còn hiệu lực để tiếp nhận.">
        <button type="button" onClick={onSwitchToWalkIn} className="mt-2 text-xs font-medium text-primary hover:underline">Tiếp nhận như bệnh nhân không đặt lịch →</button>
      </Notice>
    );
  }
  if (state.kind === "CANCELLED") {
    return (
      <Notice tone="error" title="Lịch hẹn này đã bị hủy." description={`Lịch ${appointment.appointment_code} không còn hiệu lực.`}>
        <button type="button" onClick={onSwitchToWalkIn} className="mt-2 text-xs font-medium text-primary hover:underline">Tiếp nhận như bệnh nhân không đặt lịch →</button>
      </Notice>
    );
  }
  if (state.kind === "COMPLETED") {
    return <Notice tone="info" title="Lịch hẹn này đã khám xong." description="Nếu bệnh nhân cần khám lại, hãy tạo lượt tiếp nhận mới." />;
  }
  if (state.kind === "IN_PROGRESS" && !inQueue) {
    return <Notice tone="info" title="Lịch chưa có trong hàng đợi đang hiển thị." description="Thử làm mới trang để cập nhật hàng đợi hôm nay." />;
  }
  return null;
}

function Notice({ tone, title, description, children }: { tone: "error" | "warning" | "info"; title: string; description: string; children?: ReactNode }) {
  const toneClass = {
    error: "border-destructive/20 bg-destructive/[0.04] [&_.notice-title]:text-destructive",
    warning: "border-amber-300/60 bg-amber-50 [&_.notice-title]:text-amber-800",
    info: "border-border bg-muted/40 [&_.notice-title]:text-foreground",
  }[tone];
  const Icon = tone === "info" ? Info : TriangleAlert;
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4 text-sm", toneClass)}>
      <Icon className="notice-title mt-0.5 size-4 shrink-0" />
      <div>
        <p className="notice-title font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, className, children }: { icon: typeof Clock3; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex gap-2.5", className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium">{children}</dd>
      </div>
    </div>
  );
}

/* ───────────────────── Tab 2: bệnh nhân không có lịch hẹn ───────────────────── */
/*
 * Luồng: ① Hồ sơ bệnh nhân → ② Đo sinh hiệu → ③ Phân phòng → Bắt đầu lượt khám (không gắn lịch hẹn).
 * - Tra cứu theo mã bệnh nhân (khớp chính xác) để dùng hồ sơ có sẵn (có tài khoản hoặc vãng lai).
 * - Không có tài khoản: tạo hồ sơ vãng lai (user_id = null, không có mã bệnh nhân — mã chỉ tạo khi đăng ký tài khoản).
 */

type WalkInStep = "PROFILE" | "VITALS" | "ROOM";

type ProfileForm = {
  full_name: string;
  date_of_birth: string;
  gender?: Gender;
  phone_number: string;
  identity_number: string;
  address: string;
};

const emptyProfile: ProfileForm = { full_name: "", date_of_birth: "", phone_number: "", identity_number: "", address: "" };

const emptyDraft: ReceptionDraft = { temperature: "", bloodPressure: "", heartRate: "", spo2: "", height: "", weight: "", visitReason: "", receptionNote: "" };


function optionalNumber(value: string) {
  return value.trim() ? Number(value.replace(",", ".")) : null;
}

/** Sinh hiệu + lý do khám từ form tiếp nhận → payload API (giống luồng có lịch hẹn). */
function receptionPayload(draft: ReceptionDraft) {
  const pressure = draft.bloodPressure.trim().split("/").map((part) => part.trim());
  return {
    receiving_room_code: draft.room!,
    temperature_c: optionalNumber(draft.temperature),
    systolic_blood_pressure: draft.bloodPressure.trim() ? Number(pressure[0]) : null,
    diastolic_blood_pressure: draft.bloodPressure.trim() ? Number(pressure[1]) : null,
    heart_rate: optionalNumber(draft.heartRate),
    spo2: optionalNumber(draft.spo2),
    height_cm: optionalNumber(draft.height),
    weight_kg: optionalNumber(draft.weight),
    visit_reason: draft.visitReason.trim() || null,
    reception_note: draft.receptionNote.trim() || null,
  };
}

function WalkInIntake({ appointments, onDone, onUseAppointmentCode }: { appointments: ReceptionQueueAppointment[]; onDone: (appointmentId?: string) => void; onUseAppointmentCode: (code: string) => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WalkInStep>("PROFILE");
  /** LOOKUP: tra cứu theo mã bệnh nhân · NEW: tạo hồ sơ vãng lai mới. */
  const [mode, setMode] = useState<"LOOKUP" | "NEW">("LOOKUP");
  const [codeInput, setCodeInput] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [linked, setLinked] = useState<ReceptionPatientSearchResult | null>(null);
  const [draft, setDraft] = useState<ReceptionDraft>(emptyDraft);

  // Tra cứu khớp CHÍNH XÁC mã bệnh nhân (không phân biệt hoa thường).
  const lookup = useQuery({
    queryKey: ["patient-code-lookup", submittedCode],
    queryFn: () => patientService.searchForReception(submittedCode),
    enabled: submittedCode.length > 0,
    retry: false,
  });
  const results = (lookup.data ?? []).filter((patient) => patient.patient_code.toUpperCase() === submittedCode.toUpperCase());

  const startMutation = useMutation({
    mutationFn: () => medicalVisitService.startWalkIn({
      ...receptionPayload(draft),
      ...(linked ? { patient_id: linked.id } : {
        new_patient: {
          full_name: profile.full_name.trim(),
          date_of_birth: profile.date_of_birth || null,
          gender: profile.gender ?? null,
          phone_number: profile.phone_number.trim() || null,
          identity_number: profile.identity_number.trim() || null,
          address: profile.address.trim() || null,
        },
      }),
    }),
    onSuccess: async (result) => {
      toast.success(result.message, { description: `Bệnh nhân sang phòng ${draft.room}.` });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["room-visit-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["medical-visit-list"] }),
        queryClient.invalidateQueries({ queryKey: ["medical-records"] }),
      ]);
      onDone();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu lượt khám.")),
  });

  function submitLookup() {
    const code = codeInput.trim();
    if (code) setSubmittedCode(code);
  }

  function updateProfile<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateDraft<K extends keyof ReceptionDraft>(key: K, value: ReceptionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function pickPatient(patient: ReceptionPatientSearchResult) {
    setLinked(patient);
    setProfile({
      full_name: patient.full_name,
      date_of_birth: patient.date_of_birth?.slice(0, 10) ?? "",
      gender: patient.gender ?? undefined,
      phone_number: patient.phone_number ?? "",
      identity_number: patient.identity_number ?? "",
      address: patient.address ?? "",
    });
  }

  function unlinkPatient() {
    setLinked(null);
    setProfile(emptyProfile);
    setMode("LOOKUP");
  }

  function goNext() {
    if (step === "PROFILE") {
      if (!linked && mode === "LOOKUP") {
        toast.error("Tra cứu và chọn hồ sơ theo mã bệnh nhân, hoặc tạo hồ sơ vãng lai mới.");
        return;
      }
      if (!linked) {
        const missing = [
          !profile.full_name.trim() && "họ tên",
          !profile.date_of_birth && "ngày sinh",
          !profile.gender && "giới tính",
          !profile.phone_number.trim() && "số điện thoại",
        ].filter(Boolean);
        if (missing.length > 0) {
          toast.error(`Vui lòng nhập ${missing.join(", ")}.`);
          return;
        }
      }
      setStep("VITALS");
      return;
    }
    if (step === "VITALS") {
      const error = validateReceptionVitals(draft);
      if (error) {
        toast.error(error);
        return;
      }
      setStep("ROOM");
    }
  }

  function goBack() {
    setStep(step === "ROOM" ? "VITALS" : "PROFILE");
  }

  function finish() {
    if (!draft.room) {
      toast.error("Vui lòng chọn phòng bác sĩ tiếp nhận.");
      return;
    }
    startMutation.mutate();
  }

  const steps: Array<{ key: WalkInStep; label: string }> = [
    { key: "PROFILE", label: "Hồ sơ bệnh nhân" },
    { key: "VITALS", label: "Đo sinh hiệu" },
    { key: "ROOM", label: "Phân phòng" },
  ];
  const stepIndex = steps.findIndex((item) => item.key === step);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-5 text-xs">
        {steps.map((item, index) => (
          <span key={item.key} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-6 bg-border" />}
            <StepDot index={index + 1} label={item.label} active={index === stepIndex} done={index < stepIndex} />
          </span>
        ))}
      </div>

      {step === "PROFILE" && (
        <div className="space-y-4 px-6 py-5">
          {linked ? (
            <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Link2 className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{linked.full_name} <span className="tracking-wide text-primary">{linked.patient_code}</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">{[genderOptions.find((g) => g.value === linked.gender)?.label, linked.date_of_birth && `${new Date().getFullYear() - new Date(linked.date_of_birth).getFullYear()} tuổi`, linked.phone_number, linked.identity_number && `CCCD ${linked.identity_number}`].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{linked.has_account ? "Có tài khoản — lượt khám sẽ hiện trong tài khoản của bệnh nhân." : "Hồ sơ vãng lai — lượt khám được lưu vào lịch sử của hồ sơ này."}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={unlinkPatient}><X /> Bỏ chọn</Button>
            </div>
          ) : mode === "LOOKUP" ? (
            <>
              <div>
                <Label htmlFor="patient-code" className="text-xs text-muted-foreground">Mã bệnh nhân</Label>
                <form className="mt-1.5 flex gap-2" onSubmit={(event) => { event.preventDefault(); submitLookup(); }}>
                  <div className="relative flex-1">
                    <UserRoundSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
                    <Input id="patient-code" autoFocus value={codeInput} onChange={(event) => setCodeInput(event.target.value.toUpperCase())} placeholder="Nhập mã bệnh nhân" className="h-11 rounded-xl pl-10 font-mono text-base tracking-wide" />
                  </div>
                  <Button type="submit" disabled={!codeInput.trim() || lookup.isFetching} className="h-11 rounded-xl px-5">{lookup.isFetching ? <LoaderCircle className="animate-spin" /> : <Search />} Tra cứu</Button>
                </form>
                <p className="mt-1.5 text-xs text-muted-foreground">Mã bệnh nhân chỉ có ở bệnh nhân đã đăng ký tài khoản (xem trong trang hồ sơ của họ).</p>
              </div>

              {submittedCode && !lookup.isFetching && (results.length > 0 ? (
                <div className="space-y-1.5">
                  {results.map((patient) => (
                    <CandidateCard key={patient.id} patient={patient} onPick={() => pickPatient(patient)} onUseAppointmentCode={onUseAppointmentCode} onOpenVisit={(appointmentId) => onDone(appointmentId)} queueIds={appointments.map((item) => item.id)} />
                  ))}
                </div>
              ) : lookup.isError ? (
                <p className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-3.5 text-sm text-destructive">Không thể tra cứu lúc này. Vui lòng thử lại.</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-3.5">
                  <p className="text-sm text-amber-900">Không tìm thấy mã <span className="font-mono font-semibold">{submittedCode}</span> trong hệ thống.</p>
                  <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setMode("NEW")}><UserPlus /> Tạo hồ sơ vãng lai</Button>
                </div>
              ))}

              <button type="button" onClick={() => setMode("NEW")} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><UserPlus className="size-3.5" /> Bệnh nhân không có tài khoản — tạo hồ sơ vãng lai</button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Hồ sơ vãng lai: không có tài khoản và không có mã bệnh nhân.</p>
                <button type="button" onClick={() => setMode("LOOKUP")} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><ArrowLeft className="size-3.5" /> Tra cứu mã bệnh nhân</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Họ và tên" required className="sm:col-span-2"><Input value={profile.full_name} onChange={(event) => updateProfile("full_name", event.target.value)} autoFocus placeholder="Nguyễn Văn A" className="h-11 rounded-xl" /></Field>
                <Field label="Số điện thoại" required><Input value={profile.phone_number} onChange={(event) => updateProfile("phone_number", event.target.value)} type="tel" inputMode="tel" placeholder="0912 345 678" className="h-11 rounded-xl" /></Field>
                <Field label="Số CCCD"><Input value={profile.identity_number} onChange={(event) => updateProfile("identity_number", event.target.value)} inputMode="numeric" placeholder="12 chữ số" className="h-11 rounded-xl" /></Field>
                <Field label="Ngày sinh" required><Input value={profile.date_of_birth} onChange={(event) => updateProfile("date_of_birth", event.target.value)} type="date" max={new Date().toISOString().slice(0, 10)} className="h-11 rounded-xl" /></Field>
                <Field label="Giới tính" required>
                  <div className="grid h-11 grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                    {genderOptions.map((option) => (
                      <button key={option.value} type="button" onClick={() => updateProfile("gender", option.value)} aria-pressed={profile.gender === option.value} className={cn("rounded-lg text-sm transition", profile.gender === option.value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{option.label}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Địa chỉ" className="sm:col-span-2"><Input value={profile.address} onChange={(event) => updateProfile("address", event.target.value)} placeholder="Số nhà, đường, phường/xã, tỉnh/thành" className="h-11 rounded-xl" /></Field>
              </div>
            </>
          )}
        </div>
      )}

      {step === "VITALS" && <VitalsForm draft={draft} onChange={updateDraft} className="px-6 py-5" />}
      {step === "ROOM" && <RoomPicker value={draft.room} onChange={(code) => updateDraft("room", code)} className="px-6 py-5" />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
        {step === "PROFILE" ? (
          <p className="text-xs text-muted-foreground">{linked ? `Bệnh nhân: ${linked.full_name}${linked.patient_code ? ` (${linked.patient_code})` : ""}` : mode === "NEW" ? "Khách vãng lai: hồ sơ mới không kèm tài khoản đăng nhập." : "Tra cứu mã bệnh nhân để dùng hồ sơ có sẵn."}</p>
        ) : (
          <Button type="button" variant="ghost" onClick={goBack} className="h-10 rounded-full px-4"><ArrowLeft /> Quay lại</Button>
        )}
        {step === "ROOM" ? (
          <Button type="button" onClick={finish} disabled={!draft.room || startMutation.isPending} className="h-10 rounded-full px-5">{startMutation.isPending ? <LoaderCircle className="animate-spin" /> : <ClipboardPlus />} Bắt đầu lượt khám</Button>
        ) : (
          <Button type="button" onClick={goNext} className="h-10 rounded-full px-5">Tiếp tục <ArrowRight /></Button>
        )}
      </div>
    </>
  );
}

/** Bệnh nhân gợi ý khi nhập SĐT / CCCD trùng với hồ sơ đã có. */
function CandidateCard({ patient, queueIds, onPick, onOpenVisit, onUseAppointmentCode }: { patient: ReceptionPatientSearchResult; queueIds: string[]; onPick: () => void; onOpenVisit: (appointmentId: string) => void; onUseAppointmentCode: (code: string) => void }) {
  const genderLabel = genderOptions.find((option) => option.value === patient.gender)?.label;
  const age = patient.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : null;
  const visit = patient.active_visit;
  const appointment = patient.today_appointment ?? patient.upcoming_appointment;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{patient.full_name}</p>
            <span className={cn("rounded-full px-1.5 py-px text-[0.65rem] font-semibold", patient.has_account ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{patient.has_account ? "Có tài khoản" : "Hồ sơ vãng lai"}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{[patient.patient_code, genderLabel, age !== null ? `${age} tuổi` : null, patient.phone_number, patient.identity_number && `CCCD ${patient.identity_number}`].filter(Boolean).join(" · ")}</p>
        </div>
        {!visit && !appointment && <Button type="button" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={onPick}>Chọn</Button>}
      </div>
      {visit && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/[0.05] px-2.5 py-1.5 text-xs">
          <span>Đang khám <span className="font-semibold">{visit.visit_code}</span> tại {visit.receiving_room.name}</span>
          {queueIds.includes(visit.appointment_id) && <button type="button" onClick={() => onOpenVisit(visit.appointment_id)} className="font-medium text-primary hover:underline">Mở hồ sơ</button>}
        </div>
      )}
      {!visit && appointment && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-100/70 px-2.5 py-1.5 text-xs text-amber-900">
          <span>Đã có lịch hẹn <span className="font-semibold tracking-wide">{appointment.appointment_code}</span> {patient.today_appointment ? "hôm nay" : `ngày ${format(parseISO(appointment.appointment_date.slice(0, 10)), "dd/MM")}`} lúc {formatTime(appointment.appointment_time)}</span>
          <button type="button" onClick={() => onUseAppointmentCode(appointment.appointment_code)} className="font-medium text-primary hover:underline">Tiếp nhận theo lịch →</button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Thành phần nhỏ ───────────────────────────── */

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof UserPlus; label: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("flex h-9 items-center justify-center gap-2 rounded-full text-sm transition", active ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="size-4" /> {label}
    </button>
  );
}

function StepDot({ index, label, active, done }: { index: number; label: string; active?: boolean; done?: boolean }) {
  return (
    <span className={cn("flex items-center gap-1.5 font-medium", active || done ? "text-foreground" : "text-muted-foreground")}>
      <span className={cn("grid size-5 place-items-center rounded-full text-[0.65rem] font-bold", active ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{index}</span>
      {label}
    </span>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactElement }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
