import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AppointmentHistory } from "@/components/patient/appointment-history";
import { AppointmentDialog } from "@/components/patient/appointment-dialog";
import { PageTitle, PageTitleBar } from "@/components/patient/page-title-bar";
import { PatientPageShell } from "@/components/patient/patient-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AppointmentHistoryPage() {
  return (
    <PatientPageShell>
      <PageTitleBar
        title={<PageTitle>Lịch sử đặt lịch</PageTitle>}
        badge="Lịch khám"
        description="Toàn bộ lịch khám bạn đã đặt, kể cả lịch đã qua và đã hủy."
        actions={
          <>
            <Link href="/patient/appointments" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-5")}>
              <ArrowLeft className="size-4" /> Lịch sắp tới
            </Link>
            <AppointmentDialog />
          </>
        }
      />
      <AppointmentHistory />
    </PatientPageShell>
  );
}
