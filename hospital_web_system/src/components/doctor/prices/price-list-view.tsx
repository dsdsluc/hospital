"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Pill, ReceiptText, Search, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatVnd, priceService, type MedicinePriceItem, type ServiceCategory, type ServicePriceItem } from "@/services/price.service";
import { FilterChip, QueueCardHeader, StateBlock } from "@/components/doctor/queue/queue-ui";

type PriceTab = "services" | "medicines";

const categoryLabels: Record<ServiceCategory, string> = {
  EXAMINATION: "Khám bệnh",
  IMAGING: "Chẩn đoán hình ảnh",
  LABORATORY: "Xét nghiệm",
  FUNCTIONAL_TEST: "Thăm dò chức năng",
  EMERGENCY: "Cấp cứu",
  SURGERY: "Phẫu thuật",
  BED_DAY: "Giường bệnh / lưu trú",
};
const categoryOrder = Object.keys(categoryLabels) as ServiceCategory[];

/** Tồn kho từ mức này trở xuống được tô màu nhắc (chỉ hiển thị, không chặn kê đơn). */
const LOW_STOCK = 50;

/**
 * Mục "Bảng giá" của khu vực làm việc bác sĩ: 2 tab giá dịch vụ / giá thuốc (giá đang áp dụng, VND).
 * Tab đang mở lưu ở `?price=`.
 */
export function PriceListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: PriceTab = searchParams.get("price") === "medicines" ? "medicines" : "services";

  const servicesQuery = useQuery({ queryKey: ["prices", "services"], queryFn: priceService.getServicePrices });
  const medicinesQuery = useQuery({ queryKey: ["prices", "medicines"], queryFn: priceService.getMedicinePrices });

  function changeTab(next: PriceTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("price", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const tabs = (
    <div role="tablist" aria-label="Loại bảng giá" className="scrollbar-hidden flex min-w-0 overflow-x-auto">
      <TabButton active={tab === "services"} onClick={() => changeTab("services")} icon={Stethoscope} label="Giá dịch vụ" count={servicesQuery.data?.length} />
      <TabButton active={tab === "medicines"} onClick={() => changeTab("medicines")} icon={Pill} label="Giá thuốc" count={medicinesQuery.data?.length} />
    </div>
  );

  const query = tab === "services" ? servicesQuery : medicinesQuery;

  return (
    <section className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <QueueCardHeader tabs={tabs} hint="Giá đang áp dụng · đơn vị VND" fetching={query.isFetching} onRefresh={() => query.refetch()} />
      {tab === "services"
        ? <ServicePriceTable query={servicesQuery} />
        : <MedicinePriceTable query={medicinesQuery} />}
    </section>
  );
}

/* --------------------------------------------- Giá dịch vụ --------------------------------------------- */

function ServicePriceTable({ query }: { query: { data?: ServicePriceItem[]; isPending: boolean; isError: boolean; refetch: () => unknown } }) {
  const [category, setCategory] = useState<ServiceCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const items = useMemo(() => query.data ?? [], [query.data]);

  const counts = useMemo(() => {
    const result = new Map<ServiceCategory, number>();
    for (const item of items) result.set(item.category, (result.get(item.category) ?? 0) + 1);
    return result;
  }, [items]);

  const normalizedSearch = normalize(search.trim());
  const groups = useMemo(() => categoryOrder
    .filter((key) => category === "ALL" || key === category)
    .map((key) => ({
      category: key,
      items: items
        .filter((item) => item.category === key)
        .filter((item) => !normalizedSearch || normalize([item.service_code, item.name, item.room_function?.name, ...(item.room_function?.room_codes ?? [])].filter(Boolean).join(" ")).includes(normalizedSearch))
        .sort((left, right) => left.unit_price - right.unit_price || left.name.localeCompare(right.name, "vi")),
    }))
    .filter((group) => group.items.length > 0), [items, category, normalizedSearch]);

  return (
    <>
      <Filters search={search} onSearch={setSearch} placeholder="Tìm mã, tên dịch vụ hoặc phòng thực hiện">
        <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")} label="Tất cả" count={items.length} />
        {categoryOrder.filter((key) => counts.has(key)).map((key) => (
          <FilterChip key={key} active={category === key} onClick={() => setCategory(key)} label={categoryLabels[key]} count={counts.get(key) ?? 0} />
        ))}
      </Filters>

      <QueryState query={query} empty={items.length === 0 ? "Chưa có bảng giá dịch vụ." : groups.length === 0 ? "Không có dịch vụ phù hợp." : null}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-3 pl-5 pr-3 font-normal">Mã</th>
                <th className="px-3 py-3 font-normal">Dịch vụ</th>
                <th className="px-3 py-3 font-normal">Phòng thực hiện</th>
                <th className="px-3 py-3 font-normal">Đơn vị</th>
                <th className="py-3 pl-3 pr-5 text-right font-normal">Đơn giá</th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.category}>
                <tr className="border-b bg-muted/40">
                  <td colSpan={5} className="px-5 py-2 text-xs font-medium">{categoryLabels[group.category]} <span className="font-normal text-muted-foreground">· {group.items.length} dịch vụ</span></td>
                </tr>
                {group.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pl-5 pr-3 align-top"><Code>{item.service_code}</Code></td>
                    <td className="px-3 py-3 align-top">
                      <p>{item.name}</p>
                      {item.note && <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-muted-foreground">
                      {item.room_function ? <>{item.room_function.name}{item.room_function.room_codes.length > 0 && <span className="block font-mono text-[0.7rem]">{item.room_function.room_codes.join(", ")}</span>}</> : "—"}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-muted-foreground">{item.unit}</td>
                    <td className="py-3 pl-3 pr-5 text-right align-top font-medium tabular-nums">{formatVnd(item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </QueryState>
    </>
  );
}

/* ---------------------------------------------- Giá thuốc ---------------------------------------------- */

function MedicinePriceTable({ query }: { query: { data?: MedicinePriceItem[]; isPending: boolean; isError: boolean; refetch: () => unknown } }) {
  const [category, setCategory] = useState<string>("ALL");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const items = useMemo(() => query.data ?? [], [query.data]);

  const categories = useMemo(() => {
    const result = new Map<string, { name: string; count: number }>();
    for (const item of items) for (const entry of item.categories) {
      const current = result.get(entry.category_code);
      result.set(entry.category_code, { name: entry.name, count: (current?.count ?? 0) + 1 });
    }
    return [...result.entries()].sort((left, right) => left[1].name.localeCompare(right[1].name, "vi"));
  }, [items]);
  const lowStockCount = items.filter((item) => item.stock_quantity <= LOW_STOCK).length;

  const normalizedSearch = normalize(search.trim());
  const filtered = useMemo(() => items.filter((item) => {
    if (category !== "ALL" && !item.categories.some((entry) => entry.category_code === category)) return false;
    if (lowStockOnly && item.stock_quantity > LOW_STOCK) return false;
    if (!normalizedSearch) return true;
    return normalize(`${item.medicine_code} ${item.name}`).includes(normalizedSearch);
  }), [items, category, lowStockOnly, normalizedSearch]);

  return (
    <>
      <Filters
        search={search}
        onSearch={setSearch}
        placeholder="Tìm mã hoặc tên thuốc"
        extra={(
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} className="size-3.5 accent-[var(--primary)]" />
            Sắp hết <span className="tabular-nums">({lowStockCount})</span>
          </label>
        )}
      >
        <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")} label="Tất cả" count={items.length} />
        {categories.map(([code, entry]) => <FilterChip key={code} active={category === code} onClick={() => setCategory(code)} label={entry.name} count={entry.count} />)}
      </Filters>

      <QueryState query={query} empty={items.length === 0 ? "Chưa có thuốc trong hệ thống." : filtered.length === 0 ? "Không có thuốc phù hợp." : null}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-3 pl-5 pr-3 font-normal">Mã</th>
                <th className="px-3 py-3 font-normal">Tên thuốc</th>
                <th className="px-3 py-3 font-normal">Đơn vị</th>
                <th className="px-3 py-3 text-right font-normal">Tồn kho</th>
                <th className="px-3 py-3 font-normal">Trạng thái</th>
                <th className="py-3 pl-3 pr-5 text-right font-normal">Đơn giá</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const low = item.stock_quantity <= LOW_STOCK;
                return (
                  <tr key={item.id} className={cn("border-b last:border-0", item.status === "UNAVAILABLE" && "opacity-60")}>
                    <td className="py-3 pl-5 pr-3 align-top"><Code>{item.medicine_code}</Code></td>
                    <td className="px-3 py-3 align-top">
                      <p>{item.name}</p>
                      {item.categories.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{item.categories.map((entry) => entry.name).join(" · ")}</p>}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-muted-foreground">{item.unit}</td>
                    <td className={cn("px-3 py-3 text-right align-top tabular-nums", item.stock_quantity === 0 ? "text-red-600" : low ? "text-amber-700" : "text-muted-foreground")}>
                      {item.stock_quantity.toLocaleString("vi-VN")}
                      {low && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 text-[0.6rem] font-medium text-amber-700">{item.stock_quantity === 0 ? "Hết" : "Sắp hết"}</span>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-medium", item.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>{item.status === "AVAILABLE" ? "Đang cấp" : "Ngừng cấp"}</span>
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right align-top">
                      {item.unit_price == null
                        ? <span className="text-xs text-muted-foreground/70">Chưa có giá</span>
                        : <><span className="font-medium tabular-nums">{formatVnd(item.unit_price)}</span><span className="block text-[0.7rem] text-muted-foreground">/ {item.unit.toLowerCase()}</span></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </QueryState>
    </>
  );
}

/* ---------------------------------------------- Dùng chung --------------------------------------------- */

function Filters({ search, onSearch, placeholder, children, extra }: { search: string; onSearch: (value: string) => void; placeholder: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="space-y-3 border-b bg-muted/25 px-4 py-4 sm:px-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} className="h-10 rounded-xl bg-background pl-9" />
      </div>
      <div className="flex items-center gap-2">
        <div className="scrollbar-hidden -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">{children}</div>
        {extra}
      </div>
    </div>
  );
}

function QueryState({ query, empty, children }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown }; empty: string | null; children: ReactNode }) {
  if (query.isPending) return <StateBlock><LoaderCircle className="size-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Đang tải bảng giá...</p></StateBlock>;
  if (query.isError) return <StateBlock><p className="text-sm text-muted-foreground">Không thể tải bảng giá.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 rounded-full">Thử lại</Button></StateBlock>;
  if (empty) return <StateBlock><ReceiptText className="size-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{empty}</p></StateBlock>;
  return <>{children}</>;
}

function TabButton({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: typeof Pill; label: string; count?: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("group relative flex shrink-0 items-center gap-2.5 px-3 py-3.5 text-sm transition sm:px-4", active ? "font-medium text-foreground" : "font-normal text-muted-foreground hover:text-foreground")}
    >
      <span className={cn("grid size-8 place-items-center rounded-xl transition", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary")}>
        <Icon className="size-4" />
      </span>
      {label}
      {count != null && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] tabular-nums text-muted-foreground">{count}</span>}
      <span className={cn("absolute inset-x-3 -bottom-px h-0.5 rounded-full transition sm:inset-x-4", active ? "bg-primary" : "bg-transparent group-hover:bg-border")} />
    </button>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">{children}</span>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
