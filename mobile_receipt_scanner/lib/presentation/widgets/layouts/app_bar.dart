import 'package:flutter/material.dart';

class AppBarLayout extends StatelessWidget {
  final Widget child;
  final String title;
  final List<Widget>? actions;
  final bool search;
  final Color textColor;

  const AppBarLayout({
    super.key,
    required this.child,
    this.title = 'Scanner',
    this.actions,
    this.search = true,
    this.textColor = Colors.black,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        centerTitle: true,
        title: Text(
          title,
          style: TextStyle(fontWeight: FontWeight.bold, color: textColor),
        ),
        actions: [
          if (search)
            IconButton(onPressed: () {}, icon: const Icon(Icons.search, color: Colors.deepPurple,)),

          ...?actions,

          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(child: child),
    );
  }
}
