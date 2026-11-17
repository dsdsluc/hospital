import 'package:intl/intl.dart';

/// Định dạng dùng chung (tiếng Việt). Cần gọi `initializeDateFormatting('vi')` ở main.
abstract final class Formatters {
  static final _vnd = NumberFormat.decimalPattern('vi');

  /// 483500 → "483.500 ₫".
  static String vnd(num value) => '${_vnd.format(value)} ₫';

  /// "Thứ Bảy, 15 tháng 11".
  static String longDay(DateTime date) {
    final text = DateFormat('EEEE, d MMMM', 'vi').format(date);
    return text[0].toUpperCase() + text.substring(1);
  }

  /// "17/11/2026".
  static String shortDate(DateTime date) => DateFormat('dd/MM/yyyy', 'vi').format(date);

  /// "Thứ Hai".
  static String weekday(DateTime date) {
    final text = DateFormat('EEEE', 'vi').format(date);
    return text[0].toUpperCase() + text.substring(1);
  }
}
