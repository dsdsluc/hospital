import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  // Định dạng ngày / số tiếng Việt (Thứ Bảy, 15 tháng 11 · 483.500 ₫).
  await initializeDateFormatting('vi');
  runApp(const ProviderScope(child: HospitalApp()));
}
