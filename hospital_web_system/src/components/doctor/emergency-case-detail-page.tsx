"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Activity, ArrowLeft, ClipboardList, FileHeart, FlaskConical, HeartPulse, LoaderCircle, Pill, Route, Siren, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emergencyService, type InterventionType, type PreparationOrderType } from "@/services/emergency.service";
import { Card, Empty, Info, Status } from "@/components/doctor/visit-results-page";
import { Detail, DetailList, RecordedAt, Vital, VitalStrip, bloodPressureFlag, rangeFlag, spo2Flag } from "@/components/doctor/detail-ui";
import { PageState } from "@/components/doctor/appointment-detail-page";
import { CopyCode, formatDuration, formatGender } from "@/components/doctor/queue/queue-ui";
import { arrivalLabels, getCaseLocation, getCaseStatus, priorityMeta } from "@/components/doctor/queue/emergency-queue";

const interventionLabels: Record<InterventionType, string> = {
  IV_ACCESS: "Thiết lập đường truyền tĩnh mạch",
  OXYGEN: "Thở oxy",
  MONITORING: "Theo dõi monitor liên tục",
  BLEEDING_CONTROL: "Kiểm soát chảy máu",
  EMERGENCY_MEDICATION: "Thuốc cấp cứu",
  CPR: "Hồi sinh tim phổi",
  AIRWAY: "Kiểm soát đường thở",
  OTHER: "Xử trí khác",
};

const orderLabels: Record<PreparationOrderType, string> = { BLOOD_TEST: "Xét nghiệm máu", ULTRASOUND: "Siêu âm", CT_SCAN: "Chụp CT" };
const urgencyLabels = { IMMEDIATE: "Ngay lập tức", URGENT: "Khẩn", EXPEDITED: "Ưu tiên" } as const;
const preparationStatusLabels = { REQUESTED: "Đã yêu cầu", IN_PROGRESS: "Đang chuẩn bị", COMPLETED: "Đã điều phối" } as const;
const surgeryStatusLabels = { WAITING: "Chờ phẫu thuật", IN_PROGRESS: "Đang phẫu thuật", COMPLETED: "Đã phẫu thuật" } as const;

/** Trang chi tiết một ca cấp cứu (mở từ tab "Ca cấp cứu" của trang Hàng đợi). */
export function EmergencyCaseDetailPage({ caseId, backHref }: { caseId: string; backHref: string }) {
  const [now] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["emergency-case", caseId],
    queryFn: () => emergencyService.getCase(caseId),
    retry: (count, error) => !(isAxiosError(error) && error.response?.status && error.response.status < 500) && count < 2,
  });

  if (query.isPending) return <PageState icon={<LoaderCircle className="animate-spin" />} text="Đang tải chi tiết ca cấp cứu..." />;
  if (query.isError || !query.data) {
    const message = isAxiosError(query.error) && query.error.response?.status === 404 ? "Không tìm thấy ca cấp cứu." : "Không thể tải chi tiết ca cấp cứu.";
    return <PageState icon={<Siren />} text={message} backHref={backHref} />;
  }

  const item = query.data;
  const priority = priorityMeta[item.priority];
  const status = getCaseStatus(item);
  const assessment = item.assessment;
  const preparation = item.preparation;
  const finished = item.status === "TRANSFERRED" || item.status === "CLOSED";
  const waited = Math.max(0, Math.floor((now - new Date(item.arrived_at).getTime()) / 60_000));

  return (
    <main className="min-h-screen bg-muted/35 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className={cn("flex flex-col gap-4 rounded-[1.6rem] border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7", item.priority === "RED" && !finished && "border-red-200")}>
          <div className="flex items-start gap-4">
            <Button render={<Link href={backHref} />} variant="outline" size="icon" className="mt-0.5 shrink-0 rounded-full" aria-label="Quay lại hàng đợi"><ArrowLeft /></Button>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600"><Siren className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">Chi tiết ca cấp cứu</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{item.full_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Đến lúc {formatDateTime(item.arrived_at)}{!finished && ` · ${formatDuration(waited).toLowerCase()} trước`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <CopyCode code={item.emergency_code} label="mã cấp cứu" tone="danger" />
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", priority.badge)}><span className={cn("size-1.5 rounded-full", priority.dot)} />{priority.label}</span>
            <span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", status.badge)}>{status.label}</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Thông tin bệnh nhân" icon={<UserRound />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Họ và tên" value={item.unidentified ? `${item.full_name} (chưa xác định danh tính)` : item.full_name} />
              <Info label="Giới tính · Tuổi" value={`${formatGender(item.gender)} · ${item.age != null ? `${item.age} tuổi` : "Chưa rõ tuổi"}`} />
              <Info label="Ngày sinh" value={item.date_of_birth ? formatDay(item.date_of_birth) : null} />
              <Info label="Số CCCD" value={item.identity_number} />
              <Info label="Số điện thoại" value={item.phone_number} />
              <Info label="Địa chỉ" value={item.address} />
            </div>
          </Card>
          <Card title="Tiếp nhận" icon={<Route />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Hình thức đến" value={arrivalLabels[item.arrival_mode]} />
              <Info label="Vị trí hiện tại" value={getCaseLocation(item) ?? "—"} />
              <Info label="Người đi cùng" value={item.companion_name ? `${item.companion_name}${item.companion_phone ? ` · ${item.companion_phone}` : ""}` : null} />
              <Info label="Cơ chế chấn thương" value={item.injury_mechanism} />
              <div className="sm:col-span-2"><Info label="Lý do vào cấp cứu" value={item.reason} /></div>
              <div className="sm:col-span-2"><Info label="Ghi chú tiếp nhận" value={item.intake_note} /></div>
            </div>
          </Card>
        </section>

        <Card title="Đánh giá ban đầu" icon={<HeartPulse />}>
          {!assessment ? <Empty text="Chưa có đánh giá ban đầu." /> : (
            <div className="space-y-5">
              {/* Dải chỉ số sinh tồn: số gọn, chỉ số bất thường có chấm màu + nhãn Cao/Thấp. */}
              <VitalStrip>
                <Vital label="Mạch" value={assessment.pulse_bpm} unit="lần/phút" flag={rangeFlag(assessment.pulse_bpm, 60, 100)} />
                <Vital label="Huyết áp" value={assessment.systolic_pressure != null && assessment.diastolic_pressure != null ? `${assessment.systolic_pressure}/${assessment.diastolic_pressure}` : null} unit="mmHg" flag={bloodPressureFlag(assessment.systolic_pressure, assessment.diastolic_pressure)} />
                <Vital label="SpO₂" value={assessment.spo2_percent} unit="%" flag={spo2Flag(assessment.spo2_percent)} />
                <Vital label="Nhiệt độ" value={assessment.temperature_c} unit="°C" flag={rangeFlag(assessment.temperature_c, 36, 37.5)} />
                <Vital label="Nhịp thở" value={assessment.respiratory_rate} unit="lần/phút" flag={rangeFlag(assessment.respiratory_rate, 12, 20)} />
                <Vital label="Mức đau" value={assessment.pain_score} unit="/ 10" flag={assessment.pain_score != null && assessment.pain_score >= 7 ? "HIGH" : null} />
              </VitalStrip>

              <DetailList>
                <Detail label="Ý thức" value={assessment.consciousness} wide />
                <Detail label="Triệu chứng" value={assessment.symptoms} />
                <Detail label="Đánh giá ban đầu" value={assessment.initial_assessment} />
                <Detail label="Tiền sử quan trọng" value={assessment.important_history} />
                <Detail label="Dị ứng" value={assessment.allergies} />
              </DetailList>

              {assessment.assessed_at && <RecordedAt>Ghi nhận lúc {formatDateTime(assessment.assessed_at)}</RecordedAt>}
            </div>
          )}
        </Card>

        <Card title="Xử trí cấp cứu" icon={<Activity />}>
          {item.interventions.length === 0 ? <Empty text="Chưa ghi nhận xử trí nào." /> : (
            <ol className="space-y-3">
              {item.interventions.map((intervention) => (
                <li key={intervention.id} className="flex gap-3 rounded-2xl border p-4">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-red-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-medium">{interventionLabels[intervention.intervention_type]}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(intervention.performed_at)}{intervention.recorded_by?.doctor && ` · BS. ${intervention.recorded_by.doctor.full_name}`}</p>
                    </div>
                    {intervention.details && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{intervention.details}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Chuẩn bị phẫu thuật & điều phối" icon={<ClipboardList />}>
          {!preparation ? <Empty text="Ca này chưa được chuyển sang chuẩn bị phẫu thuật (PRE-503)." /> : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Mức khẩn" value={urgencyLabels[preparation.urgency]} />
                <Info label="Trạng thái chuẩn bị" value={preparationStatusLabels[preparation.status]} />
                <Info label="Yêu cầu lúc" value={formatDateTime(preparation.requested_at)} />
                <Info label="Phòng chuyển đến" value={preparation.destination_room} />
                <Info label="Chẩn đoán nghi ngờ" value={preparation.suspected_diagnosis} />
                <Info label="Chẩn đoán sơ bộ" value={preparation.preliminary_diagnosis} />
                <Info label="Tình trạng vận chuyển" value={preparation.transport_condition} />
                <Info label="Ghi chú yêu cầu" value={preparation.request_note} />
              </div>
              {preparation.disposition_note && <Info label="Ghi chú điều phối" value={preparation.disposition_note} />}
              {preparation.surgery_status && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Phẫu thuật" value={surgeryStatusLabels[preparation.surgery_status]} />
                  <Info label="Phương pháp" value={preparation.procedure_name} />
                  <Info label="Phát hiện trong mổ" value={preparation.surgical_findings} />
                  <Info label="Hồi sức sau mổ" value={preparation.postoperative_destination} />
                </div>
              )}
            </div>
          )}
        </Card>

        {preparation && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Card title="Chỉ định cận lâm sàng" icon={<FlaskConical />}>
              {preparation.orders.length === 0 ? <Empty text="Không có chỉ định." /> : (
                <div className="space-y-3">
                  {preparation.orders.map((order) => (
                    <article key={order.id} className="rounded-2xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><p className="font-semibold">{orderLabels[order.order_type]}</p><p className="mt-0.5 text-xs text-muted-foreground">Chỉ định lúc {formatDateTime(order.ordered_at)}</p></div>
                        <Status value={order.status === "ORDERED" ? "PENDING" : order.status} />
                      </div>
                      {order.instruction && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><span className="font-medium">Chỉ định: </span>{order.instruction}</p>}
                      {order.result && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Kết quả</p><p className="whitespace-pre-wrap text-sm leading-6">{order.result}</p></div>}
                    </article>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Đơn thuốc cấp cứu" icon={<Pill />}>
              {!preparation.emergency_prescription || preparation.emergency_prescription.items.length === 0 ? <Empty text="Chưa có đơn thuốc." /> : (
                <div className="space-y-3">
                  {preparation.emergency_prescription.items.map((prescriptionItem) => (
                    <div key={prescriptionItem.id} className="grid gap-2 rounded-2xl border p-4 sm:grid-cols-[1fr_auto]">
                      <div><p className="font-semibold">{prescriptionItem.medicine.name}</p><p className="mt-1 text-xs text-muted-foreground">{prescriptionItem.medicine.medicine_code} · {prescriptionItem.dosage || "Chưa ghi liều dùng"} · {prescriptionItem.usage || "Chưa ghi cách dùng"}</p></div>
                      <p className="text-sm font-semibold text-primary">{prescriptionItem.quantity} {prescriptionItem.medicine.unit}</p>
                    </div>
                  ))}
                  {preparation.emergency_prescription.note && <p className="rounded-xl bg-muted p-3 text-sm">Ghi chú: {preparation.emergency_prescription.note}</p>}
                </div>
              )}
            </Card>
          </section>
        )}

        {!assessment && item.interventions.length === 0 && !preparation && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><FileHeart className="size-3.5" /> Ca này mới được tiếp nhận, chưa có dữ liệu xử trí.</p>
        )}
      </div>
    </main>
  );
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
