import 'package:flutter/material.dart';

enum TextFieldSize { small, medium, large }

class AppTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? errorText;
  final IconData? prefixIcon;
  final IconData? suffixIcon;
  final VoidCallback? onSuffixIconTap;
  final bool obscureText;
  final bool enabled;
  final int maxLines;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final FocusNode? focusNode;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;

  final TextFieldSize size;

  const AppTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.errorText,
    this.prefixIcon,
    this.suffixIcon,
    this.onSuffixIconTap,
    this.obscureText = false,
    this.enabled = true,
    this.maxLines = 1,
    this.keyboardType,
    this.validator,
    this.onChanged,
    this.onTap,
    this.focusNode,
    this.textInputAction,
    this.onFieldSubmitted,
    this.size = TextFieldSize.medium,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dimension = _TextFieldDimension.from(size);

    return TextFormField(
        controller: controller,
        obscureText: obscureText,
        enabled: enabled,
        maxLines: maxLines,
        keyboardType: keyboardType,
        validator: validator,
        onChanged: onChanged,
        onTap: onTap,
        focusNode: focusNode,
        textInputAction: textInputAction,
        onFieldSubmitted: onFieldSubmitted,
        style: theme.textTheme.bodyMedium,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          errorText: errorText,
          filled: true,
          fillColor: enabled
              ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5)
              : theme.disabledColor.withValues(alpha: 0.1),
          prefixIcon: prefixIcon != null
              ? Icon(prefixIcon, size: 20, color: theme.colorScheme.onSurfaceVariant)
              : null,
          suffixIcon: suffixIcon != null
              ? GestureDetector(
                  onTap: onSuffixIconTap,
                  child: Icon(suffixIcon, size: 20, color: theme.colorScheme.onSurfaceVariant),
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(dimension.radius),
            borderSide: BorderSide(color: theme.colorScheme.outline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(dimension.radius),
            borderSide: BorderSide(color: theme.colorScheme.outline.withValues(alpha: 0.5)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(dimension.radius),
            borderSide: BorderSide(color: theme.colorScheme.primary, width: 1.5),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(dimension.radius),
            borderSide: BorderSide(color: theme.colorScheme.error),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(dimension.radius),
            borderSide: BorderSide(color: theme.colorScheme.error, width: 1.5),
          ),
          contentPadding: dimension.padding,
          isDense: true,
        ),
    );
  }
}

class AppPasswordField extends StatefulWidget {
  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? errorText;
  final IconData? prefixIcon;
  final bool enabled;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final FocusNode? focusNode;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;

  final TextFieldSize size;

  const AppPasswordField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.errorText,
    this.prefixIcon = Icons.lock_outline,
    this.enabled = true,
    this.validator,
    this.onChanged,
    this.focusNode,
    this.textInputAction,
    this.onFieldSubmitted,
    this.size = TextFieldSize.medium,
  });

  @override
  State<AppPasswordField> createState() => _AppPasswordFieldState();
}

class _AppPasswordFieldState extends State<AppPasswordField> {
  bool _obscureText = true;

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      controller: widget.controller,
      label: widget.label,
      hint: widget.hint,
      errorText: widget.errorText,
      prefixIcon: widget.prefixIcon,
      enabled: widget.enabled,
      obscureText: _obscureText,
      validator: widget.validator,
      onChanged: widget.onChanged,
      focusNode: widget.focusNode,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: widget.onFieldSubmitted,
      size: widget.size,
      suffixIcon: _obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
      onSuffixIconTap: () => setState(() => _obscureText = !_obscureText),
    );
  }
}

class _TextFieldDimension {
  final double height;
  final EdgeInsets padding;
  final double radius;

  _TextFieldDimension({
    required this.height,
    required this.padding,
    required this.radius,
  });

  factory _TextFieldDimension.from(TextFieldSize size) {
    switch (size) {
      case TextFieldSize.small:
        return _TextFieldDimension(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          radius: 6,
        );
      case TextFieldSize.medium:
        return _TextFieldDimension(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          radius: 8,
        );
      case TextFieldSize.large:
        return _TextFieldDimension(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          radius: 10,
        );
    }
  }
}
