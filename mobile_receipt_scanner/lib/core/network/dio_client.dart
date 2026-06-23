import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

class DioClient {
  final Dio _dio;
  final FirebaseAuth _firebaseAuth;

  DioClient({
    FirebaseAuth? firebaseAuth,
    String baseUrl = 'http://10.0.2.2:3000',
  })  : _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance,
        _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
          headers: {'Content-Type': 'application/json'},
        )) {
    _dio.interceptors.add(_AuthInterceptor(_firebaseAuth, _dio));
  }

  Dio get dio => _dio;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParams}) {
    return _dio.get<T>(path, queryParameters: queryParams);
  }

  Future<Response<T>> post<T>(String path, {dynamic data}) {
    return _dio.post<T>(path, data: data);
  }

  Future<Response<T>> patch<T>(String path, {dynamic data}) {
    return _dio.patch<T>(path, data: data);
  }
}

class _AuthInterceptor extends Interceptor {
  final FirebaseAuth _firebaseAuth;
  final Dio _dio;

  _AuthInterceptor(this._firebaseAuth, this._dio);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final user = _firebaseAuth.currentUser;
    if (user != null) {
      try {
        final token = await user.getIdToken();
        options.headers['Authorization'] = 'Bearer $token';
      } catch (_) {
        // No token available, proceed without auth header
      }
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      final user = _firebaseAuth.currentUser;
      if (user != null) {
        try {
          await user.getIdToken(true);
          final response = await _dio.fetch(err.requestOptions);
          handler.resolve(response);
          return;
        } catch (_) {
          // Token refresh failed, propagate the 401
        }
      }
    }
    handler.next(err);
  }
}
