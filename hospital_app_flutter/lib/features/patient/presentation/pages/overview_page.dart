import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/utils/formatters.dart';
import '../../../../shared/widgets/hero_background.dart';
import '../../application/patient_providers.dart';
import '../widgets/booking_sheet.dart';
import '../widgets/current_visit_card.dart';
import '../widgets/upcoming_appointment_card.dart';

/// Tab "Tổng quan" — cùng dữ liệu với trang /patient của web nhưng bố trí theo kiểu app:
/// phần đầu ảnh nền + lời chào ngắn → "Lượt khám hiện tại" → "Lịch hẹn sắp tới".
/// (Không có hàng phím tắt — thanh điều hướng dưới đã có các tab.)
class OverviewPage extends ConsumerStatefulWidget {
  const OverviewPage({super.key});

  @override
  ConsumerState<OverviewPage> createState() => _OverviewPageState();
}

class _OverviewPageState extends ConsumerState<OverviewPage> with WidgetsBindingObserver {
  /// Phần nội dung chồng lên mép dưới ảnh nền bao nhiêu pixel.
  static const _sheetOverlap = 26.0;

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startPolling();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  /// Lượt khám hiện tại làm mới mỗi 5 giây khi app đang mở; tạm dừng khi app chạy nền.
  void _startPolling() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => ref.invalidate(currentVisitProvider));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.invalidate(currentVisitProvider);
      _startPolling();
    } else if (state == AppLifecycleState.paused) {
      _timer?.cancel();
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(patientProfileProvider);
    ref.invalidate(currentVisitProvider);
    ref.invalidate(allAppointmentsProvider);
    await Future.wait([ref.read(currentVisitProvider.future), ref.read(upcomingAppointmentsProvider.future)]).catchError((_) => <Object?>[]);
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(patientProfileProvider);
    final visit = ref.watch(currentVisitProvider);
    final appointments = ref.watch(upcomingAppointmentsProvider);
    final fullName = profile.valueOrNull?.fullName.trim() ?? '';
    final hasVisit = visit.valueOrNull != null;
    final upcomingCount = appointments.valueOrNull?.length ?? 0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: RefreshIndicator(
          onRefresh: _refresh,
          edgeOffset: MediaQuery.paddingOf(context).top,
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              _OverviewHero(fullName: fullName, overlap: _sheetOverlap, onAvatarTap: () => context.go('/account')),
              Transform.translate(
                offset: const Offset(0, -_sheetOverlap),
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Lượt khám hiện tại (chỉ khi đang khám / chờ thanh toán / chờ nhận thuốc).
                        if (visit.valueOrNull case final current?) ...[
                          const _SectionTitle('Lượt khám hiện tại'),
                          CurrentVisitCard(visit: current),
                        ],

                        // Lịch hẹn sắp tới.
                        _SectionTitle(
                          'Lịch hẹn sắp tới',
                          action: upcomingCount > 0 ? ('Xem tất cả', () => context.go('/appointments')) : null,
                        ),
                        appointments.when(
                          loading: () => const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
                          error: (_, _) => _ErrorBox(onRetry: () => ref.invalidate(allAppointmentsProvider)),
                          data: (list) {
                            if (list.isEmpty) {
                              return hasVisit
                                  ? const _EmptyNote('Không có lịch hẹn nào khác sắp tới.')
                                  : EmptyAppointmentCard(onBook: () => showBookingSheet(context));
                            }
                            return UpcomingAppointmentCard(appointment: list.first, otherCount: list.length - 1);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Phần đầu: ảnh sảnh bệnh viện + lớp phủ xanh đậm, ngày, "Xin chào, {tên}", avatar chữ tắt.
class _OverviewHero extends StatelessWidget {
  const _OverviewHero({required this.fullName, required this.overlap, required this.onAvatarTap});

  final String fullName;
  final double overlap;
  final VoidCallback onAvatarTap;

  String get _initials {
    final parts = fullName.split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
    if (parts.isEmpty) return 'BN';
    return parts.length == 1 ? parts.first[0].toUpperCase() : '${parts[parts.length - 2][0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: 196 + MediaQuery.paddingOf(context).top + overlap,
      child: HeroBackground(
        child:           SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, overlap + 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          Formatters.longDay(DateTime.now()),
                          style: text.labelMedium?.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white.withValues(alpha: 0.75)),
                        ),
                      ),
                      // Avatar chữ tắt → tab Tài khoản.
                      Material(
                        color: Colors.white.withValues(alpha: 0.16),
                        shape: CircleBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.28))),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: onAvatarTap,
                          child: SizedBox.square(
                            dimension: 40,
                            child: Center(
                              child: Text(_initials, style: text.labelLarge?.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    // Chào đầy đủ họ tên; tên dài thì xuống tối đa 2 dòng.
                    'Xin chào, ${fullName.isEmpty ? 'bạn' : fullName}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.headlineMedium?.copyWith(fontSize: 28, fontWeight: FontWeight.w600, letterSpacing: -1.1, height: 1.15, color: Colors.white),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Chúc bạn một ngày nhiều sức khỏe.',
                    style: text.bodyMedium?.copyWith(fontSize: 14, color: Colors.white.withValues(alpha: 0.72)),
                  ),
                ],
              ),
            ),
          ),
      ),
    );
  }
}

/// Tiêu đề mục + link phụ bên phải (vd. "Xem tất cả").
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, {this.action});

  final String title;
  final (String, VoidCallback)? action;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 26, bottom: 12),
      child: Row(
        children: [
          Expanded(child: Text(title, style: text.titleMedium?.copyWith(fontSize: 16.5, fontWeight: FontWeight.w600, letterSpacing: -0.3))),
          if (action case (final label, final onTap))
            InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
                child: Text(label, style: text.bodyMedium?.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500, color: AppColors.primary)),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyNote extends StatelessWidget {
  const _EmptyNote(this.message);
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: AppColors.muted.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Text(message, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 13.5, color: AppColors.mutedForeground)),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: Column(
        children: [
          Text('Không thể tải dữ liệu. Kiểm tra kết nối và thử lại.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground)),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    );
  }
}
