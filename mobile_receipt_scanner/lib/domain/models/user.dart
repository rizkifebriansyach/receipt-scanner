class User {
  final String uid;
  final String email;
  final String? displayName;

  const User({required this.uid, required this.email, this.displayName});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is User &&
          runtimeType == other.runtimeType &&
          uid == other.uid &&
          email == other.email &&
          displayName == other.displayName;

  @override
  int get hashCode => Object.hash(uid, email, displayName);
}
