import type { Request, Response } from 'express';
import { findInvoice, findInvoices, payInvoice } from '../service/invoice.service.js';
import type { PayInvoiceInput } from '../validation/invoice.validation.js';

const isValidDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** GET /invoices?date=YYYY-MM-DD — hóa đơn chờ thu + đã thu trong ngày (mặc định hôm nay). */
export async function getInvoices(req: Request, res: Response): Promise<void> {
  const date = req.query.date ?? vietnamToday();
  if (!isValidDate(date)) { res.status(400).json({ message: 'Ngày không hợp lệ.' }); return; }
  res.json({ date, invoices: await findInvoices(date) });
}

/** GET /invoices/:invoiceId — chi tiết hóa đơn. */
export async function getInvoice(req: Request, res: Response): Promise<void> {
  res.json({ invoice: await findInvoice(String(req.params.invoiceId)) });
}

/** PUT /invoices/:invoiceId/pay — xác nhận đã thu. */
export async function putPayInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await payInvoice(String(req.params.invoiceId), req.body as PayInvoiceInput);
  res.json({ message: `Đã xác nhận thanh toán hóa đơn ${invoice.invoice_code}.`, invoice });
}
