import { SurgeryFocusPage } from "@/components/doctor/surgery-focus-page";

type SurgeryPageProps = {
  params: Promise<{ preparationId: string }>;
  searchParams: Promise<{ room?: string; roomName?: string; returnTo?: string }>;
};

/** Màn hình tập trung khi đang mổ: không header / sidebar của khu vực làm việc. */
export default async function SurgeryPage({ params, searchParams }: SurgeryPageProps) {
  const { preparationId } = await params;
  const query = await searchParams;
  const roomCode = query.room === "OR-502" ? "OR-502" : "OR-501";
  // Chỉ cho quay lại đường dẫn nội bộ của khu vực bác sĩ.
  const returnTo = query.returnTo?.startsWith("/doctor") ? query.returnTo : "/doctor";
  return (
    <SurgeryFocusPage
      preparationId={preparationId}
      roomCode={roomCode}
      roomName={query.roomName ?? (roomCode === "OR-502" ? "Phòng phẫu thuật 2" : "Phòng phẫu thuật 1")}
      returnTo={returnTo}
    />
  );
}
