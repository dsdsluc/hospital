import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/storage/token_storage.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/patient_providers.dart';

/// Tab "Tài khoản": thông tin cơ bản + đăng xuất (hồ sơ cá nhân đầy đủ làm ở đợt sau).
class AccountPage extends ConsumerWidget {
  const AccountPage({super.key});

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Đăng xuất?'),
        content: const Text('Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng ứng dụng.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
          FilledButton(onPressed: () => Navigator.pop(context, true), style: FilledButton.styleFrom(minimumSize: const Size(0, 40), backgroundColor: AppColors.destructive), child: const Text('Đăng xuất')),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(tokenStorageProvider).clearAccessToken();
    ref.read(currentUserProvider.notifier).state = null;
    if (context.mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final profile = ref.watch(patientProfileProvider).valueOrNull;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            Text('Tài khoản', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    CircleAvatar(radius: 26, backgroundColor: AppColors.primary, foregroundColor: AppColors.onPrimary, child: Text(_initials(profile?.fullName ?? ''), style: const TextStyle(fontWeight: FontWeight.w600))),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(profile?.fullName ?? 'Đang tải...', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                          if (profile?.patientCode != null) Text('Mã bệnh nhân ${profile!.patientCode}', style: text.bodySmall?.copyWith(color: AppColors.mutedForeground)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              margin: EdgeInsets.zero,
              child: ListTile(
                leading: const Icon(Icons.logout_rounded, color: AppColors.destructive),
                title: Text('Đăng xuất', style: text.bodyLarge?.copyWith(color: AppColors.destructive, fontWeight: FontWeight.w500)),
                onTap: () => _logout(context, ref),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.length == 1 ? parts.first[0].toUpperCase() : (parts[parts.length - 2][0] + parts.last[0]).toUpperCase();
  }
}
