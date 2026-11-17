"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Bell,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Clock3,
  DoorOpen,
  Droplets,
  FileHeart,
  Fingerprint,
  History,
  ReceiptText,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Stethoscope,
  Phone,
  Pencil,
  Ruler,
  UserPlus,
  UserRoundPen,
  UsersRound,
  UserRoundSearch,
  VenusAndMars,
  Weight,
  X,
} from "lucide-react";

import { SiteLogo } from "@/components/public/site-logo";
import { ExaminationWorkspace } from "@/components/doctor/workspaces/examination-workspace";
import { DiagnosticWorkspace } from "@/components/doctor/workspaces/diagnostic-workspace";
import { ElectrocardiogramWorkspace } from "@/components/doctor/workspaces/electrocardiogram-workspace";
import { LaboratoryWorkspace } from "@/components/doctor/workspaces/laboratory-workspace";
import { ReceptionWorkspace } from "@/components/doctor/workspaces/reception-workspace";
import { PharmacyWorkspace } from "@/components/doctor/workspaces/pharmacy-workspace";
import { EmergencyWorkspace } from "@/components/doctor/workspaces/emergency-workspace";
import { PreparationWorkspace } from "@/components/doctor/workspaces/preparation-workspace";
import { SurgeryWorkspace } from "@/components/doctor/workspaces/surgery-workspace";
import { PostoperativeWorkspace } from "@/components/doctor/workspaces/postoperative-workspace";
import { EmergencyPharmacyWorkspace } from "@/components/doctor/workspaces/emergency-pharmacy-workspace";
import { ObservationWorkspace } from "@/components/doctor/workspaces/observation-workspace";
import { NursingStationWorkspace } from "@/components/doctor/workspaces/nursing-station-workspace";
import { IsolationWorkspace } from "@/components/doctor/workspaces/isolation-workspace";
import { AppointmentQueueView } from "@/components/doctor/appointment-queue-view";
import { RoomHistoryList } from "@/components/doctor/history/room-history-list";
import { PriceListView } from "@/components/doctor/prices/price-list-view";
import { PatientDirectory } from "@/components/doctor/patients/patient-directory";
import { VisitList } from "@/components/doctor/visits/visit-list";
import { RecordList } from "@/components/doctor/records/record-list";
import { CashierWorkspace } from "@/components/doctor/workspaces/cashier-workspace";
import { TodayScheduleSheet } from "@/components/doctor/today-schedule-sheet";
import { ExamQueueCard, FunctionalQueueCard, examGroups, getExamProgress, type ExamGroup } from "@/components/doctor/exam-room-queue";
import { PatientIntakeDialog } from "@/components/doctor/patient-intake-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { authStorage } from "@/lib/auth-storage";
import { appointmentService } from "@/services/appointment.service";
import { medicalVisitService, type RoomVisitAssignment } from "@/services/medical-visit.service";
import { patientService, type UpdatePatientPayload } from "@/services/patient.service";
import type { BloodType, Gender, ReceptionQueueAppointment } from "@/types/api";

type DoctorWorkspaceProps = {
  floor: string;
  roomCode: string;
  roomName: string;
  roomFunction: string;
};

type WorkspaceQueueAppointment = ReceptionQueueAppointment & {
  assigned_step?: RoomVisitAssignment["visit_step"];
};

type QueueContext = {
  isExaminationRoom?: boolean;
  isDiagnosticRoom?: boolean;
  isLaboratoryRoom?: boolean;
  isPharmacyRoom?: boolean;
};

type WorkspaceView = "overview" | "queue" | "visits" | "records" | "history" | "prices" | "patients";

const navItems: { view: WorkspaceView; label: string; icon: typeof LayoutDashboard; ready?: boolean }[] = [
  { view: "overview", label: "Tổng quan", icon: LayoutDashboard, ready: true },
  { view: "queue", label: "Hàng đợi", icon: UsersRound, ready: true },
  { view: "visits", label: "Lượt khám", icon: ClipboardList, ready: true },
  { view: "records", label: "Tra cứu hồ sơ", icon: FileSearch, ready: true },
  { view: "patients", label: "Tra cứu bệnh nhân", icon: UserRoundSearch, ready: true },
  { view: "history", label: "Lịch sử", icon: History, ready: true },
  { view: "prices", label: "Bảng giá", icon: ReceiptText, ready: true },
];

export function DoctorWorkspace({ floor, roomCode, roomName, roomFunction }: DoctorWorkspaceProps) {
  const isExaminationRoom = /^(GEN|INT|PED|ENT|DER)-/.test(roomCode);
  const isDiagnosticRoom = /^(US|XR|CT|ECG)-/.test(roomCode);
  const isElectrocardiogramRoom = /^ECG-/.test(roomCode);
  const isLaboratoryRoom = /^LAB-/.test(roomCode);
  const isReceptionRoom = roomCode === "REC-101";
  const isEmergencyRoom = roomCode === "ER-102";
  const isPreparationRoom = roomCode === "PRE-503";
  const isSurgeryRoom = roomCode === "OR-501" || roomCode === "OR-502";
  const isPostoperativeRoom = roomCode === "REC-504" || roomCode === "ICU-505";
  const isObservationRoom = roomCode === "OBS-403";
  const isInpatientRoom = roomCode === "IP-401" || roomCode === "IP-402";
  const isNursingStation = roomCode === "NUR-405";
  const isIsolationRoom = roomCode === "ISO-404";
  const isCashierRoom = roomCode === "CAS-103";
  const isPharmacyRoom = roomCode === "PHM-105";
  const usesAssignedQueue = isExaminationRoom || isDiagnosticRoom || isLaboratoryRoom || isPharmacyRoom;
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const [selectedPatientId, setSelectedPatientId] = useState<string>();
  const [queueFilter, setQueueFilter] = useState<"WAITING" | "IN_PROGRESS">(isExaminationRoom ? "IN_PROGRESS" : "WAITING");
  const [searchTerm, setSearchTerm] = useState("");
  /** Phòng khám tầng 2: nhóm theo tiến trình khám (null = tự chọn nhóm đầu tiên có bệnh nhân). */
  const [examFilter, setExamFilter] = useState<ExamGroup | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [patientProfileOpen, setPatientProfileOpen] = useState(false);
  const [editingPatientProfile, setEditingPatientProfile] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeView: WorkspaceView = navItems.some((item) => item.ready && item.view === tabParam) ? (tabParam as WorkspaceView) : "overview";

  /** Đổi mục sidebar qua `?tab=`, giữ nguyên các tham số phòng đang có. */
  function changeView(view: WorkspaceView) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "overview") params.delete("tab");
    else params.set("tab", view);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  const queueKey = usesAssignedQueue ? ["room-visit-queue", roomCode] : ["reception-queue", today];
  const queueQuery = useQuery<WorkspaceQueueAppointment[]>({
    queryKey: queueKey,
    queryFn: async () => {
      if (usesAssignedQueue) {
        const assignments = await medicalVisitService.getRoomQueue(roomCode);
        return assignments.map(normalizeRoomAssignment).filter((item): item is WorkspaceQueueAppointment => item !== null);
      }
      if (isReceptionRoom) return appointmentService.getReceptionQueue(today);
      return [];
    },
  });
  const patients = useMemo(() => queueQuery.data ?? [], [queueQuery.data]);
  const selectedAppointment = patients.find((appointment) => appointment.id === selectedPatientId) ?? patients[0];
  const updatePatientMutation = useMutation({
    mutationFn: ({ patientId, payload }: { patientId: string; payload: UpdatePatientPayload }) =>
      patientService.updateByDoctor(patientId, payload),
    onSuccess: (updatedPatient) => {
      queryClient.setQueryData<WorkspaceQueueAppointment[]>(queueKey, (appointments = []) =>
        appointments.map((appointment) => appointment.patient.id === updatedPatient.id
          ? { ...appointment, patient: updatedPatient }
          : appointment),
      );
      setEditingPatientProfile(false);
      toast.success("Đã cập nhật hồ sơ bệnh nhân.");
    },
    onError: () => toast.error("Không thể cập nhật hồ sơ bệnh nhân."),
  });
  // Cập nhật "thời gian chờ" mỗi phút ở phòng khám.
  useEffect(() => {
    if (!isExaminationRoom && !isLaboratoryRoom && !isDiagnosticRoom && !isPharmacyRoom) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [isExaminationRoom, isLaboratoryRoom, isDiagnosticRoom, isPharmacyRoom]);
  const examProgress = new Map(isExaminationRoom ? patients.map((appointment) => [appointment.id, getExamProgress(appointment)] as const) : []);
  const examCounts = examGroups.map((group) => ({ ...group, count: patients.filter((appointment) => examProgress.get(appointment.id)?.group === group.value).length }));
  const activeExamFilter: ExamGroup = examFilter ?? examCounts.find((group) => group.count > 0)?.value ?? "NEED_CONCLUSION";

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("vi");
  const visiblePatients = patients.filter((appointment) => {
    const matchesFilter = isExaminationRoom
      ? examProgress.get(appointment.id)?.group === activeExamFilter
      : queueFilter === getQueueStatus(appointment);
    const matchesSearch = !normalizedSearch
      || appointment.patient.full_name.toLocaleLowerCase("vi").includes(normalizedSearch)
      || (appointment.patient.patient_code ?? "").toLocaleLowerCase("vi").includes(normalizedSearch)
      || appointment.appointment_code.toLocaleLowerCase("vi").includes(normalizedSearch)
      || Boolean(appointment.medical_visits[0]?.visit_code.toLocaleLowerCase("vi").includes(normalizedSearch));
    return matchesFilter && matchesSearch;
  });
  // Phòng khám: ai chờ lâu hơn đứng trước.
  if (isExaminationRoom) {
    visiblePatients.sort((a, b) => (examProgress.get(a.id)?.waitingSince ?? "").localeCompare(examProgress.get(b.id)?.waitingSince ?? ""));
  }

  const waitingCount = patients.filter((appointment) => getQueueStatus(appointment) === "WAITING").length;
  const inProgressCount = patients.filter((appointment) => getQueueStatus(appointment) === "IN_PROGRESS").length;

  // Cột "Hành trình khám" + "Kết quả đã thực hiện": ẩn ở phòng tiếp nhận, các phòng khám tầng 2 và các phòng chức năng.
  const showJourneyPanel = !isReceptionRoom && !isExaminationRoom && !isDiagnosticRoom && !isLaboratoryRoom && !isPharmacyRoom;

  /** Chọn một lịch trong hàng đợi và chuyển bộ lọc sang tab chứa nó. */
  function focusAppointment(appointmentId: string) {
    // Lịch vừa check-in / vừa chuyển sang hôm nay có thể chưa có trong `patients` (hàng đợi đang tải lại),
    // nên vẫn chọn theo id; hồ sơ sẽ hiện ngay khi hàng đợi cập nhật.
    const appointment = patients.find((item) => item.id === appointmentId);
    setSelectedPatientId(appointmentId);
    setQueueFilter(appointment ? getQueueStatus(appointment) : "WAITING");
    if (isExaminationRoom && appointment) setExamFilter(getExamProgress(appointment).group);
    setSearchTerm("");
  }

  function handlePatientProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    if (submitter?.dataset.action !== "save-patient-profile") return;
    if (!selectedAppointment) return;

    const formData = new FormData(event.currentTarget);
    const nullableText = (name: string) => String(formData.get(name) ?? "").trim() || null;
    const nullableNumber = (name: string) => {
      const value = String(formData.get(name) ?? "").trim();
      return value ? Number(value) : null;
    };

    updatePatientMutation.mutate({
      patientId: selectedAppointment.patient.id,
      payload: {
        full_name: String(formData.get("full_name") ?? "").trim(),
        date_of_birth: nullableText("date_of_birth"),
        gender: nullableText("gender") as Gender | null,
        blood_type: nullableText("blood_type") as BloodType | null,
        identity_number: nullableText("identity_number"),
        address: nullableText("address"),
        height_cm: nullableNumber("height_cm"),
        weight_kg: nullableNumber("weight_kg"),
        email: nullableText("email"),
        phone_number: nullableText("phone_number"),
      },
    });
  }

  return (
    <div className="min-h-screen bg-muted/35">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-xl">
        <div className="flex h-[4.5rem] items-center gap-5 px-4 sm:px-6">
          <SiteLogo />
          <div className="hidden h-8 w-px bg-border lg:block" />
          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><DoorOpen className="size-4" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{roomCode} · {roomName}</p><p className="truncate text-xs text-muted-foreground">{floor} · {roomFunction}</p></div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/doctor" className="hidden rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-muted sm:inline-flex">Đổi phòng</Link>
            <Button variant="ghost" size="icon-lg" className="relative rounded-full" aria-label="Thông báo"><Bell className="size-[1.1rem]" /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-background bg-[var(--brand-coral)]" /></Button>
            <div className="relative ml-1 border-l pl-3">
              <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-left transition hover:bg-muted" aria-expanded={profileOpen}>
                <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">MT</span>
                <span className="hidden md:block"><span className="block text-sm font-semibold leading-tight">BS. Minh Trần</span><span className="block text-xs text-muted-foreground">DR0001</span></span>
                <ChevronDown className={cn("size-4 text-muted-foreground transition", profileOpen && "rotate-180")} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border bg-card p-2 shadow-xl shadow-foreground/5">
                  <div className="border-b px-3 py-2 md:hidden"><p className="text-sm font-semibold">BS. Minh Trần</p><p className="text-xs text-muted-foreground">DR0001</p></div>
                  <button type="button" onClick={() => { setProfileOpen(false); setProfileDialogOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"><UserRoundPen className="size-4 text-muted-foreground" /> Chỉnh sửa thông tin</button>
                  <Link href="/doctor" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted"><DoorOpen className="size-4 text-muted-foreground" /> Đổi phòng làm việc</Link>
                  <Link href="/auth/login" onClick={() => authStorage.removeAccessToken()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"><LogOut className="size-4" /> Đăng xuất</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="scrollbar-hidden max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
            <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><UserRoundPen className="size-5" /></div>
            <DialogTitle className="text-xl font-semibold tracking-tight">Thông tin bác sĩ</DialogTitle>
            <DialogDescription>Kiểm tra và cập nhật hồ sơ cá nhân của bạn.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); setProfileDialogOpen(false); }}>
            <div className="space-y-5 px-5 py-6 sm:px-6">
              <div className="space-y-2"><Label htmlFor="doctor-name">Họ và tên</Label><Input id="doctor-name" name="fullName" defaultValue="Minh Trần" required className="h-11 rounded-xl px-3" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="doctor-code">Mã bác sĩ</Label><Input id="doctor-code" defaultValue="DR0001" disabled className="h-11 rounded-xl px-3" /></div>
                <div className="space-y-2"><Label htmlFor="doctor-gender">Giới tính</Label><select id="doctor-gender" name="gender" defaultValue="MALE" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="doctor-birthday">Ngày sinh</Label><Input id="doctor-birthday" name="dateOfBirth" type="date" defaultValue="1988-06-12" className="h-11 rounded-xl px-3" /></div>
                <div className="space-y-2"><Label htmlFor="doctor-experience">Số năm kinh nghiệm</Label><Input id="doctor-experience" name="yearsOfExperience" type="number" min="0" defaultValue="10" className="h-11 rounded-xl px-3" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="doctor-specialization">Chuyên môn</Label><Input id="doctor-specialization" name="specialization" defaultValue="Nội tổng quát" required className="h-11 rounded-xl px-3" /></div>
              <div className="rounded-2xl bg-muted/60 p-4"><p className="text-xs font-medium text-muted-foreground">Tài khoản đăng nhập</p><p className="mt-1 text-sm font-semibold">doctor@gmail.com</p><p className="mt-1 text-xs text-muted-foreground">Email được quản lý trong thông tin tài khoản.</p></div>
            </div>
            <DialogFooter className="m-0 rounded-none px-5 py-4 sm:px-6">
              <DialogClose render={<Button type="button" variant="outline" className="h-10 rounded-full px-5" />}>Hủy thay đổi</DialogClose>
              <Button type="submit" className="h-10 rounded-full px-6">Lưu thông tin</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={patientProfileOpen} onOpenChange={(open) => { setPatientProfileOpen(open); if (!open) setEditingPatientProfile(false); }}>
        <DialogContent className="h-[calc(100vh-1.5rem)] max-h-[56rem] w-[calc(100vw-1.5rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[1.75rem] border bg-background p-0 shadow-2xl sm:h-[calc(100vh-2.5rem)] sm:w-[calc(100vw-2.5rem)] sm:max-w-7xl">
          {selectedAppointment && (
            <form className="contents" onSubmit={handlePatientProfileSubmit}>
              <DialogHeader className="border-b bg-background px-5 py-5 pr-16 sm:px-7 sm:py-6">
                <div className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm sm:size-14">
                    {getInitials(selectedAppointment.patient.full_name)}
                  </span>
                  <div>
                    <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">Hồ sơ bệnh nhân</DialogTitle>
                    <DialogDescription className="mt-1">Thông tin đầy đủ phục vụ quá trình tiếp nhận và khám bệnh.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="scrollbar-hidden min-h-0 overflow-y-auto bg-muted/25 px-5 py-5 sm:px-8 sm:py-7">
                <div className="mx-auto max-w-[75rem] space-y-5">
                <section className="flex flex-col gap-5 rounded-[1.35rem] border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
                  <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-bold text-primary sm:size-20 sm:text-xl">
                    {getInitials(selectedAppointment.patient.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Bệnh nhân</p>
                    <h3 className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{selectedAppointment.patient.full_name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedAppointment.patient.patient_code}</p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-3 border-t pt-4 text-sm sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0">
                    <div><p className="text-xs text-muted-foreground">Lịch hẹn</p><p className="mt-1 font-semibold">{selectedAppointment.appointment_code}</p></div>
                    <div><p className="text-xs text-muted-foreground">Giờ khám</p><p className="mt-1 font-semibold">{formatAppointmentTime(selectedAppointment.appointment_time)}</p></div>
                    <div className="col-span-2">
                    {getQueueStatus(selectedAppointment) === "IN_PROGRESS" ? <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">Đang khám</Badge> : <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-100">Đang chờ tiếp nhận</Badge>}
                    </div>
                  </div>
                </section>

                {editingPatientProfile ? (
                  <PatientProfileFormFields appointment={selectedAppointment} />
                ) : <>
                <section className="rounded-[1.35rem] border bg-card p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-semibold">Thông tin cá nhân</h4>
                      <p className="mt-1 text-xs text-muted-foreground">Thông tin nhận dạng cơ bản của bệnh nhân.</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ProfileField icon={CalendarDays} label="Ngày sinh" value={formatDateOfBirth(selectedAppointment.patient.date_of_birth)} />
                    <ProfileField icon={VenusAndMars} label="Giới tính" value={formatGender(selectedAppointment.patient.gender)} />
                    <ProfileField icon={Fingerprint} label="Số CCCD" value={selectedAppointment.patient.identity_number || "Chưa cập nhật"} />
                    <ProfileField icon={Droplets} label="Nhóm máu" value={formatBloodType(selectedAppointment.patient.blood_type)} />
                  </div>
                </section>

                <section className="rounded-[1.35rem] border bg-card p-5 shadow-sm sm:p-6">
                  <h4 className="mb-4 text-base font-semibold">Thông tin liên hệ</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ProfileField icon={Phone} label="Số điện thoại" value={selectedAppointment.patient.user.phone_number || "Chưa cập nhật"} />
                    <ProfileField icon={Mail} label="Email" value={selectedAppointment.patient.user.email || "Chưa cập nhật"} />
                    <ProfileField icon={MapPin} label="Địa chỉ" value={selectedAppointment.patient.address || "Chưa cập nhật"} />
                  </div>
                </section>

                <section className="rounded-[1.35rem] border bg-card p-5 shadow-sm sm:p-6">
                  <h4 className="mb-4 text-base font-semibold">Chỉ số sức khỏe</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ProfileField icon={Ruler} label="Chiều cao" value={selectedAppointment.patient.height_cm == null ? "Chưa cập nhật" : `${selectedAppointment.patient.height_cm} cm`} />
                    <ProfileField icon={Weight} label="Cân nặng" value={selectedAppointment.patient.weight_kg == null ? "Chưa cập nhật" : `${selectedAppointment.patient.weight_kg} kg`} />
                  </div>
                </section>
                </>}
                </div>
              </div>

              <DialogFooter className="m-0 rounded-none border-t bg-background px-5 py-4 sm:px-7">
                {editingPatientProfile ? <>
                  <Button type="button" variant="outline" className="h-10 rounded-full px-5" disabled={updatePatientMutation.isPending} onClick={() => setEditingPatientProfile(false)}><X /> Hủy chỉnh sửa</Button>
                  <Button type="submit" data-action="save-patient-profile" className="h-10 rounded-full px-6" disabled={updatePatientMutation.isPending}>{updatePatientMutation.isPending ? <LoaderCircle className="animate-spin" /> : <Check />} Lưu hồ sơ</Button>
                </> : <>
                  <DialogClose render={<Button type="button" variant="outline" className="h-10 rounded-full px-5" />}>Đóng hồ sơ</DialogClose>
                  <button type="button" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/80" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setEditingPatientProfile(true); }}><Pencil className="size-4" /> Chỉnh sửa thông tin</button>
                </>}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex min-h-[calc(100vh-4.5rem)]">
        {/* Sidebar cố định dưới header (không cuộn theo nội dung), thu gọn / mở rộng được và nhớ trạng thái. */}
        <aside className={cn(
          "sticky top-[4.5rem] hidden h-[calc(100vh-4.5rem)] shrink-0 flex-col border-r bg-background transition-[width] duration-200 xl:flex",
          sidebarCollapsed ? "w-[4.25rem]" : "w-56",
        )}>
          <nav className="scrollbar-hidden flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map(({ view, label, icon: Icon, ready }) => {
              const showCount = view === "queue" && patients.length > 0;
              return (
                <button
                  key={view}
                  type="button"
                  disabled={!ready}
                  onClick={() => changeView(view)}
                  aria-current={activeView === view ? "page" : undefined}
                  aria-label={sidebarCollapsed ? label : undefined}
                  title={sidebarCollapsed ? (ready ? label : `${label} (sắp có)`) : undefined}
                  className={cn(
                    "relative flex h-10 w-full items-center gap-3 rounded-xl text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                    sidebarCollapsed ? "justify-center px-0" : "px-3",
                    activeView === view ? "bg-primary/10 text-primary" : "text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!sidebarCollapsed && <>
                    <span className="flex-1 truncate text-left">{label}</span>
                    {showCount && <span className="rounded-full bg-primary px-2 py-0.5 text-[0.65rem] text-primary-foreground">{patients.length}</span>}
                    {!ready && <span className="text-[0.6rem] font-medium text-muted-foreground">Sắp có</span>}
                  </>}
                  {sidebarCollapsed && showCount && <span className="absolute right-3 top-2 size-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </nav>
          <div className="border-t p-3">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              title={sidebarCollapsed ? "Mở rộng thanh bên" : undefined}
              className={cn("flex h-9 w-full items-center gap-3 rounded-xl text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground", sidebarCollapsed ? "justify-center" : "px-3")}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Thu gọn</>}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-6">
          <div className="mx-auto max-w-[1500px]">
            <nav className="scrollbar-hidden -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 xl:hidden">
              {navItems.filter((item) => item.ready).map(({ view, label, icon: Icon }) => (
                <button key={view} type="button" onClick={() => changeView(view)} aria-current={activeView === view ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", activeView === view ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                  <Icon className="size-4" />{label}
                </button>
              ))}
            </nav>
            {activeView === "queue" ? <>
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"><h1 className="text-[0.95rem] font-semibold">Hàng đợi</h1><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{formatDisplayDate(new Date())}</span><span className="hidden h-5 w-px bg-border lg:block" /><p className="text-sm text-muted-foreground">Ca thường theo lịch hẹn và ca cấp cứu đang hoạt động.</p></div>
            </div>
            <AppointmentQueueView defaultTab={isEmergencyRoom || isPreparationRoom ? "emergency" : "regular"} />
            </> : activeView === "visits" ? <>
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"><h1 className="text-[0.95rem] font-semibold">Lượt khám</h1><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{formatDisplayDate(new Date())}</span><span className="hidden h-5 w-px bg-border lg:block" /><p className="text-sm text-muted-foreground">Theo dõi bệnh nhân đang ở phòng nào và đã đi qua những bước nào.</p></div>
            </div>
            <VisitList />
            </> : activeView === "patients" ? <>
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"><h1 className="text-[0.95rem] font-semibold">Tra cứu bệnh nhân</h1><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{formatDisplayDate(new Date())}</span><span className="hidden h-5 w-px bg-border lg:block" /><p className="text-sm text-muted-foreground">Thông tin cơ bản của bệnh nhân, sao chép nhanh mã bệnh nhân.</p></div>
            </div>
            <PatientDirectory />
            </> : activeView === "records" ? <>
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"><h1 className="text-[0.95rem] font-semibold">Tra cứu hồ sơ</h1><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{formatDisplayDate(new Date())}</span><span className="hidden h-5 w-px bg-border lg:block" /><p className="text-sm text-muted-foreground">Toàn bộ lượt khám và ca cấp cứu của bệnh viện: đang điều trị hay đã xong, ra viện.</p></div>
            </div>
            <RecordList />
            </> : activeView === "prices" ? <>
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"><h1 className="text-[0.95rem] font-semibold">Bảng giá</h1><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{formatDisplayDate(new Date())}</span><span className="hidden h-5 w-px bg-border lg:block" /><p className="text-sm text-muted-foreground">Giá dịch vụ và giá thuốc đang áp dụng tại bệnh viện.</p></div>
            </div>
            <PriceListView />
            </> : activeView === "history" ? <>
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"><h1 className="text-[0.95rem] font-semibold">Lịch sử</h1><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{formatDisplayDate(new Date())}</span><span className="hidden h-5 w-px bg-border lg:block" /><p className="text-sm text-muted-foreground">Các phòng trong bệnh viện và hoạt động đã xử lý tại từng phòng.</p></div>
            </div>
            <RoomHistoryList currentRoomCode={roomCode} />
            </> : <>
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"><h1 className="text-[0.95rem] font-semibold">{isEmergencyRoom ? "Trung tâm điều phối cấp cứu" : isPreparationRoom ? "Chuẩn bị phẫu thuật khẩn" : isSurgeryRoom ? "Phòng phẫu thuật" : isPostoperativeRoom ? (roomCode === "REC-504" ? "Phòng hồi tỉnh" : "Hồi sức tích cực") : isObservationRoom ? "Phòng theo dõi" : isInpatientRoom ? "Phòng điều trị nội trú" : isNursingStation ? "Trung tâm điều phối điều dưỡng" : isIsolationRoom ? "Phòng cách ly" : isCashierRoom ? "Quầy thu ngân" : "Khu vực làm việc"}</h1><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{formatDisplayDate(new Date())}</span><span className="hidden h-5 w-px bg-border lg:block" /><p className="text-sm text-muted-foreground">{isEmergencyRoom ? `${roomCode} · ${roomName} · Ưu tiên xử trí theo mức độ nguy hiểm` : isPreparationRoom ? `${roomCode} · Thực hiện chỉ định tại chỗ và điều phối phẫu thuật` : isSurgeryRoom ? `${roomCode} · Nhận ca được điều phối từ PRE-503` : isPostoperativeRoom ? `${roomCode} · Tiếp nhận và theo dõi bệnh nhân sau bàn giao` : isObservationRoom ? "OBS-403 · Theo dõi diễn biến và quyết định hướng điều trị tiếp theo" : isInpatientRoom ? `${roomCode} · Điều trị, theo dõi và lập kế hoạch ra viện` : isNursingStation ? "NUR-405 · Điều phối chăm sóc và bàn giao ca trực toàn tầng 4" : isIsolationRoom ? "ISO-404 · Tiếp nhận, theo dõi và quản lý rời phòng cách ly" : isCashierRoom ? "CAS-103 · Thu viện phí trước khi bệnh nhân nhận thuốc hoặc ra về" : "Quản lý hàng đợi và xử lý lượt khám tại phòng hiện tại."}</p></div>
              {isReceptionRoom && <div className="flex shrink-0 gap-2"><TodayScheduleSheet selectableIds={patients.map((appointment) => appointment.id)} onSelectAppointment={focusAppointment} /><PatientIntakeDialog appointments={patients} onSelectAppointment={focusAppointment} /></div>}
            </div>

            {isEmergencyRoom ? <EmergencyWorkspace /> : isPreparationRoom ? <PreparationWorkspace /> : isSurgeryRoom ? <SurgeryWorkspace roomCode={roomCode as "OR-501" | "OR-502"} roomName={roomName} /> : isPostoperativeRoom ? <PostoperativeWorkspace roomCode={roomCode as "REC-504" | "ICU-505"} roomName={roomName} /> : isObservationRoom || isInpatientRoom ? <ObservationWorkspace roomCode={roomCode as "IP-401" | "IP-402" | "OBS-403"} roomName={roomName} /> : isNursingStation ? <NursingStationWorkspace /> : isIsolationRoom ? <IsolationWorkspace /> : isCashierRoom ? <CashierWorkspace /> : <>{isPharmacyRoom && <EmergencyPharmacyWorkspace />}
            {isReceptionRoom && <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label={getWaitingLabel({ isExaminationRoom, isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom })} value={String(waitingCount).padStart(2, "0")} detail="Bệnh nhân" icon={UsersRound} color="bg-amber-100 text-amber-700" />
              <Metric label="Đang thực hiện" value={String(inProgressCount).padStart(2, "0")} detail="Lượt khám" icon={Activity} color="bg-primary/10 text-primary" />
              <Metric label="Đã hoàn thành" value="00" detail="Hôm nay" icon={Check} color="bg-emerald-100 text-emerald-700" />
              <Metric label="Thời gian trung bình" value="--" detail="Chưa có dữ liệu" icon={Clock3} color="bg-sky-100 text-sky-700" />
            </section>}

            <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
                <div className="border-b p-4"><div className="flex items-center justify-between gap-2"><div><h2 className="font-semibold">{isExaminationRoom ? `Bệnh nhân tại ${roomCode}` : getQueueTitle({ isExaminationRoom, isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom })}</h2><p className="mt-0.5 text-xs text-muted-foreground">{patients.length} {isExaminationRoom ? "lượt khám đang phụ trách" : usesAssignedQueue ? `lượt tại ${roomCode}` : "lượt khám hôm nay"}</p></div></div><div className="relative mt-3"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm tên hoặc mã bệnh nhân" className="h-10 rounded-xl pl-9" /></div>{isExaminationRoom ? <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">{examCounts.map((group) => <button key={group.value} type="button" onClick={() => setExamFilter(group.value)} className={cn("flex flex-col items-center rounded-lg px-1 py-1.5 text-[0.7rem] font-medium leading-tight transition", activeExamFilter === group.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}><span>{group.label}</span><span className={cn("mt-0.5 text-xs font-semibold tabular-nums", activeExamFilter === group.value && "text-primary")}>{group.count}</span></button>)}</div> : <div className="mt-3 flex gap-1 rounded-xl bg-muted p-1">{([['WAITING',getWaitingLabel({ isExaminationRoom, isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom })],['IN_PROGRESS',getInProgressLabel({ isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom })]] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setQueueFilter(value)} className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition", queueFilter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{label}</button>)}</div>}</div>
                <div className="max-h-[38rem] space-y-1 overflow-y-auto p-2 scrollbar-hidden">
                  {queueQuery.isLoading && <QueueMessage message="Đang tải hàng đợi..." />}
                  {queueQuery.isError && <QueueMessage message="Không thể tải hàng đợi. Vui lòng thử lại." />}
                  {!queueQuery.isLoading && !queueQuery.isError && visiblePatients.length === 0 && <QueueMessage message={isExaminationRoom && patients.length > 0 && !normalizedSearch ? `Không có bệnh nhân ở nhóm “${examGroups.find((group) => group.value === activeExamFilter)?.label}”.` : patients.length === 0 ? (usesAssignedQueue ? `Chưa có bệnh nhân được phân công đến ${roomCode}.` : "Chưa có lịch hẹn nào hôm nay.") : "Không tìm thấy bệnh nhân phù hợp."} />}
                  {visiblePatients.map((appointment) => {
                    const active = appointment.id === selectedAppointment?.id;
                    const progress = examProgress.get(appointment.id);
                    if (isLaboratoryRoom || isDiagnosticRoom || isPharmacyRoom) return <FunctionalQueueCard key={appointment.id} appointment={appointment} roomCode={roomCode} now={now} active={active} initials={getInitials(appointment.patient.full_name)} waitingLabel={getWaitingLabel({ isLaboratoryRoom, isDiagnosticRoom, isPharmacyRoom })} inProgressLabel={getInProgressLabel({ isLaboratoryRoom, isDiagnosticRoom, isPharmacyRoom })} pharmacy={isPharmacyRoom} onSelect={() => setSelectedPatientId(appointment.id)} />;
                    if (isExaminationRoom && progress) return <ExamQueueCard key={appointment.id} appointment={appointment} progress={progress} now={now} active={active} initials={getInitials(appointment.patient.full_name)} onSelect={() => setSelectedPatientId(appointment.id)} />;
                    const patient = appointment.patient;
                    const inProgress = getQueueStatus(appointment) === "IN_PROGRESS";
                    return <button key={appointment.id} type="button" onClick={() => setSelectedPatientId(appointment.id)} className={cn("w-full rounded-2xl p-3 text-left transition", active ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/70")}><div className="flex items-start gap-3"><span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{getInitials(patient.full_name)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{patient.full_name}</span><span className="text-xs font-medium text-primary">{formatAppointmentTime(appointment.appointment_time)}</span></span><span className="mt-0.5 block text-xs text-muted-foreground">{patient.patient_code} · {getAge(patient.date_of_birth)}</span><span className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{appointment.medical_visits[0]?.reception_record?.visit_reason || appointment.note || "Không có ghi chú"}</span><span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", inProgress ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700")}>{inProgress ? getInProgressLabel({ isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom }) : getWaitingLabel({ isExaminationRoom, isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom })}</span></span></span></div></button>;
                  })}
                </div>
              </section>

              <section className="min-w-0 space-y-5">
                {selectedAppointment ? <>
                <div className="rounded-[1.4rem] border bg-card shadow-sm">
                  <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">{getInitials(selectedAppointment.patient.full_name)}</span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{selectedAppointment.patient.full_name}</h2>{isExaminationRoom && examProgress.get(selectedAppointment.id) ? <Badge className={cn("rounded-full border-0", examGroups.find((group) => group.value === examProgress.get(selectedAppointment.id)?.group)?.badge)}>{examGroups.find((group) => group.value === examProgress.get(selectedAppointment.id)?.group)?.label}</Badge> : getQueueStatus(selectedAppointment) === "IN_PROGRESS" ? <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{getInProgressLabel({ isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom })}</Badge> : <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">{getWaitingLabel({ isExaminationRoom, isDiagnosticRoom, isLaboratoryRoom, isPharmacyRoom })}</Badge>}</div><p className="mt-0.5 text-xs text-muted-foreground">{selectedAppointment.patient.patient_code} · {formatGender(selectedAppointment.patient.gender)} · {getAge(selectedAppointment.patient.date_of_birth)} · Nhóm máu {formatBloodType(selectedAppointment.patient.blood_type)}</p></div>
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4" onClick={() => setPatientProfileOpen(true)}><CircleUserRound /> Hồ sơ đầy đủ</Button>
                  </div>
                  <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0"><Info label="Lý do khám" value={selectedAppointment.medical_visits[0]?.reception_record?.visit_reason || selectedAppointment.note || "Không có ghi chú"} icon={FileHeart} /><Info label={isWalkInEntry(selectedAppointment) ? "Giờ tiếp nhận" : "Giờ hẹn"} value={`${formatAppointmentTime(selectedAppointment.appointment_time)} hôm nay`} icon={Clock3} /><Info label={selectedAppointment.medical_visits[0] ? "Mã lượt khám" : "Mã lịch hẹn"} value={selectedAppointment.medical_visits[0]?.visit_code || selectedAppointment.appointment_code} icon={ClipboardList} /></div>
                </div>

                <div className={cn("grid gap-5", showJourneyPanel && "2xl:grid-cols-[minmax(0,1fr)_19rem]")}>
                  {isExaminationRoom ? <ExaminationWorkspace key={selectedAppointment.id} roomCode={roomCode} roomName={roomName} appointment={selectedAppointment} /> : isElectrocardiogramRoom ? <ElectrocardiogramWorkspace key={`${selectedAppointment.id}-${selectedAppointment.assigned_step?.status ?? ""}`} roomCode={roomCode} roomName={roomName} roomFunction={roomFunction} appointment={selectedAppointment} onStarted={() => setQueueFilter("IN_PROGRESS")} /> : isDiagnosticRoom ? <DiagnosticWorkspace key={`${selectedAppointment.id}-${selectedAppointment.assigned_step?.status ?? ""}`} roomCode={roomCode} roomName={roomName} roomFunction={roomFunction} appointment={selectedAppointment} onStarted={() => setQueueFilter("IN_PROGRESS")} /> : isLaboratoryRoom ? <LaboratoryWorkspace key={`${selectedAppointment.id}-${selectedAppointment.assigned_step?.status ?? ""}`} roomCode={roomCode} roomName={roomName} roomFunction={roomFunction} appointment={selectedAppointment} onStarted={() => setQueueFilter("IN_PROGRESS")} /> : isReceptionRoom ? <ReceptionWorkspace key={`${selectedAppointment.id}-${selectedAppointment.checked_in_at ?? ""}`} appointment={selectedAppointment} onStarted={() => setQueueFilter("IN_PROGRESS")} onEditPatientProfile={() => { setEditingPatientProfile(true); setPatientProfileOpen(true); }} /> : isPharmacyRoom ? <PharmacyWorkspace key={`${selectedAppointment.id}-${selectedAppointment.assigned_step?.status ?? ""}`} roomCode={roomCode} roomName={roomName} appointment={selectedAppointment} onStarted={() => setQueueFilter("IN_PROGRESS")} /> : <div className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Thao tác hiện tại</p><h2 className="mt-1 text-lg font-semibold">Ghi nhận kết quả tại phòng</h2></div><Stethoscope className="size-5 text-primary" /></div>
                    <div className="mt-5 rounded-2xl bg-muted/60 p-4"><p className="text-xs font-medium text-muted-foreground">Phòng đang xử lý</p><p className="mt-1 text-sm font-semibold">{roomCode} — {roomName}</p><p className="mt-1 text-xs text-muted-foreground">Chức năng: {roomFunction}</p></div>
                    <label className="mt-5 block text-sm font-medium" htmlFor="clinical-result">Kết quả / ghi chú lâm sàng</label>
                    <Textarea id="clinical-result" rows={7} placeholder="Nhập kết quả đánh giá của bác sĩ tại phòng này..." className="mt-2 min-h-40 resize-none rounded-xl p-3" />
                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" className="h-10 rounded-full px-5">Lưu tạm</Button><Button className="h-10 rounded-full px-5"><Check /> Hoàn thành bước khám</Button><Button variant="secondary" className="h-10 rounded-full px-5"><Send /> Chuyển phòng</Button></div>
                  </div>}

                  {showJourneyPanel && <div className="space-y-5">
                    <div className="rounded-[1.4rem] border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Hành trình khám</h2><ChevronRight className="size-4 text-muted-foreground" /></div><div className="mt-5 space-y-0"><JourneyStep label="Tiếp nhận" room="REC-101" done /><JourneyStep label={roomFunction} room={roomCode} current /><JourneyStep label="Chờ chỉ định" room="Chưa xác định" /></div></div>
                    <ClinicalResultsPanel appointment={selectedAppointment} />
                  </div>}
                </div>
                </> : <div className="grid min-h-72 place-items-center rounded-[1.4rem] border bg-card p-8 text-center shadow-sm"><div><UsersRound className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Chưa có bệnh nhân được chọn</h2><p className="mt-1 text-sm text-muted-foreground">Hàng đợi hôm nay hiện đang trống.</p>{isReceptionRoom && <div className="mt-5 flex flex-wrap justify-center gap-2"><PatientIntakeDialog appointments={patients} onSelectAppointment={focusAppointment} defaultTab="CODE" trigger={<Button variant="outline" className="h-10 rounded-full px-4"><CalendarCheck /> Nhập mã lịch hẹn</Button>} /><PatientIntakeDialog appointments={patients} onSelectAppointment={focusAppointment} defaultTab="WALK_IN" trigger={<Button className="h-10 rounded-full px-4"><UserPlus /> Bệnh nhân không đặt lịch</Button>} /></div>}</div></div>}
              </section>
            </div>
            </>}
            </>}
          </div>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, color }: { label: string; value: string; detail: string; icon: typeof UsersRound; color: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm"><span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", color)}><Icon className="size-[1.1rem]" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-xl font-semibold leading-none">{value} <span className="text-xs font-normal text-muted-foreground">{detail}</span></p></div></div>;
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FileHeart }) {
  return <div className="flex min-w-0 gap-2.5 px-5 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-sm font-medium" title={value}>{value}</p></div></div>;
}

function ProfileField({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FileHeart }) {
  return <div className="flex min-h-20 gap-3 rounded-2xl bg-muted/55 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div></div>;
}

function PatientProfileFormFields({ appointment }: { appointment: ReceptionQueueAppointment }) {
  const patient = appointment.patient;
  return <div className="space-y-5">
    <section className="rounded-[1.35rem] border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5"><h4 className="text-base font-semibold">Thông tin cá nhân</h4><p className="mt-1 text-xs text-muted-foreground">Bổ sung hoặc chỉnh sửa thông tin nhận dạng của bệnh nhân.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Họ và tên" className="sm:col-span-2"><Input name="full_name" defaultValue={patient.full_name} required minLength={2} className="h-11 rounded-xl" /></FormField>
        <FormField label="Ngày sinh"><Input name="date_of_birth" type="date" defaultValue={patient.date_of_birth?.slice(0, 10) ?? ""} className="h-11 rounded-xl" /></FormField>
        <FormField label="Giới tính"><select name="gender" defaultValue={patient.gender ?? ""} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"><option value="">Chưa cập nhật</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></FormField>
        <FormField label="Số CCCD"><Input name="identity_number" defaultValue={patient.identity_number ?? ""} maxLength={30} className="h-11 rounded-xl" /></FormField>
        <FormField label="Nhóm máu"><select name="blood_type" defaultValue={patient.blood_type ?? ""} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"><option value="">Chưa cập nhật</option>{(["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as BloodType[]).map((type) => <option key={type} value={type}>{formatBloodType(type)}</option>)}</select></FormField>
        <FormField label="Chiều cao (cm)"><Input name="height_cm" type="number" min="1" max="300" step="0.1" defaultValue={patient.height_cm ?? ""} className="h-11 rounded-xl" /></FormField>
        <FormField label="Cân nặng (kg)"><Input name="weight_kg" type="number" min="1" max="500" step="0.1" defaultValue={patient.weight_kg ?? ""} className="h-11 rounded-xl" /></FormField>
      </div>
    </section>

    <section className="rounded-[1.35rem] border bg-card p-5 shadow-sm sm:p-6">
      <h4 className="mb-5 text-base font-semibold">Thông tin liên hệ</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Số điện thoại"><Input name="phone_number" type="tel" defaultValue={patient.user.phone_number ?? ""} maxLength={20} className="h-11 rounded-xl" /></FormField>
        <FormField label="Email"><Input name="email" type="email" defaultValue={patient.user.email ?? ""} maxLength={255} className="h-11 rounded-xl" /></FormField>
        <FormField label="Địa chỉ" className="sm:col-span-2"><Textarea name="address" defaultValue={patient.address ?? ""} maxLength={500} rows={3} className="min-h-24 resize-none rounded-xl" /></FormField>
      </div>
    </section>
  </div>;
}

function FormField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={cn("space-y-2", className)}><Label>{label}</Label>{children}</div>;
}

function JourneyStep({ label, room, done, current }: { label: string; room: string; done?: boolean; current?: boolean }) {
  return <div className="relative flex gap-3 pb-5 last:pb-0"><div className="relative z-10"><span className={cn("grid size-7 place-items-center rounded-full border-2", done && "border-primary bg-primary text-primary-foreground", current && "border-primary bg-background text-primary", !done && !current && "border-border bg-background text-muted-foreground")}>{done ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}</span>{room !== "Chưa xác định" && <span className="absolute left-1/2 top-7 h-5 w-px -translate-x-1/2 bg-border" />}</div><div><p className={cn("text-sm font-medium", current && "text-primary")}>{label}</p><p className="text-xs text-muted-foreground">{room}</p></div></div>;
}

function ClinicalResultsPanel({ appointment }: { appointment: WorkspaceQueueAppointment }) {
  const visit = appointment.medical_visits[0];
  const results = visit?.steps?.filter((step) => step.clinical_result) ?? [];

  return <div className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">Kết quả đã thực hiện</h2>
      <div className="flex items-center gap-2">{results.length > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[0.65rem] font-semibold text-emerald-700">{results.length} kết quả</span>}{visit && <Link href={`/doctor/visits/${visit.id}/results`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition hover:opacity-70">Xem tất cả <ChevronRight className="size-3.5" /></Link>}</div>
    </div>
    {results.length === 0 ? <div className="mt-4 rounded-xl border border-dashed p-4 text-center">
      <FileHeart className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-2 text-xs text-muted-foreground">Chưa có kết quả từ phòng chức năng.</p>
    </div> : <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1 scrollbar-hidden">
      {results.map((step) => <article key={step.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/55 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{step.room.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{step.room.room_code}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[0.65rem] font-semibold text-emerald-700"><Check className="size-3" /> Đã hoàn thành</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-foreground/80">{step.clinical_result!.result}</p>
      </article>)}
    </div>}
  </div>;
}

function QueueMessage({ message }: { message: string }) {
  return <p className="px-3 py-10 text-center text-sm text-muted-foreground">{message}</p>;
}

function getQueueStatus(appointment: WorkspaceQueueAppointment): "WAITING" | "IN_PROGRESS" {
  if (appointment.assigned_step) {
    return appointment.assigned_step.status === "IN_PROGRESS" ? "IN_PROGRESS" : "WAITING";
  }
  return appointment.medical_visits.some((visit) => visit.status === "IN_PROGRESS") ? "IN_PROGRESS" : "WAITING";
}

/** Lượt khám không có lịch hẹn (vãng lai / tiếp nhận tại quầy) dùng một "lịch hẹn" thay thế để hiện trong hàng đợi phòng. */
export function isWalkInEntry(appointment: { id: string }) {
  return appointment.id.startsWith("walk-in-");
}

function normalizeRoomAssignment(assignment: RoomVisitAssignment): WorkspaceQueueAppointment | null {
  const visit = assignment.medical_visit;
  const createdAt = visit.created_at ?? assignment.visit_step.created_at;
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(createdAt));
  const appointment = visit.appointment ?? {
    id: `walk-in-${visit.id}`,
    appointment_code: visit.visit_code,
    patient_id: visit.patient.id,
    doctor_id: null,
    appointment_date: createdAt,
    appointment_time: `1970-01-01T${clock}:00.000Z`,
    note: null,
    status: "BOOKED" as const,
    checked_in_at: createdAt,
    created_at: createdAt,
    updated_at: createdAt,
    doctor: null,
  };

  return {
    ...appointment,
    patient: assignment.medical_visit.patient,
    medical_visits: [{
      id: assignment.medical_visit.id,
      visit_code: assignment.medical_visit.visit_code,
      status: assignment.medical_visit.status,
      receiving_room: assignment.medical_visit.receiving_room,
      reception_record: assignment.medical_visit.reception_record,
      examination_record: assignment.medical_visit.examination_record,
      prescription: assignment.medical_visit.prescription,
      invoice: assignment.medical_visit.invoice ?? null,
      steps: assignment.medical_visit.steps,
    }],
    assigned_step: assignment.visit_step,
  };
}

function getQueueTitle(context: QueueContext) {
  if (context.isExaminationRoom) return "Bệnh nhân được phân công";
  if (context.isDiagnosticRoom) return "Bệnh nhân chờ";
  if (context.isLaboratoryRoom) return "Bệnh nhân chờ xét nghiệm";
  if (context.isPharmacyRoom) return "Bệnh nhân chờ nhận thuốc";
  return "Hàng đợi bệnh nhân";
}

function getWaitingLabel(context: QueueContext) {
  if (context.isExaminationRoom) return "Chờ khám";
  if (context.isDiagnosticRoom) return "Chờ";
  if (context.isLaboratoryRoom) return "Chờ xét nghiệm";
  if (context.isPharmacyRoom) return "Chờ nhận thuốc";
  return "Đang chờ";
}

function getInProgressLabel(context: QueueContext) {
  if (context.isDiagnosticRoom) return "Đang chẩn đoán";
  if (context.isLaboratoryRoom) return "Đang xét nghiệm";
  if (context.isPharmacyRoom) return "Đang cấp thuốc";
  return "Đang khám";
}

function formatLocalDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function formatAppointmentTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : date.toISOString().slice(11, 16);
}

function formatDateOfBirth(value: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa cập nhật"
    : new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" }).format(date);
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((word) => word[0]?.toLocaleUpperCase("vi") ?? "").join("");
}

function getAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return "Chưa rõ tuổi";
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return "Chưa rõ tuổi";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getUTCFullYear();
  const hasNotHadBirthday = today.getMonth() < birthDate.getUTCMonth()
    || (today.getMonth() === birthDate.getUTCMonth() && today.getDate() < birthDate.getUTCDate());
  if (hasNotHadBirthday) age -= 1;
  return `${age} tuổi`;
}

function formatGender(gender: Gender | null) {
  if (gender === "MALE") return "Nam";
  if (gender === "FEMALE") return "Nữ";
  if (gender === "OTHER") return "Khác";
  return "Chưa cập nhật giới tính";
}

function formatBloodType(bloodType: BloodType | null) {
  const labels: Record<BloodType, string> = {
    A_POSITIVE: "A+",
    A_NEGATIVE: "A-",
    B_POSITIVE: "B+",
    B_NEGATIVE: "B-",
    AB_POSITIVE: "AB+",
    AB_NEGATIVE: "AB-",
    O_POSITIVE: "O+",
    O_NEGATIVE: "O-",
  };
  return bloodType ? labels[bloodType] : "Chưa cập nhật";
}

/* Trạng thái thu gọn sidebar, lưu ở localStorage (chỉ là tiện ích theo từng trình duyệt). */
const SIDEBAR_STORAGE_KEY = "doctor-workspace:sidebar-collapsed";
const sidebarListeners = new Set<() => void>();
/** Giá trị dự phòng khi trình duyệt chặn localStorage (chỉ giữ trong phiên hiện tại). */
let fallbackCollapsed = false;

function readSidebarCollapsed() {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === null ? fallbackCollapsed : stored === "1";
  } catch {
    return fallbackCollapsed;
  }
}

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => { sidebarListeners.delete(listener); };
}

function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);
  function toggle() {
    fallbackCollapsed = !collapsed;
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, fallbackCollapsed ? "1" : "0");
    } catch {
      // Trình duyệt chặn localStorage: vẫn đổi được trong phiên hiện tại nhờ fallbackCollapsed.
    }
    sidebarListeners.forEach((listener) => listener());
  }
  return [collapsed, toggle] as const;
}
