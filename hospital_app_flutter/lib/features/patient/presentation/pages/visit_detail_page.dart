import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/utils/formatters.dart';
import '../../application/patient_providers.dart';
import '../../data/visit_models.dart';
import '../widgets/clinical_result_sheet.dart';
import 'visits_page.dart';

/// Chi tiết một lượt khám: kết luận, lời dặn, đơn thuốc, viện phí, kết quả phòng chức năng.
class VisitDetailPage extends ConsumerWidget {
  const VisitDetailPage({super.key, required this.visitId});
  final String visitId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visit = ref.watch(visitDetailProvider(visitId));
    return Scaffold(
      appBar: AppBar(
        title: Text(visit.valueOrNull?.visitCode ?? 'Hồ sơ lượt khám'),
        titleTextStyle: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
      ),
      body: visit.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Không thể tải lượt khám này.'),
            const SizedBox(height: 10),
            OutlinedButton(onPressed: () => ref.invalidate(visitDetailProvider(visitId)), child: const Text('Thử lại')),
          ]),
        ),
        data: (v) => RefreshIndicator(
          onRefresh: () async => ref.refresh(visitDetailProvider(visitId).future),
          child: _Body(visit: v),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.visit});
  final PatientVisit visit;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final functionSteps = visit.functionSteps;
    final results = functionSteps.where((s) => s.result != null).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
      children: [
        Row(children: [
          StatusPill(label: visit.isCompleted ? 'Đã hoàn thành' : 'Đang khám', positive: visit.isCompleted),
          const SizedBox(width: 10),
          Expanded(child: Text('${Formatters.longDay(visit.createdAt)} · ${visit.receivingRoom.name}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground))),
        ]),
        const SizedBox(height: 16),

        _Section(
          icon: Icons.medical_services_outlined,
          title: 'Kết luận bác sĩ',
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _Field(label: 'Chẩn đoán', value: visit.finalDiagnosis),
            _Field(label: 'Hướng điều trị', value: visit.treatmentDirection),
            _Field(label: 'Kết luận', value: visit.conclusion, last: true),
          ]),
        ),
        _Section(
          icon: Icons.favorite_border_rounded,
          title: 'Lời dặn bác sĩ',
          child: Text(visit.doctorAdvice ?? 'Chưa có lời dặn.', style: text.bodyMedium?.copyWith(height: 1.6, color: visit.doctorAdvice == null ? AppColors.mutedForeground : null)),
        ),
        _Section(
          icon: Icons.medication_outlined,
          title: 'Đơn thuốc',
          child: visit.prescription.isEmpty
              ? Text('Chưa có đơn thuốc.', style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground))
              : Column(children: [
                  for (final line in visit.prescription)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(14)),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(line.name, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 2),
                            Text('${line.dosage ?? 'Chưa ghi liều'} · ${line.usage ?? 'Chưa ghi cách dùng'}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                          ]),
                        ),
                        Text('${line.quantity} ${line.unit}', style: text.labelLarge?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  if (visit.prescriptionNote != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(14)),
                      child: Text(visit.prescriptionNote!, style: text.bodySmall?.copyWith(height: 1.55)),
                    ),
                ]),
        ),

        // Viện phí: thanh gọn, bấm để xem chi tiết hóa đơn.
        _InvoiceBar(visit: visit),
        const SizedBox(height: 18),

        Row(children: [
          Text('Kết quả phòng chức năng', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(width: 8),
          Text('${results.length}/${functionSteps.length}', style: text.labelMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 8),
        if (results.isEmpty)
          Text('Chưa có kết quả phòng chức năng.', style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground))
        else
          for (final step in results)
            Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => showClinicalResultSheet(context, visitId: visit.id, stepId: step.id, roomName: step.room.name),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text('${step.room.name} (${step.room.roomCode})', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600))),
                      Text('Chi tiết', style: text.labelMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
                      const Icon(Icons.chevron_right, size: 18, color: AppColors.primary),
                    ]),
                    const SizedBox(height: 6),
                    Text(step.result!, maxLines: 3, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground, height: 1.5)),
                  ]),
                ),
              ),
            ),
      ],
    );
  }
}

class _InvoiceBar extends StatelessWidget {
  const _InvoiceBar({required this.visit});
  final PatientVisit visit;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final invoice = visit.invoice;
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: invoice == null ? null : () => context.push('/visits/${visit.id}/invoice'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(11)),
                child: const Icon(Icons.receipt_long_outlined, size: 18, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: invoice == null
                    ? Text('Viện phí · chưa có hóa đơn', style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground))
                    : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Text('Viện phí', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                          const SizedBox(width: 8),
                          StatusPill(label: invoice.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán', positive: invoice.isPaid, warn: !invoice.isPaid),
                        ]),
                        const SizedBox(height: 3),
                        Text(
                          [
                            '${invoice.isPaid ? 'Đã trả' : 'Cần trả'} ${Formatters.vnd(invoice.patientAmount)}',
                            if (invoice.insuranceApplied) 'BHYT −${Formatters.vnd(invoice.insuranceAmount)}',
                            if (invoice.isPaid && invoice.paidAt != null) DateFormat('HH:mm dd/MM').format(invoice.paidAt!),
                          ].join(' · '),
                          style: text.bodySmall?.copyWith(color: AppColors.mutedForeground),
                        ),
                      ]),
              ),
              if (invoice != null) const Icon(Icons.chevron_right, color: AppColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.icon, required this.title, required this.child});
  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 18, color: AppColors.primary),
            const SizedBox(width: 8),
            Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 10),
          child,
        ]),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.value, this.last = false});
  final String label;
  final String? value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
        const SizedBox(height: 2),
        Text(value ?? 'Chưa cập nhật', style: text.bodyMedium?.copyWith(height: 1.55, color: value == null ? AppColors.mutedForeground : null)),
      ]),
    );
  }
}
