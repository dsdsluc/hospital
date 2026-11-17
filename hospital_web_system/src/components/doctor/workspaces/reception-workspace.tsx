"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarCheck,
  Check,
  CircleCheck,
  ClipboardPlus,
  Clock3,
  DoorOpen,
  FileCheck2,
  FileText,
  HeartPulse,
  IdCard,
  MapPin,
  Pencil,
  Phone,
  Stethoscope,
  UserRoundCheck,
  VenusAndMars,
  LoaderCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BloodType, Gender, ReceptionQueueAppointment } from "@/types/api";
import { appointmentService } from "@/services/appointment.service";
import { medicalVisitService } from "@/services/medical-visit.service";
import { getApiErrorMessage } from "@/lib/api-client";
import { IsolationReferralPanel } from "@/components/doctor/workspaces/isolation-referral-panel";
import {
  ReceptionMeasureDialog,
  examinationRooms,
  flagStyle,
  getBmi,
  getVitalFlag,
  vitalFields,
  type ReceptionDraft,
} from "@/components/doctor/workspaces/reception-measure-dialog";

export function ReceptionWorkspace({ appointment, onEditPatientProfile, onStarted }: { appointment: ReceptionQueueAppointment; onEditPatientProfile: () => void; onStarted: () => void }) {
  const patient = appointment.patient;
  const activeVisit = appointment.medical_visits[0];
  const receptionRecord = activeVisit?.reception_record;
  const appointmentConfirmed = Boolean(activeVisit) || Boolean(appointment.checked_in_at);
  const [draft, setDraft] = useState<ReceptionDraft>({
    temperature: receptionRecord?.temperature_c?.toString() ?? "",
    bloodPressure: receptionRecord?.systolic_blood_pressure && receptionRecord.diastolic_blood_pressure ? `${receptionRecord.systolic_blood_pressure}/${receptionRecord.diastolic_blood_pressure}` : "",
    heartRate: receptionRecord?.heart_rate?.toString() ?? "",
    spo2: receptionRecord?.spo2?.toString() ?? "",
    height: receptionRecord?.height_cm?.toString() ?? patient.height_cm?.toString() ?? "",
    weight: receptionRecord?.weight_kg?.toString() ?? patient.weight_kg?.toString() ?? "",
    visitReason: receptionRecord?.visit_reason ?? appointment.note ?? "",
    receptionNote: receptionRecord?.reception_note ?? "",
    room: activeVisit?.receiving_room.room_code,
  });
  const queryClient = useQueryClient();

  const checkInMutation = useMutation({
    mutationFn: () => appointmentService.checkIn(appointment.id),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reception-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["appointment-schedule"] }),
      ]);
      toast.success(result.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận bệnh nhân đã đến.")),
  });

  const startVisitMutation = useMutation({
    mutationFn: medicalVisitService.start,
    onSuccess: (medicalVisit) => {
      void queryClient.invalidateQueries({ queryKey: ["reception-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["appointment-schedule"] });
      onStarted();
      toast.success(`Đã bắt đầu lượt khám ${medicalVisit.visit_code}.`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể bắt đầu lượt khám.")),
  });

  function optionalNumber(value: string) {
    return value.trim() ? Number(value.replace(",", ".")) : null;
  }

  function startVisit(data: ReceptionDraft) {
    if (!data.room) return;
    const pressureParts = data.bloodPressure.trim().split("/").map((part) => part.trim());
    startVisitMutation.mutate({
      appointment_id: appointment.id,
      receiving_room_code: data.room,
      temperature_c: optionalNumber(data.temperature),
      systolic_blood_pressure: data.bloodPressure.trim() ? Number(pressureParts[0]) : null,
      diastolic_blood_pressure: data.bloodPressure.trim() ? Number(pressureParts[1]) : null,
      heart_rate: optionalNumber(data.heartRate),
      spo2: optionalNumber(data.spo2),
      height_cm: optionalNumber(data.height),
      weight_kg: optionalNumber(data.weight),
      visit_reason: data.visitReason.trim() || null,
      reception_note: data.receptionNote.trim() || null,
    });
  }

  const selectedRoom = examinationRooms.find((room) => room.code === draft.room);
  const filledVitals = vitalFields.filter((field) => draft[field.key].trim());
  const bmi = getBmi(draft.height, draft.weight);
  const hasRecorded = filledVitals.length > 0 || Boolean(draft.room);

  return (
    <div className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserRoundCheck className="size-4" /></span>
        <h2 className="text-[0.95rem] font-semibold">Tiếp nhận lượt khám</h2>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">REC-101 · Xác nhận bệnh nhân và khởi tạo hành trình khám</p>
        <Badge className={cn("w-fit rounded-full border-0 px-3 py-1", appointmentConfirmed ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100")}>{appointmentConfirmed ? "Đã xác nhận" : "Chờ xác nhận"}</Badge>
      </div>

      <div className="space-y-6 p-5">
        {/* 1. Lịch hẹn */}
        <section>
          <SectionTitle index={1} title="Kiểm tra lịch hẹn" description="Đối chiếu lịch bệnh nhân đã đặt trước khi đến bệnh viện." />
          <div className={cn("rounded-2xl border p-4 transition", appointmentConfirmed ? "border-emerald-200 bg-emerald-50/50" : "border-primary/15 bg-primary/[0.035]")}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", appointmentConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary")}><CalendarCheck className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Lịch hẹn <span className="tracking-wide">{appointment.appointment_code}</span></p>
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" /> {formatAppointmentTime(appointment.appointment_time)}, {formatAppointmentDate(appointment.appointment_date)}</span>
                  {appointment.checked_in_at && <span className="flex items-center gap-1.5"><UserRoundCheck className="size-3.5" /> Đến quầy lúc {formatDateTime(appointment.checked_in_at)}</span>}
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-sm"><FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> {appointment.note || "Không có ghi chú từ bệnh nhân."}</p>
              </div>
              <Button onClick={() => checkInMutation.mutate()} disabled={appointmentConfirmed || checkInMutation.isPending} className="rounded-full px-5">
                {checkInMutation.isPending ? <><LoaderCircle className="animate-spin" /> Đang xác nhận...</> : appointmentConfirmed ? <><CircleCheck /> Đã xác nhận</> : <><Check /> Xác nhận đã đến</>}
              </Button>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* 2. Thông tin bệnh nhân */}
        <section>
          <SectionTitle index={2} title="Kiểm tra thông tin bệnh nhân" description="Các thông tin cần thiết trước khi tạo lượt khám." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PatientInfo icon={IdCard} label="Mã bệnh nhân" value={patient.patient_code ?? "Vãng lai (không có mã)"} />
            <PatientInfo icon={Phone} label="Số điện thoại" value={patient.user.phone_number || "Chưa cập nhật"} />
            <PatientInfo icon={VenusAndMars} label="Giới tính · Tuổi" value={`${formatGender(patient.gender)} · ${getAge(patient.date_of_birth)}`} />
            <PatientInfo icon={HeartPulse} label="Nhóm máu" value={formatBloodType(patient.blood_type)} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/55 px-4 py-3"><span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-4 shrink-0 text-primary" /><span className="truncate">{patient.address || "Chưa cập nhật địa chỉ"}</span></span><button type="button" onClick={onEditPatientProfile} className="shrink-0 text-xs font-semibold text-primary hover:underline">Chỉnh sửa hồ sơ</button></div>
        </section>

        <div className="h-px bg-border" />

        {/* 3. Ghi nhận ban đầu & phòng tiếp nhận (nhập trong dialog) */}
        <section>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <SectionTitle index={3} title="Ghi nhận ban đầu & chuyển phòng" description="Đo sinh hiệu, ghi lý do khám và chọn phòng bác sĩ trong cửa sổ riêng." className="mb-0" />
            <ReceptionMeasureDialog
              value={draft}
              onSave={setDraft}
              onSaveAndStart={(next) => { setDraft(next); startVisit(next); }}
              canStart={appointmentConfirmed}
              isStarting={startVisitMutation.isPending}
              readOnly={Boolean(activeVisit)}
              trigger={<Button variant={hasRecorded ? "outline" : "default"} className="rounded-full px-4">{activeVisit ? <><FileText /> Xem ghi nhận</> : hasRecorded ? <><Pencil /> Chỉnh sửa</> : <><Stethoscope /> Đo & ghi nhận</>}</Button>}
            />
          </div>

          {!hasRecorded ? (
            <div className="rounded-2xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">
              Chưa ghi nhận sinh hiệu và phòng tiếp nhận. Bấm <span className="font-medium text-foreground">“Đo & ghi nhận”</span> để bắt đầu.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="rounded-2xl border p-4">
                <p className="text-xs font-medium text-muted-foreground">Sinh hiệu</p>
                {filledVitals.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Chưa đo chỉ số nào.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {filledVitals.map((field) => {
                      const flag = getVitalFlag(field.key, draft[field.key]);
                      return (
                        <span key={field.key} className={cn("inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1.5 text-xs", flag && flag !== "NORMAL" ? flagStyle[flag].className : "bg-muted/70")}>
                          <span className="text-muted-foreground">{field.label}</span>
                          <span className="font-semibold tabular-nums text-foreground">{draft[field.key]}</span>
                          <span className="text-muted-foreground">{field.unit}</span>
                        </span>
                      );
                    })}
                    {bmi && <span className="inline-flex items-baseline gap-1 rounded-lg bg-muted/70 px-2.5 py-1.5 text-xs"><span className="text-muted-foreground">BMI</span><span className="font-semibold tabular-nums">{bmi.value}</span></span>}
                  </div>
                )}
                {draft.visitReason.trim() && <p className="mt-3 border-t pt-3 text-sm"><span className="text-xs text-muted-foreground">Lý do khám: </span>{draft.visitReason}</p>}
              </div>
              <div className={cn("rounded-2xl border p-4", selectedRoom && "border-primary/25 bg-primary/[0.035]")}>
                <p className="text-xs font-medium text-muted-foreground">Phòng bác sĩ tiếp nhận</p>
                {selectedRoom ? (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><DoorOpen className="size-4" /></span>
                    <span className="min-w-0"><span className="block text-[0.7rem] font-semibold tracking-wide text-primary">{selectedRoom.code}</span><span className="block truncate text-sm font-semibold">{selectedRoom.name}</span></span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Chưa chọn phòng.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-3 border-t bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileCheck2 className="size-4 shrink-0 text-primary" /> {!appointmentConfirmed ? "Xác nhận bệnh nhân đã đến để tiếp tục." : draft.room ? `Lượt khám sẽ dùng ${draft.room} làm phòng tiếp nhận chính.` : "Chọn phòng bác sĩ ở mục 3 để bắt đầu lượt khám."}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
        {activeVisit && <IsolationReferralPanel variant="compact" sourceRoom="REC-101" medicalVisitId={activeVisit.id} defaultDiagnosis={activeVisit.reception_record?.visit_reason} />}
        <Button type="button" onClick={() => startVisit(draft)} disabled={Boolean(activeVisit) || !appointmentConfirmed || !draft.room || startVisitMutation.isPending} className="h-10 rounded-full px-6">{startVisitMutation.isPending ? <LoaderCircle className="animate-spin" /> : activeVisit ? <CircleCheck /> : <ClipboardPlus />} {startVisitMutation.isPending ? "Đang tạo lượt khám..." : activeVisit ? `Đang khám · ${activeVisit.visit_code}` : "Bắt đầu lượt khám"}</Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ index, title, description, className }: { index: number; title: string; description: string; className?: string }) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1", className)}>
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.7rem] font-bold text-primary">{index}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="hidden h-4 w-px bg-border sm:block" />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function PatientInfo({ icon: Icon, label, value }: { icon: typeof IdCard; label: string; value: string }) {
  return <div className="rounded-xl bg-muted/55 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5 text-primary" /> {label}</div><p className="mt-2 text-sm font-semibold">{value}</p></div>;
}

function formatAppointmentTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : date.toISOString().slice(11, 16);
}

function formatAppointmentDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--/--/----" : new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
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
  return "Chưa cập nhật";
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
