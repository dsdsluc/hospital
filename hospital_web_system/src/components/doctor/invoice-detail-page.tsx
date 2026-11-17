"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, ArrowRight, Banknote, CreditCard, FileText, Landmark, LoaderCircle, ReceiptText, ShieldCheck, Siren, Stethoscope, UserRound } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { invoiceService, type InvoiceItemGroup, type PaymentMethod } from "@/services/invoice.service";
import { formatVnd } from "@/services/price.service";
import { PageState } from "@/components/doctor/appointment-detail-page";
import { useDetailHref } from "@/components/doctor/queue/queue-ui";

const groupLabel: Record<InvoiceItemGroup, string> = {
  EXAMINATION: "Khám bệnh",
  EMERGENCY: "Cấp cứu & thủ thuật",
  PARACLINICAL: "Cận lâm sàng",
  SURGERY: "Phẫu thuật",
  BED_DAY: "Ngày giường",
  MEDICINE: "Thuốc",
};
const groupOrder: InvoiceItemGroup[] = ["EXAMINATION", "EMERGENCY", "PARACLINICAL", "SURGERY", "BED_DAY", "MEDICINE"];
const methodMeta: Record<PaymentMethod, { label: string; icon: typeof Banknote }> = {
  CASH: { label: "Tiền mặt", icon: Banknote },
  TRANSFER: { label: "Chuyển khoản", icon: Landmark },
  CARD: { label: "Thẻ", icon: CreditCard },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

/** Trang chi tiết một hóa đơn (mở từ lịch sử phòng CAS-103), chỉ xem. */
export function InvoiceDetailPage({ invoiceId, backHref }: { invoiceId: string; backHref: string }) {
  const detailHref = useDetailHref();
  const query = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => invoiceService.get(invoiceId),
    retry: (count, error) => !(isAxiosError(error) && error.response?.status && error.response.status < 500) && count < 2,
  });

  if (query.isPending) return <PageState icon={<LoaderCircle className="animate-spin" />} text="Đang tải hóa đơn..." />;
  if (query.isError || !query.data) {
    const message = isAxiosError(query.error) && query.error.response?.status === 404 ? "Không tìm thấy hóa đơn." : "Không thể tải hóa đơn.";
    return <PageState icon={<ReceiptText />} text={message} backHref={backHref} />;
  }

  const invoice = query.data;
  const paid = invoice.status === "PAID";
  const emergency = invoice.type === "EMERGENCY";
  const patientAmount = invoice.patient_amount ?? invoice.total_amount - invoice.insurance_amount;
  const origins = new Set(invoice.items.map((i) => i.origin).filter(Boolean));
  const groups = groupOrder.map((group) => ({ group, lines: invoice.items.filter((l) => l.group === group) })).filter((g) => g.lines.length > 0);
  const recordHref = emergency ? `/doctor/emergency/${invoice.emergency_case_id}` : `/doctor/visits/${invoice.medical_visit_id}/results`;
  const Method = methodMeta[invoice.payment_method ?? "CASH"];

  return (
    <main className="min-h-screen bg-muted/35 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[1.6rem] border bg-card px-5 py-4 shadow-sm">
          <Button render={<Link href={backHref} />} variant="outline" size="icon" className="shrink-0 rounded-full" aria-label="Quay lại"><ArrowLeft /></Button>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ReceiptText className="size-4" /></span>
          <h1 className="text-[0.95rem] font-semibold">Hóa đơn <span className="font-mono tracking-wide text-primary">{invoice.invoice_code}</span></h1>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", paid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{paid ? "Đã thanh toán" : "Chưa thanh toán"}</span>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{invoice.patient_name} · {emergency ? "Cấp cứu / nội trú" : "Khám ngoại trú"} · lập {formatDateTime(invoice.created_at)}</p>
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium tracking-wide text-muted-foreground">CAS-103</span>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-4">
              <h2 className="text-sm font-semibold">Chi tiết chi phí</h2>
              <span className="hidden h-4 w-px bg-border sm:block" />
              <p className="text-xs text-muted-foreground">{invoice.items.length} khoản · giá chốt lúc lập hóa đơn{origins.size > 1 ? ` · gồm ${origins.size} phần của đợt điều trị` : ""}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-2.5 font-medium">Dịch vụ / thuốc</th><th className="px-3 py-2.5 font-medium">ĐVT</th><th className="px-3 py-2.5 text-right font-medium">SL</th><th className="px-3 py-2.5 text-right font-medium">Đơn giá</th><th className="px-5 py-2.5 text-right font-medium">Thành tiền</th></tr></thead>
                {groups.map(({ group, lines }) => (
                  <tbody key={group} className="divide-y border-t">
                    <tr className="bg-muted/25"><td colSpan={4} className="px-5 py-2 text-xs font-semibold">{groupLabel[group]}</td><td className="px-5 py-2 text-right text-xs font-semibold tabular-nums">{formatVnd(lines.reduce((s, l) => s + l.amount, 0))}</td></tr>
                    {lines.map((line) => (
                      <tr key={line.id} className="align-top">
                        <td className="px-5 py-2">
                          <p>{line.name}</p>
                          <p className="text-[0.68rem] text-muted-foreground"><span className="font-mono">{line.item_code}</span>{line.source_room ? ` · ${line.source_room}` : ""}{origins.size > 1 && line.origin ? ` · ${line.origin}` : ""}</p>
                          {line.detail && <p className="text-[0.7rem] text-muted-foreground">{line.detail}</p>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{line.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatVnd(line.unit_price)}</td>
                        <td className="px-5 py-2 text-right font-medium tabular-nums">{formatVnd(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Tổng tiền</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Tổng chi phí</dt><dd className="tabular-nums">{formatVnd(invoice.total_amount)}</dd></div>
                {invoice.insurance_applied && <div className="flex justify-between"><dt className="text-muted-foreground">BHYT chi trả (80%)</dt><dd className="tabular-nums text-emerald-700">− {formatVnd(invoice.insurance_amount)}</dd></div>}
                <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>{paid ? "Bệnh nhân đã trả" : "Cần thanh toán"}</dt><dd className="tabular-nums text-primary">{formatVnd(paid ? patientAmount : invoice.total_amount)}</dd></div>
              </dl>
              {invoice.insurance_applied && <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900"><ShieldCheck className="mt-px size-3.5 shrink-0" /><span>BHYT · {invoice.insurance_number || "chưa ghi mã thẻ"}{invoice.insurance_holder_name ? ` · ${invoice.insurance_holder_name}` : ""}</span></p>}
              {paid
                ? <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted/55 p-3 text-xs"><Method.icon className="size-3.5 text-primary" /> {Method.label}{invoice.paid_at ? ` · ${formatDateTime(invoice.paid_at)}` : ""}</p>
                : <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-800">Hóa đơn chưa thanh toán tại quầy thu ngân.</p>}
            </section>

            <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Bệnh nhân & hồ sơ</h2>
              <dl className="space-y-3 text-sm">
                <Row icon={UserRound} label="Bệnh nhân" value={`${invoice.patient_name}${invoice.patient_code ? ` · ${invoice.patient_code}` : " · vãng lai"}`} />
                <Row icon={emergency ? Siren : Stethoscope} label={emergency ? "Ca điều trị" : "Lượt khám"} value={`${invoice.record_code}${invoice.source_room ? ` · từ ${invoice.source_room}` : ""}`} />
                <Row icon={FileText} label="Sau thanh toán" value={invoice.next_destination === "PHM-105" ? "PHM-105 nhận thuốc" : "Bệnh nhân ra về"} />
              </dl>
              <Link href={detailHref(recordHref)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 w-full rounded-full")}>Xem hồ sơ {emergency ? "ca điều trị" : "lượt khám"} <ArrowRight /></Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div></div>;
}
