import { z } from 'zod';
import { validateBody } from './validate.js';

/** Thanh toán: chỉ phương thức + BHYT (tiền thu / biên lai do hệ thống khác quản lý). */
export const payInvoiceSchema = z.object({
  payment_method: z.enum(['CASH', 'TRANSFER', 'CARD']),
  cashier_note: z.string().trim().max(2000).nullable().optional(),
  /** Có BHYT → giảm 80%. Không kiểm tra thẻ (bệnh viện có hệ thống kiểm tra riêng). */
  insurance_applied: z.boolean().optional(),
  insurance_number: z.string().trim().max(30).nullable().optional(),
  insurance_holder_name: z.string().trim().max(150).nullable().optional(),
});
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;
export const validatePayInvoice = validateBody(payInvoiceSchema);
