import 'dart:math';

import 'package:flutter/material.dart';

import '../models/roster.dart';

Future<void> showRandomPickerDialog(BuildContext context, List<Student> students) {
  return showDialog(
    context: context,
    builder: (context) => _RandomPickerDialog(students: students),
  );
}

class _RandomPickerDialog extends StatefulWidget {
  const _RandomPickerDialog({required this.students});
  final List<Student> students;

  @override
  State<_RandomPickerDialog> createState() => _RandomPickerDialogState();
}

class _RandomPickerDialogState extends State<_RandomPickerDialog> {
  final _random = Random();
  late Student _picked;

  @override
  void initState() {
    super.initState();
    _pick();
  }

  void _pick() {
    setState(() => _picked = widget.students[_random.nextInt(widget.students.length)]);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E1B4B),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.casino, color: Color(0xFF14B8A6), size: 40),
            const SizedBox(height: 12),
            Text(
              _picked.name,
              style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(onPressed: _pick, child: const Text('اختيار آخر')),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('إغلاق'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
