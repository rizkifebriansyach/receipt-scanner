import 'package:flutter/material.dart';

class AppBarLayout extends StatelessWidget {
  final Widget child;
  final String title;
  final List<Widget>? actions;
  final bool search;

  const AppBarLayout({
    super.key,
    required this.child,
    this.title = 'Scanner',
    this.actions,
    this.search = true,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        centerTitle: true,
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          if (search)
            IconButton(
              onPressed: () {},
              icon: const Icon(
                Icons.search,
              ),
            ),

          ...?actions,

          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: child,
      ),
    );
  }
}