"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, CalendarDays, CreditCard, FileHeart, Landmark, LoaderCircle, ReceiptText, ShieldCheck } from "lucide-react";
import { PageTitle, PageTitleBar } from "@/components/patient/page-title-bar";
import { PatientPageShell } from "@/components/patient/patient-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { medicalVisitService, type PatientMedicalVisit } from "@/services/medical-visit.service";
import { type Invoice, type InvoiceItemGroup, type PaymentMethod } from "@/services/invoice.service";
import { formatVnd } from "@/services/price.service";

const groupLabel: Record<InvoiceItemGroup, string> = {
  EXAMINATION: "Khám bệnh",
  EMERGENCY: "Cấp cứu & thủ thuật",
  PARACLINICAL: "Cận lâm sàng",
  SURGERY: "Phẫu thuật",
  BED_DAY: "Ngày giường",
  MEDICINE: "Thuốc",
};
const groupOrder: InvoiceItemGroup[] = ["EXAMINATION", "EMERGENCY", "PARACLINICAL", "SURGERY", "BED_DAY", "MEDICINE"];
export const paymentMethodMeta: Record<PaymentMethod, { label: string; icon: typeof Banknote }> = {
  CASH: { label: "Tiền mặt", icon: Banknote },
  TRANSFER: { label: "Chuyển khoản", icon: Landmark },
  CARD: { label: "Thẻ", icon: CreditCard },
};

/**
 * Hóa đơn của một lượt khám: hóa đơn khám thường, hoặc (nếu đã chuyển lên tầng 4)
 * hóa đơn ra viện của ca điều trị — đã gộp phí lượt khám này.
 */
export function getVisitInvoice(visit: PatientMedicalVisit): { invoice: Invoice | null; mergedFrom: string | null } {
  if (visit.invoice) return { invoice: visit.invoice, mergedFrom: null };
  const escalated = visit.escalated_emergency_cases?.find((c) => c.invoice);
  return { invoice: escalated?.invoice ?? null, mergedFrom: escalated?.emergency_code ?? null };
}

/** Số tiền bệnh nhân trả: đã thu thì lấy số đã lưu; chưa thu thì là tổng chi phí (BHYT áp dụng lúc thanh toán). */
export function invoicePatientAmount(invoice: Invoice) {
  return invoice.status === "PAID" ? (invoice.patient_amount ?? invoice.total_amount - invoice.insurance_amount) : invoice.total_amount;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

/** Trang chi tiết hóa đơn cho bệnh nhân: /patient/visits/[visitId]/invoice. */
export function PatientInvoiceDetails({ visitId }: { visitId: string }) {
  const query = useQuery({ queryKey: ["my-medical-visit", visitId], queryFn: () => medicalVisitService.getMyVisit(visitId), refetchInterval: 20_000 });
  if (query.isPending) return <State text="Đang tải hóa đơn..." />;
  if (query.isError || !query.data) return <State text="Không thể tải hóa đơn này." failed />;

  const visit = query.data;
  const { invoice, mergedFrom } = getVisitInvoice(visit);
  const backLink = <Link href={`/patient/visits/${visit.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-5")}><ArrowLeft className="size-4" /> Lượt khám {visit.visit_code}</Link>;

  if (!invoice) return <PatientPageShell>
    <PageTitleBar title={<PageTitle>Hóa đơn lượt khám <span className="tracking-wide text-primary">{visit.visit_code}</span></PageTitle>} description="Hóa đơn được lập khi bác sĩ hoàn tất khám." actions={backLink} />
    <div className="rounded-[1.5rem] border border-dashed p-10 text-center text-sm text-muted-foreground"><ReceiptText className="mx-auto mb-2 size-7" />Lượt khám này chưa có hóa đơn.</div>
  </PatientPageShell>;

  const paid = invoice.status === "PAID";
  const amount = invoicePatientAmount(invoice);
  const groups = groupOrder.map((group) => ({ group, lines: invoice.items.filter((l) => l.group === group) })).filter((g) => g.lines.length > 0);
  const origins = new Set(invoice.items.map((i) => i.origin).filter(Boolean));
  const method = invoice.payment_method ? paymentMethodMeta[invoice.payment_method] : null;

  return <PatientPageShell>
    <PageTitleBar
      title={<PageTitle>Hóa đơn <span className="font-mono tracking-wide text-primary">{invoice.invoice_code}</span></PageTitle>}
      badge={paid ? "Đã thanh toán" : "Chưa thanh toán"}
      description={<span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Lập {formatDateTime(invoice.created_at)}<span className="mx-1.5 text-border">•</span>Lượt khám {visit.visit_code}{mergedFrom ? ` · gộp trong hồ sơ điều trị ${mergedFrom}` : ""}</span>}
      actions={backLink}
    />

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="overflow-hidden rounded-[1.5rem] border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-4">
          <h2 className="text-base font-semibold">Chi tiết chi phí</h2>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <p className="text-sm text-muted-foreground">{invoice.items.length} khoản{origins.size > 1 ? ` · gồm ${origins.size} phần của đợt điều trị` : ""}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-2.5 font-medium">Dịch vụ / thuốc</th><th className="px-3 py-2.5 text-right font-medium">Số lượng</th><th className="px-3 py-2.5 text-right font-medium">Đơn giá</th><th className="px-5 py-2.5 text-right font-medium">Thành tiền</th></tr></thead>
            {groups.map(({ group, lines }) => <tbody key={group} className="divide-y border-t">
              <tr className="bg-muted/25"><td colSpan={3} className="px-5 py-2 text-xs font-semibold">{groupLabel[group]}</td><td className="px-5 py-2 text-right text-xs font-semibold tabular-nums">{formatVnd(lines.reduce((s, l) => s + l.amount, 0))}</td></tr>
              {lines.map((line) => <tr key={line.id} className="align-top">
                <td className="px-5 py-2.5"><p>{line.name}</p>{(line.detail || (origins.size > 1 && line.origin)) && <p className="mt-0.5 text-xs text-muted-foreground">{[origins.size > 1 ? line.origin : null, line.detail].filter(Boolean).join(" · ")}</p>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{line.quantity} {line.unit}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatVnd(line.unit_price)}</td>
                <td className="px-5 py-2.5 text-right font-medium tabular-nums">{formatVnd(line.amount)}</td>
              </tr>)}
            </tbody>)}
          </table>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-[1.5rem] border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Tổng tiền</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Tổng chi phí</dt><dd className="tabular-nums">{formatVnd(invoice.total_amount)}</dd></div>
            {invoice.insurance_applied && <div className="flex justify-between"><dt className="text-muted-foreground">BHYT chi trả (80%)</dt><dd className="tabular-nums text-emerald-700">− {formatVnd(invoice.insurance_amount)}</dd></div>}
            <div className="flex justify-between border-t pt-3 text-base font-semibold"><dt>{paid ? "Bạn đã thanh toán" : "Cần thanh toán"}</dt><dd className="tabular-nums text-primary">{formatVnd(amount)}</dd></div>
          </dl>
          {paid
            ? method && <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted/55 p-3 text-xs"><method.icon className="size-3.5 text-primary" /> {method.label}{invoice.paid_at ? ` · ${formatDateTime(invoice.paid_at)}` : ""}</p>
            : <p className="mt-4 rounded-xl bg-orange-50 p-3 text-xs text-orange-900">Vui lòng thanh toán tại quầy thu ngân CAS-103 (tầng 1). Có thẻ BHYT còn hạn được giảm 80%.</p>}
        </section>

        {invoice.insurance_applied && <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/60 p-5">
          <div className="flex items-center gap-2 text-emerald-800"><ShieldCheck className="size-5" /><h2 className="font-semibold">Bảo hiểm y tế đã dùng</h2></div>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-xs text-muted-foreground">Mã thẻ / CCCD</dt><dd className="mt-0.5 font-mono font-medium">{invoice.insurance_number || "Chưa ghi"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Họ tên trên thẻ</dt><dd className="mt-0.5 font-medium">{invoice.insurance_holder_name || "Chưa ghi"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">BHYT chi trả</dt><dd className="mt-0.5 font-medium tabular-nums">{formatVnd(invoice.insurance_amount)}</dd></div>
          </dl>
        </section>}
      </aside>
    </div>
  </PatientPageShell>;
}

function State({ text, failed }: { text: string; failed?: boolean }) {
  return <PatientPageShell><div className="grid min-h-[60vh] place-items-center"><div className="text-center">{failed ? <FileHeart className="mx-auto size-8 text-muted-foreground" /> : <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />}<p className="mt-3 text-sm text-muted-foreground">{text}</p>{failed && <Link href="/patient/visits" className="mt-4 inline-flex text-sm font-semibold text-primary">Về hồ sơ khám</Link>}</div></div></PatientPageShell>;
}
