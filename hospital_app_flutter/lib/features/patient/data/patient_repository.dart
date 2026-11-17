import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'patient_models.dart';
import 'visit_models.dart';

final patientRepositoryProvider = Provider<PatientRepository>((ref) => PatientRepository(ref.watch(dioProvider)));

/// Các API phía bệnh nhân (dùng chung với web /patient).
class PatientRepository {
  PatientRepository(this._dio);
  final Dio _dio;

  Future<PatientProfile> getProfile() async {
    final response = await _dio.get<Map<String, dynamic>>('/patients/me');
    return PatientProfile.fromJson(response.data!['patient'] as Map<String, dynamic>);
  }

  Future<CurrentVisit?> getCurrentVisit() async {
    final response = await _dio.get<Map<String, dynamic>>('/medical-visits/me/current');
    final visit = response.data!['medical_visit'];
    return visit == null ? null : CurrentVisit.fromJson(visit as Map<String, dynamic>);
  }

  Future<VisitNavigation?> getNavigation() async {
    final response = await _dio.get<Map<String, dynamic>>('/medical-visits/me/current/navigation');
    final navigation = response.data!['navigation'];
    return navigation == null ? null : VisitNavigation.fromJson(navigation as Map<String, dynamic>);
  }

  /// Đặt lịch: [date] "yyyy-MM-dd", [time] "HH:mm" (07:00–20:00, cách 30 phút). Trả về câu thông báo + mã lịch.
  Future<({String message, String code})> createAppointment({required String date, required String time, String? note}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/appointments', data: {
        'appointment_date': date,
        'appointment_time': time,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      });
      final data = response.data!;
      final appointment = data['appointment'] as Map<String, dynamic>?;
      return (message: data['message'] as String? ?? 'Đặt lịch thành công.', code: appointment?['appointment_code'] as String? ?? '');
    } on DioException catch (error) {
      throw ApiMessageException.from(error, 'Không thể đặt lịch. Vui lòng thử lại.');
    }
  }

  Future<String> cancelAppointment(String id) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>('/appointments/$id/cancel');
      return response.data?['message'] as String? ?? 'Đã hủy lịch hẹn.';
    } on DioException catch (error) {
      throw ApiMessageException.from(error, 'Không thể hủy lịch hẹn.');
    }
  }

  Future<List<PatientVisit>> getVisits() async {
    final response = await _dio.get<Map<String, dynamic>>('/medical-visits/me/visits');
    return (response.data!['medical_visits'] as List<dynamic>).map((e) => PatientVisit.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<PatientVisit> getVisit(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/medical-visits/me/visits/$id');
    return PatientVisit.fromJson(response.data!['medical_visit'] as Map<String, dynamic>);
  }

  Future<ClinicalResult> getClinicalResult(String visitId, String stepId) async {
    final response = await _dio.get<Map<String, dynamic>>('/medical-visits/me/visits/$visitId/results/$stepId');
    return ClinicalResult.fromJson(response.data!['clinical_result'] as Map<String, dynamic>);
  }

  Future<List<PatientAppointment>> getAppointments() async {
    final response = await _dio.get<Map<String, dynamic>>('/appointments/me');
    return (response.data!['appointments'] as List<dynamic>).map((e) => PatientAppointment.fromJson(e as Map<String, dynamic>)).toList();
  }
}

/// Lỗi có câu thông báo hiển thị được (lấy từ `message` của backend).
class ApiMessageException implements Exception {
  const ApiMessageException(this.message);
  final String message;

  factory ApiMessageException.from(DioException error, String fallback) {
    final data = error.response?.data;
    if (data is Map && data['message'] is String) return ApiMessageException(data['message'] as String);
    if (error.type == DioExceptionType.connectionError) return const ApiMessageException('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
    return ApiMessageException(fallback);
  }

  @override
  String toString() => message;
}
