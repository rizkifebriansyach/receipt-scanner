# Clean Architecture Auth Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor AuthBloc to follow Clean Architecture — BLoC depends on UseCases, which depend on Repository interface, implemented by Data layer.

**Architecture:** Domain layer defines entities, failures, repository interface, and use cases (pure Dart). Data layer implements repository and wraps Firebase Auth. Presentation layer BLoC injects use cases via injectable DI.

**Tech Stack:** Flutter, Firebase Auth, Google Sign-In, flutter_bloc, dartz, injectable

---

### Task 1: Create AuthFailure

**Files:**
- Create: `mobile_receipt_scanner/lib/domain/failures/auth_failure.dart`

- [ ] **Step 1: Create AuthFailure class**

Create `mobile_receipt_scanner/lib/domain/failures/auth_failure.dart`:

```dart
class AuthFailure {
  final String message;

  const AuthFailure(this.message);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthFailure &&
          runtimeType == other.runtimeType &&
          message == other.message;

  @override
  int get hashCode => message.hashCode;
}
```

- [ ] **Step 2: Verify**

Run: `cd mobile_receipt_scanner && flutter analyze lib/domain/failures/auth_failure.dart`
Expected: No issues

- [ ] **Step 3: Commit**

```bash
git add mobile_receipt_scanner/lib/domain/failures/auth_failure.dart
git commit -m "feat: add AuthFailure for domain error handling"
```

---

### Task 2: Create AuthRepository interface

**Files:**
- Create: `mobile_receipt_scanner/lib/domain/repositories/auth_repository.dart`

- [ ] **Step 1: Create AuthRepository abstract class**

Create `mobile_receipt_scanner/lib/domain/repositories/auth_repository.dart`:

```dart
import 'package:dartz/dartz.dart';

import '../entities/user.dart';
import '../failures/auth_failure.dart';

abstract class AuthRepository {
  Future<Either<AuthFailure, User>> login({
    required String email,
    required String password,
  });

  Future<Either<AuthFailure, User>> register({
    required String email,
    required String password,
    required String displayName,
  });

  Future<Either<AuthFailure, User>> googleSignIn();

  Future<Either<AuthFailure, void>> logout();

  Future<User?> getCurrentUser();
}
```

Notes:
- `dartz` already in pubspec.yaml
- `logout` returns `Either<AuthFailure, void>` since there's no user to return
- `getCurrentUser` returns `User?` directly (sync check, no network — uses Firebase local persistence)

- [ ] **Step 2: Verify**

Run: `cd mobile_receipt_scanner && flutter analyze lib/domain/repositories/auth_repository.dart`
Expected: No issues

- [ ] **Step 3: Commit**

```bash
git add mobile_receipt_scanner/lib/domain/repositories/auth_repository.dart
git commit -m "feat: add AuthRepository abstract class (domain layer)"
```

---

### Task 3: Create UseCase base class

**Files:**
- Create: `mobile_receipt_scanner/lib/domain/usecases/usecase.dart`

- [ ] **Step 1: Create UseCase base class**

Create `mobile_receipt_scanner/lib/domain/usecases/usecase.dart`:

```dart
import 'package:dartz/dartz.dart';

import '../failures/auth_failure.dart';

abstract class UseCase<Type, Params> {
  Future<Either<AuthFailure, Type>> call(Params params);
}

class NoParams {
  const NoParams();
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile_receipt_scanner/lib/domain/usecases/usecase.dart
git commit -m "feat: add UseCase base class and NoParams"
```

---

### Task 4: Create LoginUseCase

**Files:**
- Create: `mobile_receipt_scanner/lib/domain/usecases/login_usecase.dart`

- [ ] **Step 1: Create LoginUseCase**

Create `mobile_receipt_scanner/lib/domain/usecases/login_usecase.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../entities/user.dart';
import '../failures/auth_failure.dart';
import '../repositories/auth_repository.dart';
import 'usecase.dart';

class LoginParams {
  final String email;
  final String password;

  const LoginParams({required this.email, required this.password});
}

@injectable
class LoginUseCase extends UseCase<User, LoginParams> {
  final AuthRepository repository;

  LoginUseCase(this.repository);

  @override
  Future<Either<AuthFailure, User>> call(LoginParams params) {
    return repository.login(email: params.email, password: params.password);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile_receipt_scanner/lib/domain/usecases/login_usecase.dart
git commit -m "feat: add LoginUseCase"
```

---

### Task 5: Create RegisterUseCase

**Files:**
- Create: `mobile_receipt_scanner/lib/domain/usecases/register_usecase.dart`

- [ ] **Step 1: Create RegisterUseCase**

Create `mobile_receipt_scanner/lib/domain/usecases/register_usecase.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../entities/user.dart';
import '../failures/auth_failure.dart';
import '../repositories/auth_repository.dart';
import 'usecase.dart';

class RegisterParams {
  final String email;
  final String password;
  final String displayName;

  const RegisterParams({
    required this.email,
    required this.password,
    required this.displayName,
  });
}

@injectable
class RegisterUseCase extends UseCase<User, RegisterParams> {
  final AuthRepository repository;

  RegisterUseCase(this.repository);

  @override
  Future<Either<AuthFailure, User>> call(RegisterParams params) {
    return repository.register(
      email: params.email,
      password: params.password,
      displayName: params.displayName,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile_receipt_scanner/lib/domain/usecases/register_usecase.dart
git commit -m "feat: add RegisterUseCase"
```

---

### Task 6: Create GoogleSignInUseCase

**Files:**
- Create: `mobile_receipt_scanner/lib/domain/usecases/google_sign_in_usecase.dart`

- [ ] **Step 1: Create GoogleSignInUseCase**

Create `mobile_receipt_scanner/lib/domain/usecases/google_sign_in_usecase.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../entities/user.dart';
import '../failures/auth_failure.dart';
import '../repositories/auth_repository.dart';
import 'usecase.dart';

@injectable
class GoogleSignInUseCase extends UseCase<User, NoParams> {
  final AuthRepository repository;

  GoogleSignInUseCase(this.repository);

  @override
  Future<Either<AuthFailure, User>> call(NoParams params) {
    return repository.googleSignIn();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile_receipt_scanner/lib/domain/usecases/google_sign_in_usecase.dart
git commit -m "feat: add GoogleSignInUseCase"
```

---

### Task 7: Create LogoutUseCase

**Files:**
- Create: `mobile_receipt_scanner/lib/domain/usecases/logout_usecase.dart`

- [ ] **Step 1: Create LogoutUseCase**

Create `mobile_receipt_scanner/lib/domain/usecases/logout_usecase.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../failures/auth_failure.dart';
import '../repositories/auth_repository.dart';
import 'usecase.dart';

@injectable
class LogoutUseCase extends UseCase<void, NoParams> {
  final AuthRepository repository;

  LogoutUseCase(this.repository);

  @override
  Future<Either<AuthFailure, void>> call(NoParams params) {
    return repository.logout();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile_receipt_scanner/lib/domain/usecases/logout_usecase.dart
git commit -m "feat: add LogoutUseCase"
```

---

### Task 8: Create AuthRemoteDataSource

**Files:**
- Create: `mobile_receipt_scanner/lib/data/datasources/auth_remote_datasource.dart`

- [ ] **Step 1: Create AuthRemoteDataSource**

Create `mobile_receipt_scanner/lib/data/datasources/auth_remote_datasource.dart`:

```dart
import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:injectable/injectable.dart';

import '../../domain/entities/user.dart';

@lazySingleton
class AuthRemoteDataSource {
  final firebase_auth.FirebaseAuth _firebaseAuth;
  final GoogleSignIn _googleSignIn;

  AuthRemoteDataSource()
      : _firebaseAuth = firebase_auth.FirebaseAuth.instance,
        _googleSignIn = GoogleSignIn();

  Future<User> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final credential = await _firebaseAuth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
    await credential.user?.updateDisplayName(displayName);
    return _mapFirebaseUser(credential.user!);
  }

  Future<User> login({
    required String email,
    required String password,
  }) async {
    final credential = await _firebaseAuth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    return _mapFirebaseUser(credential.user!);
  }

  Future<User> googleSignIn() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) {
      throw AuthCancelledException();
    }
    final googleAuth = await googleUser.authentication;
    final credential = firebase_auth.GoogleAuthProvider.credential(
      idToken: googleAuth.idToken,
      accessToken: googleAuth.accessToken,
    );
    final userCredential = await _firebaseAuth.signInWithCredential(credential);
    return _mapFirebaseUser(userCredential.user!);
  }

  Future<void> logout() async {
    await _firebaseAuth.signOut();
    await _googleSignIn.signOut();
  }

  User? getCurrentUser() {
    final firebaseUser = _firebaseAuth.currentUser;
    if (firebaseUser == null) return null;
    return _mapFirebaseUser(firebaseUser);
  }

  String mapFirebaseError(String code) {
    switch (code) {
      case 'email-already-in-use':
        return 'Email is already registered.';
      case 'invalid-email':
        return 'Invalid email address.';
      case 'weak-password':
        return 'Password is too weak (min 6 characters).';
      case 'user-not-found':
        return 'No account found with this email.';
      case 'wrong-password':
        return 'Wrong password.';
      case 'invalid-credential':
        return 'Invalid email or password.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }

  User _mapFirebaseUser(firebase_auth.User firebaseUser) {
    return User(
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName,
    );
  }
}

class AuthCancelledException implements Exception {}
```

Notes:
- `AuthCancelledException` is a custom exception for when user cancels Google Sign-In (not a Firebase error)
- `mapFirebaseError` is public so `AuthRepositoryImpl` can use it for error mapping

- [ ] **Step 2: Verify**

Run: `cd mobile_receipt_scanner && flutter analyze lib/data/datasources/auth_remote_datasource.dart`
Expected: No issues

- [ ] **Step 3: Commit**

```bash
git add mobile_receipt_scanner/lib/data/datasources/auth_remote_datasource.dart
git commit -m "feat: add AuthRemoteDataSource wrapping Firebase Auth"
```

---

### Task 9: Create AuthRepositoryImpl

**Files:**
- Create: `mobile_receipt_scanner/lib/data/repositories/auth_repository_impl.dart`

- [ ] **Step 1: Create AuthRepositoryImpl**

Create `mobile_receipt_scanner/lib/data/repositories/auth_repository_impl.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:injectable/injectable.dart';

import '../../domain/entities/user.dart';
import '../../domain/failures/auth_failure.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

@LazySingleton(as: AuthRepository)
class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;

  AuthRepositoryImpl(this._remoteDataSource);

  @override
  Future<Either<AuthFailure, User>> login({
    required String email,
    required String password,
  }) async {
    return _catchFirebaseErrors(() async {
      return await _remoteDataSource.login(email: email, password: password);
    });
  }

  @override
  Future<Either<AuthFailure, User>> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    return _catchFirebaseErrors(() async {
      return await _remoteDataSource.register(
        email: email,
        password: password,
        displayName: displayName,
      );
    });
  }

  @override
  Future<Either<AuthFailure, User>> googleSignIn() async {
    try {
      final user = await _remoteDataSource.googleSignIn();
      return Right(user);
    } on AuthCancelledException {
      // User cancelled — not an error, just unauthenticated
      // BLoC will handle this by emitting Unauthenticated
      return const Left(AuthFailure('Google sign-in was cancelled.'));
    } catch (e) {
      return const Left(AuthFailure('Google sign-in failed.'));
    }
  }

  @override
  Future<Either<AuthFailure, void>> logout() async {
    try {
      await _remoteDataSource.logout();
      return const Right(null);
    } catch (_) {
      return const Left(AuthFailure('Logout failed.'));
    }
  }

  @override
  Future<User?> getCurrentUser() async {
    return _remoteDataSource.getCurrentUser();
  }

  Future<Either<AuthFailure, User>> _catchFirebaseErrors(
    Future<User> Function() fn,
  ) async {
    try {
      final user = await fn();
      return Right(user);
    } on firebase_auth.FirebaseAuthException catch (e) {
      return Left(AuthFailure(_remoteDataSource.mapFirebaseError(e.code)));
    } catch (_) {
      return const Left(AuthFailure('Authentication failed.'));
    }
  }
}
```

Notes:
- `@LazySingleton(as: AuthRepository)` binds the impl to the abstract interface for injectable
- `_catchFirebaseErrors` is a helper to avoid repeating try/catch in every method
- `AuthCancelledException` from `AuthRemoteDataSource` is handled specially in `googleSignIn`

- [ ] **Step 2: Verify**

Run: `cd mobile_receipt_scanner && flutter analyze lib/data/repositories/auth_repository_impl.dart`
Expected: No issues

- [ ] **Step 3: Commit**

```bash
git add mobile_receipt_scanner/lib/data/repositories/auth_repository_impl.dart
git commit -m "feat: add AuthRepositoryImpl with Firebase error handling"
```

---

### Task 10: Add get_it dependency + Create injection setup

**Files:**
- Modify: `mobile_receipt_scanner/pubspec.yaml`
- Create: `mobile_receipt_scanner/lib/injection.dart`

- [ ] **Step 1: Add get_it to pubspec.yaml**

In `pubspec.yaml`, under `dependencies`, add after `injectable` line:
```yaml
  get_it: ^8.0.3
```

Run: `cd mobile_receipt_scanner && flutter pub get`

- [ ] **Step 2: Create injection.dart (getIt setup)**

Create `mobile_receipt_scanner/lib/injection.dart`:

```dart
import 'package:get_it/get_it.dart';
import 'package:injectable/injectable.dart';

import 'injection.config.dart';

final getIt = GetIt.instance;

@InjectableInit(preferRelativeImports: true)
Future<void> configureDependencies() async => getIt.init();
```

Note: `injection.config.dart` will be generated by `build_runner` in the next step.

- [ ] **Step 2: Run build_runner to generate injectable config**

Run: `cd mobile_receipt_scanner && dart run build_runner build --delete-conflicting-outputs`
Expected: Generated files appear, no errors. `injection.config.dart` is created.

- [ ] **Step 3: Add generated file to git**

Run: `cd mobile_receipt_scanner && git add lib/injection.config.dart && git status`

- [ ] **Step 4: Commit**

```bash
git add mobile_receipt_scanner/lib/injection.dart mobile_receipt_scanner/lib/injection.config.dart
git commit -m "feat: add injectable DI setup with generated registration"
```

---

### Task 11: Refactor AuthBloc to use UseCases

**Files:**
- Modify: `mobile_receipt_scanner/lib/presentation/bloc/auth/auth_bloc.dart`

- [ ] **Step 1: Replace AuthBloc to use UseCases**

Replace the entire content of `auth_bloc.dart` with:

```dart
import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/user.dart';
import '../../../domain/failures/auth_failure.dart';
import '../../../domain/usecases/google_sign_in_usecase.dart';
import '../../../domain/usecases/login_usecase.dart';
import '../../../domain/usecases/logout_usecase.dart';
import '../../../domain/usecases/register_usecase.dart';
import '../../../domain/usecases/usecase.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final LoginUseCase _loginUseCase;
  final RegisterUseCase _registerUseCase;
  final GoogleSignInUseCase _googleSignInUseCase;
  final LogoutUseCase _logoutUseCase;

  AuthBloc({
    required LoginUseCase loginUseCase,
    required RegisterUseCase registerUseCase,
    required GoogleSignInUseCase googleSignInUseCase,
    required LogoutUseCase logoutUseCase,
  })  : _loginUseCase = loginUseCase,
        _registerUseCase = registerUseCase,
        _googleSignInUseCase = googleSignInUseCase,
        _logoutUseCase = logoutUseCase,
        super(const AuthInitial()) {
    on<AuthStatusChanged>(_onStatusChanged);
    on<AuthRegisterRequested>(_onRegisterRequested);
    on<AuthLoginRequested>(_onLoginRequested);
    on<AuthGoogleSignInRequested>(_onGoogleSignInRequested);
    on<AuthLogoutRequested>(_onLogoutRequested);
  }

  void _onStatusChanged(AuthStatusChanged event, Emitter<AuthState> emit) {
    if (event.user != null) {
      emit(Authenticated(event.user!));
    } else {
      emit(const Unauthenticated());
    }
  }

  Future<void> _onRegisterRequested(
    AuthRegisterRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await _registerUseCase(
      RegisterParams(
        email: event.email,
        password: event.password,
        displayName: event.displayName,
      ),
    );
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (user) => emit(Authenticated(user)),
    );
  }

  Future<void> _onLoginRequested(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await _loginUseCase(
      LoginParams(
        email: event.email,
        password: event.password,
      ),
    );
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (user) => emit(Authenticated(user)),
    );
  }

  Future<void> _onGoogleSignInRequested(
    AuthGoogleSignInRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await _googleSignInUseCase(const NoParams());
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (user) => emit(Authenticated(user)),
    );
  }

  Future<void> _onLogoutRequested(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await _logoutUseCase(const NoParams());
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (_) => emit(const Unauthenticated()),
    );
  }
}
```

Key changes:
- No more `firebase_auth` or `google_sign_in` imports
- Constructor takes UseCases instead of Firebase instances
- Error handling uses `Either.fold()` instead of try/catch
- `RegisterParams` and `LoginParams` imported from their use case files

- [ ] **Step 2: Verify**

Run: `cd mobile_receipt_scanner && flutter analyze lib/presentation/bloc/auth/auth_bloc.dart`
Expected: No issues

- [ ] **Step 3: Commit**

```bash
git add mobile_receipt_scanner/lib/presentation/bloc/auth/auth_bloc.dart
git commit -m "refactor: AuthBloc uses UseCases instead of direct Firebase calls"
```

---

### Task 12: Update main.dart to use injectable DI

**Files:**
- Modify: `mobile_receipt_scanner/lib/main.dart`

- [ ] **Step 1: Update main.dart to configure DI and resolve AuthBloc**

Replace the entire content of `main.dart` with:

```dart
import 'package:firebase_auth/firebase_auth.dart' hide User;
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'domain/entities/user.dart';
import 'domain/usecases/usecase.dart';
import 'injection.dart';
import 'presentation/bloc/auth/auth_bloc.dart';
import 'presentation/bloc/auth/auth_event.dart';
import 'core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await configureDependencies();

  final authBloc = getIt<AuthBloc>();

  FirebaseAuth.instance.authStateChanges().listen((firebaseUser) {
    if (firebaseUser != null) {
      authBloc.add(AuthStatusChanged(
        User(
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName,
        ),
      ));
    } else {
      authBloc.add(const AuthStatusChanged(null));
    }
  });

  runApp(MyApp(authBloc: authBloc));
}

class MyApp extends StatelessWidget {
  final AuthBloc authBloc;

  const MyApp({super.key, required this.authBloc});

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: authBloc,
      child: MaterialApp.router(
        title: 'Receipt Scanner',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
          scaffoldBackgroundColor: const Color(0xffEDE0FF),
        ),
        routerConfig: AppRouter.createRouter(authBloc),
      ),
    );
  }
}
```

Key changes:
- `configureDependencies()` called after Firebase init
- `AuthBloc` resolved via `getIt<AuthBloc>()` instead of `AuthBloc()`
- `AuthBloc` needs to be registered as injectable — add `@injectable` to it (handled in Task 11, or add here if needed)

- [ ] **Step 2: Add @injectable to AuthBloc**

In `auth_bloc.dart`, add `import 'package:injectable/injectable.dart';` and add `@injectable` annotation above the class:

```dart
@injectable
class AuthBloc extends Bloc<AuthEvent, AuthState> {
```

Then re-run build_runner:
Run: `cd mobile_receipt_scanner && dart run build_runner build --delete-conflicting-outputs`

- [ ] **Step 3: Verify full project**

Run: `cd mobile_receipt_scanner && flutter analyze`
Expected: No errors (pre-existing deprecation warning is acceptable)

- [ ] **Step 4: Commit all**

```bash
git add mobile_receipt_scanner/lib/main.dart mobile_receipt_scanner/lib/presentation/bloc/auth/auth_bloc.dart mobile_receipt_scanner/lib/injection.config.dart
git commit -m "refactor: use injectable DI for AuthBloc resolution in main.dart"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full flutter analyze**

Run: `cd mobile_receipt_scanner && flutter analyze`
Expected: 0 errors (only pre-existing deprecation warning acceptable)

- [ ] **Step 2: Verify no Firebase imports in BLoC**

Run: `grep -r "firebase_auth\|google_sign_in" mobile_receipt_scanner/lib/presentation/bloc/auth/`
Expected: No output (Firebase only referenced in data layer)

- [ ] **Step 3: Verify dependency flow**

Run: `grep -r "import.*data" mobile_receipt_scanner/lib/domain/`
Expected: No output (domain has zero imports from data layer)

Run: `grep -r "import.*presentation" mobile_receipt_scanner/lib/domain/ mobile_receipt_scanner/lib/data/`
Expected: No output (domain/data don't depend on presentation)
