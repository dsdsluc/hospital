import type { Request, Response } from 'express';
import { findRoomHistory, findRoomsWithHistory } from '../service/room.service.js';

export async function getRooms(_req: Request, res: Response): Promise<void> {
  res.json({ floors: await findRoomsWithHistory() });
}

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

function vietnamDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

/** GET /rooms/:roomCode/history?from=YYYY-MM-DD&to=YYYY-MM-DD (mặc định 30 ngày gần nhất). */
export async function getRoomHistory(req: Request, res: Response): Promise<void> {
  const roomCode = String(req.params.roomCode).toUpperCase();
  const from = req.query.from ?? vietnamDate(-29);
  const to = req.query.to ?? vietnamDate();
  if (!isValidDate(from) || !isValidDate(to) || to < from) {
    res.status(400).json({ message: 'Khoảng ngày xem lịch sử không hợp lệ.' });
    return;
  }
  res.json(await findRoomHistory(roomCode, from, to));
}
