# Clean Architecture Auth Refactor Design

## Problem
AuthBloc langsung memanggil Firebase Auth SDK, melanggar Clean Architecture. Presentation layer bergantung pada infrastruktur.

## Goal
Refactor auth flow ke Clean Architecture: UseCase → Repository (interface) → RepositoryImpl → RemoteDataSource.

## Architecture

```
Presentation Layer
  AuthBloc → inject UseCases via constructor
      ↓
Domain Layer (pure Dart, no Flutter/Firebase dependency)
  entities/     → User (sudah ada)
  failures/     → AuthFailure
  repositories/  → AuthRepository (abstract class)
  usecases/      → LoginUseCase, RegisterUseCase, GoogleSignInUseCase, LogoutUseCase
      ↓
Data Layer (depends on Firebase)
  datasources/   → AuthRemoteDataSource (wrap FirebaseAuth + GoogleSignIn)
  repositories/  → AuthRepositoryImpl (implements AuthRepository, @injectable)
```

## Dependency Flow

AuthBloc → LoginUseCase → AuthRepository → AuthRepositoryImpl → AuthRemoteDataSource → FirebaseAuth

Setiap layer hanya bergantung pada interface layer di bawahnya. BLoC tidak tahu Firebase ada.

## Components

### Domain Layer

| File | Tanggung Jawab |
|---|---|
| `domain/entities/user.dart` | Sudah ada — tidak berubah |
| `domain/failures/auth_failure.dart` | Kelas error untuk `Either<AuthFailure, User>` |
| `domain/repositories/auth_repository.dart` | Abstract class: `login()`, `register()`, `googleSignIn()`, `logout()`, `getCurrentUser()` |
| `domain/usecases/usecase.dart` | Base class untuk semua use cases |
| `domain/usecases/login_usecase.dart` | Wrap repository.login(), return Either |
| `domain/usecases/register_usecase.dart` | Wrap repository.register(), return Either |
| `domain/usecases/google_sign_in_usecase.dart` | Wrap repository.googleSignIn(), return Either |
| `domain/usecases/logout_usecase.dart` | Wrap repository.logout(), return Either |

### Data Layer

| File | Tanggung Jawab |
|---|---|
| `data/datasources/auth_remote_datasource.dart` | Wrap FirebaseAuth + GoogleSignIn, return User entity |
| `data/repositories/auth_repository_impl.dart` | Implement AuthRepository, inject AuthRemoteDataSource, @injectable |

### Presentation Layer (refactor)

| File | Perubahan |
|---|---|
| `presentation/bloc/auth/auth_bloc.dart` | Inject UseCases via constructor, bukan langsung Firebase |

## Error Handling

Pakai `dartz` `Either<AuthFailure, User>`:

```dart
class AuthFailure {
  final String message;
  const AuthFailure(this.message);
}
```

Firebase error codes di-mapping ke message di `AuthRemoteDataSource`.

## UseCase Pattern

```dart
abstract class UseCase<Type, Params> {
  Future<Either<AuthFailure, Type>> call(Params params);
}
```

Setiap UseCase implement base class ini, inject AuthRepository.

## Injectable DI

- `AuthRemoteDataSource` → `@injectable` (singleton)
- `AuthRepositoryImpl` → `@injectable(as: AuthRepository)` → bind ke interface
- UseCases → `@injectable` (singleton)
- AuthBloc → `@injectable` atau manual (karena di main.dart)

Generate dengan: `dart run build_runner build --delete-conflicting-outputs`

## main.dart Changes

- AuthBloc tetap di-create di main.dart (bukan injectable)
- UseCases dan repository di-resolve via `getIt` (injectable)

## Scope

- Refactor auth flow ke Clean Architecture
- Tambah injectable DI
- Tidak termasuk: fitur baru, backend integration, test
