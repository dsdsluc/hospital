import { apiClient } from "@/lib/api-client";
import type { PatientProfile } from "@/types/api";

export interface UpdatePatientPayload {
  full_name?: string;
  date_of_birth?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  identity_number?: string | null;
  address?: string | null;
  blood_type?: "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE" | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE" | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  email?: string | null;
  phone_number?: string | null;
}

/** Kết quả tra cứu hồ sơ tại quầy tiếp nhận, kèm tình trạng lịch hẹn / lượt khám. */
export interface ReceptionPatientSearchResult {
  id: string;
  patient_code: string;
  full_name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  date_of_birth: string | null;
  identity_number: string | null;
  address: string | null;
  phone_number: string | null;
  has_account: boolean;
  active_visit: { id: string; visit_code: string; appointment_id: string; receiving_room: { room_code: string; name: string } } | null;
  today_appointment: { id: string; appointment_code: string; appointment_date: string; appointment_time: string; checked_in_at: string | null } | null;
  upcoming_appointment: { id: string; appointment_code: string; appointment_date: string; appointment_time: string; checked_in_at: string | null } | null;
}

export const patientService = {
  /** Tra cứu hồ sơ theo CCCD, SĐT hoặc mã bệnh nhân (khớp chính xác). Dành cho bác sĩ / quầy tiếp nhận. */
  async searchForReception(query: string): Promise<ReceptionPatientSearchResult[]> {
    const response = await apiClient.get<{ patients: ReceptionPatientSearchResult[] }>("/patients/search", { params: { q: query } });
    return response.data.patients;
  },

  async getMyProfile(): Promise<PatientProfile> {
    const response = await apiClient.get<{ patient: PatientProfile }>("/patients/me");
    return response.data.patient;
  },
  async updateMyProfile(payload: UpdatePatientPayload): Promise<PatientProfile> {
    const response = await apiClient.patch<{ patient: PatientProfile }>("/patients/me", payload);
    return response.data.patient;
  },
  async updateByDoctor(patientId: string, payload: UpdatePatientPayload): Promise<PatientProfile & { user: { email: string | null; phone_number: string | null } }> {
    const response = await apiClient.patch<{ patient: PatientProfile & { user: { email: string | null; phone_number: string | null } } }>(`/patients/${patientId}`, payload);
    return response.data.patient;
  },
};

/** Một bệnh nhân trong mục "Tra cứu bệnh nhân" (GET /patients). */
export interface PatientDirectoryItem {
  id: string;
  patient_code: string | null;
  full_name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  date_of_birth: string | null;
  blood_type: import("@/types/api").BloodType | null;
  identity_number: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  created_at: string;
  /** false = bệnh nhân vãng lai (không có tài khoản đăng nhập). */
  has_account: boolean;
  counts: { visits: number; emergencies: number; appointments: number };
  last_visit: { id: string; visit_code: string; status: "IN_PROGRESS" | "COMPLETED"; created_at: string } | null;
}

export interface PatientDirectoryResponse {
  query: string | null;
  total: number;
  /** Có nhiều hơn số hồ sơ trả về (tối đa 200) — nên tìm cụ thể hơn. */
  limited: boolean;
  patients: PatientDirectoryItem[];
}

/** Danh bạ bệnh nhân cho bác sĩ: tìm theo tên / mã bệnh nhân / CCCD / SĐT. */
export async function getPatientDirectory(q?: string): Promise<PatientDirectoryResponse> {
  const response = await apiClient.get<PatientDirectoryResponse>("/patients", { params: q ? { q } : {} });
  return response.data;
}

