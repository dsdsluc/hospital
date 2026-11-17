import { apiClient } from "@/lib/api-client";

/** IN_TREATMENT: đang khám / điều trị · AWAITING_PAYMENT: chờ thanh toán tại CAS-103 · AWAITING_MEDICINE: chờ quầy PHM-105 cấp thuốc · COMPLETED: khám xong / ra viện · DECEASED: tử vong. */
export type RecordStatus = "IN_TREATMENT" | "AWAITING_PAYMENT" | "AWAITING_MEDICINE" | "COMPLETED" | "DECEASED";
export type RecordType = "VISIT" | "EMERGENCY";

export interface MedicalRecordItem {
  id: string;
  type: RecordType;
  code: string;
  status: RecordStatus;
  started_at: string;
  ended_at: string | null;
  patient: {
    full_name: string;
    patient_code: string | null;
    gender: "MALE" | "FEMALE" | "OTHER" | null;
    date_of_birth: string | null;
    age: number | null;
    identity_number: string | null;
    phone_number: string | null;
  };
  location: { room_code: string; name: string | null } | null;
  reason: string | null;
  diagnosis: string | null;
  priority: "RED" | "ORANGE" | "YELLOW" | "GREEN" | null;
}

export interface MedicalRecordResponse {
  from: string;
  to: string;
  query: string | null;
  /** Một nguồn chạm giới hạn số bản ghi — nên thu hẹp khoảng ngày. */
  limited: boolean;
  records: MedicalRecordItem[];
}

export const recordService = {
  async search(params: { from: string; to: string; q?: string }): Promise<MedicalRecordResponse> {
    const response = await apiClient.get<MedicalRecordResponse>("/records", { params: { from: params.from, to: params.to, ...(params.q ? { q: params.q } : {}) } });
    return response.data;
  },
};
