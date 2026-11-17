import { apiClient } from "@/lib/api-client";

export type ServiceCategory = "EXAMINATION" | "IMAGING" | "LABORATORY" | "FUNCTIONAL_TEST" | "EMERGENCY" | "SURGERY" | "BED_DAY";

export interface ServicePriceItem {
  id: string;
  service_code: string;
  name: string;
  category: ServiceCategory;
  unit: string;
  /** Đơn giá VND. */
  unit_price: number;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
  room_function: { function_code: string; name: string; room_codes: string[] } | null;
}

export interface MedicinePriceItem {
  id: string;
  medicine_code: string;
  name: string;
  unit: string;
  stock_quantity: number;
  status: "AVAILABLE" | "UNAVAILABLE";
  categories: Array<{ category_code: string; name: string }>;
  /** Đơn giá VND cho 1 đơn vị tính; null nếu thuốc chưa có giá. */
  unit_price: number | null;
  effective_from: string | null;
  effective_to: string | null;
  note: string | null;
}

export const priceService = {
  /** Bảng giá dịch vụ đang áp dụng (GET /prices/services). */
  async getServicePrices(): Promise<ServicePriceItem[]> {
    const response = await apiClient.get<{ services: ServicePriceItem[] }>("/prices/services");
    return response.data.services;
  },

  /** Bảng giá thuốc đang áp dụng (GET /prices/medicines). */
  async getMedicinePrices(): Promise<MedicinePriceItem[]> {
    const response = await apiClient.get<{ medicines: MedicinePriceItem[] }>("/prices/medicines");
    return response.data.medicines;
  },
};

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

/** 150000 → "150.000 ₫". */
export function formatVnd(value: number) {
  return vndFormatter.format(value);
}
