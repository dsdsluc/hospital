import { apiClient } from "@/lib/api-client";

export type PatientNotificationType = "NEXT_ROOM" | "PAYMENT_DUE" | "MEDICINE_READY" | "APPOINTMENT_REMINDER";

export interface PatientNotification {
  id: string;
  type: PatientNotificationType;
  title: string;
  body: string;
  /** Trang mở khi bấm vào thông báo. */
  href: string | null;
  /** Cần bệnh nhân làm ngay (đến phòng, thanh toán...). */
  urgent: boolean;
  read_at: string | null;
  created_at: string;
}

export interface PatientNotificationResponse {
  unread_count: number;
  notifications: PatientNotification[];
}

export const notificationService = {
  /** 50 thông báo mới nhất của bệnh nhân đang đăng nhập (server tự tạo nhắc lịch hẹn trước khi trả). */
  async getMine(): Promise<PatientNotificationResponse> {
    const response = await apiClient.get<PatientNotificationResponse>("/notifications/me");
    return response.data;
  },

  async markRead(id: string) {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllRead() {
    await apiClient.patch("/notifications/me/read-all");
  },
};
