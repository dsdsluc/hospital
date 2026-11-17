"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyNotificationIcon, usePatientNotifications } from "@/components/patient/notifications/notification-data";
import { NotificationItem } from "@/components/patient/notifications/notification-item";

/** Chuông thông báo ở header bệnh nhân: số chưa đọc + popup 6 thông báo gần nhất. */
export function NotificationBell() {
  const { items, now, unreadCount, isPending, isError, refetch, markRead, markAllRead } = usePatientNotifications();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((item) => !item.read_at);
  const visible = (onlyUnread ? unread : items).slice(0, 6);

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    function handlePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon-lg"
        className="relative rounded-full"
        aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-[1.1rem]" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-[var(--brand-coral)] px-1 text-[0.6rem] font-semibold leading-none text-white tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border bg-card shadow-xl shadow-foreground/5">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-sm font-medium">Thông báo</p>
              <p className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} chưa đọc` : "Bạn đã đọc hết"}</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5 rounded-full bg-muted p-0.5 text-xs">
                <button type="button" onClick={() => setOnlyUnread(false)} className={cn("rounded-full px-2.5 py-1 transition", !onlyUnread ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>Tất cả</button>
                <button type="button" onClick={() => setOnlyUnread(true)} className={cn("rounded-full px-2.5 py-1 transition", onlyUnread ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>Chưa đọc</button>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" title="Đánh dấu tất cả đã đọc" aria-label="Đánh dấu tất cả đã đọc" disabled={unreadCount === 0} onClick={markAllRead}>
                <CheckCheck />
              </Button>
            </div>
          </div>

          <div className="scrollbar-hidden max-h-[26rem] overflow-y-auto p-2">
            {isPending ? (
              <div className="grid place-items-center px-6 py-10 text-muted-foreground"><LoaderCircle className="size-5 animate-spin text-primary" /></div>
            ) : isError ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Không thể tải thông báo.
                <button type="button" onClick={() => refetch()} className="mt-2 block w-full text-primary hover:underline">Thử lại</button>
              </div>
            ) : visible.length === 0 ? (
              <div className="px-6 py-10 text-center text-muted-foreground">
                <EmptyNotificationIcon className="mx-auto size-6" />
                <p className="mt-2 text-sm">{onlyUnread ? "Không có thông báo chưa đọc." : "Chưa có thông báo nào."}</p>
              </div>
            ) : visible.map((item) => (
              <NotificationItem key={item.id} item={item} now={now} read={Boolean(item.read_at)} compact onOpen={() => { markRead(item.id); setOpen(false); }} />
            ))}
          </div>

          <Link href="/patient/notifications" onClick={() => setOpen(false)} className="block border-t px-4 py-3 text-center text-sm font-medium text-primary transition hover:bg-muted/50">
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
