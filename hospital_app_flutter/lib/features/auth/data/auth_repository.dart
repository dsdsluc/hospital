import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Người dùng trả về từ POST /auth/login.
class AuthUser {
  const AuthUser({required this.id, required this.email, required this.role, this.fullName, this.patientCode});

  final String id;
  final String? email;
  final String role;
  final String? fullName;
  final String? patientCode;

  bool get isPatient => role == 'PATIENT';

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final patient = json['patient'] as Map<String, dynamic>?;
    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String?,
      role: json['role'] as String,
      fullName: patient?['full_name'] as String?,
      patientCode: patient?['patient_code'] as String?,
    );
  }
}

class LoginResult {
  const LoginResult({required this.accessToken, required this.user, required this.message});

  final String accessToken;
  final AuthUser user;
  final String message;
}

/// Lỗi có câu thông báo hiển thị được cho người dùng.
class AuthException implements Exception {
  const AuthException(this.message);
  final String message;

  @override
  String toString() => message;
}

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository(ref.watch(dioProvider)));

class AuthRepository {
  AuthRepository(this._dio);
  final Dio _dio;

  Future<LoginResult> login({required String email, required String password}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/auth/login', data: {'email': email, 'password': password});
      final data = response.data!;
      return LoginResult(
        accessToken: data['access_token'] as String,
        user: AuthUser.fromJson(data['user'] as Map<String, dynamic>),
        message: data['message'] as String? ?? 'Đăng nhập thành công.',
      );
    } on DioException catch (error) {
      throw AuthException(_messageOf(error));
    }
  }

  /// Lấy câu lỗi từ backend ({ message }); lỗi mạng thì báo không kết nối được.
  static String _messageOf(DioException error) {
    final data = error.response?.data;
    if (data is Map && data['message'] is String) return data['message'] as String;
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';
      case DioExceptionType.connectionError:
        return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
      default:
        return 'Không thể đăng nhập. Vui lòng thử lại.';
    }
  }
}
