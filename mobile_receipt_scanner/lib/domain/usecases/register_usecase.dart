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
