import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <AuthGuard allowedRoles={["PATIENT"]}>{children}</AuthGuard>;
}
