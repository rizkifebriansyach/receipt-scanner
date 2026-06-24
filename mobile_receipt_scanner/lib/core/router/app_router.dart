import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../presentation/bloc/auth/auth_bloc.dart';
import '../../presentation/bloc/auth/auth_state.dart';
import '../../presentation/pages/auth/login/login_page.dart';
import '../../presentation/pages/auth/register/register_page.dart';
import '../../presentation/pages/dashboard/dashboard_page.dart';
import '../../presentation/pages/telegram_linked/telegram_linked_page.dart';

class AppRouter {
  static const home = '/';
  static const login = '/login';
  static const register = '/register';
  static const dashboard = '/dashboard';
  static const telegramLinked = '/telegram-linked';

  static GoRouter createRouter(AuthBloc authBloc) {
    return GoRouter(
      initialLocation: dashboard,
      refreshListenable: _GoRouterAuthNotifier(authBloc),
      redirect: (context, state) {
        final authState = authBloc.state;
        final isAuthRoute =
            state.matchedLocation == login || state.matchedLocation == register;

        if (authState is Authenticated && isAuthRoute) {
          return home;
        }
        if (authState is Unauthenticated && state.matchedLocation == home) {
          return login;
        }
        return null;
      },
      routes: [
        GoRoute(
          path: telegramLinked,
          builder: (context, state) => const TelegramLinkedPage(),
        ),
        GoRoute(
          path: dashboard,
          builder: (context, state) => const DashboardPage(),
        ),
        GoRoute(path: login, builder: (context, state) => const LoginPage()),
        GoRoute(
          path: register,
          builder: (context, state) => const RegisterPage(),
        ),
      ],
    );
  }
}

class _GoRouterAuthNotifier extends ChangeNotifier {
  final AuthBloc _authBloc;
  late final StreamSubscription<AuthState> _subscription;

  _GoRouterAuthNotifier(this._authBloc) {
    _subscription = _authBloc.stream.listen((_) => notifyListeners());
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
