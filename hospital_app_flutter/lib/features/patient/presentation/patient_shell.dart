import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';

/// Khung app bệnh nhân: thanh tab dưới (Tổng quan · Lịch khám · Hồ sơ khám · Tài khoản).
class PatientShell extends StatelessWidget {
  const PatientShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: AppColors.primary.withValues(alpha: 0.12),
          surfaceTintColor: Colors.transparent,
          labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
                fontSize: 12,
                fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
                color: states.contains(WidgetState.selected) ? AppColors.primary : AppColors.mutedForeground,
              )),
          iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(size: 22, color: states.contains(WidgetState.selected) ? AppColors.primary : AppColors.mutedForeground)),
        ),
        child: DecoratedBox(
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
          child: NavigationBar(
            height: 66,
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: (index) => navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Tổng quan'),
              NavigationDestination(icon: Icon(Icons.event_outlined), selectedIcon: Icon(Icons.event_rounded), label: 'Lịch khám'),
              NavigationDestination(icon: Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment_rounded), label: 'Hồ sơ khám'),
              NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Tài khoản'),
            ],
          ),
        ),
      ),
    );
  }
}
