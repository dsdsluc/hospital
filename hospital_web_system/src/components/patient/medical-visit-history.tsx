"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, FileHeart, LoaderCircle, MapPin, ReceiptText, ShieldCheck } from "lucide-react";
import { medicalVisitService } from "@/services/medical-visit.service";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/services/price.service";
import { getVisitInvoice, invoicePatientAmount } from "@/components/patient/patient-invoice-details";

export function MedicalVisitHistory() {
  const query = useQuery({ queryKey: ["my-medical-visits"], queryFn: medicalVisitService.getMyVisits, refetchInterval: 20_000 });
  if (query.isPending) return <div className="grid min-h-44 place-items-center rounded-[1.5rem] border bg-card"><LoaderCircle className="size-6 animate-spin text-primary" /></div>;
  const visits = query.data ?? [];
  return <section id="medical-visits" className="rounded-[1.6rem] border border-border/70 bg-card p-5 shadow-sm sm:p-6">
    <div className="flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Tất cả lượt khám</h2><p className="mt-1 text-sm text-muted-foreground">Chọn một lượt khám để xem toàn bộ kết quả và đơn thuốc.</p></div>{visits.length > 0 && <span className="hidden rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block">{visits.length} lượt khám</span>}</div>
    {query.isError ? <Empty text="Không thể tải lịch sử khám lúc này." /> : visits.length === 0 ? <Empty text="Bạn chưa có lượt khám nào." /> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{visits.map((visit) => {
      const functionSteps = visit.steps.filter((step) => step.room.room_code !== "REC-101" && step.room.id !== visit.receiving_room.id && step.room.room_code !== "PHM-105");
      const completed = functionSteps.filter((step) => step.status === "COMPLETED").length;
      const { invoice } = getVisitInvoice(visit);
      return <Link key={visit.id} href={`/patient/visits/${visit.id}`} className="group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{visit.visit_code}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> {formatDate(visit.created_at)}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[0.65rem] font-semibold", visit.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{visit.status === "COMPLETED" ? "Đã hoàn thành" : "Đang khám"}</span></div><p className="mt-4 flex items-center gap-2 text-sm"><MapPin className="size-4 text-primary" /> {visit.receiving_room.name}</p>{invoice ? <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted/50 px-3 py-2 text-xs"><ReceiptText className="size-3.5 text-primary" /><span className="text-muted-foreground">Viện phí</span><span className="font-semibold tabular-nums text-foreground">{formatVnd(invoicePatientAmount(invoice))}</span>{invoice.insurance_applied && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-px text-[0.65rem] font-semibold text-emerald-700"><ShieldCheck className="size-3" /> BHYT</span>}<span className={cn("ml-auto rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", invoice.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-800")}>{invoice.status === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}</span></div> : <p className="mt-3 text-xs text-muted-foreground">Chưa có hóa đơn</p>}<div className="mt-4 flex items-center justify-between gap-3 border-t pt-3"><span className="text-xs text-muted-foreground">{completed}/{functionSteps.length} kết quả phòng chức năng</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">Xem hồ sơ <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></span></div></Link>;
    })}</div>}
  </section>;
}

function Empty({ text }: { text: string }) { return <div className="mt-5 rounded-2xl border border-dashed p-7 text-center"><FileHeart className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
