import 'package:flutter/material.dart';

/// Màu dùng chung, quy đổi (xấp xỉ) từ token OKLCH của web `globals.css`.
abstract final class AppColors {
  /// --primary: oklch(0.47 0.105 174)
  static const primary = Color(0xFF13695D);
  static const onPrimary = Color(0xFFFAFAFA);

  /// --background: oklch(0.992 0.004 165)
  static const background = Color(0xFFFAFCFB);

  /// --foreground: oklch(0.22 0.035 175)
  static const foreground = Color(0xFF0F2925);

  /// --muted-foreground: oklch(0.53 0.025 175)
  static const mutedForeground = Color(0xFF5E7571);

  /// --muted: oklch(0.965 0.009 165)
  static const muted = Color(0xFFF1F5F3);

  /// --border / --input: oklch(0.9 0.016 170)
  static const border = Color(0xFFD6E3DF);

  /// --destructive: oklch(0.577 0.245 27)
  static const destructive = Color(0xFFD93025);

  /// --brand-coral: oklch(0.7 0.16 35) — chấm nhỏ trên logo.
  static const coral = Color(0xFFEC7B55);

  /// Nền panel thương hiệu tối.
  static const brandDark = Color(0xFF082F2B);
}
