import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Primary
  static const Color grapePurple = Color(0xFF7C3AED);
  static const Color hotPink = Color(0xFFEC4899);

  // Secondary
  static const Color electricBlue = Color(0xFF3B82F6);
  static const Color sunshineYellow = Color(0xFFFBBF24);
  static const Color mintGreen = Color(0xFF34D399);

  // Neutral — Light
  static const Color background = Color(0xFFF8F7FF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color textPrimary = Color(0xFF1E1B4B);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color border = Color(0xFFE5E7EB);

  // Neutral — Dark
  static const Color darkBackground = Color(0xFF0F0E1A);
  static const Color darkSurface = Color(0xFF1A1826);
  static const Color darkTextPrimary = Color(0xFFF1F0F5);
  static const Color darkTextSecondary = Color(0xFF9CA3AF);

  // Status
  static const Color needsReview = Color(0xFFF59E0B);
  static const Color confirmed = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);

  // Gradients — CSS 135deg maps to Alignment.topLeft → Alignment.bottomRight
  static const List<Color> primaryGradientColors = [grapePurple, hotPink];
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: primaryGradientColors,
  );

  // Dark gradient uses lighter variants per PRD section 7
  static const List<Color> darkGradientColors = [
    Color(0xFF8B5CF6),
    Color(0xFFF472B6),
  ];
  static const LinearGradient darkGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: darkGradientColors,
  );
}
