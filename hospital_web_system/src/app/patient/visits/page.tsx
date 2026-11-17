import { MedicalVisitHistory } from "@/components/patient/medical-visit-history";
import { PageTitle, PageTitleBar } from "@/components/patient/page-title-bar";
import { PatientPageShell } from "@/components/patient/patient-page-shell";

export default function VisitsPage() {
  return (
    <PatientPageShell>
      <PageTitleBar
        title={<PageTitle>Kết quả và đơn thuốc</PageTitle>}
        badge="Hồ sơ khám bệnh"
        description="Toàn bộ lịch sử khám của bạn được lưu tại đây."
      />
      <MedicalVisitHistory />
    </PatientPageShell>
  );
}
