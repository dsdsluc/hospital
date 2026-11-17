import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/patient_models.dart';
import '../data/patient_repository.dart';
import '../data/visit_models.dart';

final patientProfileProvider = FutureProvider.autoDispose<PatientProfile>((ref) => ref.watch(patientRepositoryProvider).getProfile());

/// Lượt khám hiện tại — màn hình Tổng quan tự làm mới mỗi 5 giây khi đang mở.
final currentVisitProvider = FutureProvider.autoDispose<CurrentVisit?>((ref) => ref.watch(patientRepositoryProvider).getCurrentVisit());

final visitNavigationProvider = FutureProvider.autoDispose<VisitNavigation?>((ref) => ref.watch(patientRepositoryProvider).getNavigation());

/// Toàn bộ lịch hẹn của bệnh nhân, mới đặt trước.
final allAppointmentsProvider = FutureProvider.autoDispose<List<PatientAppointment>>((ref) => ref.watch(patientRepositoryProvider).getAppointments());

/// Lịch hẹn sắp tới: còn hiệu lực, chưa bắt đầu khám, từ hôm nay trở đi — sắp theo ngày giờ (giống web).
final upcomingAppointmentsProvider = FutureProvider.autoDispose<List<PatientAppointment>>((ref) async {
  final all = await ref.watch(allAppointmentsProvider.future);
  return all.where((a) => a.historyStatus == AppointmentHistoryStatus.upcoming).toList()
    ..sort((a, b) => '${a.date.toIso8601String()}${a.time}'.compareTo('${b.date.toIso8601String()}${b.time}'));
});

/// Hồ sơ khám: danh sách lượt khám (20 lượt gần nhất), chi tiết một lượt, kết quả một phòng chức năng.
final myVisitsProvider = FutureProvider.autoDispose<List<PatientVisit>>((ref) => ref.watch(patientRepositoryProvider).getVisits());

final visitDetailProvider = FutureProvider.autoDispose.family<PatientVisit, String>((ref, id) => ref.watch(patientRepositoryProvider).getVisit(id));

final clinicalResultProvider = FutureProvider.autoDispose.family<ClinicalResult, (String, String)>((ref, ids) => ref.watch(patientRepositoryProvider).getClinicalResult(ids.$1, ids.$2));
