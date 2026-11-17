import { InvoiceDetailPage } from "@/components/doctor/invoice-detail-page";
import { resolveBackHref } from "@/components/doctor/queue/back-href";

type PageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ back?: string }>;
};

/** Chi tiết hóa đơn (mở từ lịch sử phòng CAS-103). */
export default async function InvoiceDetailRoute({ params, searchParams }: PageProps) {
  const [{ invoiceId }, { back }] = await Promise.all([params, searchParams]);
  return <InvoiceDetailPage invoiceId={invoiceId} backHref={resolveBackHref(back)} />;
}
