export type UserRole = "PATIENT" | "DOCTOR" | "ADMIN";

export interface User {
  id: string;
  email: string | null;
  phone_number: string | null;
  role: UserRole;
  patient: {
    id: string;
    patient_code: string;
    full_name: string;
  } | null;
  doctor: {
    id: string;
    doctor_code: string;
    full_name: string;
  } | null;
}

export interface AuthResponse {
  message: string;
  user: User;
  access_token: string;
}

export interface ApiMessageResponse {
  message: string;
}

export type AppointmentStatus = "BOOKED" | "CANCELLED";

export interface Appointment {
  id: string;
  appointment_code: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_date: string;
  appointment_time: string;
  note: string | null;
  status: AppointmentStatus;
  /** Thời điểm bệnh nhân được xác nhận đã đến quầy tiếp nhận. */
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  doctor: {
    id: string;
    doctor_code: string;
    full_name: string;
    specialization: string;
  } | null;
}

export interface ReceptionQueueAppointment extends Appointment {
  patient: PatientProfile & {
    user: {
      email: string | null;
      phone_number: string | null;
    };
  };
  medical_visits: Array<{
    id: string;
    visit_code: string;
    status: "IN_PROGRESS" | "COMPLETED";
    /** Hóa đơn tại CAS-103 (lập khi hoàn tất khám). */
    invoice?: { invoice_code: string; status: "UNPAID" | "PAID"; total_amount: number } | null;
    receiving_room: {
      id: string;
      room_code: string;
      name: string;
    };
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
      /** Thời điểm đo / ghi nhận tại phòng tiếp nhận. */
      created_at?: string;
    } | null;
    examination_record?: {
      id: string;
      preliminary_diagnosis: string | null;
      next_evaluation: string | null;
      clinical_findings?: string | null;
      specialty_data?: Record<string, unknown> | null;
      final_diagnosis: string | null;
      treatment_direction: string | null;
      conclusion: string | null;
      doctor_advice: string | null;
      updated_at?: string;
    } | null;
    prescription?: {
      id: string;
      note: string | null;
      confirmed_at: string | null;
      items: Array<{
        id: string;
        medicine_id: string;
        dosage: string | null;
        quantity: number;
        usage: string | null;
        medicine: {
          id: string;
          medicine_code: string;
          name: string;
          unit: string;
          stock_quantity: number;
          status: "AVAILABLE" | "UNAVAILABLE";
        };
      }>;
    } | null;
    steps?: Array<{
      id: string;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
      instruction: string | null;
      created_at?: string;
      completed_at?: string | null;
      room: {
        id: string;
        room_code: string;
        name: string;
        floor: { floor_number: number; name: string };
        function: { function_code: string; name: string };
      };
      clinical_result: { id: string; result: string } | null;
    }>;
  }>;
}

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type BloodType = "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE" | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE";

export interface PatientProfile {
  id: string;
  /** null = bệnh nhân vãng lai (không có tài khoản). */
  user_id: string | null;
  /** Chỉ bệnh nhân có tài khoản mới có mã; vãng lai = null. */
  patient_code: string | null;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  blood_type: BloodType | null;
  identity_number: string | null;
  address: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  created_at: string;
  updated_at: string;
}
