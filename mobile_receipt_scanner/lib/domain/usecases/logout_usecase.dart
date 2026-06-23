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
