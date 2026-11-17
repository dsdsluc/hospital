import Link from "next/link";
import { History } from "lucide-react";

import { AppointmentDialog } from "@/components/patient/appointment-dialog";
import { PageTitle, PageTitleBar } from "@/components/patient/page-title-bar";
import { PatientPageShell } from "@/components/patient/patient-page-shell";
import { UpcomingAppointmentCard } from "@/components/patient/upcoming-appointment-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AppointmentsPage() {
  return (
    <PatientPageShell>
      <PageTitleBar
        title={<PageTitle>Lịch khám của tôi</PageTitle>}
        badge="Lịch khám"
        description="Xem lịch sắp tới hoặc đăng ký một lịch khám mới."
        actions={
          <>
            <Link href="/patient/appointments/history" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-5")}>
              <History className="size-4" /> Lịch sử đặt lịch
            </Link>
            <AppointmentDialog />
          </>
        }
      />
      <UpcomingAppointmentCard />
    </PatientPageShell>
  );
}
