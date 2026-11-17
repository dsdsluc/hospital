"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, FileHeart, FlaskConical, HeartPulse, LoaderCircle, MapPin, Pill, ReceiptText, ShieldCheck, Stethoscope } from "lucide-react";
import { ClinicalResultDialog } from "@/components/patient/clinical-result-dialog";
import { PageTitle, PageTitleBar } from "@/components/patient/page-title-bar";
import { Paragraphs } from "@/components/patient/paragraphs";
import { PatientPageShell } from "@/components/patient/patient-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { medicalVisitService } from "@/services/medical-visit.service";
import { type Invoice } from "@/services/invoice.service";
import { formatVnd } from "@/services/price.service";
import { formatDateTime, getVisitInvoice, invoicePatientAmount, paymentMethodMeta } from "@/components/patient/patient-invoice-details";
import { cn } from "@/lib/utils";

export function PatientVisitDetails({ visitId }: { visitId: string }) {
  const query = useQuery({ queryKey: ["my-medical-visit", visitId], queryFn: () => medicalVisitService.getMyVisit(visitId), refetchInterval: 20_000 });
  if (query.isPending) return <State text="Đang tải hồ sơ lượt khám..." />;
  if (query.isError || !query.data) return <State text="Không thể tải lượt khám này." failed />;
  const visit = query.data;
  const functionSteps = visit.steps.filter((step) => step.room.room_code !== "REC-101" && step.room.id !== visit.receiving_room.id && step.room.room_code !== "PHM-105");
  const results = functionSteps.filter((step) => step.clinical_result);
  const exam = visit.examination_record;
  // Hóa đơn của lượt khám; nếu đã chuyển lên tầng 4 thì là hóa đơn ra viện (đã gộp phí lượt khám này).
  const { invoice, mergedFrom } = getVisitInvoice(visit);

  return <PatientPageShell>
    <PageTitleBar
      title={<PageTitle>Hồ sơ lượt khám <span className="tracking-wide text-primary">{visit.visit_code}</span></PageTitle>}
      badge={visit.status === "COMPLETED" ? "Đã hoàn thành" : "Đang khám"}
      description={<span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {formatDate(visit.created_at)}<span className="mx-1.5 text-border">•</span><MapPin className="size-3.5" /> {visit.receiving_room.name} · {visit.receiving_room.floor.name}</span>}
      actions={<Link href="/patient/visits" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-5")}><ArrowLeft className="size-4" /> Hồ sơ khám</Link>}
    />

    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-3">
        <SideCard title="Kết luận bác sĩ" icon={<Stethoscope />}><Data label="Chẩn đoán" value={exam?.final_diagnosis} /><Data label="Hướng điều trị" value={exam?.treatment_direction} /><Data label="Kết luận" value={exam?.conclusion} /></SideCard>
        <SideCard title="Lời dặn bác sĩ" icon={<HeartPulse />}>{exam?.doctor_advice ? <Paragraphs text={exam.doctor_advice} className="text-sm leading-6" /> : <Empty text="Chưa có lời dặn." />}</SideCard>
        <SideCard title="Đơn thuốc" icon={<Pill />}>{!visit.prescription?.items.length ? <Empty text="Chưa có đơn thuốc." /> : <div className="space-y-3">{visit.prescription.items.map((item) => <div key={item.id} className="rounded-2xl bg-muted/55 p-4"><div className="flex justify-between gap-3"><p className="font-semibold">{item.medicine.name}</p><span className="shrink-0 text-xs font-semibold text-primary">{item.quantity} {item.medicine.unit}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.dosage || "Chưa ghi liều"} · {item.usage || "Chưa ghi cách dùng"}</p></div>)}{visit.prescription.note && <Paragraphs text={visit.prescription.note} className="rounded-2xl bg-orange-50 p-4 text-sm leading-6" />}</div>}</SideCard>
      </div>

      <InvoiceSection visitId={visit.id} invoice={invoice} mergedFrom={mergedFrom} />

      <Section title="Kết quả phòng chức năng" badge={`${results.length}/${functionSteps.length} đã hoàn thành`} subtitle="Bấm “Chi tiết” để xem thông số và hướng xử lý." icon={<FlaskConical />}>{results.length === 0 ? <Empty text="Chưa có kết quả phòng chức năng." /> : <div className="grid gap-4 lg:grid-cols-2">{results.map((step) => <article key={step.id} className="rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{step.room.name} <span className="text-muted-foreground">({step.room.room_code})</span></h3><span className="mt-1.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700">Đã hoàn thành</span></div><ClinicalResultDialog medicalVisitId={visit.id} visitStepId={step.id} roomName={step.room.name} /></div><Paragraphs text={step.clinical_result!.result} className="mt-5 border-t pt-4 text-sm leading-6 text-foreground/80" /></article>)}</div>}</Section>
    </div>
  </PatientPageShell>;
}

/** Viện phí của lượt khám: tóm tắt hóa đơn, xem chi tiết ở trang riêng. */
function InvoiceSection({ visitId, invoice, mergedFrom }: { visitId: string; invoice: Invoice | null; mergedFrom: string | null }) {
  if (!invoice) return <Section title="Viện phí" subtitle="Hóa đơn được lập khi bác sĩ hoàn tất khám." icon={<ReceiptText />}><Empty text="Chưa có hóa đơn." /></Section>;
  const paid = invoice.status === "PAID";
  const method = invoice.payment_method ? paymentMethodMeta[invoice.payment_method].label : null;
  // Một thanh ngang gọn: tiêu đề + trạng thái + số tiền + nút chi tiết.
  return <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3">
    <span className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><ReceiptText className="size-4" /></span>
      <h2 className="text-base font-semibold">Viện phí</h2>
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", paid ? "bg-primary/10 text-primary" : "bg-orange-100 text-orange-800")}>{paid ? "Đã thanh toán" : "Chưa thanh toán"}</span>
    </span>
    <span className="font-mono text-xs text-muted-foreground" title={mergedFrom ? `Gộp trong hồ sơ điều trị ${mergedFrom}` : undefined}>{invoice.invoice_code}</span>
    <span className="hidden h-5 w-px bg-border lg:block" />
    <Amount label="Tổng" value={formatVnd(invoice.total_amount)} />
    {invoice.insurance_applied && <Amount label={<span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5 text-emerald-700" /> BHYT</span>} value={`− ${formatVnd(invoice.insurance_amount)}`} tone="text-emerald-700" title={invoice.insurance_number ?? undefined} />}
    <Amount label={paid ? "Đã trả" : "Cần trả"} value={formatVnd(invoicePatientAmount(invoice))} tone="font-semibold text-primary" />
    <span className="text-xs text-muted-foreground">{paid ? [method, invoice.paid_at && formatDateTime(invoice.paid_at)].filter(Boolean).join(" · ") : "Thanh toán tại CAS-103"}</span>
    <Link href={`/patient/visits/${visitId}/invoice`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto h-8 rounded-full px-3 text-xs")}>Chi tiết hóa đơn <ArrowRight className="size-3.5" /></Link>
  </section>;
}

function Amount({ label, value, tone, title }: { label: React.ReactNode; value: string; tone?: string; title?: string }) {
  return <span className="inline-flex items-baseline gap-1.5 text-sm" title={title}><span className="text-xs text-muted-foreground">{label}</span><span className={cn("tabular-nums", tone)}>{value}</span></span>;
}

function Section({ title, badge, subtitle, icon, children }: { title: string; badge?: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) { return <section><div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5"><span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-4">{icon}</span><h2 className="text-base font-semibold">{title}</h2>{badge && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{badge}</span>}<span className="hidden h-5 w-px bg-border sm:block" /><p className="text-sm text-muted-foreground">{subtitle}</p></div>{children}</section>; }
function SideCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="flex h-full flex-col rounded-[1.5rem] border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 text-primary [&_svg]:size-5">{icon}<h2 className="font-semibold text-foreground">{title}</h2></div><div className="flex-1 space-y-3">{children}</div></section>; }
function Data({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs text-muted-foreground">{label}</p>{value ? <Paragraphs text={value} className="mt-1 text-sm leading-6" /> : <p className="mt-1 text-sm leading-6 text-muted-foreground">Chưa cập nhật</p>}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{text}</div>; }
function State({ text, failed }: { text: string; failed?: boolean }) { return <PatientPageShell><div className="grid min-h-[60vh] place-items-center"><div className="text-center">{failed ? <FileHeart className="mx-auto size-8 text-muted-foreground" /> : <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />}<p className="mt-3 text-sm text-muted-foreground">{text}</p>{failed && <Link href="/patient/visits" className="mt-4 inline-flex text-sm font-semibold text-primary">Về hồ sơ khám</Link>}</div></div></PatientPageShell>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
