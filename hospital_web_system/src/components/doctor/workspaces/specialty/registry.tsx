"use client";

import type { ReactNode } from "react";
import { Baby, Ear, HeartPulse, ScanFace, type LucideIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { ReceptionQueueAppointment } from "@/types/api";
import { PediatricSection, isPediatricEmpty, readPediatric, type PediatricData } from "@/components/doctor/workspaces/pediatric-fields";
import { EntSection, isEntEmpty, readEnt, type EntData } from "@/components/doctor/workspaces/specialty/ent-exam";
import { DermatologySection, isDermatologyEmpty, readDermatology, type DermatologyData } from "@/components/doctor/workspaces/specialty/dermatology-exam";
import { InternalSection, isInternalEmpty, readInternal, type InternalData } from "@/components/doctor/workspaces/specialty/internal-exam";
import { appendText } from "@/components/doctor/workspaces/specialty/ui";

/**
 * Tab chuyên khoa theo phòng khám tầng 2. Mỗi chuyên khoa nằm trong file riêng;
 * phòng không có trong bảng này (GEN-201, GEN-202) giữ nguyên màn hình chung.
 * Dữ liệu lưu ở `examination_records.specialty_data` (+ `clinical_findings`).
 */
export type SpecialtyValue = { type: string };

type SectionProps = {
  value: SpecialtyValue;
  onChange: (next: SpecialtyValue) => void;
  appointment: ReceptionQueueAppointment;
  /** Chép câu mô tả vào ô khám lâm sàng. */
  onDescribe: (text: string) => void;
};

type SpecialtyDef = {
  tabLabel: string;
  icon: LucideIcon;
  title: string;
  description: string;
  findingsPlaceholder: string;
  read: (raw: Record<string, unknown> | null | undefined) => SpecialtyValue;
  isEmpty: (value: SpecialtyValue) => boolean;
  Section: (props: SectionProps) => ReactNode;
};

const specialties: Record<string, SpecialtyDef> = {
  PED: {
    tabLabel: "Khám nhi",
    icon: Baby,
    title: "Thông tin nhi khoa",
    description: "Người đưa trẻ, tiêm chủng, dinh dưỡng, tiền sử sinh",
    findingsPlaceholder: "Tổng trạng, da niêm, thóp, tim phổi, bụng, tai mũi họng...",
    read: readPediatric,
    isEmpty: (value) => isPediatricEmpty(value as PediatricData),
    Section: ({ value, onChange, appointment }) => <PediatricSection value={value as PediatricData} onChange={onChange} dateOfBirth={appointment.patient.date_of_birth} />,
  },
  INT: {
    tabLabel: "Khám nội khoa",
    icon: HeartPulse,
    title: "Bệnh mạn tính",
    description: "Bệnh đang theo dõi, huyết áp, đường huyết, thuốc đang dùng",
    findingsPlaceholder: "Tổng trạng, tim, phổi, bụng, phù, thần kinh...",
    read: readInternal,
    isEmpty: (value) => isInternalEmpty(value as InternalData),
    Section: ({ value, onChange, appointment }) => {
      const reception = appointment.medical_visits[0]?.reception_record;
      return <InternalSection value={value as InternalData} onChange={onChange} clinicBp={{ systolic: reception?.systolic_blood_pressure ?? null, diastolic: reception?.diastolic_blood_pressure ?? null }} />;
    },
  },
  ENT: {
    tabLabel: "Khám TMH",
    icon: Ear,
    title: "Khám tai mũi họng",
    description: "Tai, mũi, họng, thanh quản và hạch cổ",
    findingsPlaceholder: "Bấm “Chép mô tả vào khám lâm sàng” để tạo nhanh, sau đó chỉnh sửa thêm...",
    read: readEnt,
    isEmpty: (value) => isEntEmpty(value as EntData),
    Section: ({ value, onChange, onDescribe }) => <EntSection value={value as EntData} onChange={onChange} onDescribe={onDescribe} />,
  },
  DER: {
    tabLabel: "Khám da liễu",
    icon: ScanFace,
    title: "Tổn thương da",
    description: "Vị trí, loại, màu sắc, kích thước và phân bố",
    findingsPlaceholder: "Bấm “Chép mô tả vào khám lâm sàng” để tạo nhanh, sau đó chỉnh sửa thêm...",
    read: readDermatology,
    isEmpty: (value) => isDermatologyEmpty(value as DermatologyData),
    Section: ({ value, onChange, onDescribe }) => <DermatologySection value={value as DermatologyData} onChange={onChange} onDescribe={onDescribe} />,
  },
};

/** Chuyên khoa của phòng (theo tiền tố mã phòng), hoặc null nếu phòng không có tab riêng. */
export function getSpecialty(roomCode: string) {
  return specialties[roomCode.split("-")[0]] ?? null;
}

/** Nội dung tab chuyên khoa: ① phần riêng của chuyên khoa, ② khám lâm sàng. */
export function SpecialtyPanel({ specialty, value, onChange, appointment, clinicalFindings, onClinicalFindingsChange, SectionHeading }: {
  specialty: SpecialtyDef;
  value: SpecialtyValue;
  onChange: (next: SpecialtyValue) => void;
  appointment: ReceptionQueueAppointment;
  clinicalFindings: string;
  onClinicalFindingsChange: (value: string) => void;
  SectionHeading: (props: { index: number; title: string; description: string }) => ReactNode;
}) {
  const { Section } = specialty;
  return (
    <div className="space-y-6 p-5">
      <section>
        <SectionHeading index={1} title={specialty.title} description={specialty.description} />
        <Section value={value} onChange={onChange} appointment={appointment} onDescribe={(text) => onClinicalFindingsChange(appendText(clinicalFindings, text))} />
      </section>
      <div className="h-px bg-border" />
      <section>
        <SectionHeading index={2} title="Khám lâm sàng" description="Triệu chứng thực thể ghi nhận khi khám" />
        <Textarea rows={5} value={clinicalFindings} onChange={(event) => onClinicalFindingsChange(event.target.value)} placeholder={specialty.findingsPlaceholder} className="min-h-28 resize-none rounded-xl p-3" />
      </section>
    </div>
  );
}
