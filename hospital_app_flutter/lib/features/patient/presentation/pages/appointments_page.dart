import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/utils/formatters.dart';
import '../../application/patient_providers.dart';
import '../../data/patient_models.dart';
import '../../data/patient_repository.dart';
import '../widgets/booking_sheet.dart';

const _statusMeta = <AppointmentHistoryStatus, (String, Color, Color)>{
  AppointmentHistoryStatus.upcoming: ('Sắp tới', Color(0xFFE3F1EE), AppColors.primary),
  AppointmentHistoryStatus.inVisit: ('Đang khám', Color(0xFFE0F2FE), Color(0xFF0369A1)),
  AppointmentHistoryStatus.awaitingMedicine: ('Chờ nhận thuốc', Color(0xFFFEF3C7), Color(0xFFB45309)),
  AppointmentHistoryStatus.visited: ('Đã khám', Color(0xFFD1FAE5), Color(0xFF047857)),
  AppointmentHistoryStatus.past: ('Không đến', AppColors.muted, AppColors.mutedForeground),
  AppointmentHistoryStatus.cancelled: ('Đã hủy', Color(0xFFFDECEA), AppColors.destructive),
};

String _countdown(DateTime date) {
  final now = DateTime.now();
  final days = date.difference(DateTime(now.year, now.month, now.day)).inDays;
  if (days <= 0) return 'Hôm nay';
  if (days == 1) return 'Ngày mai';
  return 'Còn $days ngày';
}

/// Sao chép mã lịch hẹn + báo nhỏ.
Future<void> _copyCode(BuildContext context, String code) async {
  await Clipboard.setData(ClipboardData(text: code));
  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Đã sao chép mã $code')));
}

/// Hỏi lại rồi hủy lịch. Trả về true nếu đã hủy.
Future<bool> _cancelAppointment(BuildContext context, WidgetRef ref, PatientAppointment appointment) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Hủy lịch hẹn?'),
      content: Text('Lịch ${appointment.code} lúc ${appointment.time}, ${Formatters.shortDate(appointment.date)} sẽ chuyển sang trạng thái đã hủy.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Giữ lịch')),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          style: FilledButton.styleFrom(minimumSize: const Size(0, 40), backgroundColor: AppColors.destructive),
          child: const Text('Hủy lịch'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return false;
  final messenger = ScaffoldMessenger.of(context);
  try {
    final message = await ref.read(patientRepositoryProvider).cancelAppointment(appointment.id);
    ref.invalidate(allAppointmentsProvider);
    messenger.showSnackBar(SnackBar(content: Text(message)));
    return true;
  } on ApiMessageException catch (error) {
    messenger.showSnackBar(SnackBar(content: Text(error.message), backgroundColor: AppColors.destructive));
    return false;
  }
}

/// Tab "Lịch khám" — bố cục cho điện thoại:
/// tiêu đề gọn → "vé khám" của lịch gần nhất → các lịch khác dạng dòng gọn → mục Lịch sử (trang riêng).
/// Đặt lịch bằng nút nổi ở góc dưới.
class AppointmentsPage extends ConsumerWidget {
  const AppointmentsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final upcoming = ref.watch(upcomingAppointmentsProvider);
    final historyCount = ref.watch(allAppointmentsProvider).valueOrNull?.where((a) => a.historyStatus != AppointmentHistoryStatus.upcoming).length;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => showBookingSheet(context),
          icon: const Icon(Icons.add_rounded),
          label: const Text('Đặt lịch'),
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.onPrimary,
          shape: const StadiumBorder(),
        ),
        body: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () async => ref.refresh(allAppointmentsProvider.future),
            child: ListView(
              // Chừa chỗ dưới cùng cho nút nổi.
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 96),
              children: [
                Text('Lịch khám', style: text.headlineSmall?.copyWith(fontSize: 26, fontWeight: FontWeight.w600, letterSpacing: -0.9)),
                const SizedBox(height: 4),
                Text(
                  switch (upcoming.valueOrNull?.length) {
                    null => 'Đang tải lịch hẹn...',
                    0 => 'Bạn chưa có lịch hẹn sắp tới',
                    final n => '$n lịch hẹn sắp tới',
                  },
                  style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground),
                ),
                const SizedBox(height: 20),

                ...upcoming.when(
                  loading: () => const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))],
                  error: (_, _) => [const _InfoBox(icon: Icons.cloud_off_outlined, title: 'Không thể tải lịch hẹn', body: 'Kéo xuống để thử lại.')],
                  data: (list) => list.isEmpty
                      ? [
                          _InfoBox(
                            icon: Icons.event_available_outlined,
                            title: 'Chưa có lịch hẹn sắp tới',
                            body: 'Đặt lịch trước để bệnh viện chuẩn bị và giảm thời gian chờ cho bạn.',
                            action: FilledButton.icon(
                              onPressed: () => showBookingSheet(context),
                              icon: const Icon(Icons.add_rounded, size: 18),
                              label: const Text('Đặt lịch khám'),
                              style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                            ),
                          ),
                        ]
                      : [
                          AppointmentTicket(appointment: list.first),
                          if (list.length > 1) ...[
                            const _SectionTitle('Lịch khác'),
                            for (final appointment in list.skip(1)) ...[
                              _CompactAppointmentRow(appointment: appointment, onTap: () => _showTicketSheet(context, appointment)),
                              const SizedBox(height: 10),
                            ],
                          ],
                        ],
                ),

                const SizedBox(height: 24),
                _HistoryLink(count: historyCount, onTap: () => context.go('/appointments/history')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Mở "vé khám" của một lịch trong bảng trượt từ dưới lên.
Future<void> _showTicketSheet(BuildContext context, PatientAppointment appointment) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.background,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: AppointmentTicket(appointment: appointment, onCancelled: () => Navigator.of(context).pop()),
      ),
    ),
  );
}

/* ───────────────────────────────────────── Vé khám ───────────────────────────────────────── */

/// "Vé khám": mã lịch hẹn cỡ lớn, đếm ngược, ngày giờ, bác sĩ; đường răng cưa như cuống vé;
/// phần dưới là hướng dẫn + Hủy lịch / Sao chép mã.
class AppointmentTicket extends ConsumerWidget {
  const AppointmentTicket({super.key, required this.appointment, this.onCancelled});

  final PatientAppointment appointment;
  final VoidCallback? onCancelled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final note = appointment.note?.trim();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
        boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.08), blurRadius: 24, offset: const Offset(0, 10), spreadRadius: -8)],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Phần trên của vé.
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
                      child: Text(
                        '${_countdown(appointment.date)} · ${appointment.time}',
                        style: text.labelMedium?.copyWith(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                      ),
                    ),
                    const Spacer(),
                    Text('MÃ LỊCH HẸN', style: text.labelSmall?.copyWith(fontSize: 10.5, letterSpacing: 1.4, color: AppColors.mutedForeground)),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  appointment.code,
                  style: text.displaySmall?.copyWith(fontSize: 34, fontWeight: FontWeight.w700, letterSpacing: 5, height: 1, color: AppColors.foreground),
                ),
                const SizedBox(height: 16),
                _TicketLine(icon: Icons.event_outlined, value: '${Formatters.weekday(appointment.date)}, ${Formatters.shortDate(appointment.date)} · ${appointment.time}'),
                _TicketLine(
                  icon: Icons.medical_services_outlined,
                  value: appointment.doctorName == null
                      ? 'Bác sĩ phân công khi tiếp nhận'
                      : 'BS. ${appointment.doctorName}${appointment.doctorSpecialization != null ? ' · ${appointment.doctorSpecialization}' : ''}',
                  muted: appointment.doctorName == null,
                ),
                if (note != null && note.isNotEmpty) _TicketLine(icon: Icons.notes_rounded, value: note, last: true),
              ],
            ),
          ),

          // Đường răng cưa giữa hai phần vé.
          const _TicketNotch(),

          // Cuống vé: hướng dẫn + hành động.
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 15, color: AppColors.mutedForeground),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Đọc mã này tại quầy tiếp nhận REC-101 khi đến bệnh viện.',
                        style: text.bodySmall?.copyWith(fontSize: 12.5, height: 1.45, color: AppColors.mutedForeground),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    TextButton.icon(
                      onPressed: () async {
                        final cancelled = await _cancelAppointment(context, ref, appointment);
                        if (cancelled) onCancelled?.call();
                      },
                      style: TextButton.styleFrom(foregroundColor: AppColors.destructive, padding: const EdgeInsets.symmetric(horizontal: 10)),
                      icon: const Icon(Icons.event_busy_outlined, size: 18),
                      label: const Text('Hủy lịch'),
                    ),
                    const Spacer(),
                    FilledButton.tonalIcon(
                      onPressed: () => _copyCode(context, appointment.code),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 40),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                        foregroundColor: AppColors.primary,
                        shape: const StadiumBorder(),
                      ),
                      icon: const Icon(Icons.copy_rounded, size: 17),
                      label: const Text('Sao chép mã'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TicketLine extends StatelessWidget {
  const _TicketLine({required this.icon, required this.value, this.muted = false, this.last = false});
  final IconData icon;
  final String value;
  final bool muted;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 16, color: AppColors.primary)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 14, height: 1.4, color: muted ? AppColors.mutedForeground : AppColors.foreground),
            ),
          ),
        ],
      ),
    );
  }
}

/// Hai khuyết tròn hai bên + đường gạch đứt ở giữa — giống chỗ xé của vé.
class _TicketNotch extends StatelessWidget {
  const _TicketNotch();

  @override
  Widget build(BuildContext context) {
    const size = 18.0;
    Widget notch() => Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: AppColors.background, shape: BoxShape.circle, border: Border.all(color: AppColors.border)),
        );
    return SizedBox(
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(left: -size / 2, top: 0, child: notch()),
          Positioned(right: -size / 2, top: 0, child: notch()),
          const Positioned.fill(
            left: size,
            right: size,
            child: Center(child: CustomPaint(size: Size(double.infinity, 1), painter: _DashPainter())),
          ),
        ],
      ),
    );
  }
}

class _DashPainter extends CustomPainter {
  const _DashPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.border
      ..strokeWidth = 1.2;
    const dash = 6.0;
    const gap = 5.0;
    for (var x = 0.0; x < size.width; x += dash + gap) {
      canvas.drawLine(Offset(x, 0), Offset((x + dash).clamp(0, size.width), 0), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/* ─────────────────────────────────── Lịch khác (dòng gọn) ─────────────────────────────────── */

class _CompactAppointmentRow extends StatelessWidget {
  const _CompactAppointmentRow({required this.appointment, required this.onTap});
  final PatientAppointment appointment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: AppColors.border)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
          child: Row(
            children: [
              _DateBlock(date: appointment.date),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: appointment.time, style: const TextStyle(fontWeight: FontWeight.w600)),
                        const TextSpan(text: '  ·  ', style: TextStyle(color: AppColors.mutedForeground)),
                        TextSpan(text: appointment.code, style: const TextStyle(fontWeight: FontWeight.w600, letterSpacing: 1.4)),
                      ]),
                      style: text.bodyLarge?.copyWith(fontSize: 15),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      appointment.doctorName != null ? 'BS. ${appointment.doctorName}' : '${_countdown(appointment.date)} · bác sĩ phân công khi tiếp nhận',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall?.copyWith(fontSize: 12.5, color: AppColors.mutedForeground),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.mutedForeground),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ô ngày nhỏ: số ngày + "Th 11".
class _DateBlock extends StatelessWidget {
  const _DateBlock({required this.date, this.muted = false});
  final DateTime date;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      width: 46,
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: BoxDecoration(
        color: muted ? AppColors.muted : AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Column(
        children: [
          Text('${date.day}', style: text.titleMedium?.copyWith(fontSize: 17, fontWeight: FontWeight.w700, height: 1.1, color: muted ? AppColors.foreground : AppColors.primary)),
          Text('Th ${date.month}', style: text.labelSmall?.copyWith(fontSize: 10.5, color: AppColors.mutedForeground)),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 26, bottom: 12),
      child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 16.5, fontWeight: FontWeight.w600, letterSpacing: -0.3)),
    );
  }
}

/// Dòng "Lịch sử đặt lịch (n) ›" ở cuối trang.
class _HistoryLink extends StatelessWidget {
  const _HistoryLink({required this.count, required this.onTap});
  final int? count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Material(
      color: AppColors.muted.withValues(alpha: 0.7),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
          child: Row(
            children: [
              const Icon(Icons.history_rounded, size: 20, color: AppColors.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Lịch sử đặt lịch', style: text.bodyLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w600)),
                    Text(
                      count == null ? 'Đã khám, đã hủy, không đến' : '$count lịch · đã khám, đã hủy, không đến',
                      style: text.bodySmall?.copyWith(fontSize: 12.5, color: AppColors.mutedForeground),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.mutedForeground),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoBox extends StatelessWidget {
  const _InfoBox({required this.icon, required this.title, required this.body, this.action});
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: AppColors.border)),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(height: 14),
          Text(title, textAlign: TextAlign.center, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(body, textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground, height: 1.5)),
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

/* ───────────────────────────────────── Trang Lịch sử ───────────────────────────────────── */

/// /appointments/history — toàn bộ lịch đã qua (đã khám, đang khám, chờ nhận thuốc, không đến, đã hủy),
/// mới nhất trước, lọc theo trạng thái.
class AppointmentHistoryPage extends ConsumerStatefulWidget {
  const AppointmentHistoryPage({super.key});

  @override
  ConsumerState<AppointmentHistoryPage> createState() => _AppointmentHistoryPageState();
}

class _AppointmentHistoryPageState extends ConsumerState<AppointmentHistoryPage> {
  AppointmentHistoryStatus? _filter;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final all = ref.watch(allAppointmentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Lịch sử đặt lịch', style: text.titleMedium?.copyWith(fontSize: 17, fontWeight: FontWeight.w600)),
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(allAppointmentsProvider.future),
        child: all.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => ListView(
            padding: const EdgeInsets.all(20),
            children: const [_InfoBox(icon: Icons.cloud_off_outlined, title: 'Không thể tải lịch sử', body: 'Kéo xuống để thử lại.')],
          ),
          data: (list) {
            // Lịch đã qua, mới nhất trước (lịch sắp tới nằm ở trang Lịch khám).
            final past = list.where((a) => a.historyStatus != AppointmentHistoryStatus.upcoming).toList()
              ..sort((a, b) => '${b.date.toIso8601String()}${b.time}'.compareTo('${a.date.toIso8601String()}${a.time}'));
            final counts = <AppointmentHistoryStatus, int>{};
            for (final a in past) {
              counts[a.historyStatus] = (counts[a.historyStatus] ?? 0) + 1;
            }
            final shown = _filter == null ? past : past.where((a) => a.historyStatus == _filter).toList();

            return ListView(
              padding: const EdgeInsets.fromLTRB(0, 8, 0, 28),
              children: [
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    children: [
                      _FilterChip(label: 'Tất cả', count: past.length, selected: _filter == null, onTap: () => setState(() => _filter = null)),
                      for (final status in AppointmentHistoryStatus.values)
                        if ((counts[status] ?? 0) > 0)
                          _FilterChip(label: _statusMeta[status]!.$1, count: counts[status]!, selected: _filter == status, onTap: () => setState(() => _filter = status)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (shown.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      past.isEmpty ? 'Chưa có lịch hẹn nào trong lịch sử.' : 'Không có lịch hẹn ở trạng thái này.',
                      textAlign: TextAlign.center,
                      style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground),
                    ),
                  )
                else
                  for (final a in shown) Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 10), child: _HistoryTile(appointment: a)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.appointment});
  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final (label, bg, fg) = _statusMeta[appointment.historyStatus]!;
    final note = appointment.note?.trim();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DateBlock(date: appointment.date, muted: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(appointment.code, style: text.bodyLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: 1.2))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
                      child: Text(label, style: text.labelSmall?.copyWith(fontWeight: FontWeight.w600, color: fg)),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text('${Formatters.weekday(appointment.date)}, ${Formatters.shortDate(appointment.date)} · ${appointment.time}', style: text.bodySmall?.copyWith(fontSize: 12.5, color: AppColors.mutedForeground)),
                if (appointment.visitCode != null)
                  Text('Lượt khám ${appointment.visitCode}', style: text.bodySmall?.copyWith(fontSize: 12.5, color: AppColors.primary, fontWeight: FontWeight.w500)),
                if (note != null && note.isNotEmpty)
                  Padding(padding: const EdgeInsets.only(top: 4), child: Text(note, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(fontSize: 12.5))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.count, required this.selected, required this.onTap});
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: selected ? AppColors.primary : AppColors.border),
          ),
          child: Text(
            '$label  $count',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600, color: selected ? AppColors.onPrimary : AppColors.mutedForeground),
          ),
        ),
      ),
    );
  }
}
