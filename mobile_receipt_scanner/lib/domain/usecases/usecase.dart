import 'package:dartz/dartz.dart';

import '../failures/auth_failure.dart';

abstract class UseCase<T, Params> {
  Future<Either<AuthFailure, T>> call(Params params);
}

class NoParams {
  const NoParams();
}
