import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_app_flutter/features/auth/presentation/pages/login_page.dart';

void main() {
  Widget app() => const ProviderScope(child: MaterialApp(home: LoginPage()));

  testWidgets('hiển thị màn hình đăng nhập', (tester) async {
    await tester.pumpWidget(app());

    expect(find.text('Chào mừng trở lại'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Mật khẩu'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Đăng nhập'), findsOneWidget);
  });

  testWidgets('báo lỗi khi email / mật khẩu không hợp lệ', (tester) async {
    await tester.pumpWidget(app());

    await tester.tap(find.widgetWithText(FilledButton, 'Đăng nhập'));
    await tester.pump();

    expect(find.text('Vui lòng nhập email hợp lệ.'), findsOneWidget);
    expect(find.text('Mật khẩu cần ít nhất 6 ký tự.'), findsOneWidget);
  });
}
