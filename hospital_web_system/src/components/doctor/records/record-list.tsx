"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ChevronRight, FileSearch, LoaderCircle, MapPin, RefreshCw, Search, Siren, Stethoscope, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { recordService, type MedicalRecordItem, type RecordStatus, type RecordType } from "@/services/record.service";
import { DateField, FilterChip, FilterSelect, ListFooter, StateBlock, clickableProps, formatDuration, formatGender, getAge, getInitials, usePagination, useDetailHref } from "@/components/doctor/queue/queue-ui";

type RangeKey = "7D" | "30D" | "90D" | "CUSTOM";
type StatusFilter = "ALL" | RecordStatus;
type TypeFilter = "ALL" | RecordType;

const rangeOptions: [RangeKey, string][] = [["7D", "7 ngày qua"], ["30D", "30 ngày qua"], ["90D", "90 ngày qua"], ["CUSTOM", "Tùy chọn"]];
const rangeDays: Record<Exclude<RangeKey, "CUSTOM">, number> = { "7D": 6, "30D": 29, "90D": 89 };

const statusMeta: Record<RecordStatus, { label: string; dot: string; badge: string }> = {
  IN_TREATMENT: { label: "Đang điều trị", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-700" },
  AWAITING_PAYMENT: { label: "Chờ thanh toán", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-800" },
  AWAITING_MEDICINE: { label: "Chờ cấp thuốc", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800" },
  COMPLETED: { label: "Đã xong / ra viện", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  DECEASED: { label: "Tử vong", dot: "bg-slate-500", badge: "bg-slate-100 text-slate-700" },
};
const statusOrder: RecordStatus[] = ["IN_TREATMENT", "AWAITING_PAYMENT", "AWAITING_MEDICINE", "COMPLETED", "DECEASED"];
const priorityStyle: Record<NonNullable<MedicalRecordItem["priority"]>, string> = { RED: "bg-red-500", ORANGE: "bg-orange-500", YELLOW: "bg-amber-400", GREEN: "bg-emerald-500" };

/** Nhãn trạng thái theo loại: khám thường thì "Khám xong", cấp cứu thì "Đã ra viện". */
function statusLabel(record: MedicalRecordItem) {
  if (record.status === "COMPLETED") return record.type === "VISIT" ? "Khám xong" : "Đã ra viện";
  return statusMeta[record.status].label;
}

/**
 * Mục "Tra cứu hồ sơ": toàn bộ đợt điều trị của hệ thống (lượt khám thường + ca cấp cứu),
 * phân biệt đang điều trị / chờ cấp thuốc / đã xong hoặc ra viện. Dữ liệu: GET /records.
 */
export function RecordList() {
  const router = useRouter();
  const detailHref = useDetailHref();
  const today = format(new Date(), "yyyy-MM-dd");
  const [range, setRange] = useState<RangeKey>("30D");
  const [customFrom, setCustomFrom] = useState(() => format(addDays(new Date(), -29), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(today);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [type, setType] = useState<TypeFilter>("ALL");
  const [now, setNow] = useState(() => Date.now());

  // Gõ xong 350 ms mới tra cứu trên server (tìm theo tên, mã, CCCD, SĐT trên toàn bộ thời gian).
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const from = range === "CUSTOM" ? customFrom : format(addDays(new Date(), -rangeDays[range]), "yyyy-MM-dd");
  const to = range === "CUSTOM" ? customTo : today;
  const query = useQuery({ queryKey: ["medical-records", from, to, keyword], queryFn: () => recordService.search({ from, to, q: keyword }) });
  const records = useMemo(() => query.data?.records ?? [], [query.data]);

  const byType = useMemo(() => records.filter((record) => type === "ALL" || record.type === type), [records, type]);
  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { ALL: byType.length, IN_TREATMENT: 0, AWAITING_PAYMENT: 0, AWAITING_MEDICINE: 0, COMPLETED: 0, DECEASED: 0 };
    for (const record of byType) result[record.status] += 1;
    return result;
  }, [byType]);
  const filtered = useMemo(() => byType.filter((record) => status === "ALL" || record.status === status), [byType, status]);
  const pagination = usePagination(filtered, [from, to, keyword, status, type].join("|"));

  return (
    <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="space-y-3 border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><FileSearch className="size-4" /></span>
            <div>
              <h2 className="text-sm font-medium">Hồ sơ điều trị</h2>
              <p className="text-xs text-muted-foreground">{keyword ? `Kết quả cho “${keyword}” · mọi thời gian` : "Theo ngày vào · luôn gồm các ca còn đang điều trị"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 lg:w-80 lg:flex-none">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, mã BN / lượt khám / ca, CCCD, SĐT" className="h-9 rounded-xl pl-9 pr-8" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
            </div>
            <FilterSelect label="Thời gian" value={range} onChange={(value) => setRange(value as RangeKey)} options={rangeOptions} className={cn("h-9", keyword && "opacity-50")} />
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={() => query.refetch()} aria-label="Làm mới" disabled={query.isFetching}>
              <RefreshCw className={cn(query.isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
        {range === "CUSTOM" && !keyword && <div className="flex flex-wrap gap-2">
          <DateField label="Từ" value={customFrom} max={customTo} onChange={setCustomFrom} />
          <DateField label="Đến" value={customTo} max={today} onChange={setCustomTo} />
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {([["ALL", "Tất cả"], ["VISIT", "Khám thường"], ["EMERGENCY", "Cấp cứu"]] as [TypeFilter, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setType(value)} aria-pressed={type === value} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", type === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={status === "ALL"} onClick={() => setStatus("ALL")} label="Tất cả" count={counts.ALL} />
            {statusOrder.filter((value) => value !== "DECEASED" || counts.DECEASED > 0).map((value) => (
              <FilterChip key={value} active={status === value} onClick={() => setStatus(value)} label={statusMeta[value].label} count={counts[value]} dot={statusMeta[value].dot} />
            ))}
          </div>
        </div>
      </div>

      {query.isPending ? (
        <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tra cứu hồ sơ...</p></StateBlock>
      ) : query.isError ? (
        <StateBlock><p className="text-sm text-muted-foreground">Không thể tải hồ sơ điều trị.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>
      ) : filtered.length === 0 ? (
        <StateBlock>
          <FileSearch className="size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{records.length > 0 ? "Không có hồ sơ phù hợp với bộ lọc." : keyword ? `Không tìm thấy hồ sơ cho “${keyword}”.` : "Chưa có đợt điều trị nào trong khoảng thời gian này."}</p>
        </StateBlock>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(12rem,15rem)] gap-5 border-b px-5 py-2.5 text-xs text-muted-foreground lg:grid">
            <span>Bệnh nhân</span><span>Đợt điều trị</span><span className="text-right">Trạng thái</span>
          </div>
          <ol className="divide-y">
            {pagination.pageItems.map((record) => (
              <RecordRow key={`${record.type}-${record.id}`} record={record} now={now} onOpen={() => router.push(detailHref(record.type === "VISIT" ? `/doctor/visits/${record.id}/results` : `/doctor/emergency/${record.id}`))} />
            ))}
          </ol>
          <ListFooter shown={pagination.pageItems.length} offset={pagination.offset} total={filtered.length} unfiltered={records.length} unit="đợt điều trị" page={pagination.page} pageCount={pagination.pageCount} onPage={pagination.setPage} />
          {query.data?.limited && <p className="border-t px-5 py-2 text-xs text-[oklch(0.55_0.16_35)]">Kết quả bị giới hạn 500 bản ghi mỗi loại — hãy thu hẹp khoảng thời gian hoặc tìm cụ thể hơn.</p>}
        </>
      )}
    </section>
  );
}

function RecordRow({ record, now, onOpen }: { record: MedicalRecordItem; now: number; onOpen: () => void }) {
  const patient = record.patient;
  const age = patient.date_of_birth ? getAge(patient.date_of_birth) : patient.age != null ? `${patient.age} tuổi` : "Chưa rõ tuổi";
  const contact = [patient.identity_number && `CCCD ${patient.identity_number}`, patient.phone_number].filter(Boolean).join(" · ");
  const emergency = record.type === "EMERGENCY";
  const active = record.status === "IN_TREATMENT" || record.status === "AWAITING_PAYMENT" || record.status === "AWAITING_MEDICINE";
  const minutes = Math.max(0, Math.floor((now - new Date(record.started_at).getTime()) / 60_000));

  return (
    <li
      {...clickableProps(onOpen, `Xem hồ sơ ${record.code}`)}
      className="group grid cursor-pointer gap-3 px-4 py-4 outline-none transition hover:bg-muted/40 focus-visible:bg-muted/60 sm:px-5 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(12rem,15rem)] lg:items-center lg:gap-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {getInitials(patient.full_name)}
          {emergency && record.priority && <span className={cn("absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-card", priorityStyle[record.priority])} />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{patient.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{[patient.patient_code, age, formatGender(patient.gender)].filter(Boolean).join(" · ")}</p>
          {contact && <p className="truncate text-[0.7rem] text-muted-foreground/80">{contact}</p>}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", emergency ? "bg-red-50 text-red-700" : "bg-primary/10 text-primary")}>
            {emergency ? <Siren className="size-3" /> : <Stethoscope className="size-3" />}{emergency ? "Cấp cứu" : "Khám thường"}
          </span>
          <span className="font-mono text-muted-foreground">{record.code}</span>
          <span className="text-muted-foreground">· vào {format(new Date(record.started_at), "HH:mm dd/MM/yyyy")}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm">{record.diagnosis || <span className="text-muted-foreground">{record.reason || "Chưa có chẩn đoán"}</span>}</p>
        {record.diagnosis && record.reason && <p className="line-clamp-1 text-xs text-muted-foreground">Lý do: {record.reason}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <div className="min-w-0 text-xs lg:text-right">
          <span className={cn("inline-flex rounded-full px-2 py-0.5 font-medium", statusMeta[record.status].badge)}>{statusLabel(record)}</span>
          {active && record.location ? (
            <p className="mt-1 inline-flex max-w-full items-center gap-1 text-muted-foreground lg:flex lg:justify-end">
              <MapPin className="size-3 shrink-0 text-primary" />
              <span className="truncate"><span className="font-medium text-foreground">{record.location.room_code}</span>{record.location.name ? ` · ${record.location.name}` : ""} · {formatDuration(minutes).toLowerCase()}</span>
            </p>
          ) : record.ended_at ? (
            <p className="mt-1 text-muted-foreground">Kết thúc {format(new Date(record.ended_at), "HH:mm dd/MM/yyyy")}</p>
          ) : null}
        </div>
        <ChevronRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </div>
    </li>
  );
}
