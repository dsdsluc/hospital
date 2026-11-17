"use client";

import { Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chips, Field, Group, MultiChips, Unit, str, strList } from "@/components/doctor/workspaces/specialty/ui";

/** Khám da liễu (DER-206), lưu trong `specialty_data` với type "DERMATOLOGY". */
export type Lesion = { id: string; regions: string[]; kinds: string[]; colors: string[]; size_cm: string; count: string; distribution: string };
export type DermatologyData = { type: "DERMATOLOGY"; lesions: Lesion[]; symptoms: string[]; onset: string };

export const emptyDermatology: DermatologyData = { type: "DERMATOLOGY", lesions: [], symptoms: [], onset: "" };

const regionGroups: Array<[string, string[]]> = [
  ["Đầu – mặt – cổ", ["Da đầu", "Mặt", "Quanh mắt", "Quanh miệng", "Tai", "Cổ"]],
  ["Thân", ["Ngực", "Bụng", "Lưng", "Mông", "Nách", "Bẹn – sinh dục"]],
  ["Chi trên", ["Vai – cánh tay", "Khuỷu", "Cẳng tay", "Bàn tay", "Lòng bàn tay", "Móng tay"]],
  ["Chi dưới", ["Đùi", "Gối", "Cẳng chân", "Bàn chân", "Lòng bàn chân", "Móng chân"]],
];
const kindOptions = ["Dát", "Sẩn", "Mảng", "Mụn nước", "Bọng nước", "Mụn mủ", "Vảy", "Vảy tiết", "Trợt", "Loét", "Nốt", "Sẹo"];
const colorOptions = ["Đỏ", "Hồng", "Nâu", "Đen", "Trắng", "Tím", "Vàng"];
const countOptions = ["Đơn độc", "Vài tổn thương", "Nhiều", "Lan tỏa"];
const distributionOptions = ["Rải rác", "Tập trung thành đám", "Đối xứng", "Theo dải / dây thần kinh", "Vùng tiếp xúc"];
const symptomOptions = ["Ngứa", "Đau", "Rát", "Chảy dịch", "Sốt kèm theo"];

export function readDermatology(value: Record<string, unknown> | null | undefined): DermatologyData {
  if (!value || value.type !== "DERMATOLOGY") return emptyDermatology;
  const lesions = Array.isArray(value.lesions) ? value.lesions.map((raw, index) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return { id: str(item.id) || `lesion-${index}`, regions: strList(item.regions), kinds: strList(item.kinds), colors: strList(item.colors), size_cm: str(item.size_cm), count: str(item.count), distribution: str(item.distribution) };
  }) : [];
  return { type: "DERMATOLOGY", lesions, symptoms: strList(value.symptoms), onset: str(value.onset) };
}

export function isDermatologyEmpty(data: DermatologyData) {
  return data.lesions.length === 0 && data.symptoms.length === 0 && !data.onset.trim();
}

const lower = (list: string[]) => list.map((x) => x.toLowerCase()).join(", ");

export function describeDermatology(d: DermatologyData) {
  const lesions = d.lesions.map((lesion, index) => {
    const head = lesion.kinds.length ? lower(lesion.kinds) : "tổn thương";
    const parts = [
      lesion.colors.length && `màu ${lower(lesion.colors)}`,
      lesion.size_cm.trim() && `kích thước ${lesion.size_cm.trim()} cm`,
      lesion.count && lesion.count.toLowerCase(),
      lesion.distribution && `phân bố ${lesion.distribution.toLowerCase()}`,
      lesion.regions.length && `tại ${lower(lesion.regions)}`,
    ].filter(Boolean);
    const text = `${head.charAt(0).toUpperCase()}${head.slice(1)}${parts.length ? ` ${parts.join(", ")}` : ""}.`;
    return d.lesions.length > 1 ? `${index + 1}. ${text}` : text;
  });
  const extra = [d.symptoms.length && `Triệu chứng: ${lower(d.symptoms)}.`, d.onset.trim() && `Xuất hiện: ${d.onset.trim()}.`].filter(Boolean) as string[];
  return [...lesions, ...extra].join("\n");
}

export function DermatologySection({ value, onChange, onDescribe }: { value: DermatologyData; onChange: (next: DermatologyData) => void; onDescribe: (text: string) => void }) {
  const updateLesion = (id: string, patch: Partial<Lesion>) => onChange({ ...value, lesions: value.lesions.map((lesion) => lesion.id === id ? { ...lesion, ...patch } : lesion) });
  const addLesion = () => onChange({ ...value, lesions: [...value.lesions, { id: crypto.randomUUID(), regions: [], kinds: [], colors: [], size_cm: "", count: "", distribution: "" }] });
  const removeLesion = (id: string) => onChange({ ...value, lesions: value.lesions.filter((lesion) => lesion.id !== id) });
  const description = describeDermatology(value);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={addLesion}><Plus /> Thêm tổn thương</Button>
      <Button type="button" size="sm" className="rounded-full" disabled={!description} onClick={() => onDescribe(description)}><Wand2 /> Chép mô tả vào khám lâm sàng</Button>
      <span className="text-xs text-muted-foreground">Mỗi nhóm tổn thương giống nhau ghi một lần. Các mục đều không bắt buộc.</span>
    </div>

    {value.lesions.length === 0 && <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chưa ghi tổn thương nào. Bấm “Thêm tổn thương” để mô tả vị trí, loại và hình thái.</p>}

    {value.lesions.map((lesion, index) => <Group key={lesion.id} title={`Tổn thương ${index + 1}`} aside={<Button type="button" variant="ghost" size="icon-sm" aria-label="Xóa tổn thương" className="text-destructive" onClick={() => removeLesion(lesion.id)}><Trash2 /></Button>}>
      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted-foreground">Vị trí</span>
        <div className="grid gap-2 lg:grid-cols-2">{regionGroups.map(([group, regions]) => <div key={group} className="rounded-xl bg-muted/40 p-2.5">
          <p className="mb-1.5 text-[0.7rem] font-medium text-muted-foreground">{group}</p>
          <MultiChips options={regions} value={lesion.regions} onChange={(next) => updateLesion(lesion.id, { regions: next })} />
        </div>)}</div>
      </div>
      <MultiChips label="Loại tổn thương" options={kindOptions} value={lesion.kinds} onChange={(next) => updateLesion(lesion.id, { kinds: next })} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem]">
        <MultiChips label="Màu sắc" options={colorOptions} value={lesion.colors} onChange={(next) => updateLesion(lesion.id, { colors: next })} />
        <Field label="Kích thước"><Unit unit="cm"><Input value={lesion.size_cm} onChange={(e) => updateLesion(lesion.id, { size_cm: e.target.value })} placeholder="0.5–2" className="h-9 rounded-lg pr-9" /></Unit></Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Chips label="Số lượng" options={countOptions} value={lesion.count} onChange={(next) => updateLesion(lesion.id, { count: next })} />
        <Chips label="Phân bố" options={distributionOptions} value={lesion.distribution} onChange={(next) => updateLesion(lesion.id, { distribution: next })} />
      </div>
    </Group>)}

    <Group title="Triệu chứng kèm theo">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <MultiChips options={symptomOptions} value={value.symptoms} onChange={(next) => onChange({ ...value, symptoms: next })} />
        <Field label="Thời gian xuất hiện"><Input value={value.onset} onChange={(e) => onChange({ ...value, onset: e.target.value })} placeholder="Ví dụ: 5 ngày, tái phát nhiều lần" className="h-9 rounded-lg" /></Field>
      </div>
    </Group>
  </div>;
}
