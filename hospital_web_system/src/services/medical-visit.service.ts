import { apiClient } from "@/lib/api-client";

export interface StartMedicalVisitPayload {
  appointment_id: string;
  receiving_room_code: string;
  temperature_c?: number | null;
  systolic_blood_pressure?: number | null;
  diastolic_blood_pressure?: number | null;
  heart_rate?: number | null;
  spo2?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  visit_reason?: string | null;
  reception_note?: string | null;
}

/** Lượt khám không có lịch hẹn: dùng hồ sơ có sẵn (patient_id) hoặc tạo hồ sơ vãng lai (new_patient). */
export type StartWalkInVisitPayload = Omit<StartMedicalVisitPayload, "appointment_id"> & {
  patient_id?: string;
  new_patient?: { full_name: string; date_of_birth?: string | null; gender?: "MALE" | "FEMALE" | "OTHER" | null; phone_number?: string | null; identity_number?: string | null; address?: string | null };
};

export interface StartedMedicalVisit {
  id: string;
  visit_code: string;
  appointment_id: string;
  patient_id: string;
  receiving_room_id: string;
  status: "IN_PROGRESS" | "COMPLETED";
}

export interface PatientVisitRoom {
  id: string;
  room_code: string;
  name: string;
  floor: { floor_number: number; name: string };
  function: { function_code: string; name: string };
}

export interface CurrentMedicalVisit {
  id: string;
  visit_code: string;
  status: "IN_PROGRESS" | "COMPLETED";
  created_at: string;
  receiving_room: PatientVisitRoom;
  appointment: {
    appointment_code: string;
    appointment_date: string;
    appointment_time: string;
  } | null;
  steps: Array<{
    id: string;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    started_at: string | null;
    completed_at: string | null;
    room: PatientVisitRoom;
  }>;
  /** Hóa đơn lập khi bác sĩ hoàn tất khám; UNPAID → bệnh nhân cần tới quầy thu ngân. */
  invoice?: { invoice_code: string; status: "UNPAID" | "PAID"; total_amount: number; next_destination: string | null } | null;
  /** Phòng CAS-103 khi còn hóa đơn chưa thanh toán. */
  cashier_room?: PatientVisitRoom | null;
}

export interface PatientNavigation {
  visit_id: string;
  visit_code: string;
  updated_at: string;
  origin: PatientVisitRoom;
  destination: PatientVisitRoom;
  floor_difference: number;
  estimated_minutes: number;
  instructions: string[];
}

export interface RoomVisitAssignment {
  visit_step: {
    id: string;
    status: "PENDING" | "IN_PROGRESS";
    started_at: string | null;
    created_at: string;
  };
  medical_visit: {
    id: string;
    visit_code: string;
    status: "IN_PROGRESS" | "COMPLETED";
    created_at?: string;
    invoice?: { invoice_code: string; status: "UNPAID" | "PAID"; total_amount: number } | null;
    receiving_room: { id: string; room_code: string; name: string };
    reception_record: {
      temperature_c: number | null;
      systolic_blood_pressure: number | null;
      diastolic_blood_pressure: number | null;
      heart_rate: number | null;
      spo2: number | null;
      height_cm: number | null;
      weight_kg: number | null;
      visit_reason: string | null;
      reception_note: string | null;
    } | null;
    examination_record: {
      id: string;
      preliminary_diagnosis: string | null;
      next_evaluation: string | null;
      clinical_findings?: string | null;
      specialty_data?: Record<string, unknown> | null;
      final_diagnosis: string | null;
      treatment_direction: string | null;
      conclusion: string | null;
      doctor_advice: string | null;
    } | null;
    prescription: VisitPrescription | null;
    steps: Array<{
      id: string;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
      instruction: string | null;
      room: PatientVisitRoom;
      clinical_result: { id: string; result: string } | null;
    }>;
    patient: import("@/types/api").PatientProfile & {
      user: { email: string | null; phone_number: string | null };
    };
    appointment: import("@/types/api").Appointment | null;
  };
}

export type MeasurementFlag = "LOW" | "NORMAL" | "HIGH";

export interface PatientClinicalResult {
  visit_step_id: string;
  medical_visit_id: string;
  visit_code: string;
  room: { id: string; room_code: string; name: string; floor_name: string; function_name: string };
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  instruction: string | null;
  started_at: string | null;
  completed_at: string | null;
  recorded_at: string;
  updated_at: string;
  measurements: Array<{ label: string; description: string; value: string; unit: string | null; reference: string | null; flag: MeasurementFlag | null }>;
  details: Array<{ label: string; value: string }>;
  findings: string | null;
  conclusion: string | null;
  raw_result: string;
  treatment: { final_diagnosis: string | null; treatment_direction: string | null; doctor_advice: string | null };
}

export interface AvailableMedicine {
  id: string;
  medicine_code: string;
  name: string;
  unit: string;
  stock_quantity: number;
  status: "AVAILABLE" | "UNAVAILABLE";
}

export interface VisitPrescriptionItem {
  id: string;
  medicine_id: string;
  dosage: string | null;
  quantity: number;
  usage: string | null;
  medicine: AvailableMedicine;
}

export interface VisitPrescription {
  id: string;
  note: string | null;
  confirmed_at: string | null;
  items: VisitPrescriptionItem[];
}

export interface MedicalVisitSummary {
  id: string;
  visit_code: string;
  status: "IN_PROGRESS" | "COMPLETED";
  created_at: string;
  updated_at: string;
  appointment: { appointment_code: string; appointment_date: string; appointment_time: string; note: string | null } | null;
  patient: import("@/types/api").PatientProfile & { user: { email: string | null; phone_number: string | null } };
  receiving_room: PatientVisitRoom;
  reception_record: RoomVisitAssignment["medical_visit"]["reception_record"];
  examination_record: RoomVisitAssignment["medical_visit"]["examination_record"];
  steps: Array<{
    id: string;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    instruction: string | null;
    started_at: string | null;
    completed_at: string | null;
    room: PatientVisitRoom;
    clinical_result: { id: string; result: string; created_at: string; updated_at: string } | null;
  }>;
  prescription: VisitPrescription | null;
}

export type PatientMedicalVisit = Omit<MedicalVisitSummary, "patient"> & {
  /** Hóa đơn của lượt khám (khám thường). */
  invoice?: import("@/services/invoice.service").Invoice | null;
  /** Nếu lượt khám được chuyển lên tầng 4: hóa đơn ra viện của ca điều trị đó (đã gộp phí lượt khám). */
  escalated_emergency_cases?: Array<{ emergency_code: string; invoice: import("@/services/invoice.service").Invoice | null }>;
};

export interface SaveConclusionPayload {
  final_diagnosis?: string | null;
  treatment_direction?: string | null;
  conclusion?: string | null;
  doctor_advice?: string | null;
}

export interface SavePrescriptionPayload {
  note?: string | null;
  items: Array<{
    medicine_id: string;
    dosage?: string | null;
    quantity: number;
    usage?: string | null;
  }>;
}

export interface VisitListStep {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  room: { room_code: string; name: string; function_name: string };
  has_result: boolean;
}

/** Một lượt khám trong danh sách "Lượt khám" kèm hành trình qua các phòng. */
export interface VisitListItem {
  id: string;
  visit_code: string;
  status: "IN_PROGRESS" | "COMPLETED";
  created_at: string;
  updated_at: string;
  /** Lượt khám của ngày trước vẫn đang mở. */
  carried_over: boolean;
  patient: { id: string; patient_code: string | null; full_name: string; gender: "MALE" | "FEMALE" | "OTHER" | null; date_of_birth: string | null };
  receiving_room: { room_code: string; name: string };
  appointment_code: string | null;
  visit_reason: string | null;
  diagnosis: string | null;
  prescription_items: number;
  /** UNPAID → bệnh nhân đang ở quầy thu ngân CAS-103. */
  invoice_status: "UNPAID" | "PAID" | null;
  invoice_total: number | null;
  steps: VisitListStep[];
  /** Bước đang thực hiện, hoặc bước đầu tiên còn chờ. */
  current_step: { id: string; status: VisitListStep["status"]; room: VisitListStep["room"]; waiting_since: string | null } | null;
}

export interface VisitListResponse {
  date: string;
  today: string;
  /** Ngày gần nhất (≤ date) có lượt khám. */
  latest_date: string | null;
  medical_visits: VisitListItem[];
}

export const medicalVisitService = {
  /** Danh sách lượt khám trong ngày kèm hành trình (GET /medical-visits?date=). */
  async getList(date: string): Promise<VisitListResponse> {
    const response = await apiClient.get<VisitListResponse>("/medical-visits", { params: { date } });
    return response.data;
  },


  async startWalkIn(payload: StartWalkInVisitPayload) {
    const response = await apiClient.post<{ message: string; medical_visit: { id: string; visit_code: string } }>("/medical-visits/walk-in", payload);
    return response.data;
  },
  async start(payload: StartMedicalVisitPayload): Promise<StartedMedicalVisit> {
    const response = await apiClient.post<{ medical_visit: StartedMedicalVisit }>("/medical-visits/start", payload);
    return response.data.medical_visit;
  },
  async getMyCurrentVisit(): Promise<CurrentMedicalVisit | null> {
    const response = await apiClient.get<{ medical_visit: CurrentMedicalVisit | null }>("/medical-visits/me/current");
    return response.data.medical_visit;
  },
  async getMyCurrentNavigation(): Promise<PatientNavigation | null> {
    const response = await apiClient.get<{ navigation: PatientNavigation | null }>("/medical-visits/me/current/navigation");
    return response.data.navigation;
  },
  async getMyVisits(): Promise<PatientMedicalVisit[]> {
    const response = await apiClient.get<{ medical_visits: PatientMedicalVisit[] }>("/medical-visits/me/visits");
    return response.data.medical_visits;
  },
  async getMyVisit(medicalVisitId: string): Promise<PatientMedicalVisit> {
    const response = await apiClient.get<{ medical_visit: PatientMedicalVisit }>(`/medical-visits/me/visits/${medicalVisitId}`);
    return response.data.medical_visit;
  },
  async getMyClinicalResult(medicalVisitId: string, visitStepId: string): Promise<PatientClinicalResult> {
    const response = await apiClient.get<{ clinical_result: PatientClinicalResult }>(`/medical-visits/me/visits/${medicalVisitId}/results/${visitStepId}`);
    return response.data.clinical_result;
  },
  async getRoomQueue(roomCode: string): Promise<RoomVisitAssignment[]> {
    const response = await apiClient.get<{ assignments: RoomVisitAssignment[] }>("/medical-visits/room-queue", {
      params: { room_code: roomCode },
    });
    return response.data.assignments;
  },
  async getSummary(medicalVisitId: string): Promise<MedicalVisitSummary> {
    const response = await apiClient.get<{ medical_visit: MedicalVisitSummary }>(`/medical-visits/${medicalVisitId}/summary`);
    return response.data.medical_visit;
  },
  async createOrders(medicalVisitId: string, payload: { room_codes: string[]; instruction?: string | null }) {
    const response = await apiClient.post<{ message: string }>(`/medical-visits/${medicalVisitId}/orders`, payload);
    return response.data;
  },
  /** Bắt đầu thực hiện chỉ định tại phòng chức năng (PENDING → IN_PROGRESS). */
  async startVisitStep(visitStepId: string) {
    const response = await apiClient.patch<{ message: string }>(`/medical-visits/steps/${visitStepId}/start`);
    return response.data;
  },
  async completeVisitStep(visitStepId: string, payload: { result: string }) {
    const response = await apiClient.put<{ message: string }>(`/medical-visits/steps/${visitStepId}/result`, payload);
    return response.data;
  },
  async dispensePrescription(visitStepId: string) {
    const response = await apiClient.put<{ message: string }>(`/medical-visits/steps/${visitStepId}/dispense`);
    return response.data;
  },
  async saveConclusion(medicalVisitId: string, payload: SaveConclusionPayload) {
    const response = await apiClient.put<{ message: string }>(`/medical-visits/${medicalVisitId}/conclusion`, payload);
    return response.data;
  },
  async saveInitialExamination(medicalVisitId: string, payload: { preliminary_diagnosis?: string | null; next_evaluation?: string | null; clinical_findings?: string | null; specialty_data?: Record<string, unknown> | null }) {
    const response = await apiClient.put<{ message: string }>(`/medical-visits/${medicalVisitId}/initial-examination`, payload);
    return response.data;
  },
  async getAvailableMedicines(): Promise<AvailableMedicine[]> {
    const response = await apiClient.get<{ medicines: AvailableMedicine[] }>("/medical-visits/available-medicines");
    return response.data.medicines;
  },
  async savePrescription(medicalVisitId: string, payload: SavePrescriptionPayload) {
    const response = await apiClient.put<{ message: string }>(`/medical-visits/${medicalVisitId}/prescription`, payload);
    return response.data;
  },
  async escalateToObservation(medicalVisitId: string, payload: { reason: string; preliminary_diagnosis: string; transport_condition: string; vital_signs: string; handoff_note?: string | null }) {
    const response = await apiClient.post<{ message: string }>(`/medical-visits/${medicalVisitId}/escalate-observation`, payload);
    return response.data;
  },
};
