import 'package:flutter/material.dart';

class AppBarLayout extends StatelessWidget {
  final Widget child;
  final String title;
  final List<Widget>? actions;
  final bool showNotification;

  const AppBarLayout({
    super.key,
    required this.child,
    this.title = 'Warehouse Pro',
    this.actions,
    this.showNotification = true,
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
          if (showNotification)
            IconButton(
              onPressed: () {},
              icon: const Icon(
                Icons.notifications_none,
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