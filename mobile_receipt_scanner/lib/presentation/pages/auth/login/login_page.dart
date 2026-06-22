import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';

import '../../../widgets/button/custom_button.dart';
import '../../../widgets/textfield/custom_textfield.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<LoginPage> {
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
                colors: [Color(0xFFEC4899),Color(0xFF7C3AED), ],
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
              height: double.infinity,
              padding: EdgeInsets.all(16),
              child: Center(
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
                            "Welcome Back!",
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.purple,
                            ),
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
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TextButton(
                                onPressed: () {
                                  // Navigate to login page
                                },
                                child: Text(
                                  "Forgot Password?",
                                  style: TextStyle(color: Colors.purple),
                                ),
                              ),
                            ],
                          ),
                          AppButton(
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
                            child: Text(
                              "Sign In",
                              style: TextStyle(fontSize: 16),
                            ),
                          ),
                          
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children:[
                              Expanded(
                                child: Divider(
                                  color: Colors.grey,
                                  thickness: 1,
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.only(right:8.0, left: 8.0),
                                child: Text(
                                  "OR",
                                  style: TextStyle(color: Colors.grey,fontWeight: FontWeight.bold),
                                ),
                              ),
                              Expanded(
                                child: Divider(
                                  color: Colors.grey,
                                  thickness: 1,
                                ),
                              ),
                              
                            ]
                          ),
                          const SizedBox(height: 16),
                         SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () {
                                // Handle Google sign-in logic here
                              },
                              icon: SvgPicture.asset(
                                'assets/icon/google_icon.svg',
                                height: 24,
                                width: 24,
                              ),
                              label: Text("Sign in with Google"),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: Colors.black,
                                padding: EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ),
                         ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                      Text("Don't have an account?"),
                      TextButton(
                        onPressed: () {
                          // Navigate to registration page
                        },
                        child: Text(
                          "Sign Up",
                          style: TextStyle(color: Colors.purple, fontWeight: FontWeight.bold,fontSize: 18),
                        ),
                      ),
                    ],)
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
