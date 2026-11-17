"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, ClipboardList, LoaderCircle, MapPin, RefreshCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { medicalVisitService, type VisitListItem, type VisitListStep } from "@/services/medical-visit.service";
import { toDateKey } from "@/components/doctor/today-schedule-sheet";
import { ListFooter, StateBlock, clickableProps, formatClock, formatDuration, getAge, getInitials, usePagination, useDetailHref } from "@/components/doctor/queue/queue-ui";

/** Chờ ở một bước quá số phút này thì tô đỏ. */
const LONG_WAIT_MINUTES = 45;

/** Mục "Lượt khám": các lượt khám trong ngày kèm hành trình qua từng phòng (GET /medical-visits?date=). */
export function VisitList() {
  const router = useRouter();
  const detailHref = useDetailHref();
  const [date, setDate] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const dateKey = toDateKey(date);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const query = useQuery({ queryKey: ["medical-visit-list", dateKey], queryFn: () => medicalVisitService.getList(dateKey) });
  const visits = useMemo(() => query.data?.medical_visits ?? [], [query.data]);
  const isToday = query.data ? query.data.date === query.data.today : dateKey === toDateKey(new Date());

  const normalizedSearch = normalize(search.trim());
  const filtered = useMemo(() => visits.filter((visit) => !normalizedSearch || normalize([
    visit.patient.full_name, visit.patient.patient_code, visit.visit_code, visit.appointment_code, visit.receiving_room.room_code,
  ].filter(Boolean).join(" ")).includes(normalizedSearch)), [visits, normalizedSearch]);
  const pagination = usePagination(filtered, [dateKey, normalizedSearch].join("|"));

  const openCount = visits.filter((visit) => visit.status === "IN_PROGRESS").length;
  const latestDate = query.data?.latest_date;

  return (
    <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="size-4" /></span>
          <div>
            <h2 className="text-sm font-medium">Hành trình lượt khám</h2>
            <p className="text-xs text-muted-foreground">{visits.length} lượt khám{openCount > 0 && ` · ${openCount} đang diễn ra`}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bệnh nhân, mã lượt khám / lịch hẹn" className="h-9 rounded-xl pl-9" />
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => setDate(addDays(date, -1))} aria-label="Ngày trước"><ChevronLeft /></Button>
            <label className="relative flex h-8 items-center rounded-full border bg-background px-3 text-xs font-medium focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
              <span className="capitalize">{isToday ? "Hôm nay" : format(date, "EEEE, dd/MM", { locale: vi })}</span>
              <input type="date" value={dateKey} max={toDateKey(new Date())} onChange={(event) => { if (event.target.value) setDate(new Date(`${event.target.value}T00:00:00`)); }} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Chọn ngày" />
            </label>
            <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Ngày sau"><ChevronRight /></Button>
            {!isToday && <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setDate(new Date())}>Hôm nay</Button>}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={() => query.refetch()} aria-label="Làm mới" disabled={query.isFetching}>
            <RefreshCw className={cn(query.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tải lượt khám...</p></StateBlock>
      ) : query.isError ? (
        <StateBlock><p className="text-sm text-muted-foreground">Không thể tải danh sách lượt khám.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>
      ) : filtered.length === 0 ? (
        <StateBlock>
          <ClipboardList className="size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{visits.length > 0 ? "Không có lượt khám phù hợp." : isToday ? "Hôm nay chưa có lượt khám nào." : "Không có lượt khám nào trong ngày này."}</p>
          {visits.length === 0 && latestDate && latestDate !== dateKey && (
            <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => setDate(new Date(`${latestDate}T00:00:00`))}>
              Xem ngày gần nhất có lượt khám ({format(new Date(`${latestDate}T00:00:00`), "dd/MM/yyyy")})
            </Button>
          )}
        </StateBlock>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(11rem,14rem)] gap-5 border-b px-5 py-2.5 text-xs text-muted-foreground lg:grid">
            <span>Bệnh nhân</span><span>Hành trình</span><span className="text-right">Hiện tại</span>
          </div>
          <ol className="divide-y">
            {pagination.pageItems.map((visit) => (
              <VisitRow key={visit.id} visit={visit} now={now} onOpen={() => router.push(detailHref(`/doctor/visits/${visit.id}/results`))} />
            ))}
          </ol>
          <ListFooter shown={pagination.pageItems.length} offset={pagination.offset} total={filtered.length} unfiltered={visits.length} unit="lượt khám" page={pagination.page} pageCount={pagination.pageCount} onPage={pagination.setPage} />
        </>
      )}
    </section>
  );
}

function VisitRow({ visit, now, onOpen }: { visit: VisitListItem; now: number; onOpen: () => void }) {
  return (
    <li
      {...clickableProps(onOpen, `Xem chi tiết lượt khám ${visit.visit_code}`)}
      className="group grid cursor-pointer gap-3 px-4 py-4 outline-none transition hover:bg-muted/40 focus-visible:bg-muted/60 sm:px-5 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(11rem,14rem)] lg:items-center lg:gap-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{getInitials(visit.patient.full_name)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{visit.patient.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{visit.visit_code}</span> · {visit.patient.patient_code} · {getAge(visit.patient.date_of_birth)}
          </p>
        </div>
      </div>

      <Journey steps={visit.steps} />

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <CurrentState visit={visit} now={now} />
        <ChevronRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </div>
    </li>
  );
}

/** Chuỗi các phòng bệnh nhân đi qua, theo thứ tự được chỉ định. */
function Journey({ steps }: { steps: VisitListStep[] }) {
  if (steps.length === 0) return <p className="text-xs text-muted-foreground">Chưa có bước nào.</p>;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-y-1.5">
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 && <span className={cn("mx-1 h-px w-3 shrink-0", step.status === "PENDING" ? "bg-border" : "bg-primary/40")} />}
          <StepChip step={step} />
        </Fragment>
      ))}
    </div>
  );
}

function StepChip({ step }: { step: VisitListStep }) {
  const title = [
    `${step.room.room_code} · ${step.room.name}`,
    step.started_at && `Bắt đầu ${formatClock(step.started_at)}`,
    step.completed_at && `Xong ${formatClock(step.completed_at)}`,
    step.status === "CANCELLED" && "Đã hủy chỉ định",
    step.status === "PENDING" && "Đang chờ",
  ].filter(Boolean).join(" · ");

  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.68rem] tracking-wide",
        step.status === "COMPLETED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        step.status === "IN_PROGRESS" && "border-primary/40 bg-primary/10 font-medium text-primary",
        step.status === "PENDING" && "border-dashed text-muted-foreground",
        step.status === "CANCELLED" && "border-transparent bg-muted text-muted-foreground/70 line-through",
      )}
    >
      {step.status === "COMPLETED" && <Check className="size-3" />}
      {step.status === "IN_PROGRESS" && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {step.status === "CANCELLED" && <X className="size-3" />}
      {step.room.room_code}
    </span>
  );
}

function CurrentState({ visit, now }: { visit: VisitListItem; now: number }) {
  const current = visit.current_step;

  // Đã hoàn tất khám nhưng hóa đơn chưa thu → đang ở quầy thu ngân.
  if (visit.invoice_status === "UNPAID") {
    return (
      <div className="min-w-0 text-xs lg:text-right">
        <p className="inline-flex max-w-full items-center gap-1 font-medium"><MapPin className="size-3 shrink-0 text-primary" /><span className="truncate">CAS-103 · Thu ngân</span></p>
        <p className="mt-1"><span className="rounded-full bg-orange-50 px-2 py-0.5 font-medium text-orange-800">Chờ thanh toán{visit.invoice_total != null ? ` · ${visit.invoice_total.toLocaleString("vi-VN")} ₫` : ""}</span></p>
      </div>
    );
  }

  if (visit.status === "COMPLETED" || !current) {
    return (
      <div className="text-xs lg:text-right">
        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{visit.status === "COMPLETED" ? "Đã khám xong" : "Chờ kết luận"}</span>
        <p className="mt-1 text-muted-foreground">{visit.status === "COMPLETED" ? `Đã rời viện · ${formatClock(visit.updated_at)}` : `Quay lại ${visit.receiving_room.room_code}`}</p>
      </div>
    );
  }

  const minutes = current.waiting_since ? Math.max(0, Math.floor((now - new Date(current.waiting_since).getTime()) / 60_000)) : null;
  const long = minutes != null && minutes >= LONG_WAIT_MINUTES;
  return (
    <div className="min-w-0 text-xs lg:text-right">
      <p className="inline-flex max-w-full items-center gap-1 font-medium">
        <MapPin className="size-3 shrink-0 text-primary" />
        <span className="truncate">{current.room.room_code} · {current.room.function_name}</span>
      </p>
      <p className={cn("mt-1", long ? "font-medium text-red-600" : "text-muted-foreground")}>
        {current.status === "IN_PROGRESS" ? "Đang thực hiện" : "Đang chờ"}{minutes != null && ` · ${formatDuration(minutes).toLowerCase()}`}
        {visit.carried_over && <span className="ml-1 rounded-full bg-amber-50 px-1.5 text-[0.65rem] font-medium text-amber-700">Từ hôm trước</span>}
      </p>
    </div>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
