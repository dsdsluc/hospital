import type { Request, Response } from 'express';
import { findMedicalRecords } from '../service/record.service.js';

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

function vietnamDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

/**
 * GET /records?from=YYYY-MM-DD&to=YYYY-MM-DD&q=
 * Mặc định 30 ngày gần nhất. Có `q` thì tìm trên toàn bộ thời gian (tên, mã, CCCD, SĐT).
 */
export async function getMedicalRecords(req: Request, res: Response): Promise<void> {
  const from = req.query.from ?? vietnamDate(-29);
  const to = req.query.to ?? vietnamDate();
  if (!isValidDate(from) || !isValidDate(to) || to < from) {
    res.status(400).json({ message: 'Khoảng ngày tra cứu không hợp lệ.' });
    return;
  }
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined;
  res.json(await findMedicalRecords({ from, to, q }));
}
