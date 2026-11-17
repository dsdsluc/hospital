import type { Request, Response } from 'express';
import { findMyNotifications, markAllMyNotificationsRead, markMyNotificationRead } from '../service/notification.service.js';

/** GET /notifications/me — 50 thông báo mới nhất + số chưa đọc. */
export async function getMyNotifications(req: Request, res: Response): Promise<void> {
  res.json(await findMyNotifications(req.user!.id));
}

/** PATCH /notifications/:notificationId/read */
export async function readNotification(req: Request, res: Response): Promise<void> {
  await markMyNotificationRead(req.user!.id, String(req.params.notificationId));
  res.json({ message: 'Đã đánh dấu đã đọc.' });
}

/** PATCH /notifications/me/read-all */
export async function readAllNotifications(req: Request, res: Response): Promise<void> {
  const count = await markAllMyNotificationsRead(req.user!.id);
  res.json({ message: 'Đã đánh dấu tất cả đã đọc.', count });
}
