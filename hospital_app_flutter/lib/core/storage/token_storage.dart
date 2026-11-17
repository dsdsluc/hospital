import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => const FlutterSecureStorage(),
);

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => TokenStorage(ref.watch(secureStorageProvider)),
);

/// Lưu access token.
/// - "Duy trì đăng nhập": lưu vào secure storage (còn sau khi tắt app).
/// - Không duy trì: chỉ giữ trong bộ nhớ, mất khi tắt app.
class TokenStorage {
  TokenStorage(this._storage);

  static const _accessTokenKey = 'hospital_access_token';
  final FlutterSecureStorage _storage;
  String? _sessionToken;

  Future<String?> readAccessToken() async =>
      _sessionToken ?? await _storage.read(key: _accessTokenKey);

  Future<void> saveAccessToken(String token, {bool remember = true}) async {
    if (remember) {
      _sessionToken = null;
      await _storage.write(key: _accessTokenKey, value: token);
    } else {
      _sessionToken = token;
      await _storage.delete(key: _accessTokenKey);
    }
  }

  Future<void> clearAccessToken() async {
    _sessionToken = null;
    await _storage.delete(key: _accessTokenKey);
  }
}
