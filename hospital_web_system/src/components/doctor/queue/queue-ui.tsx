"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Copy, RefreshCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Phần dùng chung cho hai tab của trang "Hàng đợi" (ca thường / ca cấp cứu). */

export const PAGE_SIZE = 20;
/** Giới hạn số bản ghi server trả về cho một lần tra cứu. */
export const RANGE_LIMIT = 1000;

/**
 * Header của card danh sách: tab loại ca nằm ngay trên đường viền (thay cho tiêu đề),
 * bên phải là chú thích ngắn + nút làm mới.
 */
export function QueueCardHeader({ tabs, hint, fetching, onRefresh }: { tabs: ReactNode; hint?: string | null; fetching: boolean; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pl-2 pr-3 sm:pl-3 sm:pr-4">
      {tabs}
      <div className="flex min-w-0 items-center gap-2">
        {hint && <span className="hidden truncate text-xs text-muted-foreground md:inline">{hint}</span>}
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 rounded-full" onClick={onRefresh} aria-label="Làm mới" disabled={fetching}>
          <RefreshCw className={cn(fetching && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}

/** Link tới trang chi tiết, kèm `?back=` là URL hiện tại để nút "Quay lại" về đúng tab / bộ lọc phòng. */
export function useDetailHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const back = encodeURIComponent(query ? `${pathname}?${query}` : pathname);
  return (path: string) => `${path}?back=${back}`;
}

/** Thuộc tính cho một dòng / thẻ bấm được để mở trang chi tiết (chuột + bàn phím). */
export function clickableProps(onOpen: () => void, label: string) {
  return {
    role: "link" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: onOpen,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    },
  };
}

/** Phân trang phía client; trang gắn với `filterKey` nên đổi bộ lọc sẽ tự quay về trang 1. */
export function usePagination<T>(items: T[], filterKey: string) {
  const [state, setState] = useState({ key: "", page: 1 });
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(state.key === filterKey ? state.page : 1, pageCount);
  return {
    page,
    pageCount,
    offset: (page - 1) * PAGE_SIZE,
    pageItems: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    setPage: (next: number) => setState({ key: filterKey, page: next }),
  };
}

export function ListFooter({ shown, offset, total, unfiltered, unit, page, pageCount, onPage }: { shown: number; offset: number; total: number; unfiltered: number; unit: string; page: number; pageCount: number; onPage: (page: number) => void }) {
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:px-5">
      <p>
        Hiển thị <span className="font-semibold text-foreground">{offset + 1}–{offset + shown}</span> trên <span className="font-semibold text-foreground">{total}</span> {unit}{total !== unfiltered && ` (lọc từ ${unfiltered})`}
        {unfiltered >= RANGE_LIMIT && <span className="ml-1 text-[oklch(0.55_0.16_35)]">· Chỉ tải {RANGE_LIMIT} bản ghi đầu tiên, hãy thu hẹp khoảng thời gian.</span>}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" className="rounded-full" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Trang trước"><ChevronLeft /></Button>
          <span className="min-w-16 text-center font-medium text-foreground">{page} / {pageCount}</span>
          <Button type="button" variant="outline" size="icon-sm" className="rounded-full" disabled={page === pageCount} onClick={() => onPage(page + 1)} aria-label="Trang sau"><ChevronRight /></Button>
        </div>
      )}
    </div>
  );
}

export function CopyCode({ code, label, tone = "primary" }: { code: string; label: string; tone?: "primary" | "danger" }) {
  const [copied, setCopied] = useState(false);

  async function copy(event: React.MouseEvent) {
    // Không mở trang chi tiết khi bấm sao chép mã trong dòng.
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Đã sao chép mã ${code}`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`Không thể sao chép ${label}.`);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Sao chép ${label}`}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-xs font-semibold tracking-wide transition",
        tone === "danger" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-primary/8 text-primary hover:bg-primary/15",
      )}
    >
      {code}
      {copied ? <Check className="size-3" /> : <Copy className="size-3 opacity-50 transition group-hover:opacity-100" />}
    </button>
  );
}

export function FilterSelect({ label, value, onChange, options, icon, className }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][]; icon?: ReactNode; className?: string }) {
  return (
    <label className={cn("flex h-10 items-center gap-2 rounded-xl border border-input bg-background pl-3 pr-1 text-sm transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20", className)}>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">{icon}{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 cursor-pointer bg-transparent pr-1 text-sm font-medium outline-none">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

export function FilterChip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", active ? "bg-primary-foreground" : dot)} />}
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground/80")}>{count}</span>
    </button>
  );
}

/** Nút nhỏ ở góc bộ lọc để mở phần tra cứu dữ liệu cũ (không ưu tiên). */
export function CornerLink({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

export function DateField({ label, value, max, onChange }: { label: string; value: string; max: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-2 text-xs transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
      <span className="text-muted-foreground">{label}</span>
      <input type="date" value={value} max={max} onChange={(event) => { if (event.target.value) onChange(event.target.value); }} className="bg-transparent font-medium outline-none" />
    </label>
  );
}

export function StateBlock({ children }: { children: ReactNode }) {
  return <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">{children}</div>;
}

export function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((word) => word[0]?.toLocaleUpperCase("vi") ?? "").join("");
}

export function formatGender(gender: "MALE" | "FEMALE" | "OTHER" | null) {
  if (gender === "MALE") return "Nam";
  if (gender === "FEMALE") return "Nữ";
  if (gender === "OTHER") return "Khác";
  return "—";
}

export function getAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return "Chưa rõ tuổi";
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return "Chưa rõ tuổi";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getUTCFullYear();
  if (today.getMonth() < birthDate.getUTCMonth() || (today.getMonth() === birthDate.getUTCMonth() && today.getDate() < birthDate.getUTCDate())) age -= 1;
  return `${age} tuổi`;
}

/** Giờ:phút theo giờ Việt Nam. */
export function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "2026-11-14" → "14/11/2026". */
export function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một mốc thời gian ISO. */
export function vietnamDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** "35 phút", "2 giờ 10 phút", "3 ngày". */
export function formatDuration(minutes: number) {
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
  }
  return `${Math.floor(minutes / (24 * 60))} ngày`;
}
