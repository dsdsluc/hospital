import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/brand_logo.dart';
import '../../application/auth_controller.dart';

/// Màn hình đăng nhập của app bệnh nhân — bố cục theo trang đăng nhập web (bản điện thoại,
/// `components/auth/login-form.tsx`): logo → eyebrow / tiêu đề / mô tả → form → tài khoản mới → lưu ý bảo mật.
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocus = FocusNode();
  bool _obscurePassword = true;
  bool _remember = true;

  /// Tấm form chồng lên ảnh nền bao nhiêu pixel.
  static const _sheetOverlap = 28.0;

  static final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final message = await ref.read(loginControllerProvider.notifier).login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          remember: _remember,
        );
    if (!mounted) return;
    final state = ref.read(loginControllerProvider);
    if (message != null) {
      _showMessage(message);
      context.go('/');
    } else if (state.hasError) {
      _showMessage(state.error.toString(), isError: true);
    }
  }

  void _showMessage(String text, {bool isError = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), backgroundColor: isError ? AppColors.destructive : AppColors.primary));
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final loading = ref.watch(loginControllerProvider).isLoading;
    final muted = text.bodyMedium?.copyWith(fontSize: 14, height: 1.5, color: AppColors.mutedForeground);

    final heroHeight = (MediaQuery.sizeOf(context).height * 0.36).clamp(250.0, 330.0);

    // Ảnh nền tối phía trên → icon thanh trạng thái màu sáng.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: GestureDetector(
          // Chạm ra ngoài ô nhập thì ẩn bàn phím.
          onTap: () => FocusScope.of(context).unfocus(),
          behavior: HitTestBehavior.translucent,
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _LoginHero(height: heroHeight, overlap: _sheetOverlap),
                // Tấm form bo góc trên, chồng lên mép dưới của ảnh.
                Transform.translate(
                  offset: const Offset(0, -_sheetOverlap),
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                    ),
                    child: SafeArea(
                      top: false,
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 420),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 28, 20, 4),
                            child: AutofillGroup(
                              child: Form(
                                key: _formKey,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                        // Email
                        const _Label('Email'),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.email],
                          autocorrect: false,
                          enabled: !loading,
                          style: text.bodyLarge?.copyWith(fontSize: 16),
                          decoration: const InputDecoration(
                            hintText: 'name@example.com',
                            prefixIcon: Icon(Icons.mail_outline_rounded, size: 17),
                          ),
                          validator: (value) => _emailPattern.hasMatch((value ?? '').trim()) ? null : 'Vui lòng nhập email hợp lệ.',
                          onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                        ),
                        const SizedBox(height: 16),

                        // Mật khẩu: nhãn + "Quên mật khẩu?" cùng một hàng, thẳng hàng với nhau.
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              const Expanded(child: _Label('Mật khẩu', padded: false)),
                              _InlineLink(
                                label: 'Quên mật khẩu?',
                                onTap: loading ? null : () => _showMessage('Vui lòng liên hệ quầy tiếp nhận để được cấp lại mật khẩu.'),
                              ),
                            ],
                          ),
                        ),
                        TextFormField(
                          controller: _passwordController,
                          focusNode: _passwordFocus,
                          obscureText: _obscurePassword,
                          textInputAction: TextInputAction.done,
                          autofillHints: const [AutofillHints.password],
                          autocorrect: false,
                          enableSuggestions: false,
                          enabled: !loading,
                          style: text.bodyLarge?.copyWith(fontSize: 16),
                          decoration: InputDecoration(
                            hintText: 'Nhập mật khẩu',
                            prefixIcon: const Icon(Icons.lock_outline_rounded, size: 17),
                            suffixIcon: IconButton(
                              tooltip: _obscurePassword ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                              icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 18),
                              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                            ),
                          ),
                          validator: (value) => (value ?? '').length >= 6 ? null : 'Mật khẩu cần ít nhất 6 ký tự.',
                          onFieldSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 14),

                        // Duy trì đăng nhập — ô nhỏ sát lề trái, cách chữ 12px (giống web), cả hàng chạm được.
                        _RememberRow(
                          value: _remember,
                          enabled: !loading,
                          onChanged: (value) => setState(() => _remember = value),
                          style: muted,
                        ),
                        const SizedBox(height: 16),

                        FilledButton(
                          onPressed: loading ? null : _submit,
                          child: loading
                              ? const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary)),
                                    SizedBox(width: 10),
                                    Text('Đang kiểm tra...'),
                                  ],
                                )
                              : const Text('Đăng nhập'),
                        ),
                        const SizedBox(height: 24),

                        // "TÀI KHOẢN MỚI" — đường kẻ hai bên, chữ nhỏ giãn rộng.
                        Row(
                          children: [
                            const Expanded(child: Divider(color: AppColors.border, height: 1)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                'TÀI KHOẢN MỚI',
                                style: text.labelSmall?.copyWith(fontSize: 11.5, letterSpacing: 1.8, color: AppColors.mutedForeground.withValues(alpha: 0.7)),
                              ),
                            ),
                            const Expanded(child: Divider(color: AppColors.border, height: 1)),
                          ],
                        ),
                        const SizedBox(height: 18),
                        // Wrap để tự xuống dòng khi màn hình hẹp / chữ phóng to (tránh tràn ngang).
                        Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text('Chưa có tài khoản?', style: muted),
                            const SizedBox(width: 4),
                            _InlineLink(
                              label: 'Đăng ký ngay',
                              bold: true,
                              onTap: loading ? null : () => _showMessage('Tính năng đăng ký trên ứng dụng sẽ có trong phiên bản sau.'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 28),

                        // Lưu ý bảo mật — rounded-2xl, nền muted nhạt, chữ nhỏ.
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                          decoration: BoxDecoration(
                            color: AppColors.muted.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(
                                padding: EdgeInsets.only(top: 2),
                                child: Icon(Icons.shield_outlined, size: 15, color: AppColors.primary),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text.rich(
                                  TextSpan(children: [
                                    TextSpan(text: 'Lưu ý bảo mật: ', style: text.bodySmall?.copyWith(fontSize: 12.5, height: 1.6, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                                    TextSpan(text: 'Không chia sẻ mật khẩu hoặc mã truy cập với người khác.', style: text.bodySmall?.copyWith(fontSize: 12.5, height: 1.6, color: AppColors.mutedForeground)),
                                  ]),
                                ),
                              ),
                            ],
                          ),
                        ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Ảnh sảnh bệnh viện (cùng ảnh panel thương hiệu bên web) + lớp phủ xanh đậm,
/// logo phía trên, lời chào ngắn phía dưới. Chỉ dùng cho màn đăng nhập.
class _LoginHero extends StatelessWidget {
  const _LoginHero({required this.height, required this.overlap});

  final double height;

  /// Phần tấm form sẽ chồng lên mép dưới — chừa khoảng này để chữ không bị che.
  final double overlap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: height + overlap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Ảnh rất ngang → lệch khung sang phải để thấy bác sĩ và bệnh nhân.
          Image.asset('assets/images/login_hero.jpg', fit: BoxFit.cover, alignment: const Alignment(0.9, -0.1)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x99062D29), Color(0x66062D29), Color(0xF0062D29)],
                stops: [0, 0.4, 1],
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 14, 20, overlap + 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const BrandLogo(onDark: true),
                  const Spacer(),
                  Text(
                    'Chào mừng trở lại',
                    style: text.headlineMedium?.copyWith(fontSize: 28, fontWeight: FontWeight.w600, letterSpacing: -1.1, height: 1.15, color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text, {this.padded = true});
  final String text;
  final bool padded;

  @override
  Widget build(BuildContext context) {
    final label = Text(
      text,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.foreground),
    );
    return padded ? Padding(padding: const EdgeInsets.only(bottom: 8), child: label) : label;
  }
}

/// Ô "Duy trì đăng nhập": checkbox nhỏ không có vùng đệm 48px mặc định của Material
/// (để thẳng lề trái với ô nhập), nhưng cả hàng vẫn chạm được.
class _RememberRow extends StatelessWidget {
  const _RememberRow({required this.value, required this.enabled, required this.onChanged, this.style});

  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: enabled ? () => onChanged(!value) : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            SizedBox.square(
              dimension: 18,
              child: Checkbox(
                value: value,
                onChanged: enabled ? (next) => onChanged(next ?? false) : null,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: const VisualDensity(horizontal: -4, vertical: -4),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text('Duy trì đăng nhập trên thiết bị này', style: style)),
          ],
        ),
      ),
    );
  }
}

/// Link chữ gọn (không có đệm của TextButton) để thẳng hàng với chữ bên cạnh.
class _InlineLink extends StatelessWidget {
  const _InlineLink({required this.label, required this.onTap, this.bold = false});

  final String label;
  final VoidCallback? onTap;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontSize: 14,
                fontWeight: bold ? FontWeight.w600 : FontWeight.w500,
                color: onTap == null ? AppColors.mutedForeground : AppColors.primary,
              ),
        ),
      ),
    );
  }
}
