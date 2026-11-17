import 'dart:math';

/// Lời chào trên trang Tổng quan — cùng bộ câu với web (`lib/greetings.ts`).
/// `before` và `after` là phần chữ đứng trước / sau họ tên.
class Greeting {
  const Greeting(this.before, this.after);
  final String before;
  final String after;
}

const patientGreetings = <Greeting>[
  Greeting('Chào, ', ', nay bạn khỏe chứ?'),
  Greeting('Xin chào ', ', chúc bạn một ngày an lành.'),
  Greeting('Chào ', ', hôm nay bạn thấy thế nào?'),
  Greeting('Rất vui được gặp lại ', '.'),
  Greeting('Chào mừng trở lại, ', '!'),
  Greeting('Chào ', ', nhớ uống đủ nước hôm nay nhé.'),
  Greeting('Chào ', ', chúc bạn luôn mạnh khỏe.'),
  Greeting('Hi ', ', mong bạn có một ngày nhẹ nhàng.'),
  Greeting('Chào ', ', đừng quên nghỉ ngơi đầy đủ nhé.'),
  Greeting('Chào ', ', sức khỏe của bạn là ưu tiên của chúng tôi.'),
];

Greeting pickRandomGreeting() => patientGreetings[Random().nextInt(patientGreetings.length)];
