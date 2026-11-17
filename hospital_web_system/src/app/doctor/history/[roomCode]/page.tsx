import { RoomHistoryPage } from "@/components/doctor/history/room-history-page";
import { resolveBackHref } from "@/components/doctor/queue/back-href";

type PageProps = {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ back?: string }>;
};

export default async function RoomHistoryRoute({ params, searchParams }: PageProps) {
  const [{ roomCode }, { back }] = await Promise.all([params, searchParams]);
  return <RoomHistoryPage roomCode={decodeURIComponent(roomCode).toUpperCase()} backHref={resolveBackHref(back, "/doctor/workspace?tab=history")} />;
}
