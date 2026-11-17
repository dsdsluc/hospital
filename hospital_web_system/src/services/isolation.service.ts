import { apiClient } from "@/lib/api-client";
import type { EmergencyPreparation } from "@/services/emergency.service";

export type IsolationType = "CONTACT" | "DROPLET" | "AIRBORNE" | "PROTECTIVE";
export interface IsolationMonitoring { id: string; symptoms: string; vital_signs: string | null; respiratory_support: string | null; treatment_response: string | null; test_name: string | null; test_result: string | null; infection_note: string | null; recorded_at: string }
export interface IsolationEpisode {
  id: string;
  emergency_case_id: string | null;
  medical_visit_id: string | null;
  source_room: string;
  status: "REQUESTED" | "ACTIVE" | "RELEASED" | "DECEASED";
  isolation_type: IsolationType;
  reason: string;
  diagnosis: string | null;
  transport_condition: string | null;
  vital_signs: string | null;
  ppe_requirements: string | null;
  handoff_note: string | null;
  requested_at: string;
  admitted_at: string | null;
  monitoring_records: IsolationMonitoring[];
  emergency_case: { emergency_code: string; full_name: string; age: number | null; date_of_birth: string | null; location: string | null; preparation?: EmergencyPreparation | null } | null;
  medical_visit: { id: string; visit_code: string; patient: { full_name: string; patient_code: string | null; date_of_birth: string | null } } | null;
}
export type IsolationMonitoringPayload = { symptoms: string; vital_signs: string | null; respiratory_support: string | null; treatment_response: string | null; test_name: string | null; test_result: string | null; infection_note: string | null };
/** ICU-505 và DECEASED backend vẫn nhận, giao diện ISO-404 hiện không đề xuất. */
export type IsolationDestination = "IP-401" | "IP-402" | "OBS-403" | "PHM-105" | "ICU-505" | "DECEASED";

export const isolationService = {
  async createReferral(payload: object) { const r = await apiClient.post<{ message: string }>("/isolation/referrals", payload); return r.data; },
  async getEpisodes() { const r = await apiClient.get<{ episodes: IsolationEpisode[] }>("/isolation/episodes"); return r.data.episodes; },
  async admit(id: string) { const r = await apiClient.put<{ message: string }>(`/isolation/episodes/${id}/admit`); return r.data; },
  async monitor(id: string, payload: IsolationMonitoringPayload) { const r = await apiClient.post<{ message: string }>(`/isolation/episodes/${id}/monitoring`, payload); return r.data; },
  async release(id: string, payload: { final_assessment: string; infection_risk_result: string; destination_room: IsolationDestination }) { const r = await apiClient.put<{ message: string }>(`/isolation/episodes/${id}/release`, payload); return r.data; },
  /** Đơn thuốc của bệnh nhân đang ở ISO-404 (dùng chung API đơn thuốc tầng 4). */
  async savePrescription(preparationId: string, payload: { note?: string | null; items: Array<{ medicine_id: string; dosage?: string | null; quantity: number; usage?: string | null }> }) {
    const r = await apiClient.put<{ message: string }>(`/emergency/ward-transfers/${preparationId}/prescription`, payload, { params: { room_code: "ISO-404" } });
    return r.data;
  },
};
