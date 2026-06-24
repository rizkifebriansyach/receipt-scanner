import 'package:dartz/dartz.dart';
import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:firebase_core/firebase_core.dart';
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
      return const Left(AuthFailure('Google sign-in was cancelled.'));
    } on AuthPlatformException catch (e) {
      return Left(AuthFailure(e.message));
    } catch (_) {
      return const Left(AuthFailure('Google sign-in failed. Please try again.'));
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
    } on FirebaseException catch (e) {
      return Left(AuthFailure(_remoteDataSource.mapFirebaseError(e.code)));
    } catch (_) {
      return const Left(AuthFailure('Something went wrong. Please try again.'));
    }
  }
}
