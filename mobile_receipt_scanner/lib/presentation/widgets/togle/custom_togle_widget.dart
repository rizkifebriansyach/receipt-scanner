import 'package:flutter/material.dart';

class ConnectionToggle extends StatefulWidget {
  const ConnectionToggle({super.key});

  @override
  State<ConnectionToggle> createState() => _ConnectionToggleState();
}

class _ConnectionToggleState extends State<ConnectionToggle> {
  bool isConnected = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(2),
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFFE9E2EF),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(
              alpha: 0.1,
            ), // Shadow color with opacity
            spreadRadius: 4, // Extent to which the box inflates before blur
            blurRadius: 10, // Haziness/softness of the shadow edges
            offset: const Offset(0, 4), // Shadow position displacement (x, y)
          ),
        ],
      ),
      child: Stack(
        children: [
          AnimatedAlign(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            alignment: isConnected
                ? Alignment.centerRight
                : Alignment.centerLeft,
            child: Container(
              width: MediaQuery.of(context).size.width * 0.42,
              margin: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(.05),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
            ),
          ),

          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      isConnected = false;
                    });
                  },
                  child: Center(
                    child: Text(
                      'Not Connected',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: isConnected
                            ? const Color(0xFF4F4A5E)
                            : const Color(0xFF6128E3),
                      ),
                    ),
                  ),
                ),
              ),

              Expanded(
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      isConnected = true;
                    });
                  },
                  child: Center(
                    child: Text(
                      'Connected',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: isConnected
                            ? const Color(0xFF6128E3)
                            : const Color(0xFF4F4A5E),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
