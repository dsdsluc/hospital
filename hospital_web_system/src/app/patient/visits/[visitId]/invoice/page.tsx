import { PatientInvoiceDetails } from "@/components/patient/patient-invoice-details";

/** Chi tiết hóa đơn của một lượt khám (phía bệnh nhân). */
export default async function PatientVisitInvoicePage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  return <PatientInvoiceDetails visitId={visitId} />;
}
