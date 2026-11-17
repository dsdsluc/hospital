"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, Pill } from "lucide-react";
import { toast } from "sonner";
import { emergencyService, type EmergencyPreparation } from "@/services/emergency.service";
import { formatVnd } from "@/services/price.service";

export function EmergencyPharmacyWorkspace() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["emergency-pharmacy-transfers"], queryFn: emergencyService.getEmergencyPharmacyTransfers, refetchInterval: 10_000 });
  const mutation = useMutation({ mutationFn: (id: string) => emergencyService.dispenseEmergencyPrescription(id), onSuccess: async (data) => { toast.success(data.message); await client.invalidateQueries({ queryKey: ["emergency-pharmacy-transfers"] }); }, onError: () => toast.error("Không thể cấp thuốc. Hãy kiểm tra tồn kho.") });
  const transfers = query.data ?? [];
  if (!query.isPending && transfers.length === 0) return null;
  return <section className="mb-5 rounded-[1.4rem] border border-violet-200 bg-violet-50/60 p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-600 text-white"><Pill className="size-5" /></span><div><h2 className="font-semibold">Đơn thuốc ra viện (cấp cứu / nội trú)</h2><p className="text-xs text-muted-foreground">Cấp thuốc xong mới đóng ca cấp cứu.</p></div></div>{query.isPending ? <p className="py-8 text-center text-sm text-muted-foreground">Đang tải đơn thuốc ICU...</p> : <div className="mt-4 space-y-3">{transfers.map((item) => <EmergencyPrescriptionCard key={item.id} item={item} busy={mutation.isPending} onDispense={() => mutation.mutate(item.id)} />)}</div>}</section>;
}

function EmergencyPrescriptionCard({ item, busy, onDispense }: { item: EmergencyPreparation; busy: boolean; onDispense: () => void }) {
  const prescription = item.emergency_prescription!;
  const enough = prescription.items.every((x) => x.medicine.stock_quantity >= x.quantity);
  return <article className="rounded-2xl border bg-white p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-semibold">{item.emergency_case?.full_name}</p><p className="mt-1 text-xs text-muted-foreground">{item.emergency_case?.emergency_code} · Ra viện</p>{item.emergency_case?.invoice && <p className={item.emergency_case.invoice.status === "PAID" ? "mt-1.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700" : "mt-1.5 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800"}>{item.emergency_case.invoice.status === "PAID" ? "Đã thanh toán tại CAS-103" : `Chưa thanh toán tại CAS-103 · ${formatVnd(item.emergency_case.invoice.total_amount)}`}</p>}</div><button disabled={busy || !enough} onClick={onDispense} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Xác nhận cấp thuốc</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="pb-2">Thuốc</th><th>Liều</th><th>Số lượng</th><th>Tồn kho</th><th>Cách dùng</th></tr></thead><tbody className="divide-y">{prescription.items.map((x) => <tr key={x.id}><td className="py-2 font-medium">{x.medicine.name}</td><td>{x.dosage || "—"}</td><td>{x.quantity} {x.medicine.unit}</td><td className={x.medicine.stock_quantity < x.quantity ? "font-semibold text-destructive" : ""}>{x.medicine.stock_quantity} {x.medicine.unit}</td><td>{x.usage || "—"}</td></tr>)}</tbody></table></div>{prescription.note && <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">Lời dặn: {prescription.note}</p>}</article>;
}
