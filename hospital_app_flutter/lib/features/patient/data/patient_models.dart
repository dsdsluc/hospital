// Model cho các màn hình bệnh nhân. Đọc JSON thủ công (ít trường, không cần codegen).

class PatientProfile {
  const PatientProfile({required this.id, required this.fullName, this.patientCode});

  final String id;
  final String fullName;
  final String? patientCode;

  factory PatientProfile.fromJson(Map<String, dynamic> json) => PatientProfile(
        id: json['id'] as String,
        fullName: (json['full_name'] as String? ?? '').trim().replaceAll(RegExp(r'\s+'), ' '),
        patientCode: json['patient_code'] as String?,
      );
}

class VisitRoom {
  const VisitRoom({required this.id, required this.roomCode, required this.name, required this.floorName, required this.floorNumber, required this.functionName});

  final String id;
  final String roomCode;
  final String name;
  final String floorName;
  final int floorNumber;
  final String functionName;

  /// "Tầng 1 - Tiếp nhận và cấp cứu" → "Tầng 1".
  String get floorShort => floorName.split(' - ').first;

  factory VisitRoom.fromJson(Map<String, dynamic> json) {
    final floor = json['floor'] as Map<String, dynamic>? ?? const {};
    final function = json['function'] as Map<String, dynamic>? ?? const {};
    return VisitRoom(
      id: json['id'] as String,
      roomCode: json['room_code'] as String,
      name: json['name'] as String,
      floorName: floor['name'] as String? ?? '',
      floorNumber: (floor['floor_number'] as num?)?.toInt() ?? 0,
      functionName: function['name'] as String? ?? '',
    );
  }
}

enum StepStatus { pending, inProgress, completed, cancelled }

StepStatus _stepStatus(String value) => switch (value) {
      'IN_PROGRESS' => StepStatus.inProgress,
      'COMPLETED' => StepStatus.completed,
      'CANCELLED' => StepStatus.cancelled,
      _ => StepStatus.pending,
    };

class VisitStep {
  const VisitStep({required this.id, required this.status, required this.room});

  final String id;
  final StepStatus status;
  final VisitRoom room;

  bool get isActive => status == StepStatus.pending || status == StepStatus.inProgress;

  factory VisitStep.fromJson(Map<String, dynamic> json) => VisitStep(
        id: json['id'] as String,
        status: _stepStatus(json['status'] as String),
        room: VisitRoom.fromJson(json['room'] as Map<String, dynamic>),
      );
}

class VisitInvoiceSummary {
  const VisitInvoiceSummary({required this.code, required this.isPaid, required this.totalAmount, this.nextDestination});

  final String code;
  final bool isPaid;
  final int totalAmount;
  final String? nextDestination;

  factory VisitInvoiceSummary.fromJson(Map<String, dynamic> json) => VisitInvoiceSummary(
        code: json['invoice_code'] as String,
        isPaid: json['status'] == 'PAID',
        totalAmount: (json['total_amount'] as num).toInt(),
        nextDestination: json['next_destination'] as String?,
      );
}

/// Lượt khám hiện tại (GET /medical-visits/me/current).
class CurrentVisit {
  const CurrentVisit({required this.id, required this.visitCode, required this.isCompleted, required this.receivingRoom, required this.steps, this.invoice, this.cashierRoom});

  final String id;
  final String visitCode;
  final bool isCompleted;
  final VisitRoom receivingRoom;
  final List<VisitStep> steps;
  final VisitInvoiceSummary? invoice;

  /// Phòng CAS-103 khi còn hóa đơn chưa thanh toán.
  final VisitRoom? cashierRoom;

  factory CurrentVisit.fromJson(Map<String, dynamic> json) => CurrentVisit(
        id: json['id'] as String,
        visitCode: json['visit_code'] as String,
        isCompleted: json['status'] == 'COMPLETED',
        receivingRoom: VisitRoom.fromJson(json['receiving_room'] as Map<String, dynamic>),
        steps: (json['steps'] as List<dynamic>? ?? const []).map((e) => VisitStep.fromJson(e as Map<String, dynamic>)).toList(),
        invoice: json['invoice'] == null ? null : VisitInvoiceSummary.fromJson(json['invoice'] as Map<String, dynamic>),
        cashierRoom: json['cashier_room'] == null ? null : VisitRoom.fromJson(json['cashier_room'] as Map<String, dynamic>),
      );
}

/// Lộ trình chỉ đường (GET /medical-visits/me/current/navigation).
class VisitNavigation {
  const VisitNavigation({required this.origin, required this.destination, required this.estimatedMinutes, required this.instructions});

  final VisitRoom origin;
  final VisitRoom destination;
  final int estimatedMinutes;
  final List<String> instructions;

  factory VisitNavigation.fromJson(Map<String, dynamic> json) => VisitNavigation(
        origin: VisitRoom.fromJson(json['origin'] as Map<String, dynamic>),
        destination: VisitRoom.fromJson(json['destination'] as Map<String, dynamic>),
        estimatedMinutes: (json['estimated_minutes'] as num?)?.toInt() ?? 0,
        instructions: (json['instructions'] as List<dynamic>? ?? const []).cast<String>(),
      );
}

/// Trạng thái hiển thị của lịch hẹn (giống web `appointment-history`).
/// Lịch vẫn là BOOKED sau khi khám → dựa vào lượt khám gắn với lịch.
enum AppointmentHistoryStatus { upcoming, inVisit, awaitingMedicine, visited, past, cancelled }

/// Lịch hẹn của bệnh nhân (GET /appointments/me).
class PatientAppointment {
  const PatientAppointment({
    required this.id,
    required this.code,
    required this.date,
    required this.time,
    required this.isBooked,
    required this.hasVisit,
    this.visitCode,
    this.visitCompleted = false,
    this.visitHasPendingSteps = false,
    this.note,
    this.doctorName,
    this.doctorSpecialization,
    this.createdAt,
  });

  final String id;
  final String code;

  /// Ngày hẹn (chỉ phần ngày, theo lịch).
  final DateTime date;

  /// "HH:mm".
  final String time;
  final bool isBooked;
  final bool hasVisit;
  final String? visitCode;
  final bool visitCompleted;

  /// Lượt khám còn bước nhà thuốc chưa cấp.
  final bool visitHasPendingSteps;
  final String? note;
  final String? doctorName;
  final String? doctorSpecialization;
  final DateTime? createdAt;

  AppointmentHistoryStatus get historyStatus {
    if (!isBooked) return AppointmentHistoryStatus.cancelled;
    if (hasVisit) {
      if (visitCompleted) return AppointmentHistoryStatus.visited;
      return visitHasPendingSteps ? AppointmentHistoryStatus.awaitingMedicine : AppointmentHistoryStatus.inVisit;
    }
    final now = DateTime.now();
    return date.isBefore(DateTime(now.year, now.month, now.day)) ? AppointmentHistoryStatus.past : AppointmentHistoryStatus.upcoming;
  }

  factory PatientAppointment.fromJson(Map<String, dynamic> json) {
    final dateText = (json['appointment_date'] as String).substring(0, 10);
    final timeText = json['appointment_time'] as String;
    final doctor = json['doctor'] as Map<String, dynamic>?;
    final visits = json['medical_visits'] as List<dynamic>? ?? const [];
    final visit = visits.isEmpty ? null : visits.first as Map<String, dynamic>;
    return PatientAppointment(
      id: json['id'] as String,
      code: json['appointment_code'] as String,
      date: DateTime.parse(dateText),
      time: timeText.length >= 16 ? timeText.substring(11, 16) : timeText,
      isBooked: json['status'] == 'BOOKED',
      hasVisit: visit != null,
      visitCode: visit?['visit_code'] as String?,
      visitCompleted: visit?['status'] == 'COMPLETED',
      visitHasPendingSteps: (visit?['steps'] as List<dynamic>? ?? const []).isNotEmpty,
      note: json['note'] as String?,
      doctorName: doctor?['full_name'] as String?,
      doctorSpecialization: doctor?['specialization'] as String?,
      createdAt: json['created_at'] == null ? null : DateTime.parse(json['created_at'] as String).toLocal(),
    );
  }
}
