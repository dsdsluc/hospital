import type { ReactNode } from "react";
import { PatientHeader } from "@/components/patient/patient-header";

/** Khung chung cho các trang bệnh nhân: nền, header và vùng nội dung. */
export function PatientPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,oklch(0.975_0.012_170)_100%)]">
      <PatientHeader />
      <main className="mx-auto max-w-7xl px-4 pb-14 pt-7 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
