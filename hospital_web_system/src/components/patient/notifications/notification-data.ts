"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarClock, CreditCard, DoorOpen, Pill, type LucideIcon } from "lucide-react";

import { notificationService, type PatientNotification, type PatientNotificationResponse, type PatientNotificationType } from "@/services/notification.service";

export type { PatientNotification } from "@/services/notification.service";

/**
 * Thông báo phía bệnh nhân — dữ liệu thật từ GET /notifications/me (bảng patient_notifications).
 * Trạng thái đã đọc lưu trên server (read_at).
 */

export type NotificationGroup = "VISIT" | "PAYMENT" | "MEDICINE" | "APPOINTMENT";

export const notificationTypeMeta: Record<PatientNotificationType, { group: NotificationGroup; icon: LucideIcon; tone: string }> = {
  NEXT_ROOM: { group: "VISIT", icon: DoorOpen, tone: "bg-sky-50 text-sky-700" },
  PAYMENT_DUE: { group: "PAYMENT", icon: CreditCard, tone: "bg-orange-50 text-orange-700" },
  MEDICINE_READY: { group: "MEDICINE", icon: Pill, tone: "bg-amber-50 text-amber-700" },
  APPOINTMENT_REMINDER: { group: "APPOINTMENT", icon: CalendarClock, tone: "bg-primary/10 text-primary" },
};

export const notificationGroupLabels: Record<NotificationGroup, string> = {
  VISIT: "Lượt khám",
  PAYMENT: "Thanh toán",
  MEDICINE: "Nhận thuốc",
  APPOINTMENT: "Lịch hẹn",
};

export const EmptyNotificationIcon = BellRing;

const QUERY_KEY = ["patient-notifications"] as const;
/** Thông báo cần đến đúng lúc (mời đến phòng, thanh toán) → tự kiểm tra lại mỗi 30 giây. */
const POLL_INTERVAL = 30_000;

/** Danh sách thông báo + số chưa đọc + thao tác đánh dấu đã đọc (cập nhật ngay trên giao diện). */
export function usePatientNotifications() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const data = await notificationService.getMine();
      setNow(Date.now());
      return data;
    },
    refetchInterval: POLL_INTERVAL,
    refetchOnWindowFocus: true,
  });

  // Cập nhật lạc quan: đổi read_at trong cache trước, lỗi thì tải lại từ server.
  function patchCache(update: (data: PatientNotificationResponse) => PatientNotificationResponse) {
    queryClient.setQueryData<PatientNotificationResponse>(QUERY_KEY, (data) => (data ? update(data) : data));
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onMutate: (id) => patchCache((data) => {
      const target = data.notifications.find((item) => item.id === id);
      if (!target || target.read_at) return data;
      const readAt = new Date().toISOString();
      return { unread_count: Math.max(0, data.unread_count - 1), notifications: data.notifications.map((item) => (item.id === id ? { ...item, read_at: readAt } : item)) };
    }),
    onError: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onMutate: () => patchCache((data) => {
      const readAt = new Date().toISOString();
      return { unread_count: 0, notifications: data.notifications.map((item) => (item.read_at ? item : { ...item, read_at: readAt })) };
    }),
    onError: refresh,
  });

  const items: PatientNotification[] = query.data?.notifications ?? [];
  return {
    items,
    now,
    unreadCount: query.data?.unread_count ?? 0,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    markRead: (id: string) => { if (items.some((item) => item.id === id && !item.read_at)) markRead.mutate(id); },
    markAllRead: () => markAllRead.mutate(),
  };
}

/** Thời gian tương đối: "Vừa xong", "5 phút trước", "2 giờ trước", "Hôm qua", "3 ngày trước". */
export function formatRelative(value: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Hôm qua" : `${days} ngày trước`;
}
