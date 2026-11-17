import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/utils/formatters.dart';
import '../../data/patient_models.dart';

String _countdown(DateTime date) {
  final now = DateTime.now();
  final days = date.difference(DateTime(now.year, now.month, now.day)).inDays;
  if (days <= 0) return 'Hôm nay';
  if (days == 1) return 'Ngày mai';
  return 'Còn $days ngày';
}

/// Thẻ "Lịch hẹn sắp tới" — lịch gần nhất, mã đọc tại quầy tiếp nhận.
class UpcomingAppointmentCard extends StatelessWidget {
  const UpcomingAppointmentCard({super.key, required this.appointment, required this.otherCount});
  final PatientAppointment appointment;
  final int otherCount;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: const BorderSide(color: AppColors.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Dải mã lịch hẹn nền xanh đậm.
          Container(
            padding: const EdgeInsets.fromLTRB(18, 16, 12, 16),
            color: AppColors.primary,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('LỊCH HẸN SẮP TỚI · ${_countdown(appointment.date).toUpperCase()}', style: text.labelSmall?.copyWith(fontSize: 10.5, letterSpacing: 1.4, fontWeight: FontWeight.w600, color: AppColors.onPrimary.withValues(alpha: 0.75))),
                      const SizedBox(height: 6),
                      Text(appointment.code, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: 3.5, color: AppColors.onPrimary)),
                      const SizedBox(height: 2),
                      Text('Đọc mã này cho nhân viên tiếp nhận khi đến bệnh viện', style: text.bodySmall?.copyWith(color: AppColors.onPrimary.withValues(alpha: 0.8))),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: appointment.code));
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Đã sao chép mã ${appointment.code}')));
                  },
                  style: TextButton.styleFrom(foregroundColor: AppColors.onPrimary, backgroundColor: Colors.white.withValues(alpha: 0.15), shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 12)),
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: const Text('Sao chép'),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                _Line(icon: Icons.event_outlined, label: 'Ngày khám', value: '${Formatters.weekday(appointment.date)}, ${Formatters.shortDate(appointment.date)}'),
                _Line(icon: Icons.schedule_outlined, label: 'Giờ hẹn', value: appointment.time),
                _Line(
                  icon: Icons.medical_services_outlined,
                  label: 'Bác sĩ',
                  value: appointment.doctorName ?? 'Phân công khi tiếp nhận',
                  sub: appointment.doctorSpecialization,
                  muted: appointment.doctorName == null,
                ),
                _Line(icon: Icons.description_outlined, label: 'Ghi chú', value: appointment.note?.trim().isNotEmpty == true ? appointment.note!.trim() : 'Không có ghi chú.', muted: appointment.note?.trim().isNotEmpty != true, last: true),
                if (otherCount > 0) ...[
                  const SizedBox(height: 12),
                  Align(alignment: Alignment.centerLeft, child: Text('Bạn còn $otherCount lịch hẹn khác.', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground))),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.label, required this.value, this.sub, this.muted = false, this.last = false});
  final IconData icon;
  final String label;
  final String value;
  final String? sub;
  final bool muted;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 10),
          SizedBox(width: 78, child: Text(label, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground))),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: text.bodyMedium?.copyWith(fontWeight: muted ? FontWeight.w400 : FontWeight.w600, color: muted ? AppColors.mutedForeground : AppColors.foreground)),
                if (sub != null) Text(sub!, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Khi chưa có lịch hẹn nào sắp tới.
class EmptyAppointmentCard extends StatelessWidget {
  const EmptyAppointmentCard({super.key, required this.onBook});
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: const BorderSide(color: AppColors.border)),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
              child: const Icon(Icons.event_available_outlined, color: AppColors.primary),
            ),
            const SizedBox(height: 12),
            Text('Chưa có lịch hẹn sắp tới', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('Đặt lịch trước để bệnh viện chuẩn bị và giảm thời gian chờ.', textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground, height: 1.5)),
            const SizedBox(height: 14),
            FilledButton.icon(onPressed: onBook, icon: const Icon(Icons.add, size: 18), label: const Text('Đặt lịch khám'), style: FilledButton.styleFrom(minimumSize: const Size(0, 44))),
          ],
        ),
      ),
    );
  }
}
