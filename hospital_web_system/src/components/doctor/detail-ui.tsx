import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Thành phần hiển thị gọn cho các trang chi tiết (lịch hẹn, ca cấp cứu, kết quả lượt khám). */

export type VitalFlag = "LOW" | "HIGH" | null;

export function rangeFlag(value: number | null | undefined, min: number, max: number): VitalFlag {
  if (value == null) return null;
  return value < min ? "LOW" : value > max ? "HIGH" : null;
}

/** Ngưỡng giống phòng tiếp nhận: > 139/89 là cao, < 90/60 là thấp. */
export function bloodPressureFlag(systolic: number | null | undefined, diastolic: number | null | undefined): VitalFlag {
  if (systolic == null || diastolic == null) return null;
  if (systolic > 139 || diastolic > 89) return "HIGH";
  if (systolic < 90 || diastolic < 60) return "LOW";
  return null;
}

export function spo2Flag(value: number | null | undefined): VitalFlag {
  return value != null && value < 95 ? "LOW" : null;
}

/** Dải chỉ số sinh tồn: một khung viền mảnh, các ô ngăn bằng đường kẻ. */
export function VitalStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-b [&>*]:border-r", className)}>{children}</div>;
}

export function Vital({ label, value, unit, flag = null }: { label: string; value: string | number | null | undefined; unit?: string; flag?: VitalFlag }) {
  const empty = value == null || value === "";
  return (
    <div className="-mb-px -mr-px px-4 py-3">
      <p className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
        {label}
        {flag && <span className={cn("rounded-full px-1.5 text-[0.6rem] font-medium", flag === "HIGH" ? "bg-red-50 text-red-600" : "bg-sky-50 text-sky-700")}>{flag === "HIGH" ? "Cao" : "Thấp"}</span>}
      </p>
      <p className={cn("mt-1 text-base font-medium tabular-nums", empty && "text-muted-foreground", flag === "HIGH" && "text-red-600", flag === "LOW" && "text-sky-700")}>
        {empty ? "—" : value}
        {!empty && unit && <span className="ml-1 text-[0.7rem] font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

/** Danh sách nhãn – nội dung, ngăn bằng đường kẻ mảnh (thay cho các ô nền xám). */
export function DetailList({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  return <dl className={cn("grid gap-x-8", columns === 2 && "md:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>{children}</dl>;
}

export function Detail({ label, value, wide, className }: { label: string; value: ReactNode; wide?: boolean; className?: string }) {
  const empty = value == null || value === "";
  return (
    <div className={cn("border-t py-3", wide && "col-span-full", className)}>
      <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 whitespace-pre-wrap text-sm leading-6", empty && "text-muted-foreground/70")}>{empty ? "Chưa cập nhật" : value}</dd>
    </div>
  );
}

export function RecordedAt({ children }: { children: ReactNode }) {
  return <p className="text-[0.7rem] text-muted-foreground">{children}</p>;
}
