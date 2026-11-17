"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Thành phần nhỏ dùng chung cho các tab chuyên khoa. Không có ô nào bắt buộc. */

export function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={cn("block space-y-1.5", className)}><span className="block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

export function Unit({ unit, children }: { unit: string; children: ReactNode }) {
  return <div className="relative">{children}<span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span></div>;
}

const chipClass = (active: boolean, tone: "primary" | "warn" = "primary") => cn(
  "h-8 rounded-full border px-3 text-xs font-medium transition",
  active ? (tone === "warn" ? "border-amber-400 bg-amber-100 text-amber-900" : "border-primary bg-primary text-primary-foreground") : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
);

/** Chọn một; bấm lại chip đang chọn để bỏ chọn. Chip có `warn` được tô vàng khi chọn (bất thường). */
export function Chips({ label, options, value, onChange, className }: { label?: string; options: Array<string | { value: string; warn?: boolean }>; value: string; onChange: (next: string) => void; className?: string }) {
  return <div className={cn("space-y-1.5", className)}>
    {label && <span className="block text-xs font-medium text-muted-foreground">{label}</span>}
    <div className="flex flex-wrap gap-1.5">{options.map((option) => {
      const item = typeof option === "string" ? { value: option, warn: false } : option;
      const active = value === item.value;
      return <button key={item.value} type="button" aria-pressed={active} onClick={() => onChange(active ? "" : item.value)} className={chipClass(active, item.warn ? "warn" : "primary")}>{item.value}</button>;
    })}</div>
  </div>;
}

/** Chọn nhiều. */
export function MultiChips({ label, options, value, onChange, className }: { label?: string; options: string[]; value: string[]; onChange: (next: string[]) => void; className?: string }) {
  return <div className={cn("space-y-1.5", className)}>
    {label && <span className="block text-xs font-medium text-muted-foreground">{label}</span>}
    <div className="flex flex-wrap gap-1.5">{options.map((option) => {
      const active = value.includes(option);
      return <button key={option} type="button" aria-pressed={active} onClick={() => onChange(active ? value.filter((x) => x !== option) : [...value, option])} className={chipClass(active)}>{option}</button>;
    })}</div>
  </div>;
}

export function Group({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{title}</p>{aside}</div>
    <div className="space-y-3">{children}</div>
  </div>;
}

/** Đọc chuỗi / mảng chuỗi an toàn từ dữ liệu JSON đã lưu. */
export const str = (value: unknown) => (typeof value === "string" ? value : "");
export const strList = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []);
export const obj = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** Ghép câu mô tả vào ô khám lâm sàng: rỗng thì thay, có nội dung thì nối xuống dòng. */
export function appendText(current: string, addition: string) {
  const trimmed = current.trim();
  return trimmed ? `${trimmed}\n${addition}` : addition;
}
