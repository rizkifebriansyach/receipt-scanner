class AuthFailure {
  final String message;

  const AuthFailure(this.message);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthFailure &&
          runtimeType == other.runtimeType &&
          message == other.message;

  @override
  int get hashCode => message.hashCode;
}
