import 'package:flutter/material.dart';

import '../../widgets/button/custom_button.dart';
import '../../widgets/textfield/custom_textfield.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Container(
            width: double.infinity,
            height: 355,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
              ),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(40),
                bottomRight: Radius.circular(40),
              ),
            ),
          ),
          SafeArea(
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Icon(Icons.document_scanner, size: 100, color: Colors.white),
                  const SizedBox(height: 16),
                  Text(
                    "Receipt Scanner",
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    "Join the funky finance revolution!",
                    style: TextStyle(fontSize: 16, color: Colors.white),
                  ),
                  const SizedBox(height: 32),
                  Container(
                    padding: EdgeInsets.all(16),
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(
                            alpha: 0.1,
                          ), // Shadow color with opacity
                          spreadRadius:
                              4, // Extent to which the box inflates before blur
                          blurRadius:
                              10, // Haziness/softness of the shadow edges
                          offset: const Offset(
                            0,
                            4,
                          ), // Shadow position displacement (x, y)
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Text(
                          "Create Account",
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.purple,
                          ),
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: "Full Name",
                          hint: "Enter your full name",
                          prefixIcon: Icons.person_outline,
                          keyboardType: TextInputType.name,
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: "Email",
                          hint: "Enter your email",
                          prefixIcon: Icons.email_outlined,
                          keyboardType: TextInputType.emailAddress,
                        ),
                        const SizedBox(height: 16),
                        AppPasswordField(
                          label: "Password",
                          hint: "Enter your password",
                          prefixIcon: Icons.lock_outline,
                        ),
                        const SizedBox(height: 16),
                        AppPasswordField(
                          label: "Confirm Password",
                          hint: "Enter your password again",
                          prefixIcon: Icons.lock_reset,
                        ),
                        const SizedBox(height: 24),
                        AppButton(
                          child: Text("Sign Up", style: TextStyle(fontSize: 16)),
                          backgroundColor: Colors.transparent,
                          gradient: LinearGradient(
                            colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          icon: Icons.arrow_forward,
                          onPressed: () {
                            // Handle registration logic here
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
