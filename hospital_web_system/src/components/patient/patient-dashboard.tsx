"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pickRandomGreeting } from "@/lib/greetings";
import { AppointmentDialog } from "@/components/patient/appointment-dialog";
import { CurrentVisitGuide } from "@/components/patient/current-visit-guide";
import { PageTitleBar } from "@/components/patient/page-title-bar";
import { PatientPageShell } from "@/components/patient/patient-page-shell";
import { UpcomingAppointmentCard } from "@/components/patient/upcoming-appointment-card";
import { patientService } from "@/services/patient.service";

export function PatientDashboard() {
  const profile = useQuery({ queryKey: ["patient-profile"], queryFn: patientService.getMyProfile });
  const patient = profile.data;
  const fullName = patient?.full_name.trim().replace(/\s+/g, " ") || "bạn";
  const [greeting] = useState(pickRandomGreeting);
  const today = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return (
    <PatientPageShell>
      <PageTitleBar
        title={<h1 className="text-[0.95rem] font-normal text-muted-foreground">{greeting.before}<span className="font-medium text-foreground">{fullName}</span>{greeting.after} <span aria-hidden>👋</span></h1>}
        badge={today}
        description="Mọi thông tin chăm sóc sức khỏe của bạn ở cùng một nơi."
        actions={<AppointmentDialog />}
      />

      <div className="space-y-6">
        <CurrentVisitGuide />
        <UpcomingAppointmentCard />
      </div>
    </PatientPageShell>
  );
}
