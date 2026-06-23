import 'package:dartz/dartz.dart';

import '../failures/auth_failure.dart';

abstract class UseCase<Type, Params> {
  Future<Either<AuthFailure, Type>> call(Params params);
}

class NoParams {
  const NoParams();
}
