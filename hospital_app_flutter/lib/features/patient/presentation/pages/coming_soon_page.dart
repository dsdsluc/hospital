import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Tab chưa làm (Lịch khám, Hồ sơ khám) — sẽ thay ở các đợt sau.
class ComingSoonPage extends StatelessWidget {
  const ComingSoonPage({super.key, required this.title, required this.description, required this.icon});
  final String title;
  final String description;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(18)),
                  child: Icon(icon, color: AppColors.primary, size: 26),
                ),
                const SizedBox(height: 16),
                Text(title, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Text(description, textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.mutedForeground, height: 1.5)),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(99)),
                  child: Text('Sắp có', style: text.labelMedium?.copyWith(color: AppColors.mutedForeground, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
