import { AppointmentDetailPage } from "@/components/doctor/appointment-detail-page";
import { resolveBackHref } from "@/components/doctor/queue/back-href";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ back?: string }>;
};

export default async function AppointmentDetailRoute({ params, searchParams }: PageProps) {
  const [{ code }, { back }] = await Promise.all([params, searchParams]);
  return <AppointmentDetailPage code={decodeURIComponent(code).toUpperCase()} backHref={resolveBackHref(back)} />;
}
