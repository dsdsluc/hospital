"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatRelative, notificationGroupLabels, notificationTypeMeta, type PatientNotification } from "@/components/patient/notifications/notification-data";

/** Một dòng thông báo — dùng chung cho popup ở chuông và trang "Thông báo". */
export function NotificationItem({ item, now, read, onOpen, compact }: { item: PatientNotification; now: number; read: boolean; onOpen: () => void; compact?: boolean }) {
  const meta = notificationTypeMeta[item.type];
  const Icon = meta.icon;

  const content = (
    <>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", meta.tone)}><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className={cn("text-sm leading-5", read ? "text-foreground/80" : "font-medium text-foreground")}>{item.title}</p>
          {!read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--brand-coral)]" aria-label="Chưa đọc" />}
        </div>
        <p className={cn("mt-0.5 text-xs leading-5 text-muted-foreground", compact && "line-clamp-2")}>{item.body}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground/80">
          <span>{formatRelative(item.created_at, now)}</span>
          <span>·</span>
          <span>{notificationGroupLabels[meta.group]}</span>
          {item.urgent && !read && <span className="rounded-full bg-orange-50 px-1.5 font-medium text-orange-700">Cần làm ngay</span>}
        </p>
      </div>
    </>
  );

  const className = cn(
    "flex w-full gap-3 rounded-2xl px-3 py-3 text-left outline-none transition hover:bg-muted/60 focus-visible:bg-muted/70",
    !read && "bg-primary/[0.035]",
  );

  return item.href
    ? <Link href={item.href} onClick={onOpen} className={className}>{content}</Link>
    : <button type="button" onClick={onOpen} className={className}>{content}</button>;
}
