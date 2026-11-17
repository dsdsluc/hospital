/**
 * Bệnh nhân vãng lai không có tài khoản (patients.user_id = null).
 * Giao diện bác sĩ luôn đọc `patient.user.phone_number / email`, nên trả về một `user` thay thế
 * lấy SĐT từ chính hồ sơ (patients.phone_number).
 */
export function withUserContact<T extends { user: { email: string | null; phone_number: string | null } | null; phone_number: string | null }>(patient: T) {
  return { ...patient, has_account: patient.user !== null, user: patient.user ?? { email: null, phone_number: patient.phone_number } };
}
