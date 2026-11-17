import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <AuthGuard allowedRoles={["DOCTOR"]}>{children}</AuthGuard>;
}
