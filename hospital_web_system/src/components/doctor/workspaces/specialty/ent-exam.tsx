"use client";

import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chips, Field, Group, obj, str } from "@/components/doctor/workspaces/specialty/ui";

/** Khám tai mũi họng (ENT-205), lưu trong `specialty_data` với type "ENT". */
type Ear = { canal: string; drum: string };
export type EntData = {
  type: "ENT";
  ear_right: Ear;
  ear_left: Ear;
  nose_mucosa: string;
  nose_turbinate: string;
  nose_discharge: string;
  nose_septum: string;
  tonsil_right: string;
  tonsil_left: string;
  tonsil_surface: string;
  pharynx: string;
  voice: string;
  neck_nodes: string;
  neck_nodes_note: string;
};

const emptyEar: Ear = { canal: "", drum: "" };
export const emptyEnt: EntData = { type: "ENT", ear_right: emptyEar, ear_left: emptyEar, nose_mucosa: "", nose_turbinate: "", nose_discharge: "", nose_septum: "", tonsil_right: "", tonsil_left: "", tonsil_surface: "", pharynx: "", voice: "", neck_nodes: "", neck_nodes_note: "" };

const NORMAL = {
  canal: "Sạch", drum: "Bình thường", mucosa: "Hồng", turbinate: "Bình thường", discharge: "Không", septum: "Thẳng",
  tonsil: "Độ I", surface: "Bình thường", pharynx: "Bình thường", voice: "Bình thường", nodes: "Không sờ thấy",
};
const canalOptions = [NORMAL.canal, { value: "Ráy tai", warn: true }, { value: "Viêm đỏ", warn: true }, { value: "Có dịch", warn: true }];
const drumOptions = [NORMAL.drum, { value: "Sung huyết", warn: true }, { value: "Phồng", warn: true }, { value: "Thủng", warn: true }, { value: "Không quan sát được", warn: true }];
const mucosaOptions = [NORMAL.mucosa, { value: "Nhợt", warn: true }, { value: "Sung huyết", warn: true }, { value: "Phù nề", warn: true }];
const turbinateOptions = [NORMAL.turbinate, { value: "Quá phát", warn: true }];
const dischargeOptions = [NORMAL.discharge, { value: "Trong", warn: true }, { value: "Đục", warn: true }, { value: "Mủ", warn: true }];
const septumOptions = [NORMAL.septum, { value: "Lệch", warn: true }];
const tonsilOptions = ["Độ 0", NORMAL.tonsil, { value: "Độ II", warn: true }, { value: "Độ III", warn: true }, { value: "Độ IV", warn: true }];
const surfaceOptions = [NORMAL.surface, { value: "Đỏ", warn: true }, { value: "Có mủ", warn: true }, { value: "Hốc mủ", warn: true }];
const pharynxOptions = [NORMAL.pharynx, { value: "Đỏ", warn: true }, { value: "Có hạt", warn: true }, { value: "Có mủ", warn: true }];
const voiceOptions = [NORMAL.voice, { value: "Khàn", warn: true }, { value: "Mất tiếng", warn: true }];
const nodeOptions = [NORMAL.nodes, { value: "Có hạch", warn: true }];

export function readEnt(value: Record<string, unknown> | null | undefined): EntData {
  if (!value || value.type !== "ENT") return emptyEnt;
  const ear = (raw: unknown): Ear => ({ canal: str(obj(raw).canal), drum: str(obj(raw).drum) });
  return {
    type: "ENT", ear_right: ear(value.ear_right), ear_left: ear(value.ear_left),
    nose_mucosa: str(value.nose_mucosa), nose_turbinate: str(value.nose_turbinate), nose_discharge: str(value.nose_discharge), nose_septum: str(value.nose_septum),
    tonsil_right: str(value.tonsil_right), tonsil_left: str(value.tonsil_left), tonsil_surface: str(value.tonsil_surface), pharynx: str(value.pharynx),
    voice: str(value.voice), neck_nodes: str(value.neck_nodes), neck_nodes_note: str(value.neck_nodes_note),
  };
}

export function isEntEmpty(data: EntData) {
  return JSON.stringify(data) === JSON.stringify(emptyEnt);
}

/** Câu mô tả từ các ô đã chọn, bỏ qua ô trống. */
export function describeEnt(d: EntData) {
  const join = (parts: Array<string | false>) => parts.filter(Boolean).join(", ");
  const ear = (side: string, e: Ear) => { const text = join([e.canal && `ống tai ${e.canal.toLowerCase()}`, e.drum && `màng nhĩ ${e.drum.toLowerCase()}`]); return text && `Tai ${side}: ${text}.`; };
  const nose = join([d.nose_mucosa && `niêm mạc ${d.nose_mucosa.toLowerCase()}`, d.nose_turbinate && `cuốn mũi ${d.nose_turbinate.toLowerCase()}`, d.nose_discharge && (d.nose_discharge === "Không" ? "không có dịch" : `dịch ${d.nose_discharge.toLowerCase()}`), d.nose_septum && `vách ngăn ${d.nose_septum.toLowerCase()}`]);
  const tonsil = d.tonsil_right && d.tonsil_right === d.tonsil_left ? `amidan ${d.tonsil_right.toLowerCase()} hai bên` : join([d.tonsil_right && `amidan phải ${d.tonsil_right.toLowerCase()}`, d.tonsil_left && `amidan trái ${d.tonsil_left.toLowerCase()}`]);
  const throat = join([tonsil, d.tonsil_surface && d.tonsil_surface !== "Bình thường" && `bề mặt amidan ${d.tonsil_surface.toLowerCase()}`, d.pharynx && `thành họng ${d.pharynx.toLowerCase()}`]);
  const nodes = d.neck_nodes && (d.neck_nodes === "Có hạch" ? `có hạch cổ${d.neck_nodes_note ? ` (${d.neck_nodes_note})` : ""}` : "hạch cổ không sờ thấy");
  return [ear("phải", d.ear_right), ear("trái", d.ear_left), nose && `Mũi: ${nose}.`, throat && `Họng: ${throat}.`, d.voice && `Giọng nói ${d.voice.toLowerCase()}.`, nodes && `Cổ: ${nodes}.`].filter(Boolean).join("\n");
}

export function EntSection({ value, onChange, onDescribe }: { value: EntData; onChange: (next: EntData) => void; onDescribe: (text: string) => void }) {
  const set = <K extends keyof EntData>(key: K, next: EntData[K]) => onChange({ ...value, [key]: next });
  const setEar = (side: "ear_right" | "ear_left", key: keyof Ear, next: string) => onChange({ ...value, [side]: { ...value[side], [key]: next } });
  const allNormal = () => onChange({
    ...value,
    ear_right: { canal: NORMAL.canal, drum: NORMAL.drum }, ear_left: { canal: NORMAL.canal, drum: NORMAL.drum },
    nose_mucosa: NORMAL.mucosa, nose_turbinate: NORMAL.turbinate, nose_discharge: NORMAL.discharge, nose_septum: NORMAL.septum,
    tonsil_right: NORMAL.tonsil, tonsil_left: NORMAL.tonsil, tonsil_surface: NORMAL.surface, pharynx: NORMAL.pharynx, voice: NORMAL.voice, neck_nodes: NORMAL.nodes,
  });
  const description = describeEnt(value);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={allNormal}>Bình thường toàn bộ</Button>
      <Button type="button" size="sm" className="rounded-full" disabled={!description} onClick={() => onDescribe(description)}><Wand2 /> Chép mô tả vào khám lâm sàng</Button>
      <span className="text-xs text-muted-foreground">Chip vàng là dấu hiệu bất thường. Các mục đều không bắt buộc.</span>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      {(["ear_right", "ear_left"] as const).map((side) => <Group key={side} title={side === "ear_right" ? "Tai phải" : "Tai trái"}>
        <Chips label="Ống tai" options={canalOptions} value={value[side].canal} onChange={(next) => setEar(side, "canal", next)} />
        <Chips label="Màng nhĩ" options={drumOptions} value={value[side].drum} onChange={(next) => setEar(side, "drum", next)} />
      </Group>)}
    </div>

    <Group title="Mũi">
      <div className="grid gap-3 md:grid-cols-2">
        <Chips label="Niêm mạc" options={mucosaOptions} value={value.nose_mucosa} onChange={(next) => set("nose_mucosa", next)} />
        <Chips label="Cuốn mũi" options={turbinateOptions} value={value.nose_turbinate} onChange={(next) => set("nose_turbinate", next)} />
        <Chips label="Dịch mũi" options={dischargeOptions} value={value.nose_discharge} onChange={(next) => set("nose_discharge", next)} />
        <Chips label="Vách ngăn" options={septumOptions} value={value.nose_septum} onChange={(next) => set("nose_septum", next)} />
      </div>
    </Group>

    <Group title="Họng">
      <div className="grid gap-3 md:grid-cols-2">
        <Chips label="Amidan phải" options={tonsilOptions} value={value.tonsil_right} onChange={(next) => set("tonsil_right", next)} />
        <Chips label="Amidan trái" options={tonsilOptions} value={value.tonsil_left} onChange={(next) => set("tonsil_left", next)} />
        <Chips label="Bề mặt amidan" options={surfaceOptions} value={value.tonsil_surface} onChange={(next) => set("tonsil_surface", next)} />
        <Chips label="Thành họng" options={pharynxOptions} value={value.pharynx} onChange={(next) => set("pharynx", next)} />
      </div>
    </Group>

    <Group title="Thanh quản & hạch cổ">
      <div className="grid gap-3 md:grid-cols-2">
        <Chips label="Giọng nói" options={voiceOptions} value={value.voice} onChange={(next) => set("voice", next)} />
        <div className="space-y-2">
          <Chips label="Hạch cổ" options={nodeOptions} value={value.neck_nodes} onChange={(next) => set("neck_nodes", next)} />
          {value.neck_nodes === "Có hạch" && <Field label="Vị trí, kích thước"><Input value={value.neck_nodes_note} onChange={(e) => set("neck_nodes_note", e.target.value)} placeholder="Ví dụ: dưới hàm phải, 1 cm, di động" className="h-9 rounded-lg" /></Field>}
        </div>
      </div>
    </Group>
  </div>;
}
