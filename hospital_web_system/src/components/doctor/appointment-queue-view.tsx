"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Siren } from "lucide-react";

import { cn } from "@/lib/utils";
import { emergencyService } from "@/services/emergency.service";
import { EmergencyQueue } from "@/components/doctor/queue/emergency-queue";
import { RegularQueue } from "@/components/doctor/queue/regular-queue";

type QueueTab = "regular" | "emergency";

/**
 * Trang "Hàng đợi" của khu vực làm việc bác sĩ. Hai tab nằm ngay trên header của bảng:
 * - Ca thường: lịch hẹn từ hôm nay đến tương lai (lịch cũ tra cứu ở góc bộ lọc).
 * - Ca cấp cứu: các ca cấp cứu đang hoạt động (ca cũ tra cứu ở góc bộ lọc).
 * Tab đang mở lưu ở `?queue=`, mặc định theo phòng (`defaultTab`).
 */
export function AppointmentQueueView({ defaultTab = "regular" }: { defaultTab?: QueueTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queueParam = searchParams.get("queue");
  const tab: QueueTab = queueParam === "regular" || queueParam === "emergency" ? queueParam : defaultTab;

  // Dùng chung cache với tab cấp cứu để hiện số ca chưa kết thúc trên tab.
  const emergencyQuery = useQuery({ queryKey: ["emergency-cases", "open"], queryFn: emergencyService.getOpenCases });
  const emergencyCount = emergencyQuery.data?.length ?? 0;
  const hasCritical = Boolean(emergencyQuery.data?.some((item) => item.priority === "RED"));

  function changeTab(next: QueueTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("queue", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const tabs = (
    <div role="tablist" aria-label="Loại ca" className="scrollbar-hidden flex min-w-0 overflow-x-auto">
      <TabButton active={tab === "regular"} onClick={() => changeTab("regular")} icon={CalendarDays} label="Ca thường" />
      <TabButton
        active={tab === "emergency"}
        onClick={() => changeTab("emergency")}
        icon={Siren}
        label="Ca cấp cứu"
        tone="danger"
        badge={emergencyCount > 0 ? (
          <span className={cn(
            "inline-flex min-w-5 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums",
            hasCritical ? "bg-red-600 text-white" : "bg-red-100 text-red-700",
          )}>
            {hasCritical && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
            {emergencyCount}
          </span>
        ) : null}
      />
    </div>
  );

  return tab === "emergency" ? <EmergencyQueue tabs={tabs} /> : <RegularQueue tabs={tabs} />;
}

function TabButton({ active, onClick, icon: Icon, label, badge, tone = "primary" }: { active: boolean; onClick: () => void; icon: typeof Siren; label: string; badge?: ReactNode; tone?: "primary" | "danger" }) {
  const danger = tone === "danger";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "group relative flex shrink-0 items-center gap-2.5 px-3 py-3.5 text-sm transition sm:px-4",
        active ? "font-medium text-foreground" : "font-normal text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={cn(
        "grid size-8 place-items-center rounded-xl transition",
        active
          ? danger ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
          : danger ? "bg-muted text-red-500/70 group-hover:bg-red-50 group-hover:text-red-600" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
      )}>
        <Icon className="size-4" />
      </span>
      {label}
      {badge}
      {/* Gạch chân của tab đang mở, đè lên đường viền header. */}
      <span className={cn(
        "absolute inset-x-3 -bottom-px h-0.5 rounded-full transition sm:inset-x-4",
        active ? (danger ? "bg-red-600" : "bg-primary") : "bg-transparent group-hover:bg-border",
      )} />
    </button>
  );
}
