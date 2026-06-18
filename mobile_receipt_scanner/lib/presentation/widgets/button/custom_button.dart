import 'package:flutter/material.dart';

enum ButtonVariant { primary, secondary, outline, ghost }
enum ButtonSize { small, medium, large }

class AppButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;

  final ButtonVariant variant;
  final ButtonSize size;

  final bool isLoading;
  final bool fullWidth;
  final IconData? icon;
  final double? iconSpacing;
  final Color? textColor;
  final Color? backgroundColor;
  final Gradient? gradient;

  const AppButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.variant = ButtonVariant.primary,
    this.size = ButtonSize.medium,
    this.isLoading = false,
    this.fullWidth = true,
    this.icon,
    this.iconSpacing = 8,
    this.textColor,
    this.backgroundColor,
    this.gradient,
  });

  bool get _isEnabled => onPressed != null && !isLoading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final style = _ButtonStyle.from(context, variant, _isEnabled);
    final dimension = _ButtonDimension.from(size);

    return SizedBox(
      width: fullWidth ? double.infinity : null,
      height: dimension.height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(dimension.radius),
          color: gradient == null ?(backgroundColor ??style.backgroundColor) : null,
          border: style.border == BorderSide.none ? null : Border.fromBorderSide(style.border),

        ),
        child:ElevatedButton(
        onPressed: _isEnabled ? onPressed : null,
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: backgroundColor ?? style.backgroundColor,
          foregroundColor: textColor ?? style.foregroundColor,
          shadowColor: Colors.transparent,
          padding: dimension.padding,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(dimension.radius),
            side: style.border,
          ),
        ),
        child: _buildContent(theme),
      ),
      )
    );
  }

  Widget _buildContent(ThemeData theme) {
    if (isLoading) {
      return SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: theme.colorScheme.onPrimary,
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        child,
        if (icon != null) ...[
          SizedBox(width: iconSpacing),
          Icon(icon, size: 18),
        ],
      ],
    );
  }
}

class _ButtonStyle {
  final Color backgroundColor;
  final Color foregroundColor;
  final BorderSide border;

  _ButtonStyle({
    required this.backgroundColor,
    required this.foregroundColor,
    required this.border,
  });

  factory _ButtonStyle.from(
      BuildContext context,
      ButtonVariant variant,
      bool enabled,
      ) {
    final theme = Theme.of(context);

    switch (variant) {
      case ButtonVariant.primary:
        return _ButtonStyle(
          backgroundColor:
              enabled ? theme.colorScheme.primary : Colors.grey.shade300,
          foregroundColor: Colors.white,
          border: BorderSide.none,
        );

      case ButtonVariant.secondary:
        return _ButtonStyle(
          backgroundColor: theme.colorScheme.secondary,
          foregroundColor: Colors.white,
          border: BorderSide.none,
        );

      case ButtonVariant.outline:
        return _ButtonStyle(
          backgroundColor: Colors.transparent,
          foregroundColor: theme.colorScheme.primary,
          border: BorderSide(color: theme.colorScheme.primary),
        );

      case ButtonVariant.ghost:
        return _ButtonStyle(
          backgroundColor: Colors.transparent,
          foregroundColor: theme.colorScheme.primary,
          border: BorderSide.none,
        );
    }
  }
}

class _ButtonDimension {
  final double height;
  final EdgeInsets padding;
  final double radius;

  _ButtonDimension({
    required this.height,
    required this.padding,
    required this.radius,
  });

  factory _ButtonDimension.from(ButtonSize size) {
    switch (size) {
      case ButtonSize.small:
        return _ButtonDimension(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          radius: 6,
        );

      case ButtonSize.medium:
        return _ButtonDimension(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          radius: 8,
        );

      case ButtonSize.large:
        return _ButtonDimension(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          radius: 10,
        );
    }
  }
}