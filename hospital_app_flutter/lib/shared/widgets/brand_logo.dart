import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Logo MediPath giống web (`SiteLogo`): ô vuông bo góc màu primary + chấm coral + chữ.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.onDark = false});

  /// Đặt trên nền tối / ảnh (vd. màn đăng nhập): chữ trắng, viền chấm coral theo nền tối.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(17),
                boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 10), spreadRadius: -12)],
              ),
              child: const Icon(Icons.monitor_heart_outlined, color: AppColors.onPrimary, size: 22),
            ),
            Positioned(
              right: -3,
              top: -3,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: AppColors.coral,
                  shape: BoxShape.circle,
                  border: Border.all(color: onDark ? AppColors.brandDark : AppColors.background, width: 2),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('MediPath', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.7, height: 1, color: onDark ? Colors.white : null)),
            const SizedBox(height: 4),
            Text('CARE MADE CLEAR', style: text.labelSmall?.copyWith(fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 1.8, color: onDark ? Colors.white.withValues(alpha: 0.6) : AppColors.mutedForeground, height: 1)),
          ],
        ),
      ],
    );
  }
}
