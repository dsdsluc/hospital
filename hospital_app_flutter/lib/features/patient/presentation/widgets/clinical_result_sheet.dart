import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../application/patient_providers.dart';
import '../../data/visit_models.dart';

/// Bảng trượt chi tiết một kết quả phòng chức năng: chỉ số (cờ Thấp/Cao), thông tin, mô tả, kết luận.
Future<void> showClinicalResultSheet(BuildContext context, {required String visitId, required String stepId, required String roomName}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (_) => _ResultSheet(visitId: visitId, stepId: stepId, roomName: roomName),
  );
}

class _ResultSheet extends ConsumerWidget {
  const _ResultSheet({required this.visitId, required this.stepId, required this.roomName});
  final String visitId;
  final String stepId;
  final String roomName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final result = ref.watch(clinicalResultProvider((visitId, stepId)));
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.88),
      child: result.when(
        loading: () => const SizedBox(height: 220, child: Center(child: CircularProgressIndicator())),
        error: (_, _) => SizedBox(
          height: 220,
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('Không thể tải chi tiết kết quả.', style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground)),
              const SizedBox(height: 10),
              OutlinedButton(onPressed: () => ref.invalidate(clinicalResultProvider((visitId, stepId))), child: const Text('Thử lại')),
            ]),
          ),
        ),
        data: (r) => ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Text(r.roomName, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text('${r.roomCode} · ${r.floorName}${r.completedAt != null ? ' · Trả kết quả lúc ${DateFormat('HH:mm dd/MM/yyyy').format(r.completedAt!)}' : ''}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 16),
            if (r.measurements.isNotEmpty) ...[
              _Heading('Các chỉ số'),
              for (final m in r.measurements) _MeasurementRow(m: m),
              const SizedBox(height: 6),
              Text('Khoảng tham chiếu chỉ mang tính tham khảo, bác sĩ sẽ đánh giá theo tình trạng của bạn.', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
              const SizedBox(height: 18),
            ],
            if (r.details.isNotEmpty) ...[
              _Heading('Thông tin thực hiện'),
              for (final (label, value) in r.details)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SizedBox(width: 120, child: Text(label, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground))),
                    Expanded(child: Text(value, style: text.bodyMedium)),
                  ]),
                ),
              const SizedBox(height: 14),
            ],
            if (r.findings != null) _Block(title: 'Mô tả', body: r.findings!),
            if (r.conclusion != null) _Block(title: 'Kết luận', body: r.conclusion!, highlight: true),
            if (r.measurements.isEmpty && r.details.isEmpty && r.findings == null && r.conclusion == null) _Block(title: 'Kết quả', body: r.rawResult),
          ],
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)));
}

class _MeasurementRow extends StatelessWidget {
  const _MeasurementRow({required this.m});
  final ClinicalMeasurement m;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final abnormal = m.flag == MeasurementFlag.low || m.flag == MeasurementFlag.high;
    final (label, bg, fg, icon) = switch (m.flag) {
      MeasurementFlag.low => ('Thấp', const Color(0xFFE0F2FE), const Color(0xFF0369A1), Icons.arrow_downward),
      MeasurementFlag.high => ('Cao', const Color(0xFFFDE8E1), const Color(0xFFC2410C), Icons.arrow_upward),
      MeasurementFlag.normal => ('Bình thường', AppColors.primary.withValues(alpha: 0.1), AppColors.primary, null),
      null => ('', Colors.transparent, AppColors.mutedForeground, null),
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: abnormal ? bg.withValues(alpha: 0.35) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: abnormal ? fg.withValues(alpha: 0.25) : AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(m.label, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                if (m.description.isNotEmpty) Text(m.description, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                if (m.reference != null) Text('Tham chiếu: ${m.reference}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground, fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text.rich(TextSpan(children: [
                TextSpan(text: m.value, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: abnormal ? fg : AppColors.foreground)),
                if (m.unit != null) TextSpan(text: ' ${m.unit}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
              ])),
              if (label.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (icon != null) ...[Icon(icon, size: 11, color: fg), const SizedBox(width: 2)],
                    Text(label, style: text.labelSmall?.copyWith(fontSize: 10.5, fontWeight: FontWeight.w600, color: fg)),
                  ]),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.title, required this.body, this.highlight = false});
  final String title;
  final String body;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: highlight ? AppColors.primary.withValues(alpha: 0.06) : AppColors.muted, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: text.labelLarge?.copyWith(fontWeight: FontWeight.w600, color: highlight ? AppColors.primary : AppColors.foreground)),
        const SizedBox(height: 6),
        Text(body, style: text.bodyMedium?.copyWith(height: 1.55)),
      ]),
    );
  }
}
