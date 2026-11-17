"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle, Scissors, Stethoscope, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emergencyService } from "@/services/emergency.service";
import {
  OrdersSummary,
  PretransferVitals,
  SurgeryReportForm,
  urgencyLabel,
  urgencyStyle,
  type OrRoom,
} from "@/components/doctor/workspaces/surgery-workspace";

/**
 * Màn hình tập trung ca mổ: chỉ giữ thông tin cơ bản của bệnh nhân + phòng mổ,
 * đồng hồ mổ và biên bản. Hoàn tất ca mổ thì quay lại workspace phòng mổ.
 */
export function SurgeryFocusPage({ preparationId, roomCode, roomName, returnTo }: { preparationId: string; roomCode: OrRoom; roomName: string; returnTo: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["surgical-transfers", roomCode], queryFn: () => emergencyService.getSurgicalTransfers(roomCode), refetchInterval: 15_000 });
  const item = query.data?.find((entry) => entry.id === preparationId);
  const now = useSecondTicker();

  async function handleCompleted() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["surgical-transfers", roomCode] }),
      queryClient.invalidateQueries({ queryKey: ["or-load"] }),
    ]);
    router.push(returnTo);
  }

  if (query.isPending) {
    return <Centered><LoaderCircle className="size-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang mở ca mổ...</p></Centered>;
  }
  if (!item || !item.emergency_case) {
    return <Centered>
      <Scissors className="size-8 text-muted-foreground" />
      <p className="mt-3 font-semibold">Ca mổ không còn ở {roomCode}</p>
      <p className="mt-1 text-sm text-muted-foreground">Ca có thể đã hoàn tất và được chuyển sang phòng hồi tỉnh hoặc hồi sức.</p>
      <Link href={returnTo} className={cn(buttonVariants(), "mt-5 rounded-full px-5")}><ArrowLeft /> Về khu vực làm việc</Link>
    </Centered>;
  }

  const patient = item.emergency_case;
  const started = item.surgery_started_at ? new Date(item.surgery_started_at).getTime() : null;
  const elapsed = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;

  return <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,oklch(0.97_0.014_170)_100%)]">
    {/* Thanh trên tối giản: quay lại + phòng mổ + đồng hồ mổ */}
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link href={returnTo} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}><ArrowLeft /> Khu vực làm việc</Link>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <span className="inline-flex items-center gap-2 text-sm"><Scissors className="size-4 text-red-600" /><span className="font-semibold">{roomCode}</span><span className="text-muted-foreground">· {roomName}</span></span>
        <div className="ml-auto flex items-center gap-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", item.surgery_status === "IN_PROGRESS" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700")}>
            <span className={cn("size-1.5 rounded-full", item.surgery_status === "IN_PROGRESS" ? "animate-pulse bg-red-600" : "bg-slate-500")} />
            {item.surgery_status === "IN_PROGRESS" ? "Đang phẫu thuật" : "Chờ phẫu thuật"}
          </span>
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight" aria-label="Thời gian mổ">{formatTimer(elapsed)}</span>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6">
      {/* Thông tin cơ bản bệnh nhân */}
      <section className="flex flex-wrap items-center gap-4 rounded-[1.4rem] border bg-card px-5 py-4 shadow-sm">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-red-600 text-white"><UserRound className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-semibold">{patient.full_name}</h1><span className={cn("rounded-full px-3 py-1 text-xs font-semibold", urgencyStyle[item.urgency])}>{urgencyLabel(item.urgency)}</span></div>
          <p className="mt-0.5 text-xs text-muted-foreground">{patient.emergency_code} · {patient.age ?? "?"} tuổi{item.surgery_started_at ? ` · bắt đầu mổ ${formatClock(item.surgery_started_at)}` : ""}</p>
        </div>
        <div className="flex min-w-0 max-w-xl items-start gap-2 rounded-xl bg-muted/55 px-3.5 py-2.5 text-sm">
          <Stethoscope className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Chẩn đoán trước mổ</p><p className="font-medium">{item.preliminary_diagnosis || "Chưa ghi"}</p></div>
        </div>
        {item.disposition_note && <p className="w-full border-t pt-3 text-xs"><span className="text-muted-foreground">Bàn giao từ PRE-503: </span><span className="whitespace-pre-wrap">{item.disposition_note}</span></p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Biên bản ngay trên trang */}
        <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-4">
            <h2 className="text-[0.95rem] font-semibold">Biên bản phẫu thuật</h2>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <p className="text-sm text-muted-foreground">Hoàn tất sẽ chuyển bệnh nhân và quay lại khu vực làm việc</p>
          </div>
          <SurgeryReportForm item={item} roomCode={roomCode} onCompleted={handleCompleted} />
        </section>

        {/* Thông tin tham khảo */}
        <aside className="space-y-5">
          <PretransferVitals item={item} />
          <OrdersSummary orders={item.orders} />
        </aside>
      </div>
    </main>
  </div>;
}

/** Đồng hồ cập nhật mỗi giây cho bộ đếm thời gian mổ. */
function useSecondTicker() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-muted/35 px-5"><div className="flex flex-col items-center text-center">{children}</div></div>;
}

function formatTimer(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}
