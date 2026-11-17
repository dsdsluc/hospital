import 'package:flutter/material.dart';

/// Nền phần đầu trang của app bệnh nhân: ảnh sảnh bệnh viện + lớp phủ xanh đậm (cùng tông panel
/// thương hiệu bên web) để chữ trắng phía trên luôn dễ đọc. [child] vẽ đè lên trên.
class HeroBackground extends StatelessWidget {
  const HeroBackground({super.key, required this.child, this.alignment = const Alignment(0.9, -0.2)});

  final Widget child;

  /// Ảnh rất ngang → mặc định lệch khung sang phải để thấy bác sĩ và bệnh nhân.
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset('assets/images/login_hero.jpg', fit: BoxFit.cover, alignment: alignment),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xB3062D29), Color(0x80062D29), Color(0xF2062D29)],
              stops: [0, 0.45, 1],
            ),
          ),
        ),
        child,
      ],
    );
  }
}
