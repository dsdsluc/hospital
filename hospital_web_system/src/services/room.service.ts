import { apiClient } from "@/lib/api-client";

export interface HistoryRoom {
  id: string;
  room_code: string;
  name: string;
  status: "AVAILABLE" | "UNAVAILABLE";
  function_code: string;
  function_name: string;
  doctor: { doctor_code: string; full_name: string } | null;
  /** Số bước khám / chỉ định đã hoàn thành tại phòng. */
  completed_steps: number;
  /** Số lượt khám được tiếp nhận tại phòng. */
  received_visits: number;
  /** Số ca đã xử lý ở phòng cấp cứu / phẫu thuật / hồi sức / nội trú / cách ly / điều dưỡng. */
  handled_cases: number;
  last_activity_at: string | null;
}

export interface HistoryFloor {
  id: string;
  floor_code: string;
  floor_number: number;
  name: string;
  function_name: string;
  rooms: HistoryRoom[];
}

export type HistoryEventCategory = "RECEPTION" | "EXAMINATION" | "PROCEDURE" | "DISPENSE" | "EMERGENCY" | "SURGERY" | "MONITORING" | "NURSING" | "PAYMENT";
export type HistoryEventStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "CANCELLED" | "INFO";

export interface RoomHistoryEvent {
  id: string;
  category: HistoryEventCategory;
  occurred_at: string;
  title: string;
  detail: string | null;
  status: HistoryEventStatus;
  patient: { name: string; code: string | null };
  ref: { type: "visit" | "emergency" | "invoice"; id: string; code: string } | null;
}

export interface RoomHistory {
  room: { room_code: string; name: string; function_name: string; floor_name: string };
  from: string;
  to: string;
  truncated: boolean;
  events: RoomHistoryEvent[];
}

export const roomService = {
  /** Tầng → phòng kèm số liệu lịch sử (mục "Lịch sử" của khu vực làm việc). */
  async getRoomsWithHistory(): Promise<HistoryFloor[]> {
    const response = await apiClient.get<{ floors: HistoryFloor[] }>("/rooms");
    return response.data.floors;
  },

  /** Lịch sử thực hiện của một phòng trong khoảng ngày [from, to] (tối đa 500 sự kiện, mới nhất trước). */
  async getRoomHistory(roomCode: string, from: string, to: string): Promise<RoomHistory> {
    const response = await apiClient.get<RoomHistory>(`/rooms/${encodeURIComponent(roomCode)}/history`, { params: { from, to } });
    return response.data;
  },
};
