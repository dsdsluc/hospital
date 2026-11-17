// Model cho tab "Hồ sơ khám": lượt khám, kết quả phòng chức năng, hóa đơn.
import 'patient_models.dart';

DateTime? _date(Object? value) => value == null ? null : DateTime.parse(value as String).toLocal();
String? _text(Object? value) {
  final text = (value as String?)?.trim();
  return text == null || text.isEmpty ? null : text;
}

class VisitResultStep {
  const VisitResultStep({required this.id, required this.status, required this.room, this.result});
  final String id;
  final StepStatus status;
  final VisitRoom room;

  /// Văn bản kết quả (null nếu phòng chưa trả kết quả).
  final String? result;

  factory VisitResultStep.fromJson(Map<String, dynamic> json) {
    final step = VisitStep.fromJson(json);
    final clinical = json['clinical_result'] as Map<String, dynamic>?;
    return VisitResultStep(id: step.id, status: step.status, room: step.room, result: clinical?['result'] as String?);
  }
}

class PrescriptionLine {
  const PrescriptionLine({required this.name, required this.unit, required this.quantity, this.dosage, this.usage});
  final String name;
  final String unit;
  final int quantity;
  final String? dosage;
  final String? usage;

  factory PrescriptionLine.fromJson(Map<String, dynamic> json) {
    final medicine = json['medicine'] as Map<String, dynamic>? ?? const {};
    return PrescriptionLine(
      name: medicine['name'] as String? ?? '',
      unit: medicine['unit'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      dosage: _text(json['dosage']),
      usage: _text(json['usage']),
    );
  }
}

enum InvoiceGroup { examination, emergency, paraclinical, surgery, bedDay, medicine }

const invoiceGroupLabels = {
  InvoiceGroup.examination: 'Khám bệnh',
  InvoiceGroup.emergency: 'Cấp cứu & thủ thuật',
  InvoiceGroup.paraclinical: 'Cận lâm sàng',
  InvoiceGroup.surgery: 'Phẫu thuật',
  InvoiceGroup.bedDay: 'Ngày giường',
  InvoiceGroup.medicine: 'Thuốc',
};

InvoiceGroup _group(String value) => switch (value) {
      'EMERGENCY' => InvoiceGroup.emergency,
      'PARACLINICAL' => InvoiceGroup.paraclinical,
      'SURGERY' => InvoiceGroup.surgery,
      'BED_DAY' => InvoiceGroup.bedDay,
      'MEDICINE' => InvoiceGroup.medicine,
      _ => InvoiceGroup.examination,
    };

class InvoiceLine {
  const InvoiceLine({required this.group, required this.name, required this.unit, required this.quantity, required this.unitPrice, required this.amount, this.detail, this.origin});
  final InvoiceGroup group;
  final String name;
  final String unit;
  final int quantity;
  final int unitPrice;
  final int amount;
  final String? detail;
  final String? origin;

  factory InvoiceLine.fromJson(Map<String, dynamic> json) => InvoiceLine(
        group: _group(json['group'] as String),
        name: json['name'] as String,
        unit: json['unit'] as String? ?? '',
        quantity: (json['quantity'] as num).toInt(),
        unitPrice: (json['unit_price'] as num).toInt(),
        amount: (json['amount'] as num).toInt(),
        detail: _text(json['detail']),
        origin: _text(json['origin']),
      );
}

const paymentMethodLabels = {'CASH': 'Tiền mặt', 'TRANSFER': 'Chuyển khoản', 'CARD': 'Thẻ'};

class VisitInvoice {
  const VisitInvoice({
    required this.code,
    required this.isPaid,
    required this.totalAmount,
    required this.insuranceApplied,
    required this.insuranceAmount,
    required this.createdAt,
    required this.lines,
    this.patientAmountPaid,
    this.insuranceNumber,
    this.insuranceHolder,
    this.paymentMethod,
    this.paidAt,
  });

  final String code;
  final bool isPaid;
  final int totalAmount;
  final bool insuranceApplied;
  final int insuranceAmount;
  final int? patientAmountPaid;
  final String? insuranceNumber;
  final String? insuranceHolder;
  final String? paymentMethod;
  final DateTime createdAt;
  final DateTime? paidAt;
  final List<InvoiceLine> lines;

  /// Đã thu: số bệnh nhân thực trả; chưa thu: tổng chi phí (BHYT áp dụng lúc thanh toán).
  int get patientAmount => isPaid ? (patientAmountPaid ?? totalAmount - insuranceAmount) : totalAmount;
  String? get paymentLabel => paymentMethod == null ? null : paymentMethodLabels[paymentMethod];

  factory VisitInvoice.fromJson(Map<String, dynamic> json) => VisitInvoice(
        code: json['invoice_code'] as String,
        isPaid: json['status'] == 'PAID',
        totalAmount: (json['total_amount'] as num).toInt(),
        insuranceApplied: json['insurance_applied'] as bool? ?? false,
        insuranceAmount: (json['insurance_amount'] as num?)?.toInt() ?? 0,
        patientAmountPaid: (json['patient_amount'] as num?)?.toInt(),
        insuranceNumber: _text(json['insurance_number']),
        insuranceHolder: _text(json['insurance_holder_name']),
        paymentMethod: json['payment_method'] as String?,
        createdAt: _date(json['created_at']) ?? DateTime.now(),
        paidAt: _date(json['paid_at']),
        lines: (json['items'] as List<dynamic>? ?? const []).map((e) => InvoiceLine.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

/// Một lượt khám trong hồ sơ (GET /medical-visits/me/visits và /:id).
class PatientVisit {
  const PatientVisit({
    required this.id,
    required this.visitCode,
    required this.isCompleted,
    required this.createdAt,
    required this.receivingRoom,
    required this.steps,
    required this.prescription,
    this.finalDiagnosis,
    this.treatmentDirection,
    this.conclusion,
    this.doctorAdvice,
    this.prescriptionNote,
    this.invoice,
    this.mergedInto,
  });

  final String id;
  final String visitCode;
  final bool isCompleted;
  final DateTime createdAt;
  final VisitRoom receivingRoom;
  final List<VisitResultStep> steps;
  final List<PrescriptionLine> prescription;
  final String? finalDiagnosis;
  final String? treatmentDirection;
  final String? conclusion;
  final String? doctorAdvice;
  final String? prescriptionNote;

  /// Hóa đơn của lượt khám; nếu lượt khám đã chuyển lên tầng 4 thì là hóa đơn ra viện của ca điều trị.
  final VisitInvoice? invoice;

  /// Mã ca điều trị đã gộp phí lượt khám này (nếu có).
  final String? mergedInto;

  /// Các phòng chức năng (bỏ tiếp nhận, phòng khám chính, nhà thuốc).
  List<VisitResultStep> get functionSteps => steps.where((s) => s.room.roomCode != 'REC-101' && s.room.id != receivingRoom.id && s.room.roomCode != 'PHM-105').toList();

  factory PatientVisit.fromJson(Map<String, dynamic> json) {
    final exam = json['examination_record'] as Map<String, dynamic>?;
    final prescription = json['prescription'] as Map<String, dynamic>?;
    final escalated = (json['escalated_emergency_cases'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>().where((c) => c['invoice'] != null).firstOrNull;
    final ownInvoice = json['invoice'] as Map<String, dynamic>?;
    final escalatedInvoice = escalated == null ? null : escalated['invoice'] as Map<String, dynamic>?;
    final invoiceJson = ownInvoice ?? escalatedInvoice;
    return PatientVisit(
      id: json['id'] as String,
      visitCode: json['visit_code'] as String,
      isCompleted: json['status'] == 'COMPLETED',
      createdAt: _date(json['created_at']) ?? DateTime.now(),
      receivingRoom: VisitRoom.fromJson(json['receiving_room'] as Map<String, dynamic>),
      steps: (json['steps'] as List<dynamic>? ?? const []).map((e) => VisitResultStep.fromJson(e as Map<String, dynamic>)).toList(),
      prescription: (prescription?['items'] as List<dynamic>? ?? const []).map((e) => PrescriptionLine.fromJson(e as Map<String, dynamic>)).toList(),
      prescriptionNote: _text(prescription?['note']),
      finalDiagnosis: _text(exam?['final_diagnosis']),
      treatmentDirection: _text(exam?['treatment_direction']),
      conclusion: _text(exam?['conclusion']),
      doctorAdvice: _text(exam?['doctor_advice']),
      invoice: invoiceJson == null ? null : VisitInvoice.fromJson(invoiceJson),
      mergedInto: ownInvoice == null && escalated != null ? (escalated['emergency_code'] as String?) : null,
    );
  }
}

enum MeasurementFlag { low, normal, high }

class ClinicalMeasurement {
  const ClinicalMeasurement({required this.label, required this.description, required this.value, this.unit, this.reference, this.flag});
  final String label;
  final String description;
  final String value;
  final String? unit;
  final String? reference;
  final MeasurementFlag? flag;

  factory ClinicalMeasurement.fromJson(Map<String, dynamic> json) => ClinicalMeasurement(
        label: json['label'] as String,
        description: json['description'] as String? ?? '',
        value: json['value'] as String,
        unit: _text(json['unit']),
        reference: _text(json['reference']),
        flag: switch (json['flag']) { 'LOW' => MeasurementFlag.low, 'HIGH' => MeasurementFlag.high, 'NORMAL' => MeasurementFlag.normal, _ => null },
      );
}

/// Kết quả chi tiết một phòng chức năng (GET /medical-visits/me/visits/:id/results/:stepId).
class ClinicalResult {
  const ClinicalResult({required this.roomName, required this.roomCode, required this.floorName, required this.measurements, required this.details, required this.rawResult, this.completedAt, this.findings, this.conclusion});
  final String roomName;
  final String roomCode;
  final String floorName;
  final DateTime? completedAt;
  final List<ClinicalMeasurement> measurements;
  final List<(String, String)> details;
  final String? findings;
  final String? conclusion;
  final String rawResult;

  factory ClinicalResult.fromJson(Map<String, dynamic> json) {
    final room = json['room'] as Map<String, dynamic>;
    return ClinicalResult(
      roomName: room['name'] as String,
      roomCode: room['room_code'] as String,
      floorName: (room['floor_name'] as String? ?? '').split(' - ').first,
      completedAt: _date(json['completed_at'] ?? json['recorded_at']),
      measurements: (json['measurements'] as List<dynamic>? ?? const []).map((e) => ClinicalMeasurement.fromJson(e as Map<String, dynamic>)).toList(),
      details: (json['details'] as List<dynamic>? ?? const []).map((e) => ((e as Map<String, dynamic>)['label'] as String, e['value'] as String)).toList(),
      findings: _text(json['findings']),
      conclusion: _text(json['conclusion']),
      rawResult: json['raw_result'] as String? ?? '',
    );
  }
}
