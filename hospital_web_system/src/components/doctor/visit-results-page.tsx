"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { ArrowLeft, Check, FileHeart, FlaskConical, HeartPulse, LoaderCircle, Pill, Route, Stethoscope, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { medicalVisitService, type MedicalVisitSummary } from "@/services/medical-visit.service";
import type { BloodType } from "@/types/api";
import { Detail, DetailList, Vital, VitalStrip, bloodPressureFlag, rangeFlag, spo2Flag } from "@/components/doctor/detail-ui";
import { CopyCode, formatGender, getAge } from "@/components/doctor/queue/queue-ui";

/** Trang chi tiết một lượt khám — cùng bố cục với trang "Chi tiết ca cấp cứu". */
export function VisitResultsPage({ visitId, backHref }: { visitId: string; backHref?: string }) {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["medical-visit-summary", visitId],
    queryFn: () => medicalVisitService.getSummary(visitId),
    retry: (count, error) => !(isAxiosError(error) && error.response?.status && error.response.status < 500) && count < 2,
  });
  const back = backHref
    ? <Button render={<Link href={backHref} />} variant="outline" size="icon" className="mt-0.5 shrink-0 rounded-full" aria-label="Quay lại"><ArrowLeft /></Button>
    : <Button type="button" variant="outline" size="icon" className="mt-0.5 shrink-0 rounded-full" aria-label="Quay lại" onClick={() => router.back()}><ArrowLeft /></Button>;

  if (query.isPending) return <State icon={<LoaderCircle className="animate-spin" />} text="Đang tải chi tiết lượt khám..." />;
  if (query.isError || !query.data) {
    const message = isAxiosError(query.error) && query.error.response?.status === 404 ? "Không tìm thấy lượt khám." : "Không thể tải chi tiết lượt khám.";
    return <State icon={<FileHeart />} text={message} action={backHref ? () => router.push(backHref) : () => router.back()} />;
  }

  const visit = query.data;
  const patient = visit.patient;
  const reception = visit.reception_record;
  const completed = visit.status === "COMPLETED";

  return (
    <main className="min-h-screen bg-muted/35 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 rounded-[1.6rem] border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-4">
            {back}
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Stethoscope className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Chi tiết lượt khám</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Bắt đầu lúc {formatDateTime(visit.created_at)} · {visit.receiving_room.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <CopyCode code={visit.visit_code} label="mã lượt khám" />
            {visit.appointment && <CopyCode code={visit.appointment.appointment_code} label="mã lịch hẹn" />}
            <span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", completed ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700")}>{completed ? "Đã khám xong" : "Đang khám"}</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Thông tin bệnh nhân" icon={<UserRound />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Họ và tên" value={patient.full_name} />
              <Info label="Mã bệnh nhân" value={patient.patient_code} />
              <Info label="Giới tính · Tuổi" value={`${formatGender(patient.gender)} · ${getAge(patient.date_of_birth)}`} />
              <Info label="Ngày sinh" value={patient.date_of_birth ? formatDay(patient.date_of_birth) : null} />
              <Info label="Nhóm máu" value={formatBloodType(patient.blood_type)} />
              <Info label="Số CCCD" value={patient.identity_number} />
              <Info label="Số điện thoại" value={patient.user.phone_number} />
              <Info label="Email" value={patient.user.email} />
            </div>
          </Card>
          <Card title="Tiếp nhận" icon={<Route />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Phòng tiếp nhận" value={`${visit.receiving_room.room_code} · ${visit.receiving_room.name}`} />
              <Info label="Lịch hẹn" value={visit.appointment ? `${visit.appointment.appointment_code} · ${formatDay(visit.appointment.appointment_date)} ${visit.appointment.appointment_time.slice(11, 16)}` : "Không đặt lịch"} />
              <Info label="Bắt đầu lượt khám" value={formatDateTime(visit.created_at)} />
              <Info label="Cập nhật gần nhất" value={formatDateTime(visit.updated_at)} />
              <div className="sm:col-span-2"><Info label="Lý do đến khám" value={reception?.visit_reason ?? visit.appointment?.note} /></div>
              <div className="sm:col-span-2"><Info label="Địa chỉ" value={patient.address} /></div>
            </div>
          </Card>
        </section>

        <VisitSummarySections visit={visit} />
      </div>
    </main>
  );
}

/**
 * Các khối kết quả của một lượt khám: chỉ số tiếp nhận, khám bác sĩ, chỉ định cận lâm sàng, đơn thuốc.
 * Dùng ở trang chi tiết lượt khám và trang chi tiết lịch hẹn.
 */
export function VisitSummarySections({ visit }: { visit: MedicalVisitSummary }) {
  const reception = visit.reception_record;
  const examination = visit.examination_record;
  const functionSteps = visit.steps.filter((step) => step.room.room_code !== "REC-101" && step.room.id !== visit.receiving_room.id);

  return <>
    <Card title="Chỉ số tiếp nhận" icon={<HeartPulse />}>
      {!reception ? <Empty text="Chưa có thông tin tiếp nhận." /> : (
        <div className="space-y-5">
          <VitalStrip>
            <Vital label="Nhiệt độ" value={reception.temperature_c} unit="°C" flag={rangeFlag(reception.temperature_c, 36, 37.5)} />
            <Vital label="Huyết áp" value={reception.systolic_blood_pressure != null && reception.diastolic_blood_pressure != null ? `${reception.systolic_blood_pressure}/${reception.diastolic_blood_pressure}` : null} unit="mmHg" flag={bloodPressureFlag(reception.systolic_blood_pressure, reception.diastolic_blood_pressure)} />
            <Vital label="Nhịp tim" value={reception.heart_rate} unit="lần/phút" flag={rangeFlag(reception.heart_rate, 60, 100)} />
            <Vital label="SpO₂" value={reception.spo2} unit="%" flag={spo2Flag(reception.spo2)} />
            <Vital label="Chiều cao" value={reception.height_cm} unit="cm" />
            <Vital label="Cân nặng" value={reception.weight_kg} unit="kg" />
          </VitalStrip>
          <DetailList>
            <Detail label="Lý do đến khám" value={reception.visit_reason} />
            <Detail label="Ghi chú tiếp nhận" value={reception.reception_note} />
          </DetailList>
        </div>
      )}
    </Card>

    <Card title="Khám bác sĩ" icon={<Stethoscope />}>
      {!examination ? <Empty text="Bác sĩ chưa ghi nhận kết quả khám." /> : (
        <DetailList>
          <Detail label="Chẩn đoán sơ bộ" value={examination.preliminary_diagnosis} />
          <Detail label="Đánh giá tiếp theo" value={examination.next_evaluation} />
          <Detail label="Chẩn đoán cuối cùng" value={examination.final_diagnosis} />
          <Detail label="Hướng điều trị" value={examination.treatment_direction} />
          <Detail label="Kết luận" value={examination.conclusion} />
          <Detail label="Lời dặn bác sĩ" value={examination.doctor_advice} />
        </DetailList>
      )}
    </Card>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card title="Chỉ định cận lâm sàng" icon={<FlaskConical />}>
        {functionSteps.length === 0 ? <Empty text="Chưa có chỉ định phòng chức năng." /> : (
          <div className="space-y-3">
            {functionSteps.map((step) => (
              <article key={step.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{step.room.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.room.room_code} · {step.room.floor.name.split(" - ")[0]}{step.completed_at && ` · Hoàn thành ${formatDateTime(step.completed_at)}`}</p>
                  </div>
                  <Status value={step.status} />
                </div>
                {step.instruction && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><span className="font-medium">Chỉ định: </span>{step.instruction}</p>}
                {step.clinical_result
                  ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Kết quả</p><p className="whitespace-pre-wrap text-sm leading-6">{step.clinical_result.result}</p></div>
                  : <p className="mt-3 text-xs text-muted-foreground">Chưa có kết quả.</p>}
              </article>
            ))}
          </div>
        )}
      </Card>
      <Card title="Đơn thuốc" icon={<Pill />}>
        {!visit.prescription || visit.prescription.items.length === 0 ? <Empty text="Chưa có đơn thuốc." /> : (
          <div className="space-y-3">
            {visit.prescription.items.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-2xl border p-4 sm:grid-cols-[1fr_auto]">
                <div><p className="font-semibold">{item.medicine.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.medicine.medicine_code} · {item.dosage || "Chưa ghi liều dùng"} · {item.usage || "Chưa ghi cách dùng"}</p></div>
                <p className="text-sm font-semibold text-primary">{item.quantity} {item.medicine.unit}</p>
              </div>
            ))}
            {visit.prescription.note && <p className="rounded-xl bg-muted p-3 text-sm">Ghi chú: {visit.prescription.note}</p>}
          </div>
        )}
      </Card>
    </section>
  </>;
}

export function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-[1.5rem] border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center gap-2 text-primary">{icon}<h2 className="text-lg font-semibold text-foreground">{title}</h2></div>{children}</section>; }
export function Info({ label, value }: { label: string; value?: string | number | null }) { return <div className="rounded-xl bg-muted/55 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium">{value || "Chưa cập nhật"}</p></div>; }
export function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>; }
export function Status({ value }: { value: string }) { const done = value === "COMPLETED"; const cancelled = value === "CANCELLED"; return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${done ? "bg-emerald-100 text-emerald-700" : cancelled ? "bg-muted text-muted-foreground" : value === "IN_PROGRESS" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{done && <Check className="size-3" />}{done ? "Đã hoàn thành" : cancelled ? "Đã hủy chỉ định" : value === "IN_PROGRESS" ? "Đang thực hiện" : "Đang chờ"}</span>; }
function State({ icon, text, action }: { icon: React.ReactNode; text: string; action?: () => void }) { return <div className="grid min-h-screen place-items-center bg-muted/35"><div className="text-center text-muted-foreground"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-card shadow-sm">{icon}</span><p className="mt-3 text-sm">{text}</p>{action && <Button className="mt-4 rounded-full" onClick={action}>Quay lại</Button>}</div></div>; }

const bloodTypeLabels: Record<BloodType, string> = { A_POSITIVE: "A+", A_NEGATIVE: "A-", B_POSITIVE: "B+", B_NEGATIVE: "B-", AB_POSITIVE: "AB+", AB_NEGATIVE: "AB-", O_POSITIVE: "O+", O_NEGATIVE: "O-" };
function formatBloodType(value: BloodType | null) { return value ? bloodTypeLabels[value] : null; }
function formatDay(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); }
