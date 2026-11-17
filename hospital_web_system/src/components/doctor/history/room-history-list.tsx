"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, DoorOpen, History, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { roomService, type HistoryFloor, type HistoryRoom } from "@/services/room.service";
import { FilterChip, StateBlock, useDetailHref } from "@/components/doctor/queue/queue-ui";

/** Mục "Lịch sử": danh sách phòng theo tầng (dữ liệu từ GET /rooms), chọn một phòng để xem lịch sử của phòng đó. */
export function RoomHistoryList({ currentRoomCode }: { currentRoomCode: string }) {
  const query = useQuery({ queryKey: ["rooms-with-history"], queryFn: roomService.getRoomsWithHistory });
  const floors = useMemo(() => query.data ?? [], [query.data]);
  const [floorFilter, setFloorFilter] = useState<string>("ALL");
  const [activeOnly, setActiveOnly] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedSearch = normalize(search.trim());
  const visibleFloors = useMemo(() => floors
    .filter((floor) => floorFilter === "ALL" || floor.id === floorFilter)
    .map((floor) => ({
      ...floor,
      rooms: floor.rooms.filter((room) => {
        if (activeOnly && !hasActivity(room)) return false;
        if (!normalizedSearch) return true;
        return normalize(`${room.room_code} ${room.name} ${room.function_name}`).includes(normalizedSearch);
      }),
    }))
    .filter((floor) => floor.rooms.length > 0), [floors, floorFilter, activeOnly, normalizedSearch]);

  const detailHref = useDetailHref();
  const totalRooms = floors.reduce((sum, floor) => sum + floor.rooms.length, 0);
  const activeRooms = floors.reduce((sum, floor) => sum + floor.rooms.filter(hasActivity).length, 0);

  return (
    <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><History className="size-4" /></span>
          <div>
            <h2 className="text-sm font-medium">Lịch sử theo phòng</h2>
            <p className="text-xs text-muted-foreground">Chọn một phòng để xem các lượt đã xử lý tại phòng đó.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, tên hoặc chức năng phòng" className="h-9 rounded-xl pl-9" />
          </div>
          <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 rounded-full" onClick={() => query.refetch()} aria-label="Làm mới" disabled={query.isFetching}>
            <RefreshCw className={cn(query.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b bg-muted/25 px-4 py-3 sm:px-5">
        <div className="scrollbar-hidden -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
          <FilterChip active={floorFilter === "ALL"} onClick={() => setFloorFilter("ALL")} label="Tất cả tầng" count={totalRooms} />
          {floors.map((floor) => <FilterChip key={floor.id} active={floorFilter === floor.id} onClick={() => setFloorFilter(floor.id)} label={floorLabel(floor)} count={floor.rooms.length} />)}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} className="size-3.5 accent-[var(--primary)]" />
          Có hoạt động <span className="tabular-nums">({activeRooms})</span>
        </label>
      </div>

      {query.isPending ? (
        <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tải danh sách phòng...</p></StateBlock>
      ) : query.isError ? (
        <StateBlock><p className="text-sm text-muted-foreground">Không thể tải danh sách phòng.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>
      ) : visibleFloors.length === 0 ? (
        <StateBlock><DoorOpen className="size-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{totalRooms === 0 ? "Chưa có phòng nào trong hệ thống." : "Không có phòng phù hợp với bộ lọc."}</p></StateBlock>
      ) : (
        <div className="divide-y">
          {visibleFloors.map((floor) => (
            <div key={floor.id} className="px-4 py-5 sm:px-5">
              <div className="mb-3 flex items-baseline gap-2">
                <h3 className="text-sm font-medium">{floorLabel(floor)}</h3>
                <span className="text-xs text-muted-foreground">{floor.function_name} · {floor.rooms.length} phòng</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {floor.rooms.map((room) => <RoomTile key={room.id} room={room} current={room.room_code === currentRoomCode} href={detailHref(`/doctor/history/${room.room_code}`)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RoomTile({ room, current, href }: { room: HistoryRoom; current: boolean; href: string }) {
  const active = hasActivity(room);
  const unavailable = room.status === "UNAVAILABLE";

  return (
    <Link href={href} aria-label={`Xem lịch sử ${room.room_code} · ${room.name}`} className={cn(
      "group flex flex-col rounded-2xl border bg-card p-4 outline-none transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/20",
      current ? "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/15" : "hover:border-primary/30",
      unavailable && "opacity-60",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] font-medium tracking-wide text-muted-foreground">{room.room_code}</span>
          <p className="mt-2 truncate text-sm font-medium" title={room.name}>{room.name}</p>
          <p className="truncate text-xs text-muted-foreground">{room.function_name}</p>
        </div>
        {current ? <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">Phòng hiện tại</span>
          : unavailable ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">Tạm ngưng</span> : null}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
        {active ? (
          <div className="flex gap-4">
            {room.completed_steps > 0 && <Stat value={room.completed_steps} label="đã hoàn thành" />}
            {room.received_visits > 0 && <Stat value={room.received_visits} label="lượt tiếp nhận" />}
            {room.handled_cases > 0 && <Stat value={room.handled_cases} label="ca đã xử lý" />}
          </div>
        ) : <p className="text-xs text-muted-foreground/80">Chưa có hoạt động</p>}
        {room.last_activity_at
          ? <p className="shrink-0 text-right text-[0.7rem] text-muted-foreground">Gần nhất<br /><span className="tabular-nums text-foreground/80">{formatDateTime(room.last_activity_at)}</span></p>
          : <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:text-primary" />}
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <p className="text-xs text-muted-foreground"><span className="block text-base font-medium tabular-nums text-foreground">{value}</span>{label}</p>;
}

function hasActivity(room: HistoryRoom) {
  return room.completed_steps > 0 || room.received_visits > 0 || room.handled_cases > 0;
}

/** "Tầng 1 - Tiếp nhận và cấp cứu" → "Tầng 1" (chức năng hiển thị riêng). */
function floorLabel(floor: HistoryFloor) {
  return floor.name.split(" - ")[0] || `Tầng ${floor.floor_number}`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value));
}
