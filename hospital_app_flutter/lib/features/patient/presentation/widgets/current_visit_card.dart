import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/utils/formatters.dart';
import '../../application/patient_providers.dart';
import '../../data/patient_models.dart';

/// Loại điểm đến (giống web `current-visit-guide`).
enum _Kind { cashier, pharmacy, returnForConclusion, exam, service }

/// Bước đang cần đến: ưu tiên phòng khác (cận lâm sàng, nhà thuốc); hết mới quay về phòng bác sĩ.
VisitStep? _destinationStep(CurrentVisit visit) {
  final active = visit.steps.where((s) => s.isActive).toList();
  final others = active.where((s) => s.room.id != visit.receivingRoom.id).toList();
  return others.where((s) => s.status == StepStatus.inProgress).firstOrNull
      ?? others.where((s) => s.status == StepStatus.pending).firstOrNull
      ?? active.where((s) => s.room.id == visit.receivingRoom.id).firstOrNull;
}

/// Thẻ "Hướng dẫn lượt khám hiện tại": chỉ hiện khi đang có lượt khám (hoặc còn hóa đơn chưa thanh toán).
class CurrentVisitCard extends ConsumerWidget {
  const CurrentVisitCard({super.key, required this.visit});
  final CurrentVisit visit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unpaid = visit.invoice != null && !visit.invoice!.isPaid && visit.cashierRoom != null ? visit.invoice : null;
    final activeSteps = visit.steps.where((s) => s.status != StepStatus.cancelled).toList();
    final finished = visit.isCompleted || (activeSteps.isNotEmpty && activeSteps.every((s) => s.status == StepStatus.completed));
    if (finished && unpaid == null) return const SizedBox.shrink();

    final step = _destinationStep(visit);
    if (step == null && unpaid == null) return const SizedBox.shrink();

    final destination = unpaid != null ? visit.cashierRoom! : step!.room;
    final kind = unpaid != null
        ? _Kind.cashier
        : step!.room.roomCode == 'PHM-105'
            ? _Kind.pharmacy
            : step.room.id == visit.receivingRoom.id
                ? (visit.steps.any((s) => s.status == StepStatus.completed && s.room.id != visit.receivingRoom.id && s.room.roomCode != 'REC-101') ? _Kind.returnForConclusion : _Kind.exam)
                : _Kind.service;
    final inRoom = unpaid == null && step!.status == StepStatus.inProgress && kind != _Kind.returnForConclusion;
    final remaining = visit.steps.where((s) => s.isActive && s.room.id != visit.receivingRoom.id && s.room.roomCode != 'PHM-105').length;

    final heading = switch (kind) {
      _Kind.cashier => 'Thanh toán viện phí',
      _Kind.pharmacy => 'Nhận thuốc tại nhà thuốc',
      _Kind.returnForConclusion => 'Quay lại phòng khám nhận kết luận',
      _ => inRoom ? (kind == _Kind.exam ? 'Bạn đang được khám tại' : 'Bạn đang được thực hiện tại') : 'Điểm đến tiếp theo của bạn',
    };
    final (badge, badgeBg, badgeFg) = switch (kind) {
      _Kind.cashier => ('Chờ thanh toán', const Color(0xFFFEF3C7), const Color(0xFF92400E)),
      _Kind.pharmacy => ('Đến nhận thuốc', const Color(0xFFD1FAE5), const Color(0xFF047857)),
      _Kind.returnForConclusion => ('Đã có kết quả', const Color(0xFFD1FAE5), const Color(0xFF047857)),
      _ => inRoom ? ('Đang thực hiện', AppColors.primary.withValues(alpha: 0.1), AppColors.primary) : ('Vui lòng di chuyển', const Color(0xFFFEF3C7), const Color(0xFFB45309)),
    };
    final message = switch (kind) {
      _Kind.cashier => 'Bác sĩ đã hoàn tất khám. Vui lòng đến ${destination.floorShort}, ${destination.name.toLowerCase()} ${destination.roomCode}, đọc mã lượt khám ${visit.visitCode} để thanh toán ${Formatters.vnd(unpaid!.totalAmount)} (có thẻ BHYT còn hạn được giảm 80%). ${unpaid.nextDestination == 'PHM-105' ? 'Sau đó sang nhà thuốc PHM-105 nhận thuốc.' : 'Sau khi thanh toán, bạn có thể ra về.'}',
      _Kind.pharmacy => '${visit.invoice?.isPaid == true ? 'Đã thanh toán.' : 'Bác sĩ đã hoàn tất khám.'} Vui lòng đến ${destination.floorShort}, nhà thuốc ${destination.roomCode}, đọc mã lượt khám ${visit.visitCode} để nhận thuốc.',
      _Kind.returnForConclusion => 'Đã có đủ kết quả cận lâm sàng. Vui lòng quay lại phòng ${destination.roomCode} và chờ bác sĩ gọi để nhận kết luận.',
      _ => inRoom
          ? 'Vui lòng làm theo hướng dẫn của nhân viên tại phòng ${destination.roomCode}.'
          : 'Vui lòng đến ${destination.floorShort}, tìm phòng ${destination.roomCode} và chờ trước cửa phòng.${remaining > 1 ? ' Sau đó còn ${remaining - 1} phòng cần thực hiện.' : ''}',
    };

    final text = Theme.of(context).textTheme;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: BorderSide(color: AppColors.primary.withValues(alpha: 0.2))),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(11)),
                  child: const Icon(Icons.navigation_outlined, size: 18, color: AppColors.primary),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text('HƯỚNG DẪN LƯỢT KHÁM', style: text.labelSmall?.copyWith(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1.6, color: AppColors.primary))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(99)),
                  child: Text(badge, style: text.labelSmall?.copyWith(fontSize: 11.5, fontWeight: FontWeight.w600, color: badgeFg)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(heading, style: text.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w600, letterSpacing: -0.4)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(14)),
                    child: Icon(kind == _Kind.cashier ? Icons.receipt_long_outlined : Icons.meeting_room_outlined, color: AppColors.onPrimary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${destination.roomCode} · ${destination.name}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text('${destination.floorShort} · ${destination.functionName}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                        if (unpaid != null) ...[
                          const SizedBox(height: 4),
                          Text('Tổng chi phí: ${Formatters.vnd(unpaid.totalAmount)}', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: AppColors.primary)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Text('Mã lượt khám', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                const SizedBox(width: 6),
                Text(visit.visitCode, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.4)),
              ],
            ),
            const SizedBox(height: 8),
            Text(message, style: text.bodyMedium?.copyWith(height: 1.55, color: AppColors.mutedForeground)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _showDirections(context, destination),
                    icon: const Icon(Icons.map_outlined, size: 18),
                    label: const Text('Chỉ đường'),
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _showJourney(context, visit),
                    icon: const Icon(Icons.route_outlined, size: 18),
                    label: const Text('Hành trình'),
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), side: const BorderSide(color: AppColors.border)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/* ───────── Bảng trượt: chỉ đường ───────── */

void _showDirections(BuildContext context, VisitRoom fallbackDestination) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (_) => _DirectionsSheet(fallbackDestination: fallbackDestination),
  );
}

class _DirectionsSheet extends ConsumerWidget {
  const _DirectionsSheet({required this.fallbackDestination});
  final VisitRoom fallbackDestination;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final navigation = ref.watch(visitNavigationProvider);
    final destination = navigation.valueOrNull?.destination ?? fallbackDestination;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Chỉ đường đến ${destination.roomCode}', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text('Lộ trình cập nhật theo điểm khám hiện tại của bạn.', style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground)),
              const SizedBox(height: 16),
              navigation.when(
                loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
                error: (_, _) => const _InfoBox('Chưa tải được lộ trình. Vui lòng hỏi nhân viên tại quầy hướng dẫn.'),
                data: (nav) => nav == null
                    ? const _InfoBox('Chưa có lộ trình cho lượt khám này.')
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _RoomPoint(label: 'Xuất phát', room: nav.origin),
                          Padding(
                            padding: const EdgeInsets.only(left: 22),
                            child: Container(
                              padding: const EdgeInsets.fromLTRB(20, 12, 0, 12),
                              decoration: BoxDecoration(border: Border(left: BorderSide(color: AppColors.primary.withValues(alpha: 0.3), width: 2))),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(children: [const Icon(Icons.schedule, size: 16, color: AppColors.primary), const SizedBox(width: 6), Text('Khoảng ${nav.estimatedMinutes} phút', style: text.labelMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600))]),
                                  const SizedBox(height: 10),
                                  for (final (index, step) in nav.instructions.indexed)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 10),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          CircleAvatar(radius: 11, backgroundColor: AppColors.primary.withValues(alpha: 0.1), child: Text('${index + 1}', style: text.labelSmall?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700))),
                                          const SizedBox(width: 10),
                                          Expanded(child: Text(step, style: text.bodyMedium?.copyWith(height: 1.5))),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                          _RoomPoint(label: 'Điểm đến', room: nav.destination, active: true),
                        ],
                      ),
              ),
              const SizedBox(height: 14),
              const _InfoBox('Khi đến nơi, vui lòng chờ trước phòng và theo dõi thông báo gọi lượt.', warm: true),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoomPoint extends StatelessWidget {
  const _RoomPoint({required this.label, required this.room, this.active = false});
  final String label;
  final VisitRoom room;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: active ? AppColors.primary.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: active ? AppColors.primary.withValues(alpha: 0.25) : AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: active ? AppColors.primary : AppColors.muted, borderRadius: BorderRadius.circular(12)),
            child: Icon(Icons.place_outlined, size: 20, color: active ? AppColors.onPrimary : AppColors.mutedForeground),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                Text('${room.roomCode} · ${room.name}', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                Text(room.floorShort, style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ───────── Bảng trượt: hành trình khám ───────── */

void _showJourney(BuildContext context, CurrentVisit visit) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (context) {
      final text = Theme.of(context).textTheme;
      return SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            children: [
              Text('Hành trình khám bệnh', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text('Mã lượt khám ${visit.visitCode}', style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground)),
              const SizedBox(height: 18),
              for (final (index, step) in visit.steps.indexed)
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Column(
                        children: [
                          _StepDot(status: step.status),
                          if (index < visit.steps.length - 1) Expanded(child: Container(width: 1.5, color: AppColors.border)),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(child: Text(step.room.functionName, style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w600))),
                                  Text(_statusLabel(step.status), style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text('${step.room.roomCode} · ${step.room.name} · ${step.room.floorShort}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      );
    },
  );
}

String _statusLabel(StepStatus status) => switch (status) {
      StepStatus.completed => 'Đã hoàn thành',
      StepStatus.inProgress => 'Đang thực hiện',
      StepStatus.cancelled => 'Đã hủy',
      StepStatus.pending => 'Điểm đến tiếp theo',
    };

class _StepDot extends StatelessWidget {
  const _StepDot({required this.status});
  final StepStatus status;

  @override
  Widget build(BuildContext context) {
    final done = status == StepStatus.completed;
    final current = status == StepStatus.inProgress;
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done ? AppColors.primary : Colors.white,
        border: Border.all(color: done || current ? AppColors.primary : AppColors.border, width: 2),
      ),
      child: Icon(done ? Icons.check : Icons.circle, size: done ? 14 : 8, color: done ? AppColors.onPrimary : current ? AppColors.primary : AppColors.border),
    );
  }
}

class _InfoBox extends StatelessWidget {
  const _InfoBox(this.message, {this.warm = false});
  final String message;
  final bool warm;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: warm ? const Color(0xFFFFFBEB) : AppColors.muted, borderRadius: BorderRadius.circular(14)),
      child: Text(message, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: warm ? const Color(0xFF92400E) : AppColors.mutedForeground, height: 1.5)),
    );
  }
}
