import { apiClient } from "@/lib/api-client";

export type InvoiceItemGroup = "EXAMINATION" | "PARACLINICAL" | "EMERGENCY" | "SURGERY" | "BED_DAY" | "MEDICINE";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export interface InvoiceItem {
  id: string;
  group: InvoiceItemGroup;
  item_code: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  /** Phần của đợt điều trị, ví dụ "Lượt khám VIS-123 · GEN-201" / "Cấp cứu ER-…". */
  origin: string | null;
  source_room: string | null;
  performed_at: string | null;
  detail: string | null;
}

export interface Invoice {
  id: string;
  invoice_code: string;
  type: "VISIT" | "EMERGENCY";
  medical_visit_id: string | null;
  emergency_case_id: string | null;
  patient_name: string;
  patient_code: string | null;
  record_code: string;
  source_room: string | null;
  /** PHM-105 nếu còn nhận thuốc, null = ra về. */
  next_destination: string | null;
  status: "UNPAID" | "PAID";
  total_amount: number;
  payment_method: PaymentMethod | null;
  amount_received: number | null;
  receipt_no: string | null;
  cashier_note: string | null;
  /** BHYT đã dùng cho hóa đơn này (lịch sử sử dụng BHYT). */
  insurance_applied: boolean;
  insurance_number: string | null;
  insurance_holder_name: string | null;
  insurance_amount: number;
  /** Số tiền bệnh nhân thực trả, có sau khi thu. */
  patient_amount: number | null;
  paid_at: string | null;
  created_at: string;
  started_at: string;
  date_of_birth: string | null;
  age: number | null;
  items: InvoiceItem[];
}

/** Có BHYT: bệnh nhân trả đúng 20% (tới đồng), BHYT trả 80% còn lại (giống backend). */
export function insuranceSplit(total: number, applied: boolean) {
  const patient = applied ? Math.round(total * 0.2) : total;
  return { patient_amount: patient, insurance_amount: total - patient };
}

export const invoiceService = {
  /** Chi tiết một hóa đơn. */
  async get(id: string): Promise<Invoice> {
    const response = await apiClient.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return response.data.invoice;
  },
  /** Hóa đơn chờ thu + đã thu trong ngày `date` (YYYY-MM-DD, mặc định hôm nay). */
  async list(date?: string): Promise<Invoice[]> {
    const response = await apiClient.get<{ invoices: Invoice[] }>("/invoices", { params: date ? { date } : undefined });
    return response.data.invoices;
  },
  async pay(id: string, payload: { payment_method: PaymentMethod; cashier_note?: string | null; insurance_applied?: boolean; insurance_number?: string | null; insurance_holder_name?: string | null }) {
    const response = await apiClient.put<{ message: string; invoice: Invoice }>(`/invoices/${id}/pay`, payload);
    return response.data;
  },
};
