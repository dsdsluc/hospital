/**
 * Danh sách lời chào hiển thị trên trang tổng quan bệnh nhân.
 * `before` và `after` là phần chữ đứng trước / sau họ tên.
 */
export interface Greeting {
  before: string;
  after: string;
}

export const patientGreetings: Greeting[] = [
  { before: "Chào, ", after: ", nay bạn khỏe chứ?" },
  { before: "Xin chào ", after: ", chúc bạn một ngày an lành." },
  { before: "Chào ", after: ", hôm nay bạn thấy thế nào?" },
  { before: "Rất vui được gặp lại ", after: "." },
  { before: "Chào mừng trở lại, ", after: "!" },
  { before: "Chào ", after: ", nhớ uống đủ nước hôm nay nhé." },
  { before: "Chào ", after: ", chúc bạn luôn mạnh khỏe." },
  { before: "Hi ", after: ", mong bạn có một ngày nhẹ nhàng." },
  { before: "Chào ", after: ", đừng quên nghỉ ngơi đầy đủ nhé." },
  { before: "Chào ", after: ", sức khỏe của bạn là ưu tiên của chúng tôi." },
];

export function pickRandomGreeting(): Greeting {
  return patientGreetings[Math.floor(Math.random() * patientGreetings.length)];
}
