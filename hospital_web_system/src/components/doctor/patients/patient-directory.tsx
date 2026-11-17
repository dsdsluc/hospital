"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight, IdCard, LoaderCircle, Mail, MapPin, Phone, RefreshCw, Search, UserRoundSearch, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPatientDirectory, type PatientDirectoryItem } from "@/services/patient.service";
import type { BloodType } from "@/types/api";
import { CopyCode, FilterChip, ListFooter, StateBlock, formatGender, getAge, getInitials, usePagination, useDetailHref } from "@/components/doctor/queue/queue-ui";

type KindFilter = "ALL" | "ACCOUNT" | "WALK_IN" | "IN_VISIT";

const bloodTypeLabels: Record<BloodType, string> = { A_POSITIVE: "A+", A_NEGATIVE: "A-", B_POSITIVE: "B+", B_NEGATIVE: "B-", AB_POSITIVE: "AB+", AB_NEGATIVE: "AB-", O_POSITIVE: "O+", O_NEGATIVE: "O-" };

/**
 * Mục "Tra cứu bệnh nhân": danh bạ bệnh nhân với thông tin cơ bản, mã bệnh nhân sao chép được.
 * Tìm trên server theo tên / mã bệnh nhân / CCCD / SĐT (GET /patients?q=).
 */
export function PatientDirectory() {
  const router = useRouter();
  const detailHref = useDetailHref();
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<KindFilter>("ALL");

  // Gõ xong 350 ms mới tra cứu trên server.
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useQuery({ queryKey: ["patient-directory", keyword], queryFn: () => getPatientDirectory(keyword || undefined) });
  const patients = useMemo(() => query.data?.patients ?? [], [query.data]);

  const counts = useMemo(() => ({
    ALL: patients.length,
    ACCOUNT: patients.filter((patient) => patient.has_account).length,
    WALK_IN: patients.filter((patient) => !patient.has_account).length,
    IN_VISIT: patients.filter((patient) => patient.last_visit?.status === "IN_PROGRESS").length,
  }), [patients]);
  const filtered = useMemo(() => patients.filter((patient) => {
    if (kind === "ACCOUNT") return patient.has_account;
    if (kind === "WALK_IN") return !patient.has_account;
    if (kind === "IN_VISIT") return patient.last_visit?.status === "IN_PROGRESS";
    return true;
  }), [patients, kind]);
  const pagination = usePagination(filtered, [keyword, kind].join("|"));

  return (
    <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="space-y-3 border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><UserRoundSearch className="size-4" /></span>
            <div>
              <h2 className="text-sm font-medium">Danh bạ bệnh nhân</h2>
              <p className="text-xs text-muted-foreground">{keyword ? `Kết quả cho “${keyword}” · ${query.data?.total ?? 0} bệnh nhân` : `${query.data?.total ?? 0} hồ sơ · mới tạo gần đây trước`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 lg:w-80 lg:flex-none">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, mã bệnh nhân, CCCD, SĐT" className="h-9 rounded-xl pl-9 pr-8" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
            </div>
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={() => query.refetch()} aria-label="Làm mới" disabled={query.isFetching}>
              <RefreshCw className={cn(query.isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={kind === "ALL"} onClick={() => setKind("ALL")} label="Tất cả" count={counts.ALL} />
          <FilterChip active={kind === "IN_VISIT"} onClick={() => setKind("IN_VISIT")} label="Đang khám" count={counts.IN_VISIT} dot="bg-sky-500" />
          <FilterChip active={kind === "ACCOUNT"} onClick={() => setKind("ACCOUNT")} label="Có tài khoản" count={counts.ACCOUNT} dot="bg-primary" />
          <FilterChip active={kind === "WALK_IN"} onClick={() => setKind("WALK_IN")} label="Vãng lai" count={counts.WALK_IN} dot="bg-amber-500" />
        </div>
      </div>

      {query.isPending ? (
        <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tra cứu bệnh nhân...</p></StateBlock>
      ) : query.isError ? (
        <StateBlock><p className="text-sm text-muted-foreground">Không thể tải danh bạ bệnh nhân.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>
      ) : filtered.length === 0 ? (
        <StateBlock>
          <UserRoundSearch className="size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{patients.length > 0 ? "Không có bệnh nhân phù hợp với bộ lọc." : keyword ? `Không tìm thấy bệnh nhân cho “${keyword}”.` : "Chưa có bệnh nhân nào trong hệ thống."}</p>
        </StateBlock>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)_minmax(9rem,11rem)_minmax(11rem,14rem)] gap-5 border-b px-5 py-2.5 text-xs text-muted-foreground lg:grid">
            <span>Bệnh nhân</span><span>Liên hệ</span><span>Chỉ số</span><span className="text-right">Khám bệnh</span>
          </div>
          <ol className="divide-y">
            {pagination.pageItems.map((patient) => (
              <PatientRow key={patient.id} patient={patient} onOpenVisit={(visitId) => router.push(detailHref(`/doctor/visits/${visitId}/results`))} />
            ))}
          </ol>
          <ListFooter shown={pagination.pageItems.length} offset={pagination.offset} total={filtered.length} unfiltered={patients.length} unit="bệnh nhân" page={pagination.page} pageCount={pagination.pageCount} onPage={pagination.setPage} />
          {query.data?.limited && <p className="border-t px-5 py-2 text-xs text-[oklch(0.55_0.16_35)]">Chỉ hiển thị 200 hồ sơ mới nhất trên tổng {query.data.total} — hãy tìm cụ thể hơn.</p>}
        </>
      )}
    </section>
  );
}

function PatientRow({ patient, onOpenVisit }: { patient: PatientDirectoryItem; onOpenVisit: (visitId: string) => void }) {
  const lastVisit = patient.last_visit;
  const inVisit = lastVisit?.status === "IN_PROGRESS";
  const metrics = [
    patient.blood_type && `Nhóm máu ${bloodTypeLabels[patient.blood_type]}`,
    patient.height_cm != null && `${patient.height_cm} cm`,
    patient.weight_kg != null && `${patient.weight_kg} kg`,
  ].filter(Boolean) as string[];

  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)_minmax(9rem,11rem)_minmax(11rem,14rem)] lg:items-center lg:gap-5">
      {/* Bệnh nhân + mã (sao chép được) */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{getInitials(patient.full_name)}</span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-medium">
            <span className="truncate">{patient.full_name}</span>
            {!patient.has_account && <span className="shrink-0 rounded-full bg-amber-50 px-1.5 text-[0.6rem] font-medium text-amber-700">Vãng lai</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{formatGender(patient.gender)} · {getAge(patient.date_of_birth)}{patient.date_of_birth && ` · ${format(new Date(patient.date_of_birth), "dd/MM/yyyy")}`}</p>
          {/* Chỉ bệnh nhân có tài khoản mới có mã bệnh nhân; vãng lai không hiển thị mã. */}
          <div className="mt-1">
            {patient.has_account && patient.patient_code
              ? <CopyCode code={patient.patient_code} label="mã bệnh nhân" />
              : <span className="text-[0.7rem] text-muted-foreground/80">Chưa có mã bệnh nhân</span>}
          </div>
        </div>
      </div>

      {/* Liên hệ */}
      <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
        <ContactLine icon={Phone} value={patient.phone_number} />
        <ContactLine icon={IdCard} value={patient.identity_number && `CCCD ${patient.identity_number}`} />
        <ContactLine icon={Mail} value={patient.email} />
        <ContactLine icon={MapPin} value={patient.address} />
        {!patient.phone_number && !patient.identity_number && !patient.email && !patient.address && <p className="text-muted-foreground/70">Chưa có thông tin liên hệ</p>}
      </div>

      {/* Chỉ số cơ bản */}
      <div className="text-xs text-muted-foreground">
        {metrics.length ? metrics.map((metric) => <p key={metric}>{metric}</p>) : <p className="text-muted-foreground/70">Chưa cập nhật</p>}
      </div>

      {/* Khám bệnh */}
      <div className="text-xs lg:text-right">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{patient.counts.visits}</span> lượt khám
          {patient.counts.emergencies > 0 && <> · <span className="font-medium text-foreground tabular-nums">{patient.counts.emergencies}</span> cấp cứu</>}
        </p>
        {lastVisit ? (
          <button type="button" onClick={() => onOpenVisit(lastVisit.id)} className="group mt-1 inline-flex max-w-full items-center gap-1 text-muted-foreground transition hover:text-primary">
            {inVisit && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-sky-500" />}
            <span className="truncate">{inVisit ? "Đang khám" : "Gần nhất"} · <span className="font-mono">{lastVisit.visit_code}</span> · {format(new Date(lastVisit.created_at), "dd/MM/yyyy")}</span>
            <ChevronRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" />
          </button>
        ) : <p className="mt-1 text-muted-foreground/70">Chưa có lượt khám</p>}
        <p className="mt-0.5 text-[0.7rem] text-muted-foreground/70">Tạo hồ sơ {format(new Date(patient.created_at), "dd/MM/yyyy")}</p>
      </div>
    </li>
  );
}

function ContactLine({ icon: Icon, value }: { icon: typeof Phone; value: string | null | false }) {
  if (!value) return null;
  return <p className="flex min-w-0 items-center gap-1.5"><Icon className="size-3 shrink-0" /><span className="truncate" title={value}>{value}</span></p>;
}
