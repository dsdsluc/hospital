import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/utils/formatters.dart';
import '../../application/patient_providers.dart';
import '../../data/patient_models.dart';
import '../../data/visit_models.dart';

/// Tab "Hồ sơ khám": các lượt khám gần đây, mỗi lượt kèm tóm tắt viện phí.
class VisitsPage extends ConsumerWidget {
  const VisitsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final visits = ref.watch(myVisitsProvider);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(myVisitsProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              Text('Hồ sơ khám', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('Chọn một lượt khám để xem kết quả, đơn thuốc và hóa đơn.', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
              const SizedBox(height: 16),
              ...visits.when(
                loading: () => const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))],
                error: (_, _) => [const _Empty(icon: Icons.cloud_off_outlined, text: 'Không thể tải hồ sơ khám. Kéo xuống để thử lại.')],
                data: (list) => list.isEmpty
                    ? [const _Empty(icon: Icons.assignment_outlined, text: 'Bạn chưa có lượt khám nào.')]
                    : [for (final visit in list) Padding(padding: const EdgeInsets.only(bottom: 12), child: _VisitCard(visit: visit))],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VisitCard extends StatelessWidget {
  const _VisitCard({required this.visit});
  final PatientVisit visit;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final functionSteps = visit.functionSteps;
    final done = functionSteps.where((s) => s.status == StepStatus.completed).length;
    final invoice = visit.invoice;
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => context.push('/visits/${visit.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(visit.visitCode, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.4))),
                  StatusPill(label: visit.isCompleted ? 'Đã hoàn thành' : 'Đang khám', positive: visit.isCompleted),
                ],
              ),
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.schedule, size: 14, color: AppColors.mutedForeground),
                const SizedBox(width: 4),
                Text(Formatters.shortDate(visit.createdAt), style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                const SizedBox(width: 12),
                const Icon(Icons.place_outlined, size: 14, color: AppColors.primary),
                const SizedBox(width: 4),
                Expanded(child: Text(visit.receivingRoom.name, overflow: TextOverflow.ellipsis, style: text.bodySmall)),
              ]),
              if (visit.finalDiagnosis != null) ...[
                const SizedBox(height: 8),
                Text(visit.finalDiagnosis!, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.bodyMedium),
              ],
              const SizedBox(height: 10),
              // Tóm tắt viện phí.
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(12)),
                child: invoice == null
                    ? Text('Chưa có hóa đơn', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground))
                    : Row(
                        children: [
                          const Icon(Icons.receipt_long_outlined, size: 16, color: AppColors.primary),
                          const SizedBox(width: 6),
                          Text('Viện phí ', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                          Text(Formatters.vnd(invoice.patientAmount), style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                          if (invoice.insuranceApplied) ...[const SizedBox(width: 6), const _BhytTag()],
                          const Spacer(),
                          StatusPill(label: invoice.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán', positive: invoice.isPaid, warn: !invoice.isPaid),
                        ],
                      ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text('$done/${functionSteps.length} kết quả phòng chức năng', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                  const Spacer(),
                  Text('Xem hồ sơ', style: text.labelMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
                  const Icon(Icons.chevron_right, size: 18, color: AppColors.primary),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Nhãn trạng thái nhỏ dùng chung trong hồ sơ khám.
class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, required this.positive, this.warn = false});
  final String label;
  final bool positive;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = positive ? (const Color(0xFFD1FAE5), const Color(0xFF047857)) : warn ? (const Color(0xFFFFEDD5), const Color(0xFFC2410C)) : (const Color(0xFFFEF3C7), const Color(0xFFB45309));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w600, color: fg)),
    );
  }
}

class _BhytTag extends StatelessWidget {
  const _BhytTag();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.verified_user_outlined, size: 11, color: Color(0xFF047857)),
        const SizedBox(width: 3),
        Text('BHYT', style: Theme.of(context).textTheme.labelSmall?.copyWith(fontSize: 10, fontWeight: FontWeight.w700, color: const Color(0xFF047857))),
      ]),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: Column(children: [
        Icon(icon, color: AppColors.mutedForeground),
        const SizedBox(height: 8),
        Text(text, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground)),
      ]),
    );
  }
}
