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
