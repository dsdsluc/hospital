"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Banknote, CheckCircle2, ShieldCheck, Clock3, CreditCard, Landmark, LoaderCircle, ReceiptText, Siren, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/services/price.service";
import { insuranceSplit, invoiceService, type Invoice, type InvoiceItemGroup, type PaymentMethod } from "@/services/invoice.service";
import { SectionTitle } from "@/components/doctor/workspaces/surgery-workspace";
import { DialogHead, Empty, SearchBox, Warning, formatDateTime, formatDuration, minutesSince, normalize, useNow } from "@/components/doctor/workspaces/care-panels";

/**
 * CAS-103 · Quầy thu ngân.
 * Hóa đơn được lập tự động: khám thường khi bác sĩ "Hoàn tất khám"; cấp cứu / nội trú khi ra viện qua PHM-105.
 */

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

function ageOf(invoice: Invoice) {
  if (invoice.date_of_birth) return `${Math.max(0, new Date().getFullYear() - new Date(invoice.date_of_birth).getFullYear())} tuổi`;
  return invoice.age != null ? `${invoice.age} tuổi` : null;
}

export function CashierWorkspace() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["invoices"], queryFn: () => invoiceService.list(), refetchInterval: 10_000 });
  const invoices = query.data ?? [];
  const [tab, setTab] = useState<"WAITING" | "PAID">("WAITING");
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const now = useNow();
  const waiting = invoices.filter((b) => b.status === "UNPAID");
  const paid = invoices.filter((b) => b.status === "PAID").sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""));
  const keyword = normalize(search.trim());
  const list = (tab === "WAITING" ? waiting : paid).filter((b) => !keyword || normalize([b.patient_name, b.record_code, b.invoice_code, b.patient_code ?? ""].join(" ")).includes(keyword));
  const selected = invoices.find((b) => b.id === selectedId) ?? list[0];
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["invoices"] }); };

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Hóa đơn</h2>
          <div className="mt-3 flex gap-1 rounded-xl bg-muted p-1">
            {([["WAITING", "Chờ thanh toán", waiting.length], ["PAID", "Đã thu hôm nay", paid.length]] as const).map(([value, label, count]) => <button key={value} type="button" onClick={() => { setTab(value); setSelectedId(undefined); }} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition", tab === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{label}<span className="tabular-nums">{count}</span></button>)}
          </div>
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <div className="space-y-2 p-2">
          {query.isPending ? <Empty loading text="Đang tải hóa đơn..." />
            : query.isError ? <Empty text="Không thể tải hóa đơn." />
            : list.length === 0 ? <Empty text={keyword ? `Không tìm thấy hóa đơn phù hợp với “${search.trim()}”.` : tab === "WAITING" ? "Không còn hóa đơn chờ thanh toán." : "Hôm nay chưa thu hóa đơn nào."} />
            : list.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} now={now} active={selected?.id === invoice.id} onClick={() => setSelectedId(invoice.id)} />)}
        </div>
      </section>
      <section className="min-w-0 space-y-5">{selected ? <InvoiceDetails key={selected.id} invoice={selected} now={now} onPaid={refresh} /> : <Empty text="Chọn hóa đơn để thanh toán." />}</section>
    </div>
  </div>;
}

function InvoiceRow({ invoice, now, active, onClick }: { invoice: Invoice; now: number; active: boolean; onClick: () => void }) {
  const emergency = invoice.type === "EMERGENCY";
  return <button type="button" onClick={onClick} className={cn("w-full rounded-2xl border p-3 text-left", active ? "border-primary/30 bg-primary/6" : "border-transparent hover:bg-muted")}>
    <div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{invoice.patient_name}</p><span className="shrink-0 text-sm font-semibold tabular-nums">{formatVnd(invoice.patient_amount ?? invoice.total_amount)}</span></div>
    <p className="mt-0.5 text-xs text-muted-foreground">{invoice.record_code}{invoice.source_room ? ` · từ ${invoice.source_room}` : ""}</p>
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[.62rem] font-semibold", emergency ? "bg-red-50 text-red-700" : "bg-primary/10 text-primary")}>{emergency ? <Siren className="size-2.5" /> : <Stethoscope className="size-2.5" />}{emergency ? "Cấp cứu · ra viện" : "Khám thường"}</span>
      {invoice.insurance_applied && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[.62rem] font-semibold text-emerald-700">BHYT</span>}
      {invoice.status === "PAID" ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[.62rem] font-semibold text-emerald-700">Đã thanh toán · {methodMeta[invoice.payment_method ?? "CASH"].label}</span>
        : <span className="text-[.68rem] text-muted-foreground">chờ {formatDuration(minutesSince(invoice.created_at, now))}</span>}
    </div>
  </button>;
}

/* ───────── Chi tiết hóa đơn ───────── */

type InsuranceDraft = { applied: boolean; number: string; holder: string };

function InvoiceDetails({ invoice, now, onPaid }: { invoice: Invoice; now: number; onPaid: () => Promise<void> }) {
  const emergency = invoice.type === "EMERGENCY";
  const [insurance, setInsurance] = useState<InsuranceDraft>({ applied: false, number: "", holder: invoice.patient_name });
  // Đã thu: lấy số đã lưu; chưa thu: tính theo lựa chọn BHYT đang nhập.
  const split = invoice.status === "PAID"
    ? { insurance_amount: invoice.insurance_amount, patient_amount: invoice.patient_amount ?? invoice.total_amount - invoice.insurance_amount }
    : insuranceSplit(invoice.total_amount, insurance.applied);
  const insured = invoice.status === "PAID" ? invoice.insurance_applied : insurance.applied;
  const age = ageOf(invoice);
  const origins = new Set(invoice.items.map((i) => i.origin).filter(Boolean));
  const groups = groupOrder.map((group) => ({ group, lines: invoice.items.filter((l) => l.group === group) })).filter((g) => g.lines.length > 0);
  return <>
    <article className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5"><UserRound /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{invoice.patient_name}</h2>{invoice.status === "PAID" ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Đã thanh toán</span> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Chờ thanh toán</span>}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{[invoice.invoice_code, invoice.record_code, invoice.patient_code, age, emergency ? "Cấp cứu / nội trú" : "Khám ngoại trú"].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right"><p className="text-xs text-muted-foreground">{insured ? "Bệnh nhân trả (có BHYT)" : "Phải thu"}</p><p className="text-xl font-semibold tabular-nums text-primary">{formatVnd(split.patient_amount)}</p>{insured && <p className="text-xs text-muted-foreground line-through">{formatVnd(invoice.total_amount)}</p>}</div>
      </div>
      <div className="grid divide-y border-t sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Fact icon={Clock3} label={emergency ? "Vào viện" : "Bắt đầu khám"} value={formatDateTime(invoice.started_at)} />
        <Fact icon={ReceiptText} label="Lập hóa đơn" value={`${formatDateTime(invoice.created_at)} · ${formatDuration(minutesSince(invoice.created_at, now))} trước`} />
        <Fact icon={ArrowRight} label="Sau thanh toán" value={invoice.next_destination === "PHM-105" ? "PHM-105 nhận thuốc" : "Bệnh nhân ra về"} />
      </div>
    </article>

    <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
      <SectionTitle index={1} title="Chi tiết chi phí" description={`${invoice.items.length} khoản · giá chốt lúc lập hóa đơn${origins.size > 1 ? ` · gồm ${origins.size} phần của đợt điều trị` : ""}`} />
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Dịch vụ / thuốc</th><th className="px-3 py-2.5 font-medium">ĐVT</th><th className="px-3 py-2.5 text-right font-medium">SL</th><th className="px-3 py-2.5 text-right font-medium">Đơn giá</th><th className="px-4 py-2.5 text-right font-medium">Thành tiền</th></tr></thead>
          {groups.map(({ group, lines }) => {
            const subtotal = lines.reduce((s, l) => s + l.amount, 0);
            return <tbody key={group} className="divide-y border-t">
              <tr className="bg-muted/25"><td colSpan={4} className="px-4 py-2 text-xs font-semibold">{groupLabel[group]}</td><td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">{formatVnd(subtotal)}</td></tr>
              {lines.map((line) => <tr key={line.id} className="align-top">
                <td className="px-4 py-2">
                  <p>{line.name}</p>
                  <p className="text-[0.68rem] text-muted-foreground"><span className="font-mono">{line.item_code}</span>{line.source_room ? ` · ${line.source_room}` : ""}{origins.size > 1 && line.origin ? ` · ${line.origin}` : ""}</p>
                  {line.detail && <p className={cn("text-[0.7rem]", line.detail.includes("Chưa có giá") ? "text-amber-700" : "text-muted-foreground")}>{line.detail}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{line.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatVnd(line.unit_price)}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatVnd(line.amount)}</td>
              </tr>)}
            </tbody>;
          })}
        </table>
      </div>
      <dl className="ml-auto mt-4 w-full max-w-sm space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Tổng chi phí</dt><dd className="tabular-nums">{formatVnd(invoice.total_amount)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">BHYT chi trả {insured ? "(80%)" : ""}</dt>{insured ? <dd className="tabular-nums text-emerald-700">− {formatVnd(split.insurance_amount)}</dd> : <dd className="text-xs text-muted-foreground">Không áp dụng</dd>}</div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Bệnh nhân trả</dt><dd className="tabular-nums text-primary">{formatVnd(split.patient_amount)}</dd></div>
      </dl>
    </section>

    {invoice.status === "PAID" ? <PaidPanel invoice={invoice} /> : <PaymentPanel invoice={invoice} insurance={insurance} onInsuranceChange={setInsurance} amount={split.patient_amount} onPaid={onPaid} />}
  </>;
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="flex gap-3 px-5 py-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div></div>;
}

/* ───────── Thanh toán: chỉ ghi phương thức + đổi trạng thái (tiền thu / biên lai do hệ thống khác của bệnh viện quản lý) ───────── */

function PaymentPanel({ invoice, insurance, onInsuranceChange, amount, onPaid }: { invoice: Invoice; insurance: InsuranceDraft; onInsuranceChange: (next: InsuranceDraft) => void; amount: number; onPaid: () => Promise<void> }) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const warnings = [insurance.applied && !insurance.number.trim() && "Chưa nhập mã thẻ BHYT / CCCD — vẫn có thể xác nhận."].filter(Boolean) as string[];
  const pay = useMutation({
    mutationFn: () => invoiceService.pay(invoice.id, {
      payment_method: method,
      insurance_applied: insurance.applied,
      insurance_number: insurance.applied ? insurance.number.trim() || null : null,
      insurance_holder_name: insurance.applied ? insurance.holder.trim() || null : null,
    }),
    onSuccess: async (r) => {
      setConfirmOpen(false);
      toast.success(r.message, { description: invoice.next_destination === "PHM-105" ? "Hướng dẫn bệnh nhân sang PHM-105 nhận thuốc." : "Bệnh nhân có thể ra về." });
      await onPaid();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận thanh toán.")),
  });

  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={2} title="Thanh toán" description="Bảo hiểm và phương thức thanh toán" />
    {/* BHYT: tick là giảm 80% toàn bộ hóa đơn. Nhân viên tự kiểm tra thẻ; thẻ hết hạn thì không tick. */}
    <div className={cn("mb-4 rounded-2xl border p-4 transition", insurance.applied ? "border-emerald-200 bg-emerald-50/50" : "")}>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={insurance.applied} onChange={(e) => onInsuranceChange({ ...insurance, applied: e.target.checked })} className="size-4 accent-[var(--primary)]" />
        <ShieldCheck className={cn("size-4", insurance.applied ? "text-emerald-700" : "text-muted-foreground")} />
        <span className="text-sm font-medium">Có bảo hiểm y tế</span>
        <span className="text-xs text-muted-foreground">· giảm 80% toàn bộ hóa đơn</span>
      </label>
      {insurance.applied && <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Mã thẻ BHYT hoặc CCCD</span><Input value={insurance.number} onChange={(e) => onInsuranceChange({ ...insurance, number: e.target.value })} placeholder="Ví dụ: DN4797915123456" className="h-9 rounded-lg bg-background font-mono" /></label>
        <label className="block space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Họ tên trên thẻ</span><Input value={insurance.holder} onChange={(e) => onInsuranceChange({ ...insurance, holder: e.target.value })} className="h-9 rounded-lg bg-background" /></label>
      </div>}
    </div>
    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Phương thức thanh toán</span>
    <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-3">{(Object.keys(methodMeta) as PaymentMethod[]).map((key) => {
      const { label, icon: Icon } = methodMeta[key];
      const selected = method === key;
      return <button key={key} type="button" aria-pressed={selected} onClick={() => setMethod(key)} className={cn("flex items-center gap-3 rounded-2xl border p-3.5 text-left transition", selected ? "border-primary bg-primary/6 ring-2 ring-primary/15" : "hover:border-primary/30")}>
        <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} /><span className={cn("text-sm", selected ? "font-semibold" : "font-medium")}>{label}</span>
      </button>;
    })}</div>

    {warnings.length > 0 && <div className="mt-4 space-y-2">{warnings.map((w) => <Warning key={w} text={w} />)}</div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">Sau khi thanh toán: {invoice.next_destination === "PHM-105" ? "bệnh nhân sang PHM-105 nhận thuốc" : "bệnh nhân ra về"}.</p>
      <Button type="button" onClick={() => setConfirmOpen(true)} className="rounded-full px-5"><CheckCircle2 /> Xác nhận đã thanh toán</Button>
    </div>

    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHead icon={ReceiptText} title="Xác nhận thanh toán" description={`${invoice.patient_name} · ${invoice.record_code}`} />
        <dl className="space-y-2 px-6 py-5 text-sm">
          {insurance.applied && <><div className="flex justify-between"><dt className="text-muted-foreground">Tổng chi phí</dt><dd className="tabular-nums">{formatVnd(invoice.total_amount)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">BHYT chi trả (80%)</dt><dd className="tabular-nums text-emerald-700">− {formatVnd(invoice.total_amount - amount)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Thẻ / CCCD</dt><dd className="font-mono text-xs">{insurance.number.trim() || "—"}</dd></div></>}
          <div className="flex justify-between"><dt className="text-muted-foreground">Bệnh nhân trả</dt><dd className="font-semibold tabular-nums">{formatVnd(amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Phương thức</dt><dd>{methodMeta[method].label}</dd></div>
        </dl>
        <div className="flex justify-end gap-2 border-t bg-muted/40 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} className="rounded-full px-4">Quay lại</Button>
          <Button type="button" disabled={pay.isPending} onClick={() => pay.mutate()} className="rounded-full px-5">{pay.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Xác nhận</Button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

function PaidPanel({ invoice }: { invoice: Invoice }) {
  const method = invoice.payment_method ?? "CASH";
  const MethodIcon = methodMeta[method].icon;
  const amount = invoice.patient_amount ?? invoice.total_amount - invoice.insurance_amount;
  return <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
    <SectionTitle index={2} title="Đã thanh toán" description={invoice.paid_at ? `Xác nhận lúc ${formatDateTime(invoice.paid_at)}` : "Đã xác nhận"} />
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><MethodIcon className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{formatVnd(amount)} · {methodMeta[method].label}</p><p className="mt-0.5 text-xs text-muted-foreground">Hóa đơn {invoice.invoice_code}</p></div>
    </div>
    {invoice.insurance_applied && <p className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-900"><ShieldCheck className="size-3.5" /> BHYT chi trả {formatVnd(invoice.insurance_amount)} · {invoice.insurance_number || "chưa ghi mã thẻ"}{invoice.insurance_holder_name ? ` · ${invoice.insurance_holder_name}` : ""}</p>}
  </section>;
}
