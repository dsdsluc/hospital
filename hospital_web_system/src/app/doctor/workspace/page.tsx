import { Suspense } from "react";
import { DoctorWorkspace } from "@/components/doctor/doctor-workspace";

type WorkspacePageProps = {
  searchParams: Promise<{
    floor?: string;
    room?: string;
    roomName?: string;
    function?: string;
  }>;
};

export default function DoctorWorkspacePage({ searchParams }: WorkspacePageProps) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <WorkspaceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkspaceContent({ searchParams }: WorkspacePageProps) {
  const params = await searchParams;

  return (
    <DoctorWorkspace
      floor={params.floor ?? "Tầng 2"}
      roomCode={params.room ?? "GEN-201"}
      roomName={params.roomName ?? "Phòng khám tổng quát 1"}
      roomFunction={params.function ?? "Khám tổng quát"}
    />
  );
}

function WorkspaceFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/35">
      <div className="text-center">
        <div className="mx-auto size-10 animate-pulse rounded-2xl bg-primary/15" />
        <p className="mt-3 text-sm text-muted-foreground">Đang thiết lập khu vực làm việc...</p>
      </div>
    </div>
  );
}
