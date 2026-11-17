import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/token_storage.dart';
import '../data/auth_repository.dart';

/// Người dùng đang đăng nhập (null = chưa đăng nhập).
final currentUserProvider = StateProvider<AuthUser?>((ref) => null);

final loginControllerProvider = AutoDisposeAsyncNotifierProvider<LoginController, void>(LoginController.new);

/// Xử lý đăng nhập cho app bệnh nhân.
class LoginController extends AutoDisposeAsyncNotifier<void> {
  // Trả về đồng bộ để trạng thái ban đầu là AsyncData (không phải đang tải).
  @override
  FutureOr<void> build() {}

  /// Trả về thông báo thành công; lỗi được giữ trong `state` (AsyncError với [AuthException]).
  Future<String?> login({required String email, required String password, required bool remember}) async {
    state = const AsyncLoading();
    try {
      final result = await ref.read(authRepositoryProvider).login(email: email, password: password);
      // App dành cho bệnh nhân: tài khoản bác sĩ / quản trị dùng bản web.
      if (!result.user.isPatient) {
        throw const AuthException('Ứng dụng chỉ dành cho bệnh nhân. Bác sĩ và quản trị viên vui lòng dùng bản web.');
      }
      await ref.read(tokenStorageProvider).saveAccessToken(result.accessToken, remember: remember);
      ref.read(currentUserProvider.notifier).state = result.user;
      state = const AsyncData(null);
      return result.message;
    } on AuthException catch (error, stack) {
      state = AsyncError(error, stack);
      return null;
    }
  }
}
