"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  DoorOpen,
  Layers3,
  LogOut,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

import { SiteLogo } from "@/components/public/site-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authStorage } from "@/lib/auth-storage";

type Floor = {
  id: number;
  code: string;
  name: string;
  function: string;
};

type Room = {
  code: string;
  name: string;
  function: string;
  floorId: number;
};

const floors: Floor[] = [
  { id: 1, code: "FLOOR-01", name: "Tầng 1", function: "Tiếp nhận và cấp cứu" },
  { id: 2, code: "FLOOR-02", name: "Tầng 2", function: "Khám bệnh ngoại trú" },
  { id: 3, code: "FLOOR-03", name: "Tầng 3", function: "Chẩn đoán và xét nghiệm" },
  { id: 4, code: "FLOOR-04", name: "Tầng 4", function: "Điều trị và theo dõi" },
  { id: 5, code: "FLOOR-05", name: "Tầng 5", function: "Phẫu thuật và hồi sức" },
];

const rooms: Room[] = [
  { code: "REC-101", name: "Phòng tiếp nhận", function: "Tiếp nhận bệnh nhân", floorId: 1 },
  { code: "ER-102", name: "Phòng cấp cứu", function: "Cấp cứu", floorId: 1 },
  // CAS-103 (trước là TRI-103) thay cho TRI-103 / LAB-104 — hai phòng trước đây chưa có chức năng.
  { code: "CAS-103", name: "Quầy thu ngân", function: "Thu ngân", floorId: 1 },
  { code: "PHM-105", name: "Nhà thuốc", function: "Cấp phát thuốc", floorId: 1 },
  { code: "GEN-201", name: "Phòng khám tổng quát 1", function: "Khám tổng quát", floorId: 2 },
  { code: "GEN-202", name: "Phòng khám tổng quát 2", function: "Khám tổng quát", floorId: 2 },
  { code: "INT-203", name: "Phòng khám nội khoa", function: "Nội khoa", floorId: 2 },
  { code: "PED-204", name: "Phòng khám nhi", function: "Nhi khoa", floorId: 2 },
  { code: "ENT-205", name: "Phòng tai mũi họng", function: "Tai mũi họng", floorId: 2 },
  { code: "DER-206", name: "Phòng da liễu", function: "Da liễu", floorId: 2 },
  { code: "US-301", name: "Phòng siêu âm 1", function: "Siêu âm", floorId: 3 },
  { code: "US-302", name: "Phòng siêu âm 2", function: "Siêu âm", floorId: 3 },
  { code: "XR-303", name: "Phòng X-quang", function: "Chụp X-quang", floorId: 3 },
  { code: "CT-304", name: "Phòng CT", function: "Chụp CT", floorId: 3 },
  { code: "LAB-305", name: "Phòng xét nghiệm máu", function: "Xét nghiệm máu", floorId: 3 },
  { code: "ECG-306", name: "Phòng điện tim", function: "Điện tim", floorId: 3 },
  { code: "IP-401", name: "Phòng bệnh 1", function: "Điều trị nội trú", floorId: 4 },
  { code: "IP-402", name: "Phòng bệnh 2", function: "Điều trị nội trú", floorId: 4 },
  { code: "OBS-403", name: "Phòng theo dõi", function: "Theo dõi", floorId: 4 },
  { code: "ISO-404", name: "Phòng cách ly", function: "Cách ly", floorId: 4 },
  { code: "NUR-405", name: "Phòng trực điều dưỡng", function: "Trực điều dưỡng", floorId: 4 },
  { code: "OR-501", name: "Phòng phẫu thuật 1", function: "Phẫu thuật", floorId: 5 },
  { code: "OR-502", name: "Phòng phẫu thuật 2", function: "Phẫu thuật", floorId: 5 },
  { code: "PRE-503", name: "Phòng chuẩn bị phẫu thuật", function: "Chuẩn bị phẫu thuật", floorId: 5 },
  { code: "REC-504", name: "Phòng hồi tỉnh", function: "Hồi tỉnh", floorId: 5 },
  { code: "ICU-505", name: "Phòng hồi sức tích cực", function: "Hồi sức tích cực", floorId: 5 },
];

export function DoctorLocationSelector() {
  const router = useRouter();
  const [selectedFloorId, setSelectedFloorId] = useState(2);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string>();

  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId);
  const selectedRoom = rooms.find((room) => room.code === selectedRoomCode);
  const floorRooms = useMemo(() => rooms.filter((room) => room.floorId === selectedFloorId), [selectedFloorId]);

  function chooseFloor(floorId: number) {
    setSelectedFloorId(floorId);
    setSelectedRoomCode(undefined);
  }

  function confirmLocation() {
    if (!selectedFloor || !selectedRoom) return;
    toast.success("Đang mở khu vực làm việc...");
    const query = new URLSearchParams({
      floor: selectedFloor.name,
      room: selectedRoom.code,
      roomName: selectedRoom.name,
      function: selectedRoom.function,
    });
    router.push(`/doctor/workspace?${query.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,oklch(0.97_0.014_170)_100%)]">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <SiteLogo />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">BS. Minh Trần</p>
              <p className="text-xs text-muted-foreground">DR0001 · Bác sĩ</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">MT</div>
            <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Đăng xuất" onClick={() => { authStorage.removeAccessToken(); router.push("/auth/login"); }}>
              <LogOut className="size-[1.1rem]" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-32 pt-7 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm backdrop-blur md:px-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><MapPin className="size-4" /></span>
          <h1 className="text-[0.95rem] font-semibold">Chọn vị trí làm việc</h1>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <p className="text-sm text-muted-foreground">Chọn tầng và phòng bạn đang phụ trách.</p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <section className="rounded-[1.5rem] border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex items-center gap-3 px-3 pb-3 pt-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Layers3 className="size-4" /></span>
              <div><h2 className="font-semibold">Chọn tầng</h2><p className="text-xs text-muted-foreground">5 tầng đang hoạt động</p></div>
            </div>
            <div className="space-y-1.5">
              {floors.map((floor) => {
                const active = floor.id === selectedFloorId;
                const roomCount = rooms.filter((room) => room.floorId === floor.id).length;
                return (
                  <button key={floor.id} type="button" onClick={() => chooseFloor(floor.id)} className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left transition", active ? "bg-primary text-primary-foreground shadow-md shadow-primary/15" : "hover:bg-muted")}>
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-white/15" : "bg-muted text-primary")}><Building2 className="size-[1.1rem]" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{floor.name}</span><span className={cn("block truncate text-xs", active ? "text-white/70" : "text-muted-foreground")}>{floor.function}</span></span>
                    <span className={cn("text-xs font-medium", active ? "text-white/80" : "text-muted-foreground")}>{roomCount}</span>
                    <ChevronRight className="size-4" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b pb-4"><span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Bước 2</span><h2 className="text-base font-semibold">Chọn phòng tại {selectedFloor?.name}</h2><span className="hidden h-5 w-px bg-border sm:block" /><p className="text-sm text-muted-foreground">{selectedFloor?.function}</p></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {floorRooms.map((room) => {
                const active = room.code === selectedRoomCode;
                return (
                  <button key={room.code} type="button" onClick={() => setSelectedRoomCode(room.code)} className={cn("relative min-h-40 rounded-2xl border p-4 text-left transition", active && "border-primary bg-primary/[0.06] ring-2 ring-primary/20", !active && "border-border/80 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md")}>
                    <div className="flex items-start justify-between gap-3"><span className={cn("grid size-10 place-items-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}><DoorOpen className="size-[1.1rem]" /></span>{active && <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}</div>
                    <p className="mt-4 text-xs font-semibold tracking-wide text-primary">{room.code}</p><h3 className="mt-1 text-sm font-semibold leading-snug">{room.name}</h3><p className="mt-1 text-xs text-muted-foreground">{room.function}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

      </main>

      {/* Thanh "Vị trí làm việc đã chọn" dính ở đáy màn hình */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6 lg:px-8">
        <div className={cn("pointer-events-auto mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl border bg-card/95 p-3 pl-4 shadow-xl shadow-foreground/10 backdrop-blur-xl transition sm:flex-row sm:items-center sm:gap-4", selectedRoom ? "border-primary/30" : "border-border/70")}>
          <span className={cn("hidden size-10 shrink-0 place-items-center rounded-xl sm:grid", selectedRoom ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><Stethoscope className="size-[1.1rem]" /></span>
          <div className="min-w-0 flex-1">
            {selectedRoom ? (
              <>
                <p className="truncate text-sm font-semibold">{selectedFloor?.name} · {selectedRoom.code} — {selectedRoom.name}</p>
                <p className="truncate text-xs text-muted-foreground">Chức năng: {selectedRoom.function} · Áp dụng cho phiên làm việc hiện tại, có thể đổi sau.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-muted-foreground">Chưa chọn phòng</p>
                <p className="text-xs text-muted-foreground">Chọn một phòng ở trên để bắt đầu làm việc.</p>
              </>
            )}
          </div>
          <Button disabled={!selectedRoom} onClick={confirmLocation} className="h-11 shrink-0 rounded-full px-6 shadow-lg shadow-primary/15">
            Bắt đầu làm việc <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
