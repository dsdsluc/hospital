import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Theme đồng bộ với web: font Geist (có hỗ trợ tiếng Việt), màu xanh MediPath.
/// Ô nhập / nút bo [controlRadius] (≈ `rounded-xl` của web), cao 48 cho dễ chạm.
abstract final class AppTheme {
  static const radius = 12.0;

  /// Bo góc ô nhập và nút — tương ứng `rounded-xl` trên web (0.85rem × 1.4 ≈ 18px).
  static const controlRadius = 18.0;

  static ThemeData get light {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      surface: AppColors.background,
      onSurface: AppColors.foreground,
      onSurfaceVariant: AppColors.mutedForeground,
      outline: AppColors.border,
      outlineVariant: AppColors.border,
      error: AppColors.destructive,
    );

    final baseText = GoogleFonts.geistTextTheme().apply(
      bodyColor: AppColors.foreground,
      displayColor: AppColors.foreground,
    );

    OutlineInputBorder border(Color color, [double width = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(controlRadius),
          borderSide: BorderSide(color: color, width: width),
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: baseText,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        prefixIconConstraints: const BoxConstraints(minWidth: 42, minHeight: 20),
        suffixIconConstraints: const BoxConstraints(minWidth: 44, minHeight: 44),
        hintStyle: baseText.bodyLarge?.copyWith(color: AppColors.mutedForeground.withValues(alpha: 0.8)),
        prefixIconColor: AppColors.mutedForeground,
        suffixIconColor: AppColors.mutedForeground,
        border: border(AppColors.border),
        enabledBorder: border(AppColors.border),
        focusedBorder: border(AppColors.primary, 1.5),
        errorBorder: border(AppColors.destructive),
        focusedErrorBorder: border(AppColors.destructive, 1.5),
        errorStyle: baseText.bodySmall?.copyWith(color: AppColors.destructive, fontSize: 13.5, height: 1.4),
        errorMaxLines: 2,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(controlRadius)),
          textStyle: baseText.labelLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w500),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: baseText.labelLarge?.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        side: const BorderSide(color: AppColors.border, width: 1.5),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.primary,
        contentTextStyle: baseText.bodyMedium?.copyWith(color: AppColors.onPrimary),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius)),
      ),
    );
  }
}
