import { EmergencyCaseDetailPage } from "@/components/doctor/emergency-case-detail-page";
import { resolveBackHref } from "@/components/doctor/queue/back-href";

type PageProps = {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ back?: string }>;
};

export default async function EmergencyCaseDetailRoute({ params, searchParams }: PageProps) {
  const [{ caseId }, { back }] = await Promise.all([params, searchParams]);
  return <EmergencyCaseDetailPage caseId={caseId} backHref={resolveBackHref(back)} />;
}
