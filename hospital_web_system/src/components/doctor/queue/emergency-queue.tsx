"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import {
  ArrowDownUp,
  ChevronRight,
  Clock3,
  FilterX,
  History,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  Siren,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { emergencyService, type EmergencyCase, type EmergencyCaseStatus, type EmergencyPriority } from "@/services/emergency.service";
import { toDateKey } from "@/components/doctor/today-schedule-sheet";
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
  formatDuration,
  formatGender,
  formatShortDate,
  getInitials,
  usePagination,
  vietnamDateKey,
} from "@/components/doctor/queue/queue-ui";

type SortKey = "PRIORITY" | "ARRIVED_ASC" | "ARRIVED_DESC";
type ArrivalMode = EmergencyCase["arrival_mode"];

/** Ca đang chờ (chưa xử trí) quá số phút này thì tô đỏ — cùng ngưỡng với phòng cấp cứu ER-102. */
const LONG_WAIT_MINUTES = 15;

export const priorityMeta: Record<EmergencyPriority, { label: string; short: string; badge: string; dot: string; rank: number }> = {
  RED: { label: "Đỏ · Nguy kịch", short: "Nguy kịch", badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-600", rank: 0 },
  ORANGE: { label: "Cam · Rất khẩn", short: "Rất khẩn", badge: "border-orange-200 bg-orange-50 text-orange-700", dot: "bg-orange-500", rank: 1 },
  YELLOW: { label: "Vàng · Khẩn cấp", short: "Khẩn cấp", badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", rank: 2 },
  GREEN: { label: "Xanh · Ít khẩn", short: "Ít khẩn", badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", rank: 3 },
};
const priorityOrder: EmergencyPriority[] = ["RED", "ORANGE", "YELLOW", "GREEN"];

export const statusMeta: Record<EmergencyCaseStatus, { label: string; badge: string }> = {
  WAITING: { label: "Đang chờ", badge: "bg-amber-100 text-amber-700" },
  IN_TREATMENT: { label: "Đang xử trí", badge: "bg-primary/10 text-primary" },
  STABILIZED: { label: "Đã ổn định", badge: "bg-emerald-100 text-emerald-700" },
  AWAITING_PREPARATION: { label: "Chờ chuẩn bị PT", badge: "bg-sky-100 text-sky-700" },
  IN_PREPARATION: { label: "Đang chuẩn bị PT", badge: "bg-sky-100 text-sky-700" },
  TRANSFERRED: { label: "Đã chuyển", badge: "bg-muted text-muted-foreground" },
  CLOSED: { label: "Đã khám xong", badge: "bg-emerald-100 text-emerald-700" },
};

/** Ca CLOSED do tử vong (kết luận ICU / nội trú = DECEASED) — không gắn nhãn "Đã khám xong". */
function isDeceased(item: EmergencyCase) {
  return item.status === "CLOSED" && (item.preparation?.icu_outcome === "DECEASED" || item.preparation?.ward_outcome === "DECEASED");
}

/** Nhãn trạng thái của một ca: CLOSED = "Đã khám xong" (đã cấp thuốc / ra viện), trừ ca tử vong = "Đã kết thúc". */
export function getCaseStatus(item: EmergencyCase) {
  return isDeceased(item) ? { label: "Đã kết thúc", badge: "bg-muted text-muted-foreground" } : statusMeta[item.status];
}

/**
 * Vị trí hiện tại để hiển thị. Ca đã khám xong (CLOSED) không còn ở phòng nào — backend vẫn lưu
 * location = nơi cuối cùng (vd. PHM-105 sau khi cấp thuốc) nên không dùng giá trị đó.
 * Ca TRANSFERRED vẫn đang ở phòng thật (phòng mổ / ICU / nội trú / chờ nhận thuốc) nên giữ nguyên.
 */
export function getCaseLocation(item: EmergencyCase): string | null {
  // Hóa đơn ra viện chưa thu → bệnh nhân đang ở quầy thu ngân.
  if (item.invoice?.status === "UNPAID") return "CAS-103 · chờ thanh toán";
  if (item.status !== "CLOSED") return item.location;
  return isDeceased(item) ? null : "Đã rời viện";
}

export const arrivalLabels: Record<ArrivalMode, string> = {
  WALK_IN: "Tự đến",
  AMBULANCE: "Xe cấp cứu",
  TRANSFER: "Chuyển viện",
  OTHER: "Khác",
};

/** Tab "Ca cấp cứu": các ca đang hoạt động tại cấp cứu, ưu tiên theo mức độ; ca cũ tra cứu ở góc bộ lọc. */
export function EmergencyQueue({ tabs }: { tabs: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  const [isPast, setIsPast] = useState(false);
  const [pastFrom, setPastFrom] = useState(() => toDateKey(addDays(new Date(), -30)));
  const [pastTo, setPastTo] = useState(() => toDateKey(new Date()));
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<EmergencyPriority | "ALL">("ALL");
  const [status, setStatus] = useState<EmergencyCaseStatus | "ALL">("ALL");
  const [arrival, setArrival] = useState<ArrivalMode | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("PRIORITY");

  const todayKey = toDateKey(new Date(now));
  const from = pastFrom <= pastTo ? pastFrom : pastTo;
  const to = pastFrom <= pastTo ? pastTo : pastFrom;
  const defaultSort: SortKey = isPast ? "ARRIVED_DESC" : "PRIORITY";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeQuery = useQuery({ queryKey: ["emergency-cases", "open"], queryFn: emergencyService.getOpenCases, enabled: !isPast });
  const historyQuery = useQuery({ queryKey: ["emergency-case-history", from, to], queryFn: () => emergencyService.getCaseHistory(from, to), enabled: isPast });
  const query = isPast ? historyQuery : activeQuery;
  const cases = useMemo(() => query.data ?? [], [query.data]);

  const priorityCounts = useMemo(() => {
    const result = { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 } as Record<EmergencyPriority, number>;
    for (const item of cases) result[item.priority] += 1;
    return result;
  }, [cases]);
  const presentStatuses = (Object.keys(statusMeta) as EmergencyCaseStatus[]).filter((key) => key === status || cases.some((item) => item.status === key));

  const normalizedSearch = normalize(search.trim());
  const filtered = useMemo(() => {
    const list = cases.filter((item) => {
      if (priority !== "ALL" && item.priority !== priority) return false;
      if (status !== "ALL" && item.status !== status) return false;
      if (arrival !== "ALL" && item.arrival_mode !== arrival) return false;
      if (!normalizedSearch) return true;
      return normalize([item.emergency_code, item.full_name, item.phone_number, item.identity_number, item.reason].filter(Boolean).join(" ")).includes(normalizedSearch);
    });
    return list.sort((a, b) => {
      if (sort === "ARRIVED_ASC") return a.arrived_at.localeCompare(b.arrived_at);
      if (sort === "ARRIVED_DESC") return b.arrived_at.localeCompare(a.arrived_at);
      return priorityMeta[a.priority].rank - priorityMeta[b.priority].rank || a.arrived_at.localeCompare(b.arrived_at);
    });
  }, [cases, priority, status, arrival, sort, normalizedSearch]);

  const router = useRouter();
  const detailHref = useDetailHref();
  const openDetail = (item: EmergencyCase) => router.push(detailHref(`/doctor/emergency/${item.id}`));

  const pagination = usePagination(filtered, [isPast, from, to, priority, status, arrival, sort, normalizedSearch].join("|"));
  const hasActiveFilters = priority !== "ALL" || status !== "ALL" || arrival !== "ALL" || sort !== defaultSort || normalizedSearch !== "";

  function resetFilters() {
    setSearch("");
    setPriority("ALL");
    setStatus("ALL");
    setArrival("ALL");
    setSort(defaultSort);
  }

  function switchMode(past: boolean) {
    setIsPast(past);
    setStatus("ALL");
    setSort(past ? "ARRIVED_DESC" : "PRIORITY");
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
        <QueueCardHeader tabs={tabs} hint={isPast ? "Ca cũ · chỉ để tra cứu" : "Sắp theo mức ưu tiên"} fetching={query.isFetching} onRefresh={() => query.refetch()} />

        <div className="space-y-3 border-b bg-muted/25 px-4 py-4 sm:px-5">
          {isPast && (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed bg-background px-3 py-2.5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><History className="size-3.5" /> Đang xem ca cũ</span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <DateField label="Từ" value={pastFrom} max={todayKey} onChange={setPastFrom} />
                <span className="text-xs text-muted-foreground">→</span>
                <DateField label="Đến" value={pastTo} max={todayKey} onChange={setPastTo} />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => switchMode(false)}><Siren /> Về ca hiện tại</Button>
            </div>
          )}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã cấp cứu, tên, SĐT, CCCD hoặc lý do" className="h-10 rounded-xl bg-background pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
              <FilterSelect label="Trạng thái" value={status} onChange={(value) => setStatus(value as EmergencyCaseStatus | "ALL")} options={[["ALL", "Tất cả"], ...presentStatuses.map((key) => [key, statusMeta[key].label] as [string, string])]} />
              <FilterSelect label="Đến bằng" value={arrival} onChange={(value) => setArrival(value as ArrivalMode | "ALL")} options={[["ALL", "Tất cả"], ...(Object.entries(arrivalLabels) as [string, string][])]} />
              <FilterSelect label="Sắp xếp" icon={<ArrowDownUp className="size-3.5" />} value={sort} onChange={(value) => setSort(value as SortKey)} options={[["PRIORITY", "Mức ưu tiên"], ["ARRIVED_ASC", "Đến sớm nhất"], ["ARRIVED_DESC", "Đến gần đây nhất"]]} className="col-span-2 sm:col-span-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="scrollbar-hidden -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
              <FilterChip active={priority === "ALL"} onClick={() => setPriority("ALL")} label="Mọi mức" count={cases.length} />
              {priorityOrder.map((key) => (
                <FilterChip key={key} active={priority === key} onClick={() => setPriority(key)} label={priorityMeta[key].label} count={priorityCounts[key]} dot={priorityMeta[key].dot} />
              ))}
            </div>
            {hasActiveFilters && <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs text-muted-foreground" onClick={resetFilters}><FilterX /> Xóa lọc</Button>}
            {!isPast && <CornerLink icon={History} label="Ca cũ" onClick={() => switchMode(true)} />}
          </div>
        </div>

        {query.isPending ? (
          <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tải ca cấp cứu...</p></StateBlock>
        ) : query.isError ? (
          <StateBlock><p className="text-sm text-muted-foreground">Không thể tải danh sách ca cấp cứu.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>
        ) : filtered.length === 0 ? (
          <StateBlock>
            <ShieldCheck className="size-7 text-emerald-600" />
            <p className="mt-3 text-sm font-medium">{cases.length === 0 ? (isPast ? "Không có ca cấp cứu nào trong khoảng ngày này." : "Hiện không có ca cấp cứu nào chưa kết thúc.") : "Không có ca phù hợp với bộ lọc."}</p>
            {cases.length > 0 && <Button variant="outline" size="sm" onClick={resetFilters} className="mt-3 rounded-full"><FilterX /> Xóa bộ lọc</Button>}
          </StateBlock>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="w-12 py-3 pl-5 pr-2 font-medium">#</th>
                    <th className="px-3 py-3 font-medium">Mức ưu tiên</th>
                    <th className="px-3 py-3 font-medium">Mã cấp cứu</th>
                    <th className="px-3 py-3 font-medium">Bệnh nhân</th>
                    <th className="px-3 py-3 font-medium">Lý do vào viện</th>
                    <th className="hidden px-3 py-3 font-medium xl:table-cell">Đến bằng</th>
                    <th className="px-3 py-3 font-medium">{isPast ? "Thời điểm đến" : "Đến lúc · Chờ"}</th>
                    <th className="hidden px-3 py-3 font-medium lg:table-cell">Vị trí</th>
                    <th className="py-3 pl-3 pr-5 text-right font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageItems.map((item, index) => <EmergencyRow key={item.id} item={item} index={pagination.offset + index + 1} now={now} isPast={isPast} todayKey={todayKey} onOpen={() => openDetail(item)} />)}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 p-3 md:hidden">
              {pagination.pageItems.map((item) => <EmergencyCard key={item.id} item={item} now={now} isPast={isPast} todayKey={todayKey} onOpen={() => openDetail(item)} />)}
            </div>

            <ListFooter shown={pagination.pageItems.length} offset={pagination.offset} total={filtered.length} unfiltered={cases.length} unit="ca cấp cứu" page={pagination.page} pageCount={pagination.pageCount} onPage={pagination.setPage} />
          </>
        )}
      </section>
    </div>
  );
}

function EmergencyRow({ item, index, now, isPast, todayKey, onOpen }: { item: EmergencyCase; index: number; now: number; isPast: boolean; todayKey: string; onOpen: () => void }) {
  const priority = priorityMeta[item.priority];
  const statusInfo = getCaseStatus(item);
  const location = getCaseLocation(item);
  const longWait = !isPast && item.status === "WAITING" && minutesSince(item.arrived_at, now) >= LONG_WAIT_MINUTES;

  return (
    <tr {...clickableProps(onOpen, `Xem chi tiết ca cấp cứu ${item.emergency_code}`)} className={cn("group cursor-pointer outline-none focus-visible:bg-muted/60 border-b align-middle transition-colors last:border-0 hover:bg-muted/40", item.priority === "RED" && !isPast && "bg-red-50/40")}>
      <td className="py-3 pl-5 pr-2 text-xs tabular-nums text-muted-foreground">{String(index).padStart(2, "0")}</td>
      <td className="px-3 py-3"><PriorityBadge priority={item.priority} label={priority.short} /></td>
      <td className="px-3 py-3"><CopyCode code={item.emergency_code} label="mã cấp cứu" tone="danger" /></td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{item.unidentified ? "?" : getInitials(item.full_name)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{item.full_name}</p>
            <p className="text-xs text-muted-foreground">{item.unidentified ? "Chưa xác định danh tính" : `${formatGender(item.gender)} · ${item.age != null ? `${item.age} tuổi` : "Chưa rõ tuổi"}`}</p>
          </div>
        </div>
      </td>
      <td className="max-w-64 px-3 py-3"><p className="line-clamp-2 text-xs" title={item.reason}>{item.reason}</p></td>
      <td className="hidden px-3 py-3 text-xs text-muted-foreground xl:table-cell">{arrivalLabels[item.arrival_mode]}</td>
      <td className="px-3 py-3"><ArrivalTime item={item} now={now} isPast={isPast} todayKey={todayKey} longWait={longWait} /></td>
      <td className="hidden px-3 py-3 lg:table-cell">
        {location ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{item.status !== "CLOSED" && <MapPin className="size-3" />}{location}</span> : <span className="text-xs text-muted-foreground/70">—</span>}
      </td>
      <td className="py-3 pl-3 pr-5 text-right"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold", statusInfo.badge)}>{statusInfo.label}</span><ChevronRight className="ml-1.5 inline size-4 -translate-x-1 text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100" /></td>
    </tr>
  );
}

function EmergencyCard({ item, now, isPast, todayKey, onOpen }: { item: EmergencyCase; now: number; isPast: boolean; todayKey: string; onOpen: () => void }) {
  const statusInfo = getCaseStatus(item);
  const location = getCaseLocation(item);
  const longWait = !isPast && item.status === "WAITING" && minutesSince(item.arrived_at, now) >= LONG_WAIT_MINUTES;

  return (
    <article {...clickableProps(onOpen, `Xem chi tiết ca cấp cứu ${item.emergency_code}`)} className={cn("cursor-pointer rounded-2xl border bg-card p-3.5 outline-none transition hover:border-primary/35 hover:shadow-sm focus-visible:border-primary", item.priority === "RED" && !isPast && "border-red-200 bg-red-50/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><PriorityBadge priority={item.priority} label={priorityMeta[item.priority].short} /><p className="truncate text-sm font-semibold">{item.full_name}</p></div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.reason}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold", statusInfo.badge)}>{statusInfo.label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <CopyCode code={item.emergency_code} label="mã cấp cứu" tone="danger" />
        <ArrivalTime item={item} now={now} isPast={isPast} todayKey={todayKey} longWait={longWait} inline />
        <span>{arrivalLabels[item.arrival_mode]}</span>
        {location && <span className="inline-flex items-center gap-1">{item.status !== "CLOSED" && <MapPin className="size-3" />}{location}</span>}
      </div>
    </article>
  );
}

function PriorityBadge({ priority, label }: { priority: EmergencyPriority; label: string }) {
  const meta = priorityMeta[priority];
  return <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", meta.badge)}><span className={cn("size-1.5 rounded-full", meta.dot)} />{label}</span>;
}

function ArrivalTime({ item, now, isPast, todayKey, longWait, inline }: { item: EmergencyCase; now: number; isPast: boolean; todayKey: string; longWait: boolean; inline?: boolean }) {
  const dateKey = vietnamDateKey(item.arrived_at);
  const clock = formatClock(item.arrived_at);
  const dateLabel = dateKey === todayKey ? null : formatShortDate(dateKey);
  const waited = isPast ? null : formatDuration(minutesSince(item.arrived_at, now));

  if (inline) {
    return <span className={cn("inline-flex items-center gap-1.5", longWait && "font-semibold text-red-600")}><Clock3 className="size-3.5" />{clock}{dateLabel && ` · ${dateLabel}`}{waited && ` · ${waited}`}</span>;
  }
  return (
    <div>
      <p className="text-sm font-semibold tabular-nums">{clock}{dateLabel && <span className="ml-1 text-xs font-normal text-muted-foreground">{dateLabel}</span>}</p>
      {waited && <p className={cn("text-xs", longWait ? "font-semibold text-red-600" : "text-muted-foreground")}>{longWait && "⚠ "}{waited === "Vừa xong" ? waited : `${waited} trước`}</p>}
    </div>
  );
}

function minutesSince(value: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
