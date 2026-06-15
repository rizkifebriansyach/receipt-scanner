import 'package:flutter/widgets.dart';

extension ResponsiveExtension on BuildContext{
  double get width => MediaQuery.of(this).size.width;

  bool get isMobile => width < 600;

  bool get isTablet => width >= 600 &&  width < 1024;

  bool get isDekstop => width >= 1024;
}