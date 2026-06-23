// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format width=80

// **************************************************************************
// InjectableConfigGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:get_it/get_it.dart' as _i174;
import 'package:injectable/injectable.dart' as _i526;

import 'data/datasources/auth_remote_datasource.dart' as _i127;
import 'data/repositories/auth_repository_impl.dart' as _i145;
import 'domain/repositories/auth_repository.dart' as _i716;
import 'domain/usecases/google_sign_in_usecase.dart' as _i501;
import 'domain/usecases/login_usecase.dart' as _i883;
import 'domain/usecases/logout_usecase.dart' as _i808;
import 'domain/usecases/register_usecase.dart' as _i784;

extension GetItInjectableX on _i174.GetIt {
  // initializes the registration of main-scope dependencies inside of GetIt
  _i174.GetIt init({
    String? environment,
    _i526.EnvironmentFilter? environmentFilter,
  }) {
    final gh = _i526.GetItHelper(this, environment, environmentFilter);
    gh.lazySingleton<_i127.AuthRemoteDataSource>(
      () => _i127.AuthRemoteDataSource(),
    );
    gh.lazySingleton<_i716.AuthRepository>(
      () => _i145.AuthRepositoryImpl(gh<_i127.AuthRemoteDataSource>()),
    );
    gh.factory<_i501.GoogleSignInUseCase>(
      () => _i501.GoogleSignInUseCase(gh<_i716.AuthRepository>()),
    );
    gh.factory<_i883.LoginUseCase>(
      () => _i883.LoginUseCase(gh<_i716.AuthRepository>()),
    );
    gh.factory<_i808.LogoutUseCase>(
      () => _i808.LogoutUseCase(gh<_i716.AuthRepository>()),
    );
    gh.factory<_i784.RegisterUseCase>(
      () => _i784.RegisterUseCase(gh<_i716.AuthRepository>()),
    );
    return this;
  }
}
