"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowDownUp,
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  ChevronRight,
  Clock3,
  FilterX,
  History,
  LoaderCircle,
  Phone,
  Search,
  UserX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { appointmentService, type DailyScheduleAppointment } from "@/services/appointment.service";
import { getScheduleStatus, statusMeta, statusOrder, toDateKey, type ScheduleStatus } from "@/components/doctor/today-schedule-sheet";
import {
  CopyCode,
  CornerLink,
  DateField,
  FilterChip,
  FilterSelect,
  ListFooter,
  QueueCardHeader,
  clickableProps,
  useDetailHref,
  StateBlock,
  formatClock,
  formatGender,
  formatShortDate,
  getAge,
  getInitials,
  usePagination,
} from "@/components/doctor/queue/queue-ui";

type SessionFilter = "ALL" | "MORNING" | "AFTERNOON";
type ArrivalFilter = "ALL" | "ARRIVED" | "NOT_ARRIVED";
type SortKey = "DATE_ASC" | "DATE_DESC" | "NAME" | "CREATED";
/**
 * Mốc hiện tại / tương lai; "PAST" = tra cứu lịch cũ (mở từ góc bộ lọc).
 * "ACTIVE" (mặc định) = lịch hôm nay chưa xong + toàn bộ lịch tương lai.
 */
type RangeKey = "ACTIVE" | "UPCOMING" | "TODAY" | "NEXT_7" | "NEXT_30" | "PAST";
/** Trạng thái coi là "đã xong" — ẩn khỏi chế độ mặc định "Sắp tới". */
const FINISHED_STATUSES: ScheduleStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];
/** Lịch của các ngày sau hôm nay hiển thị là "Sắp tới" thay vì "Chờ tiếp nhận". */
type QueueStatus = ScheduleStatus | "UPCOMING";

const queueStatusMeta: Record<QueueStatus, { label: string; badge: string; dot: string }> = {
  ...statusMeta,
  UPCOMING: { label: "Sắp tới", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
};
const queueStatusOrder: QueueStatus[] = ["WAITING", "LATE", "IN_PROGRESS", "UPCOMING", "COMPLETED", "NO_SHOW", "CANCELLED"].filter(
  (key): key is QueueStatus => key === "UPCOMING" || statusOrder.includes(key as ScheduleStatus),
);

const rangeLabels: [Exclude<RangeKey, "PAST">, string][] = [
  ["ACTIVE", "Sắp tới"],
  ["UPCOMING", "Tất cả từ hôm nay"],
  ["TODAY", "Chỉ hôm nay"],
  ["NEXT_7", "7 ngày tới"],
  ["NEXT_30", "30 ngày tới"],
];

const sortLabels: [SortKey, string][] = [
  ["DATE_ASC", "Ngày hẹn gần nhất"],
  ["DATE_DESC", "Ngày hẹn xa nhất"],
  ["NAME", "Tên bệnh nhân A–Z"],
  ["CREATED", "Mới đặt gần đây"],
];

type Row = { appointment: DailyScheduleAppointment; dateKey: string; time: string; status: QueueStatus };
type ListItem = { type: "date"; dateKey: string; count: number } | { type: "row"; row: Row; index: number };

/** Tab "Ca thường": lịch hẹn từ hôm nay đến tương lai, kèm mã lịch hẹn; lịch cũ tra cứu ở góc bộ lọc. */
export function RegularQueue({ tabs }: { tabs: ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  const [range, setRange] = useState<RangeKey>("ACTIVE");
  const [pastFrom, setPastFrom] = useState(() => toDateKey(addDays(new Date(), -30)));
  const [pastTo, setPastTo] = useState(() => toDateKey(addDays(new Date(), -1)));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QueueStatus | "ALL">("ALL");
  const [session, setSession] = useState<SessionFilter>("ALL");
  const [arrival, setArrival] = useState<ArrivalFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("DATE_ASC");

  const todayKey = toDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isPast = range === "PAST";
  const defaultSort: SortKey = isPast ? "DATE_DESC" : "DATE_ASC";

  const { from, to } = useMemo(() => {
    if (range === "PAST") return pastFrom <= pastTo ? { from: pastFrom, to: pastTo } : { from: pastTo, to: pastFrom };
    if (range === "TODAY") return { from: todayKey, to: todayKey };
    if (range === "NEXT_7") return { from: todayKey, to: toDateKey(addDays(now, 6)) };
    if (range === "NEXT_30") return { from: todayKey, to: toDateKey(addDays(now, 29)) };
    return { from: todayKey, to: undefined };
  }, [range, pastFrom, pastTo, todayKey, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const query = useQuery({
    queryKey: ["appointment-schedule-range", from, to ?? ""],
    queryFn: () => appointmentService.getScheduleRange(from, to),
  });

  const rows = useMemo<Row[]>(
    () => (query.data ?? []).flatMap((appointment): Row[] => {
      const dateKey = appointment.appointment_date.slice(0, 10);
      const base = getScheduleStatus(appointment, dateKey, todayKey, nowMinutes);
      // Mặc định "Sắp tới": bỏ các lịch đã khám xong / đã hủy.
      if (range === "ACTIVE" && FINISHED_STATUSES.includes(base)) return [];
      return [{ appointment, dateKey, time: appointment.appointment_time.slice(11, 16), status: base === "WAITING" && dateKey > todayKey ? "UPCOMING" : base }];
    }),
    [query.data, todayKey, nowMinutes, range],
  );

  const counts = useMemo(() => {
    const result = Object.fromEntries(queueStatusOrder.map((key) => [key, 0])) as Record<QueueStatus, number>;
    for (const row of rows) result[row.status] += 1;
    return result;
  }, [rows]);

  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const filtered = useMemo(() => {
    const list = rows.filter(({ appointment, time, status: rowStatus }) => {
      if (status !== "ALL" && rowStatus !== status) return false;
      if (session === "MORNING" && time >= "12:00") return false;
      if (session === "AFTERNOON" && time < "12:00") return false;
      if (arrival === "ARRIVED" && !appointment.checked_in_at) return false;
      if (arrival === "NOT_ARRIVED" && appointment.checked_in_at) return false;
      if (!normalizedSearch) return true;
      return [
        appointment.appointment_code,
        appointment.patient.full_name,
        appointment.patient.patient_code,
        appointment.patient.user.phone_number,
        appointment.medical_visits[0]?.visit_code,
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalizedSearch);
    });
    const byDateTime = (a: Row, b: Row) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time);
    return list.sort((a, b) => {
      if (sort === "DATE_DESC") return byDateTime(b, a);
      if (sort === "NAME") return a.appointment.patient.full_name.localeCompare(b.appointment.patient.full_name, "vi");
      if (sort === "CREATED") return b.appointment.created_at.localeCompare(a.appointment.created_at);
      return byDateTime(a, b);
    });
  }, [rows, status, session, arrival, sort, normalizedSearch]);

  const router = useRouter();
  const detailHref = useDetailHref();
  const openDetail = (row: Row) => router.push(detailHref(`/doctor/appointments/${row.appointment.appointment_code}`));

  const pagination = usePagination(filtered, [status, session, arrival, sort, normalizedSearch, from, to].join("|"));

  // Chèn dòng tiêu đề ngày khi đang sắp theo ngày.
  const groupByDate = sort === "DATE_ASC" || sort === "DATE_DESC";
  const dateCounts = useMemo(() => {
    const result = new Map<string, number>();
    for (const row of filtered) result.set(row.dateKey, (result.get(row.dateKey) ?? 0) + 1);
    return result;
  }, [filtered]);
  const listItems: ListItem[] = [];
  pagination.pageItems.forEach((row, index, items) => {
    if (groupByDate && (index === 0 || items[index - 1].dateKey !== row.dateKey)) {
      listItems.push({ type: "date", dateKey: row.dateKey, count: dateCounts.get(row.dateKey) ?? 0 });
    }
    listItems.push({ type: "row", row, index: pagination.offset + index + 1 });
  });

  const hasActiveFilters = status !== "ALL" || session !== "ALL" || arrival !== "ALL" || sort !== defaultSort || normalizedSearch !== "";

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setSession("ALL");
    setArrival("ALL");
    setSort(defaultSort);
  }

  function switchRange(next: RangeKey) {
    setRange(next);
    setStatus("ALL");
    setSort(next === "PAST" ? "DATE_DESC" : "DATE_ASC");
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <QueueCardHeader tabs={tabs} hint={isPast ? "Lịch cũ · chỉ để tra cứu" : null} fetching={query.isFetching} onRefresh={() => query.refetch()} />

        <div className="space-y-3 border-b bg-muted/25 px-4 py-4 sm:px-5">
          {isPast && (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed bg-background px-3 py-2.5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><History className="size-3.5" /> Đang xem lịch cũ</span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <DateField label="Từ" value={pastFrom} max={todayKey} onChange={setPastFrom} />
                <span className="text-xs text-muted-foreground">→</span>
                <DateField label="Đến" value={pastTo} max={todayKey} onChange={setPastTo} />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => switchRange("ACTIVE")}><CalendarClock /> Về lịch hiện tại</Button>
            </div>
          )}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã lịch hẹn, mã lượt khám, tên, mã bệnh nhân hoặc SĐT" className="h-10 rounded-xl bg-background pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
              {!isPast && <FilterSelect label="Thời gian" value={range} onChange={(value) => switchRange(value as RangeKey)} options={rangeLabels} />}
              <FilterSelect label="Buổi" value={session} onChange={(value) => setSession(value as SessionFilter)} options={[["ALL", "Cả ngày"], ["MORNING", "Sáng"], ["AFTERNOON", "Chiều"]]} />
              <FilterSelect label="Tiếp nhận" value={arrival} onChange={(value) => setArrival(value as ArrivalFilter)} options={[["ALL", "Tất cả"], ["ARRIVED", "Đã đến"], ["NOT_ARRIVED", "Chưa đến"]]} />
              <FilterSelect label="Sắp xếp" icon={<ArrowDownUp className="size-3.5" />} value={sort} onChange={(value) => setSort(value as SortKey)} options={sortLabels} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="scrollbar-hidden -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
              <FilterChip active={status === "ALL"} onClick={() => setStatus("ALL")} label="Tất cả" count={rows.length} />
              {queueStatusOrder.filter((key) => counts[key] > 0 || status === key).map((key) => (
                <FilterChip key={key} active={status === key} onClick={() => setStatus(key)} label={queueStatusMeta[key].label} count={counts[key]} dot={queueStatusMeta[key].dot} />
              ))}
            </div>
            {hasActiveFilters && <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs text-muted-foreground" onClick={resetFilters}><FilterX /> Xóa lọc</Button>}
            {!isPast && <CornerLink icon={History} label="Lịch cũ" onClick={() => switchRange("PAST")} />}
          </div>
        </div>

        {query.isPending ? (
          <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tải lịch hẹn...</p></StateBlock>
        ) : query.isError ? (
          <StateBlock><p className="text-sm text-muted-foreground">Không thể tải danh sách lịch hẹn.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>
        ) : filtered.length === 0 ? (
          <StateBlock>
            <CalendarX2 className="size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">{rows.length === 0 ? (range === "ACTIVE" ? "Không có lịch hẹn sắp tới." : "Không có lịch hẹn nào trong khoảng thời gian này.") : "Không có lịch hẹn phù hợp với bộ lọc."}</p>
            {rows.length > 0 && <Button variant="outline" size="sm" onClick={resetFilters} className="mt-3 rounded-full"><FilterX /> Xóa bộ lọc</Button>}
          </StateBlock>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="w-12 py-3 pl-5 pr-2 font-medium">#</th>
                    <th className="px-3 py-3 font-medium">Giờ hẹn</th>
                    <th className="px-3 py-3 font-medium">Mã lịch hẹn</th>
                    <th className="px-3 py-3 font-medium">Bệnh nhân</th>
                    <th className="hidden px-3 py-3 font-medium xl:table-cell">Liên hệ</th>
                    <th className="px-3 py-3 font-medium">Lượt khám</th>
                    <th className="hidden px-3 py-3 font-medium lg:table-cell">Check-in</th>
                    <th className="py-3 pl-3 pr-5 text-right font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {listItems.map((item) => item.type === "date"
                    ? <tr key={`date-${item.dateKey}`} className="border-b bg-muted/40"><td colSpan={8} className="px-5 py-2"><DateHeading dateKey={item.dateKey} todayKey={todayKey} count={item.count} /></td></tr>
                    : <TableRowItem key={item.row.appointment.id} row={item.row} index={item.index} showDate={!groupByDate} onOpen={() => openDetail(item.row)} />)}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 p-3 md:hidden">
              {listItems.map((item) => item.type === "date"
                ? <div key={`date-${item.dateKey}`} className="px-1 pb-1 pt-2 first:pt-0"><DateHeading dateKey={item.dateKey} todayKey={todayKey} count={item.count} /></div>
                : <MobileCard key={item.row.appointment.id} row={item.row} showDate={!groupByDate} onOpen={() => openDetail(item.row)} />)}
            </div>

            <ListFooter shown={pagination.pageItems.length} offset={pagination.offset} total={filtered.length} unfiltered={rows.length} unit="lịch hẹn" page={pagination.page} pageCount={pagination.pageCount} onPage={pagination.setPage} />
          </>
        )}
      </section>
    </div>
  );
}

function DateHeading({ dateKey, todayKey, count }: { dateKey: string; todayKey: string; count: number }) {
  const tomorrowKey = toDateKey(addDays(new Date(`${todayKey}T00:00:00`), 1));
  const relative = dateKey === todayKey ? "Hôm nay" : dateKey === tomorrowKey ? "Ngày mai" : null;
  return (
    <div className="flex items-center gap-2 text-xs">
      {relative && <span className={cn("rounded-full px-2 py-0.5 font-semibold", dateKey === todayKey ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>{relative}</span>}
      <span className="font-semibold capitalize text-foreground">{format(new Date(`${dateKey}T00:00:00`), "EEEE, dd/MM/yyyy", { locale: vi })}</span>
      <span className="text-muted-foreground">· {count} lịch</span>
    </div>
  );
}

function TableRowItem({ row, index, showDate, onOpen }: { row: Row; index: number; showDate: boolean; onOpen: () => void }) {
  const { appointment, time, status } = row;
  const visit = appointment.medical_visits[0];
  const patient = appointment.patient;
  const meta = queueStatusMeta[status];

  return (
    <tr {...clickableProps(onOpen, `Xem chi tiết lịch hẹn ${appointment.appointment_code}`)} className={cn("group cursor-pointer outline-none focus-visible:bg-muted/60 border-b align-middle transition-colors last:border-0 hover:bg-muted/40", (status === "CANCELLED" || status === "NO_SHOW") && "opacity-60")}>
      <td className="py-3 pl-5 pr-2 text-xs tabular-nums text-muted-foreground">{String(index).padStart(2, "0")}</td>
      <td className="px-3 py-3">
        <span className="block text-sm font-semibold tabular-nums">{time}</span>
        {showDate && <span className="text-xs text-muted-foreground">{formatShortDate(row.dateKey)}</span>}
      </td>
      <td className="px-3 py-3"><CopyCode code={appointment.appointment_code} label="mã lịch hẹn" /></td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{getInitials(patient.full_name)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{patient.full_name}</p>
            <p className="text-xs text-muted-foreground">{patient.patient_code} · {formatGender(patient.gender)} · {getAge(patient.date_of_birth)}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 xl:table-cell">
        {patient.user.phone_number ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3" />{patient.user.phone_number}</span> : <span className="text-xs text-muted-foreground/70">—</span>}
      </td>
      <td className="px-3 py-3">
        {visit ? (
          <div>
            <p className="text-xs font-semibold tracking-wide">{visit.visit_code}</p>
            <p className="text-xs text-muted-foreground">{visit.receiving_room.room_code} · {visit.receiving_room.name}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground/70">Chưa tạo</span>}
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">
        {appointment.checked_in_at
          ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CalendarCheck className="size-3.5" />{formatClock(appointment.checked_in_at)}</span>
          : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><UserX className="size-3.5" />Chưa đến</span>}
      </td>
      <td className="py-3 pl-3 pr-5 text-right">
        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold", meta.badge)}>{meta.label}</span>
        <ChevronRight className="ml-1.5 inline size-4 -translate-x-1 text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </td>
    </tr>
  );
}

function MobileCard({ row, showDate, onOpen }: { row: Row; showDate: boolean; onOpen: () => void }) {
  const { appointment, time, status } = row;
  const visit = appointment.medical_visits[0];
  const meta = queueStatusMeta[status];

  return (
    <article {...clickableProps(onOpen, `Xem chi tiết lịch hẹn ${appointment.appointment_code}`)} className={cn("cursor-pointer rounded-2xl border bg-card p-3.5 outline-none transition hover:border-primary/35 hover:shadow-sm focus-visible:border-primary", (status === "CANCELLED" || status === "NO_SHOW") && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{appointment.patient.full_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{appointment.patient.patient_code} · {getAge(appointment.patient.date_of_birth)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold", meta.badge)}>{meta.label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><Clock3 className="size-3.5 text-primary" />{time}{showDate && <span className="font-normal text-muted-foreground">· {formatShortDate(row.dateKey)}</span>}</span>
        <CopyCode code={appointment.appointment_code} label="mã lịch hẹn" />
        {visit && <span>Lượt {visit.visit_code} · {visit.receiving_room.room_code}</span>}
        {appointment.checked_in_at && <span className="text-emerald-700">Check-in {formatClock(appointment.checked_in_at)}</span>}
      </div>
    </article>
  );
}
