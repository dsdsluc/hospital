import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/patient/presentation/pages/account_page.dart';
import '../../features/patient/presentation/pages/appointments_page.dart';
import '../../features/patient/presentation/pages/invoice_page.dart';
import '../../features/patient/presentation/pages/overview_page.dart';
import '../../features/patient/presentation/pages/visit_detail_page.dart';
import '../../features/patient/presentation/pages/visits_page.dart';
import '../../features/patient/presentation/patient_shell.dart';
import '../storage/token_storage.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return GoRouter(
    initialLocation: '/login',
    // Đã có token (duy trì đăng nhập) thì bỏ qua màn hình đăng nhập; chưa có thì về /login.
    redirect: (context, state) async {
      final token = await tokenStorage.readAccessToken();
      final loggedIn = token != null && token.isNotEmpty;
      final atLogin = state.matchedLocation == '/login';
      if (!loggedIn && !atLogin) return '/login';
      if (loggedIn && atLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      // App bệnh nhân: 4 tab, mỗi tab giữ trạng thái riêng.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => PatientShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/', builder: (context, state) => const OverviewPage())]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/appointments',
              builder: (context, state) => const AppointmentsPage(),
              // Lịch sử đặt lịch: trang riêng, vẫn nằm trong tab Lịch khám (giữ thanh điều hướng dưới).
              routes: [GoRoute(path: 'history', builder: (context, state) => const AppointmentHistoryPage())],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/visits',
              builder: (context, state) => const VisitsPage(),
              routes: [
                GoRoute(
                  path: ':visitId',
                  builder: (context, state) => VisitDetailPage(visitId: state.pathParameters['visitId']!),
                  routes: [GoRoute(path: 'invoice', builder: (context, state) => InvoicePage(visitId: state.pathParameters['visitId']!))],
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/account', builder: (context, state) => const AccountPage())]),
        ],
      ),
    ],
  );
});
