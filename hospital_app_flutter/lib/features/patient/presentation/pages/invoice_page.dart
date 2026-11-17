import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/utils/formatters.dart';
import '../../application/patient_providers.dart';
import '../../data/visit_models.dart';
import 'visits_page.dart';

/// Chi tiết hóa đơn của một lượt khám (giống /patient/visits/[id]/invoice trên web).
class InvoicePage extends ConsumerWidget {
  const InvoicePage({super.key, required this.visitId});
  final String visitId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visit = ref.watch(visitDetailProvider(visitId));
    final invoice = visit.valueOrNull?.invoice;
    return Scaffold(
      appBar: AppBar(
        title: Text(invoice == null ? 'Hóa đơn' : 'Hóa đơn ${invoice.code}'),
        titleTextStyle: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
      ),
      body: visit.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Center(child: OutlinedButton(onPressed: () => ref.invalidate(visitDetailProvider(visitId)), child: const Text('Thử lại'))),
        data: (v) => v.invoice == null
            ? const Center(child: Text('Lượt khám này chưa có hóa đơn.'))
            : _InvoiceBody(visit: v, invoice: v.invoice!),
      ),
    );
  }
}

class _InvoiceBody extends StatelessWidget {
  const _InvoiceBody({required this.visit, required this.invoice});
  final PatientVisit visit;
  final VisitInvoice invoice;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final origins = invoice.lines.map((l) => l.origin).whereType<String>().toSet();
    final groups = [
      for (final group in InvoiceGroup.values)
        if (invoice.lines.any((l) => l.group == group)) (group, invoice.lines.where((l) => l.group == group).toList()),
    ];
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
      children: [
        Row(children: [
          StatusPill(label: invoice.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán', positive: invoice.isPaid, warn: !invoice.isPaid),
          const SizedBox(width: 10),
          Expanded(child: Text('Lập ${DateFormat('HH:mm dd/MM/yyyy').format(invoice.createdAt)} · lượt ${visit.visitCode}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground))),
        ]),
        if (visit.mergedInto != null) ...[
          const SizedBox(height: 6),
          Text('Hóa đơn ra viện của hồ sơ điều trị ${visit.mergedInto}, đã gộp phí lượt khám này.', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
        ],
        const SizedBox(height: 16),

        // Tổng tiền.
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              _Money(label: 'Tổng chi phí', value: Formatters.vnd(invoice.totalAmount)),
              if (invoice.insuranceApplied) _Money(label: 'BHYT chi trả (80%)', value: '− ${Formatters.vnd(invoice.insuranceAmount)}', color: const Color(0xFF047857)),
              const Divider(height: 18, color: AppColors.border),
              _Money(label: invoice.isPaid ? 'Bạn đã thanh toán' : 'Cần thanh toán', value: Formatters.vnd(invoice.patientAmount), strong: true),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: invoice.isPaid ? AppColors.muted : const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(12)),
                child: Text(
                  invoice.isPaid
                      ? [invoice.paymentLabel ?? 'Đã thanh toán', if (invoice.paidAt != null) DateFormat('HH:mm dd/MM/yyyy').format(invoice.paidAt!)].join(' · ')
                      : 'Vui lòng thanh toán tại quầy thu ngân CAS-103 (tầng 1). Có thẻ BHYT còn hạn được giảm 80%.',
                  style: text.bodySmall?.copyWith(color: invoice.isPaid ? AppColors.mutedForeground : const Color(0xFF9A3412), height: 1.5),
                ),
              ),
            ]),
          ),
        ),
        if (invoice.insuranceApplied) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFA7F3D0))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.verified_user_outlined, size: 18, color: Color(0xFF047857)),
                const SizedBox(width: 6),
                Text('Bảo hiểm y tế đã dùng', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFF065F46))),
              ]),
              const SizedBox(height: 8),
              Text('Mã thẻ / CCCD: ${invoice.insuranceNumber ?? 'Chưa ghi'}', style: text.bodyMedium),
              Text('Họ tên trên thẻ: ${invoice.insuranceHolder ?? 'Chưa ghi'}', style: text.bodyMedium),
            ]),
          ),
        ],
        const SizedBox(height: 18),

        // Chi tiết chi phí theo nhóm.
        Text('Chi tiết chi phí · ${invoice.lines.length} khoản', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        for (final (group, lines) in groups)
          Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(invoiceGroupLabels[group]!, style: text.labelLarge?.copyWith(fontWeight: FontWeight.w600))),
                  Text(Formatters.vnd(lines.fold<int>(0, (s, l) => s + l.amount)), style: text.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
                ]),
                const Divider(height: 16, color: AppColors.border),
                for (final line in lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(line.name, style: text.bodyMedium),
                          Text('${line.quantity} ${line.unit} × ${Formatters.vnd(line.unitPrice)}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                          if (line.detail != null || (origins.length > 1 && line.origin != null))
                            Text([if (origins.length > 1) line.origin, line.detail].whereType<String>().join(' · '), style: text.bodySmall?.copyWith(color: AppColors.mutedForeground, fontSize: 11.5)),
                        ]),
                      ),
                      const SizedBox(width: 8),
                      Text(Formatters.vnd(line.amount), style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                    ]),
                  ),
              ]),
            ),
          ),
      ],
    );
  }
}

class _Money extends StatelessWidget {
  const _Money({required this.label, required this.value, this.color, this.strong = false});
  final String label;
  final String value;
  final Color? color;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Expanded(child: Text(label, style: strong ? text.titleSmall?.copyWith(fontWeight: FontWeight.w600) : text.bodyMedium?.copyWith(color: AppColors.mutedForeground))),
        Text(value, style: (strong ? text.titleMedium : text.bodyMedium)?.copyWith(fontWeight: strong ? FontWeight.w700 : FontWeight.w500, color: color ?? (strong ? AppColors.primary : null))),
      ]),
    );
  }
}
