import { VisitResultsPage } from "@/components/doctor/visit-results-page";
import { resolveBackHref } from "@/components/doctor/queue/back-href";

type PageProps = {
  params: Promise<{ visitId: string }>;
  searchParams: Promise<{ back?: string }>;
};

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const [{ visitId }, { back }] = await Promise.all([params, searchParams]);
  // Có `?back=` thì nút quay lại về đúng trang gọi; không có thì quay lại theo lịch sử trình duyệt.
  return <VisitResultsPage visitId={visitId} backHref={back ? resolveBackHref(back) : undefined} />;
}
