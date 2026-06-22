import 'package:flutter/material.dart';
import 'package:mobile_receipt_scanner/presentation/pages/telegram_linked/telegram_linked_page.dart';

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
      theme: ThemeData(
        colorScheme: .fromSeed(seedColor: Colors.deepPurple),
        scaffoldBackgroundColor: Color(0xffEDE0FF),
      ),
      home: TelegramLinkedPage(),
    );
  }
}
