import 'package:flutter/material.dart';

import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: ColorScheme.light(
          primary: AppColors.grapePurple,
          onPrimary: Colors.white,
          secondary: AppColors.hotPink,
          onSecondary: Colors.white,
          tertiary: AppColors.electricBlue,
          surface: AppColors.surface,
          onSurface: AppColors.textPrimary,
          error: AppColors.error,
          onError: Colors.white,
          outline: AppColors.border,
        ),
        scaffoldBackgroundColor: AppColors.background,
        dividerColor: AppColors.border,
      );

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.dark(
          primary: AppColors.grapePurple,
          onPrimary: Colors.white,
          secondary: AppColors.hotPink,
          onSecondary: Colors.white,
          tertiary: AppColors.electricBlue,
          surface: AppColors.darkSurface,
          onSurface: AppColors.darkTextPrimary,
          error: AppColors.error,
          onError: Colors.white,
          outline: AppColors.border,
        ),
        scaffoldBackgroundColor: AppColors.darkBackground,
        dividerColor: AppColors.border,
      );
}
