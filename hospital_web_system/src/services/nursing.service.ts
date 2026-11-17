import { apiClient } from "@/lib/api-client";
import type { EmergencyCase } from "@/services/emergency.service";
export interface NursingTask { id:string; task_type:string; title:string; instruction:string|null; scheduled_at:string; assigned_nurse_name:string|null; status:"PENDING"|"IN_PROGRESS"|"COMPLETED"|"MISSED"; result:string|null; completed_at:string|null; }
export interface NursingVital { id:string; pulse:string|null; blood_pressure:string|null; spo2:string|null; temperature:string|null; respiratory_rate:string|null; consciousness:string|null; pain_score:string|null; note:string|null; recorded_by_name:string|null; recorded_at:string; }
export interface NursingAlert { id:string; priority:"ROUTINE"|"URGENT"|"CRITICAL"; reason:string; clinical_snapshot:string|null; status:"NEW"|"ACKNOWLEDGED"|"RESOLVED"; created_by_name:string|null; resolution_note:string|null; created_at:string; }
export interface NursingHandover { id:string; shift:string; outgoing_nurse_name:string; incoming_nurse_name:string; current_condition:string; outstanding_work:string|null; safety_warning:string|null; created_at:string; }
export interface NursingPatient { id:string; preliminary_diagnosis:string|null; emergency_case:EmergencyCase & { isolation_episode?: { status:string; isolation_type:string; ppe_requirements:string|null } | null }; nursing_care_plan:{bed_code:string|null;assigned_nurse_name:string|null;care_level:"STANDARD"|"HIGH"|"CRITICAL";fall_risk:boolean;pressure_injury_risk:boolean;isolation_precaution:boolean;care_note:string|null}|null; nursing_tasks:NursingTask[]; nursing_vitals:NursingVital[]; nursing_alerts:NursingAlert[]; nursing_handovers:NursingHandover[]; }
export const nursingService = {
  async dashboard(){const r=await apiClient.get<{patients:NursingPatient[]}>("/nursing/dashboard");return r.data.patients;},
  async saveCarePlan(id:string,payload:object){const r=await apiClient.put<{message:string}>(`/nursing/patients/${id}/care-plan`,payload);return r.data;},
  async createTask(id:string,payload:object){const r=await apiClient.post<{message:string}>(`/nursing/patients/${id}/tasks`,payload);return r.data;},
  async updateTask(id:string,payload:object){const r=await apiClient.patch<{message:string}>(`/nursing/tasks/${id}`,payload);return r.data;},
  async recordVital(id:string,payload:object){const r=await apiClient.post<{message:string}>(`/nursing/patients/${id}/vitals`,payload);return r.data;},
  async createAlert(id:string,payload:object){const r=await apiClient.post<{message:string}>(`/nursing/patients/${id}/alerts`,payload);return r.data;},
  async updateAlert(id:string,payload:object){const r=await apiClient.patch<{message:string}>(`/nursing/alerts/${id}`,payload);return r.data;},
  async createHandover(id:string,payload:object){const r=await apiClient.post<{message:string}>(`/nursing/patients/${id}/handovers`,payload);return r.data;},
};
