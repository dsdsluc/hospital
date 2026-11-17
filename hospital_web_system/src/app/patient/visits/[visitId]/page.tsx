import { PatientVisitDetails } from "@/components/patient/patient-visit-details";

export default async function PatientVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  return <PatientVisitDetails visitId={visitId} />;
}
