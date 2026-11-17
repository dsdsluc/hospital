"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CheckCheck, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageTitle, PageTitleBar } from "@/components/patient/page-title-bar";
import { PatientPageShell } from "@/components/patient/patient-page-shell";
import {
  EmptyNotificationIcon,
  notificationGroupLabels,
  notificationTypeMeta,
  usePatientNotifications,
  type NotificationGroup,
  type PatientNotification,
} from "@/components/patient/notifications/notification-data";
import { NotificationItem } from "@/components/patient/notifications/notification-item";

const groupOrder = Object.keys(notificationGroupLabels) as NotificationGroup[];

/** Trang "Thông báo" của bệnh nhân: lọc theo nhóm / chưa đọc, nhóm theo ngày. */
export function PatientNotificationsPage() {
  const { items, now, unreadCount, isPending, isError, refetch, markRead, markAllRead } = usePatientNotifications();
  const [group, setGroup] = useState<NotificationGroup | "ALL">("ALL");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const groupCounts = useMemo(() => {
    const result = new Map<NotificationGroup, number>();
    for (const item of items) {
      const key = notificationTypeMeta[item.type].group;
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  }, [items]);

  const filtered = items.filter((item) => (group === "ALL" || notificationTypeMeta[item.type].group === group) && (!onlyUnread || !item.read_at));

  // Nhóm theo ngày: Hôm nay / Hôm qua / ngày cụ thể.
  const days: Array<{ label: string; items: PatientNotification[] }> = [];
  for (const item of filtered) {
    const label = dayLabel(item.created_at, now);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(item);
    else days.push({ label, items: [item] });
  }

  return (
    <PatientPageShell>
      <PageTitleBar
        title={<PageTitle>Thông báo</PageTitle>}
        badge={unreadCount ? `${unreadCount} chưa đọc` : "Đã đọc hết"}
        description="Mời đến phòng tiếp theo, thanh toán, nhận thuốc và nhắc lịch hẹn."
        actions={(
          <Button type="button" variant="outline" className="h-10 rounded-full px-4" disabled={unreadCount === 0} onClick={markAllRead}>
            <CheckCheck /> Đánh dấu tất cả đã đọc
          </Button>
        )}
      />

      <section className="overflow-hidden rounded-[1.6rem] border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="scrollbar-hidden -mx-1 flex gap-1.5 overflow-x-auto px-1">
            <Chip active={group === "ALL"} onClick={() => setGroup("ALL")} label="Tất cả" count={items.length} />
            {groupOrder.filter((key) => groupCounts.has(key)).map((key) => (
              <Chip key={key} active={group === key} onClick={() => setGroup(key)} label={notificationGroupLabels[key]} count={groupCounts.get(key) ?? 0} />
            ))}
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} className="size-3.5 accent-[var(--primary)]" />
            Chỉ chưa đọc <span className="tabular-nums">({unreadCount})</span>
          </label>
        </div>

        {isPending ? (
          <div className="grid place-items-center px-6 py-16"><LoaderCircle className="size-6 animate-spin text-primary" /></div>
        ) : isError ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            Không thể tải thông báo.
            <Button type="button" variant="outline" className="mx-auto mt-3 block rounded-full" onClick={() => refetch()}>Thử lại</Button>
          </div>
        ) : days.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <EmptyNotificationIcon className="mx-auto size-7" />
            <p className="mt-3 text-sm">{onlyUnread ? "Không có thông báo chưa đọc." : "Chưa có thông báo nào."}</p>
          </div>
        ) : (
          <div className="divide-y">
            {days.map((day) => (
              <div key={day.label} className="px-2 py-3 sm:px-4">
                <p className="px-3 pb-1 text-xs font-medium capitalize text-muted-foreground">{day.label}</p>
                <div className="space-y-0.5">
                  {day.items.map((item) => <NotificationItem key={item.id} item={item} now={now} read={Boolean(item.read_at)} onOpen={() => markRead(item.id)} />)}
                </div>
              </div>
            ))}
          </div>
        )}

      </section>
    </PatientPageShell>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition", active ? "border-primary bg-primary text-primary-foreground" : "border-border/80 text-muted-foreground hover:border-primary/35 hover:text-foreground")}
    >
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground/80")}>{count}</span>
    </button>
  );
}

function dayLabel(value: string, now: number) {
  const key = (time: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(time));
  const day = key(new Date(value).getTime());
  if (day === key(now)) return "Hôm nay";
  if (day === key(now - 24 * 60 * 60 * 1000)) return "Hôm qua";
  return format(new Date(value), "EEEE, dd/MM/yyyy", { locale: vi });
}
