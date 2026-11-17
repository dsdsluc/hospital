"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { addDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import { ArrowLeft, ChevronRight, DoorOpen, FilterX, History, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { roomService, type HistoryEventCategory, type HistoryEventStatus, type RoomHistoryEvent } from "@/services/room.service";
import { toDateKey } from "@/components/doctor/today-schedule-sheet";
import { PageState } from "@/components/doctor/appointment-detail-page";
import { DateField, FilterChip, FilterSelect, ListFooter, StateBlock, clickableProps, usePagination, useDetailHref } from "@/components/doctor/queue/queue-ui";

type RangeKey = "TODAY" | "7D" | "30D" | "90D" | "CUSTOM";
type StatusFilter = "ALL" | "COMPLETED" | "IN_PROGRESS" | "CANCELLED" | "PENDING";

const rangeOptions: [RangeKey, string][] = [["TODAY", "Hôm nay"], ["7D", "7 ngày qua"], ["30D", "30 ngày qua"], ["90D", "90 ngày qua"], ["CUSTOM", "Tùy chọn"]];
const rangeDays: Record<Exclude<RangeKey, "CUSTOM">, number> = { TODAY: 0, "7D": 6, "30D": 29, "90D": 89 };

const categoryMeta: Record<HistoryEventCategory, { label: string; dot: string }> = {
  RECEPTION: { label: "Tiếp nhận", dot: "bg-amber-500" },
  EXAMINATION: { label: "Khám bệnh", dot: "bg-primary" },
  PROCEDURE: { label: "Cận lâm sàng", dot: "bg-sky-500" },
  DISPENSE: { label: "Cấp thuốc", dot: "bg-emerald-500" },
  EMERGENCY: { label: "Cấp cứu", dot: "bg-red-500" },
  SURGERY: { label: "Phẫu thuật", dot: "bg-violet-500" },
  MONITORING: { label: "Theo dõi", dot: "bg-teal-500" },
  NURSING: { label: "Điều dưỡng", dot: "bg-pink-500" },
  PAYMENT: { label: "Thanh toán", dot: "bg-orange-500" },
};
const categoryOrder = Object.keys(categoryMeta) as HistoryEventCategory[];

const statusMeta: Record<HistoryEventStatus, { label: string; badge: string } | null> = {
  COMPLETED: { label: "Hoàn thành", badge: "bg-emerald-50 text-emerald-700" },
  IN_PROGRESS: { label: "Đang thực hiện", badge: "bg-sky-50 text-sky-700" },
  PENDING: { label: "Đang chờ", badge: "bg-amber-50 text-amber-700" },
  CANCELLED: { label: "Đã hủy", badge: "bg-muted text-muted-foreground" },
  INFO: null,
};

/** Trang lịch sử thực hiện của một phòng (mở từ mục "Lịch sử"), dữ liệu từ GET /rooms/:roomCode/history. */
export function RoomHistoryPage({ roomCode, backHref }: { roomCode: string; backHref: string }) {
  const router = useRouter();
  const detailHref = useDetailHref();
  const [today] = useState(() => new Date());
  const todayKey = toDateKey(today);
  const [range, setRange] = useState<RangeKey>("30D");
  const [customFrom, setCustomFrom] = useState(() => toDateKey(addDays(new Date(), -29)));
  const [customTo, setCustomTo] = useState(() => toDateKey(new Date()));
  const [category, setCategory] = useState<HistoryEventCategory | "ALL">("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const { from, to } = range === "CUSTOM"
    ? (customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom })
    : { from: toDateKey(addDays(today, -rangeDays[range])), to: todayKey };

  const query = useQuery({
    queryKey: ["room-history", roomCode, from, to],
    queryFn: () => roomService.getRoomHistory(roomCode, from, to),
    retry: (count, error) => !(isAxiosError(error) && error.response?.status && error.response.status < 500) && count < 2,
  });
  const events = useMemo(() => query.data?.events ?? [], [query.data]);

  const categoryCounts = useMemo(() => {
    const result = new Map<HistoryEventCategory, number>();
    for (const event of events) result.set(event.category, (result.get(event.category) ?? 0) + 1);
    return result;
  }, [events]);

  const normalizedSearch = normalize(search.trim());
  const filtered = useMemo(() => events.filter((event) => {
    if (category !== "ALL" && event.category !== category) return false;
    if (status !== "ALL" && event.status !== status) return false;
    if (!normalizedSearch) return true;
    return normalize([event.patient.name, event.patient.code, event.ref?.code, event.title, event.detail].filter(Boolean).join(" ")).includes(normalizedSearch);
  }), [events, category, status, normalizedSearch]);

  const pagination = usePagination(filtered, [from, to, category, status, normalizedSearch].join("|"));
  const hasActiveFilters = category !== "ALL" || status !== "ALL" || normalizedSearch !== "";

  function resetFilters() {
    setCategory("ALL");
    setStatus("ALL");
    setSearch("");
  }

  function openEvent(event: RoomHistoryEvent) {
    if (!event.ref) return;
    const path = event.ref.type === "emergency" ? `/doctor/emergency/${event.ref.id}`
      : event.ref.type === "invoice" ? `/doctor/invoices/${event.ref.id}`
      : `/doctor/visits/${event.ref.id}/results`;
    router.push(detailHref(path));
  }

  if (query.isError && isAxiosError(query.error) && query.error.response?.status === 404) {
    return <PageState icon={<DoorOpen />} text={`Không tìm thấy phòng ${roomCode}.`} backHref={backHref} />;
  }

  const room = query.data?.room;
  // Nhóm sự kiện của trang hiện tại theo ngày.
  const groups: Array<{ dateKey: string; items: RoomHistoryEvent[] }> = [];
  for (const event of pagination.pageItems) {
    const dateKey = vietnamDateKey(event.occurred_at);
    const last = groups[groups.length - 1];
    if (last?.dateKey === dateKey) last.items.push(event);
    else groups.push({ dateKey, items: [event] });
  }

  return (
    <main className="min-h-screen bg-muted/35 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[1.6rem] border bg-card px-5 py-4 shadow-sm">
          <Button render={<Link href={backHref} />} variant="outline" size="icon" className="shrink-0 rounded-full" aria-label="Quay lại danh sách phòng"><ArrowLeft /></Button>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><History className="size-4" /></span>
          <h1 className="text-[0.95rem] font-semibold">{room?.name ?? roomCode}</h1>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">Lịch sử phòng{room ? ` · ${room.function_name} · ${room.floor_name.split(" - ")[0]}` : ""}</p>
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium tracking-wide text-muted-foreground">{roomCode}</span>
        </header>

        <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-medium">Hoạt động đã thực hiện</h2>
              <p className="text-xs text-muted-foreground">{format(new Date(`${from}T00:00:00`), "dd/MM/yyyy")} – {format(new Date(`${to}T00:00:00`), "dd/MM/yyyy")} · mới nhất trước</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 rounded-full" onClick={() => query.refetch()} aria-label="Làm mới" disabled={query.isFetching}>
              <RefreshCw className={cn(query.isFetching && "animate-spin")} />
            </Button>
          </div>

          <div className="space-y-3 border-b bg-muted/25 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã bệnh nhân, mã lượt khám / cấp cứu hoặc nội dung" className="h-10 rounded-xl bg-background pl-9" />
              </div>
              <div className="grid grid-cols-2 gap-2 lg:flex">
                <FilterSelect label="Thời gian" value={range} onChange={(value) => setRange(value as RangeKey)} options={rangeOptions} />
                <FilterSelect label="Trạng thái" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={[["ALL", "Tất cả"], ["COMPLETED", "Hoàn thành"], ["IN_PROGRESS", "Đang thực hiện"], ["PENDING", "Đang chờ"], ["CANCELLED", "Đã hủy"]]} />
              </div>
            </div>
            {range === "CUSTOM" && (
              <div className="flex flex-wrap items-center gap-2">
                <DateField label="Từ" value={customFrom} max={todayKey} onChange={setCustomFrom} />
                <span className="text-xs text-muted-foreground">→</span>
                <DateField label="Đến" value={customTo} max={todayKey} onChange={setCustomTo} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="scrollbar-hidden -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
                <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")} label="Mọi hoạt động" count={events.length} />
                {categoryOrder.filter((key) => categoryCounts.has(key) || category === key).map((key) => (
                  <FilterChip key={key} active={category === key} onClick={() => setCategory(key)} label={categoryMeta[key].label} count={categoryCounts.get(key) ?? 0} dot={categoryMeta[key].dot} />
                ))}
              </div>
              {hasActiveFilters && <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs text-muted-foreground" onClick={resetFilters}><FilterX /> Xóa lọc</Button>}
            </div>
          </div>

          {query.isPending ? (
            <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tải lịch sử phòng...</p></StateBlock>
          ) : query.isError ? (
            <StateBlock><p className="text-sm text-muted-foreground">Không thể tải lịch sử phòng.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>
          ) : filtered.length === 0 ? (
            <StateBlock>
              <History className="size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{events.length === 0 ? "Phòng chưa có hoạt động nào trong khoảng thời gian này." : "Không có hoạt động phù hợp với bộ lọc."}</p>
              {events.length > 0 && <Button variant="outline" size="sm" onClick={resetFilters} className="mt-3 rounded-full"><FilterX /> Xóa bộ lọc</Button>}
            </StateBlock>
          ) : (
            <>
              <div className="divide-y">
                {groups.map((group) => (
                  <div key={group.dateKey}>
                    <div className="sticky top-0 z-10 border-b bg-muted/60 px-4 py-2 backdrop-blur sm:px-5">
                      <DateHeading dateKey={group.dateKey} todayKey={todayKey} />
                    </div>
                    <ol className="divide-y">
                      {group.items.map((event) => <EventRow key={event.id} event={event} onOpen={() => openEvent(event)} />)}
                    </ol>
                  </div>
                ))}
              </div>
              <ListFooter shown={pagination.pageItems.length} offset={pagination.offset} total={filtered.length} unfiltered={events.length} unit="hoạt động" page={pagination.page} pageCount={pagination.pageCount} onPage={pagination.setPage} />
              {query.data?.truncated && <p className="border-t px-5 py-2 text-xs text-[oklch(0.55_0.16_35)]">Chỉ hiển thị 500 hoạt động mới nhất, hãy thu hẹp khoảng thời gian để xem đầy đủ.</p>}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function EventRow({ event, onOpen }: { event: RoomHistoryEvent; onOpen: () => void }) {
  const meta = categoryMeta[event.category];
  const status = statusMeta[event.status];
  const openable = Boolean(event.ref);

  return (
    <li
      {...(openable ? clickableProps(onOpen, `Xem chi tiết ${event.ref!.code}`) : {})}
      className={cn("group grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3.5 transition sm:px-5", openable && "cursor-pointer outline-none hover:bg-muted/40 focus-visible:bg-muted/60")}
    >
      <span className="pt-0.5 text-sm tabular-nums text-muted-foreground">{formatClock(event.occurred_at)}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
          <span className="truncate">{event.title}</span>
        </p>
        <p className="mt-0.5 truncate pl-3.5 text-xs text-muted-foreground">
          {event.patient.name}
          {event.patient.code && <> · {event.patient.code}</>}
          {event.ref && event.ref.code !== event.patient.code && <> · <span className="font-mono">{event.ref.code}</span></>}
        </p>
        {event.detail && <p className="mt-1.5 line-clamp-2 pl-3.5 text-xs leading-5 text-foreground/70">{event.detail}</p>}
      </div>
      <div className="flex items-center gap-1">
        {status && <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-medium", status.badge)}>{status.label}</span>}
        {openable && <ChevronRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100" />}
      </div>
    </li>
  );
}

function DateHeading({ dateKey, todayKey }: { dateKey: string; todayKey: string }) {
  const yesterdayKey = toDateKey(addDays(new Date(`${todayKey}T00:00:00`), -1));
  const relative = dateKey === todayKey ? "Hôm nay" : dateKey === yesterdayKey ? "Hôm qua" : null;
  return (
    <div className="flex items-center gap-2 text-xs">
      {relative && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{relative}</span>}
      <span className="font-medium capitalize text-foreground">{format(new Date(`${dateKey}T00:00:00`), "EEEE, dd/MM/yyyy", { locale: vi })}</span>
    </div>
  );
}

function vietnamDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
