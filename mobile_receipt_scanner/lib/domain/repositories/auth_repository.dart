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
