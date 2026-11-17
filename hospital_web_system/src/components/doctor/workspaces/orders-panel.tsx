"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  ChevronDown,
  ClipboardPlus,
  FlaskConical,
  HeartPulse,
  Hourglass,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Paragraphs } from "@/components/patient/paragraphs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { medicalVisitService } from "@/services/medical-visit.service";
import type { ReceptionQueueAppointment } from "@/types/api";

type IconType = ComponentType<{ className?: string }>;
type VisitStep = NonNullable<ReceptionQueueAppointment["medical_visits"][number]["steps"]>[number];

/**
 * Danh mục phòng chức năng có thể chỉ định cho bệnh nhân NGOẠI TRÚ (phòng khám tầng 2), chia theo nhóm.
 * Không gồm khu cấp cứu / lấy mẫu tầng 1 (LAB-104): xét nghiệm máu lấy mẫu và trả kết quả ngay tại LAB-305.
 */
export const orderRoomGroups: Array<{ label: string; rooms: Array<{ code: string; name: string; detail: string; icon: IconType; sameFunction?: string }> }> = [
  {
    label: "Xét nghiệm",
    rooms: [
      { code: "LAB-305", name: "Xét nghiệm máu", detail: "Lấy mẫu & trả kết quả tại phòng · Tầng 3", icon: FlaskConical },
    ],
  },
  {
    label: "Chẩn đoán hình ảnh",
    rooms: [
      { code: "US-301", name: "Siêu âm 1", detail: "Siêu âm · Tầng 3", icon: Activity, sameFunction: "US" },
      { code: "US-302", name: "Siêu âm 2", detail: "Siêu âm · Tầng 3", icon: Activity, sameFunction: "US" },
      { code: "XR-303", name: "X-quang", detail: "Chụp X-quang · Tầng 3", icon: ImagePlus },
      { code: "CT-304", name: "Chụp CT", detail: "Chụp cắt lớp vi tính · Tầng 3", icon: ScanLine },
    ],
  },
  {
    label: "Thăm dò chức năng",
    rooms: [
      { code: "ECG-306", name: "Điện tim", detail: "Đo điện tâm đồ · Tầng 3", icon: HeartPulse },
    ],
  },
];

const allOrderRooms = orderRoomGroups.flatMap((group) => group.rooms);
export const orderRoomCodes = allOrderRooms.map((room) => room.code);

/** Từ số người đang chờ + đang thực hiện trở lên thì coi là phòng đông. */
const BUSY_THRESHOLD = 5;

type OrderState = "PENDING" | "IN_PROGRESS" | "COMPLETED";

/** Chỉ định hiện tại của lượt khám tại các phòng chức năng (bỏ các bước đã hủy). */
export function getVisitOrders(steps: VisitStep[] = []) {
  return steps.filter((step) => orderRoomCodes.includes(step.room.room_code) && step.status !== "CANCELLED") as Array<VisitStep & { status: OrderState }>;
}

function formatClock(value?: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "";
}

/** Tải hàng đợi các phòng chức năng để biết số người chờ và vị trí của bệnh nhân hiện tại. */
function useRoomLoads(enabled: boolean, visitId: string) {
  const queries = useQueries({
    queries: orderRoomCodes.map((code) => ({
      queryKey: ["room-load", code],
      queryFn: () => medicalVisitService.getRoomQueue(code),
      enabled,
      staleTime: 15_000,
    })),
  });
  return useMemo(() => new Map(orderRoomCodes.map((code, index) => {
    const data = queries[index]?.data;
    if (!data) return [code, null] as const;
    const waiting = data.filter((item) => item.visit_step.status === "PENDING");
    const inProgress = data.filter((item) => item.visit_step.status === "IN_PROGRESS").length;
    const position = waiting.findIndex((item) => item.medical_visit.id === visitId);
    return [code, { waiting: waiting.length, inProgress, ahead: position >= 0 ? position : null }] as const;
  })), [queries, visitId]);
}

/* ─────────────────────────── Nội dung tab "Chỉ định" ─────────────────────────── */

export function OrdersPanel({ visitId, steps, onOpenDialog }: { visitId: string; steps: VisitStep[]; onOpenDialog: () => void }) {
  const orders = getVisitOrders(steps);

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-sm font-semibold">Chỉ định cận lâm sàng</h3>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <p className="text-xs text-muted-foreground">{orders.length > 0 ? `${orders.filter((order) => order.status === "COMPLETED").length}/${orders.length} đã có kết quả` : "Chưa có chỉ định nào"}</p>
        </div>
        <Button type="button" size="sm" className="h-9 rounded-full px-4" onClick={onOpenDialog}><ClipboardPlus /> Thêm chỉ định</Button>
      </div>

      {orders.length === 0 ? (
        <button type="button" onClick={onOpenDialog} className="w-full rounded-2xl border border-dashed px-5 py-10 text-center transition hover:border-primary/40 hover:bg-primary/[0.02]">
          <ClipboardPlus className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Chưa chỉ định phòng chức năng nào</p>
          <p className="mt-1 text-xs text-muted-foreground">Bấm để chọn phòng xét nghiệm, chẩn đoán hình ảnh hoặc thăm dò chức năng.</p>
        </button>
      ) : (
        <OrderResultList visitId={visitId} steps={steps} />
      )}
    </div>
  );
}

/** Danh sách chỉ định của lượt khám: trạng thái, vị trí chờ, xem kết quả. Dùng ở tab "Chỉ định" và "Kết luận". */
export function OrderResultList({ visitId, steps }: { visitId: string; steps: VisitStep[] }) {
  const orders = getVisitOrders(steps);
  const loads = useRoomLoads(orders.some((order) => order.status === "PENDING"), visitId);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ul className="divide-y rounded-2xl border">
      {orders.map((order) => {
        const room = allOrderRooms.find((item) => item.code === order.room.room_code);
        const Icon = room?.icon ?? FlaskConical;
        const load = loads.get(order.room.room_code);
        const done = order.status === "COMPLETED";
        const open = expanded === order.id;
        return (
          <li key={order.id} className="p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-primary")}><Icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{room?.name ?? order.room.name} <span className="font-normal text-muted-foreground">({order.room.room_code})</span></p>
                {order.instruction && <p className="truncate text-xs text-muted-foreground">Yêu cầu: {order.instruction}</p>}
              </div>
              {done ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Check className="size-3.5" /> Có kết quả {formatClock(order.completed_at)}</span>
              ) : order.status === "IN_PROGRESS" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700"><Activity className="size-3.5" /> Đang thực hiện</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"><Hourglass className="size-3.5" /> Đang chờ{load?.ahead != null ? ` · ${load.ahead} người trước` : ""}</span>
              )}
              {done && order.clinical_result && (
                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setExpanded(open ? null : order.id)}>
                  {open ? "Thu gọn" : "Xem"} <ChevronDown className={cn("transition", open && "rotate-180")} />
                </Button>
              )}
            </div>
            {open && order.clinical_result && (
              <div className="ml-12 mt-3 rounded-xl bg-muted/50 p-3">
                <Paragraphs text={order.clinical_result.result} className="text-sm leading-6 text-foreground/85" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ─────────────────────────── Dialog chọn phòng chỉ định ─────────────────────────── */

export function OrdersDialog({ open, onOpenChange, visitId, steps, onSent }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  steps: VisitStep[];
  onSent: () => Promise<void>;
}) {
  const orders = getVisitOrders(steps);
  const loads = useRoomLoads(open, visitId);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const selectedCodes = Object.keys(selected);

  const sendMutation = useMutation({
    // API hiện tại nhận một ghi chú chung, nên gửi từng phòng để giữ ghi chú riêng của mỗi phòng.
    mutationFn: async () => {
      for (const code of selectedCodes) {
        await medicalVisitService.createOrders(visitId, { room_codes: [code], instruction: selected[code]?.trim() || null });
      }
    },
    onSuccess: async () => {
      await Promise.all([onSent(), queryClient.invalidateQueries({ queryKey: ["room-load"] })]);
      toast.success(`Đã gửi ${selectedCodes.length} chỉ định.`, { description: selectedCodes.join(" · ") });
      setSelected({});
      onOpenChange(false);
    },
    onError: async (error) => {
      await onSent();
      toast.error(getApiErrorMessage(error, "Không thể gửi chỉ định."));
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) setSelected({});
    onOpenChange(next);
  }

  function toggle(code: string) {
    setSelected((current) => {
      if (code in current) {
        const rest = { ...current };
        delete rest[code];
        return rest;
      }
      return { ...current, [code]: "" };
    });
  }

  // Gợi ý phòng vắng hơn giữa các phòng cùng chức năng (vd. US-301 / US-302).
  function isLessBusy(code: string, sameFunction?: string) {
    if (!sameFunction) return false;
    const siblings = allOrderRooms.filter((room) => room.sameFunction === sameFunction);
    const totals = siblings.map((room) => {
      const load = loads.get(room.code);
      return load ? load.waiting + load.inProgress : null;
    });
    if (totals.some((total) => total === null)) return false;
    const mine = loads.get(code)!;
    const min = Math.min(...(totals as number[]));
    return mine.waiting + mine.inProgress === min && (totals as number[]).some((total) => total > min);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><ClipboardPlus className="size-4 text-primary" /> Chọn phòng chỉ định</DialogTitle>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <DialogDescription className="text-sm">Số người chờ giúp chọn phòng vắng hơn.</DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          {orderRoomGroups.map((group) => (
            <section key={group.label}>
              <p className="mb-2.5 text-xs font-semibold text-muted-foreground">{group.label}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {group.rooms.map((room) => {
                  const existing = orders.find((order) => order.room.room_code === room.code);
                  const pendingExisting = existing && existing.status !== "COMPLETED";
                  const completedExisting = existing?.status === "COMPLETED";
                  const isSelected = room.code in selected;
                  const load = loads.get(room.code);
                  const total = load ? load.waiting + load.inProgress : null;
                  const busy = total !== null && total >= BUSY_THRESHOLD;
                  const Icon = room.icon;
                  return (
                    <div key={room.code} className={cn("rounded-2xl border transition", isSelected ? "border-primary bg-primary/[0.05] ring-2 ring-primary/15" : pendingExisting ? "bg-muted/40" : "hover:border-primary/30")}>
                      <button type="button" disabled={Boolean(pendingExisting)} onClick={() => toggle(room.code)} aria-pressed={isSelected} className="flex w-full items-start gap-3 p-3.5 text-left disabled:cursor-not-allowed">
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}><Icon className="size-[1.1rem]" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{room.name} <span className="font-normal text-muted-foreground">({room.code})</span></span>
                          <span className="block text-xs text-muted-foreground">{room.detail}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {load ? (
                              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium", busy ? "bg-[var(--brand-coral-soft)] text-[oklch(0.55_0.16_35)]" : "bg-muted text-muted-foreground")}>
                                <Users className="size-3" /> {load.waiting} đang chờ · {load.inProgress} đang làm
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground"><LoaderCircle className="size-3 animate-spin" /> Đang tải...</span>
                            )}
                            {isLessBusy(room.code, room.sameFunction) && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700">Ít người hơn</span>}
                            {pendingExisting && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-700">Đã chỉ định</span>}
                            {completedExisting && !isSelected && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700">Đã có kết quả</span>}
                          </span>
                        </span>
                        {isSelected ? (
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>
                        ) : completedExisting ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[0.7rem] font-medium text-primary"><RotateCcw className="size-3" /> Chỉ định lại</span>
                        ) : null}
                      </button>
                      {isSelected && (
                        <div className="border-t px-3.5 pb-3.5 pt-3">
                          <Textarea
                            value={selected[room.code]}
                            onChange={(event) => setSelected((current) => ({ ...current, [room.code]: event.target.value }))}
                            rows={2}
                            placeholder={`Yêu cầu cho ${room.name.toLocaleLowerCase("vi")}...`}
                            className="min-h-14 resize-none rounded-xl bg-background p-2.5 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4 sm:px-8">
          <p className="text-xs text-muted-foreground">{selectedCodes.length > 0 ? `Đã chọn: ${selectedCodes.join(", ")}` : "Chọn một hoặc nhiều phòng, có thể ghi yêu cầu riêng cho từng phòng."}</p>
          <Button type="button" disabled={selectedCodes.length === 0 || sendMutation.isPending} onClick={() => sendMutation.mutate()} className="h-10 rounded-full px-5">
            {sendMutation.isPending ? <LoaderCircle className="animate-spin" /> : <Send />} Gửi {selectedCodes.length > 0 ? `${selectedCodes.length} ` : ""}chỉ định
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
