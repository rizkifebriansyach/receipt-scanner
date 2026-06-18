import 'package:flutter/material.dart';

import 'presentation/pages/auth/register_page.dart';
import 'presentation/pages/on_boarding/on_boarding_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(colorScheme: .fromSeed(seedColor: Colors.deepPurple)),
      home: RegisterPage(),
    );
  }
}
