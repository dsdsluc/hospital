import { apiClient } from "@/lib/api-client";
import type { Appointment, ReceptionQueueAppointment } from "@/types/api";

export interface CreateAppointmentPayload {
  appointment_date: string;
  appointment_time: string;
  note?: string;
}

/** Lịch hẹn phía bệnh nhân, kèm lượt khám gắn với lịch (nếu đã được tiếp nhận). */
export type PatientAppointment = Appointment & {
  medical_visits?: Array<{ id: string; visit_code: string; status: "IN_PROGRESS" | "COMPLETED"; /** Bước nhà thuốc chưa cấp (nếu có). */ steps?: Array<{ id: string }> }>;
};

export interface DailyScheduleAppointment {
  id: string;
  appointment_code: string;
  appointment_date: string;
  appointment_time: string;
  note: string | null;
  status: Appointment["status"];
  checked_in_at: string | null;
  created_at: string;
  patient: {
    id: string;
    patient_code: string;
    full_name: string;
    gender: "MALE" | "FEMALE" | "OTHER" | null;
    date_of_birth: string | null;
    user: { phone_number: string | null };
  };
  medical_visits: Array<{
    id: string;
    visit_code: string;
    status: "IN_PROGRESS" | "COMPLETED";
    created_at: string;
    receiving_room: { room_code: string; name: string };
  }>;
}

interface AppointmentResponse {
  message: string;
  appointment: Appointment;
}

export const appointmentService = {
  async create(payload: CreateAppointmentPayload): Promise<AppointmentResponse> {
    const response = await apiClient.post<AppointmentResponse>("/appointments", payload);
    return response.data;
  },

  async getMine(): Promise<PatientAppointment[]> {
    const response = await apiClient.get<{ appointments: PatientAppointment[] }>("/appointments/me");
    return response.data.appointments;
  },

  async cancel(appointmentId: string): Promise<AppointmentResponse> {
    const response = await apiClient.patch<AppointmentResponse>(`/appointments/${appointmentId}/cancel`);
    return response.data;
  },

  /**
   * Xác nhận bệnh nhân đã đến. `moveToToday` dùng cho lịch của ngày sau:
   * chuyển ngày khám sang hôm nay (giờ = giờ đến thực tế).
   */
  async checkIn(appointmentId: string, moveToToday = false): Promise<{ message: string; appointment: ReceptionQueueAppointment }> {
    const response = await apiClient.patch<{ message: string; appointment: ReceptionQueueAppointment }>(
      `/appointments/${appointmentId}/check-in`,
      { move_to_today: moveToToday },
    );
    return response.data;
  },

  /** Tra lịch hẹn theo mã (mọi ngày). `today` là ngày hiện tại theo giờ Việt Nam do server trả về. */
  async lookupByCode(code: string): Promise<{ today: string; appointment: DailyScheduleAppointment }> {
    const response = await apiClient.get<{ today: string; appointment: DailyScheduleAppointment }>(
      "/appointments/lookup",
      { params: { code } },
    );
    return response.data;
  },

  async getDailySchedule(date: string): Promise<DailyScheduleAppointment[]> {
    const response = await apiClient.get<{ appointments: DailyScheduleAppointment[] }>(
      "/appointments/schedule",
      { params: { date } },
    );
    return response.data.appointments;
  },

  /** Lịch hẹn theo khoảng ngày `[from, to]`; bỏ `to` để lấy mọi lịch từ `from` trở đi. Server giới hạn 1000 lịch. */
  async getScheduleRange(from: string, to?: string): Promise<DailyScheduleAppointment[]> {
    const response = await apiClient.get<{ appointments: DailyScheduleAppointment[] }>(
      "/appointments/schedule",
      { params: { from, ...(to ? { to } : {}) } },
    );
    return response.data.appointments;
  },

  async getReceptionQueue(date: string): Promise<ReceptionQueueAppointment[]> {
    const response = await apiClient.get<{ appointments: ReceptionQueueAppointment[] }>(
      "/appointments/reception-queue",
      { params: { date } },
    );
    return response.data.appointments;
  },
};
