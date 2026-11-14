import 'package:flutter/material.dart';

class Destination {
  const Destination(this.key, this.title, this.icon, {this.max = false});
  final String key, title;
  final IconData icon;
  final bool max;
}
