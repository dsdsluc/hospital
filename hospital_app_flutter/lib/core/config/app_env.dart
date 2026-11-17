import 'package:flutter_dotenv/flutter_dotenv.dart';

abstract final class AppEnv {
  static String get apiBaseUrl =>
      dotenv.maybeGet('API_BASE_URL') ?? 'http://10.0.2.2:4000/api';
}
