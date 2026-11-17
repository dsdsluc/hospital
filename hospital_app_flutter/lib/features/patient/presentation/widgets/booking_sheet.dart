import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/utils/formatters.dart';
import '../../application/patient_providers.dart';
import '../../data/patient_repository.dart';

/// Mở bảng trượt đặt lịch khám. Dùng ở tab Lịch khám và nút "Đặt lịch" của Tổng quan.
Future<void> showBookingSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (_) => const _BookingSheet(),
  );
}

/// Khung giờ cách nhau 30 phút, tính cả mốc cuối (giống web).
List<String> _slots(int fromHour, int toHour, {int toMinute = 30}) => [
      for (var hour = fromHour; hour <= toHour; hour++)
        for (final minute in const [0, 30])
          if (!(hour == toHour && minute > toMinute)) '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}',
    ];

final _slotGroups = <(String, IconData, List<String>)>[
  ('Buổi sáng', Icons.wb_twilight_outlined, _slots(7, 11)),
  ('Buổi chiều', Icons.wb_sunny_outlined, _slots(12, 16)),
  ('Buổi tối', Icons.nights_stay_outlined, _slots(17, 20, toMinute: 0)),
];

const _tips = [
  'Mang theo CCCD và thẻ bảo hiểm y tế.',
  'Có mặt trước giờ hẹn khoảng 15 phút.',
  'Mang theo đơn thuốc và kết quả khám cũ nếu có.',
];

String _shortWeekday(DateTime date) => date.weekday == DateTime.sunday ? 'CN' : 'T${date.weekday + 1}';

class _BookingSheet extends ConsumerStatefulWidget {
  const _BookingSheet();

  @override
  ConsumerState<_BookingSheet> createState() => _BookingSheetState();
}

class _BookingSheetState extends ConsumerState<_BookingSheet> {
  late DateTime _today;
  late DateTime _date;
  String? _time;
  final _note = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _today = DateTime(now.year, now.month, now.day);
    _date = _today;
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  bool get _isToday => _date == _today;

  /// Hôm nay: khung giờ đã qua thì không chọn được (backend cũng kiểm tra).
  bool _slotDisabled(String slot) => _isToday && slot.compareTo(DateFormat('HH:mm').format(DateTime.now())) <= 0;

  void _pickDate(DateTime date) {
    setState(() {
      _date = date;
      if (_time != null && _slotDisabled(_time!)) _time = null;
    });
  }

  Future<void> _openCalendar() async {
    final picked = await showDatePicker(
      context: context,
      locale: const Locale('vi'),
      initialDate: _date,
      firstDate: _today,
      lastDate: _today.add(const Duration(days: 180)),
      helpText: 'Chọn ngày khám',
      cancelText: 'Hủy',
      confirmText: 'Chọn',
    );
    if (picked != null) _pickDate(picked);
  }

  Future<void> _submit() async {
    if (_time == null) return;
    setState(() => _submitting = true);
    try {
      final result = await ref.read(patientRepositoryProvider).createAppointment(
            date: DateFormat('yyyy-MM-dd').format(_date),
            time: _time!,
            note: _note.text,
          );
      ref.invalidate(allAppointmentsProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result.code.isEmpty ? result.message : '${result.message} Mã lịch hẹn: ${result.code}')));
    } on ApiMessageException catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message), backgroundColor: AppColors.destructive));
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final days = List.generate(14, (i) => _today.add(Duration(days: i)));
    final dateInStrip = days.contains(_date);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              children: [
                Text('Đặt lịch khám', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('Chọn ngày, giờ và mô tả ngắn tình trạng để bệnh viện chuẩn bị trước.', style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground)),
                const SizedBox(height: 20),

                // ① Ngày khám.
                _SectionTitle(index: 1, title: 'Ngày khám', trailing: TextButton.icon(onPressed: _openCalendar, icon: const Icon(Icons.calendar_month_outlined, size: 18), label: const Text('Chọn ngày khác'))),
                SizedBox(
                  height: 76,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: days.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final day = days[index];
                      final selected = day == _date;
                      return InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => _pickDate(day),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 58,
                          decoration: BoxDecoration(
                            color: selected ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: selected ? AppColors.primary : AppColors.border),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(index == 0 ? 'Hôm nay' : _shortWeekday(day), style: text.labelSmall?.copyWith(color: selected ? AppColors.onPrimary.withValues(alpha: 0.85) : AppColors.mutedForeground)),
                              const SizedBox(height: 2),
                              Text('${day.day}', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600, color: selected ? AppColors.onPrimary : AppColors.foreground)),
                              Text('Th ${day.month}', style: text.labelSmall?.copyWith(fontSize: 10, color: selected ? AppColors.onPrimary.withValues(alpha: 0.85) : AppColors.mutedForeground)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (!dateInStrip) ...[
                  const SizedBox(height: 8),
                  Text('Đã chọn: ${Formatters.weekday(_date)}, ${Formatters.shortDate(_date)}', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: AppColors.primary)),
                ],
                const SizedBox(height: 22),

                // ② Giờ khám.
                const _SectionTitle(index: 2, title: 'Giờ khám'),
                for (final (label, icon, slots) in _slotGroups) ...[
                  Row(children: [Icon(icon, size: 16, color: AppColors.mutedForeground), const SizedBox(width: 6), Text(label, style: text.labelLarge?.copyWith(color: AppColors.mutedForeground))]),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final slot in slots)
                        _SlotChip(label: slot, selected: _time == slot, disabled: _slotDisabled(slot), onTap: () => setState(() => _time = slot)),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],
                Text(_isToday ? 'Các khung giờ đã qua trong hôm nay không thể chọn.' : 'Mỗi khung giờ cách nhau 30 phút, từ 07:00 đến 20:00.', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                const SizedBox(height: 22),

                // ③ Ghi chú.
                const _SectionTitle(index: 3, title: 'Mô tả tình trạng', subtitle: 'Không bắt buộc'),
                TextField(
                  controller: _note,
                  maxLines: 3,
                  maxLength: 1000,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(hintText: 'Ví dụ: Sốt 2 ngày, đau đầu, chóng mặt...'),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(16)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Chuẩn bị trước khi đến', style: text.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      for (final tip in _tips)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Padding(padding: EdgeInsets.only(top: 2), child: Icon(Icons.check_circle_outline, size: 16, color: AppColors.primary)),
                            const SizedBox(width: 8),
                            Expanded(child: Text(tip, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground, height: 1.4))),
                          ]),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Nút xác nhận cố định dưới cùng.
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.border))),
            child: FilledButton(
              onPressed: _time == null || _submitting ? null : _submit,
              style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.controlRadius))),
              child: _submitting
                  ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary))
                  : Text(_time == null ? 'Chọn giờ khám để tiếp tục' : 'Đặt lịch $_time · ${_shortWeekday(_date)} ${DateFormat('dd/MM').format(_date)}'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.index, required this.title, this.subtitle, this.trailing});
  final int index;
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          CircleAvatar(radius: 10, backgroundColor: AppColors.primary.withValues(alpha: 0.1), child: Text('$index', style: text.labelSmall?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700))),
          const SizedBox(width: 8),
          Text(title, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          if (subtitle != null) ...[const SizedBox(width: 6), Text('· $subtitle', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground))],
          const Spacer(),
          ?trailing,
        ],
      ),
    );
  }
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({required this.label, required this.selected, required this.disabled, required this.onTap});
  final String label;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: disabled ? null : onTap,
      child: Container(
        width: 72,
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : disabled ? AppColors.muted : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: selected ? AppColors.onPrimary : disabled ? AppColors.mutedForeground.withValues(alpha: 0.5) : AppColors.foreground,
                decoration: disabled ? TextDecoration.lineThrough : null,
              ),
        ),
      ),
    );
  }
}
