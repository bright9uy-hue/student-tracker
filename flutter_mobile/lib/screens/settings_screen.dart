import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/teacher_settings.dart';
import '../services/app_state.dart';

/// Minimal for now (Phase 0) - just enough to unblock report headers
/// later (Phase 3). A school logo/letterhead upload is added then, once
/// report generation actually needs it.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _teacherNameController;
  late final TextEditingController _schoolNameController;

  @override
  void initState() {
    super.initState();
    final settings = context.read<AppState>().teacherSettings;
    _teacherNameController = TextEditingController(text: settings.teacherName);
    _schoolNameController = TextEditingController(text: settings.schoolName);
  }

  @override
  void dispose() {
    _teacherNameController.dispose();
    _schoolNameController.dispose();
    super.dispose();
  }

  void _save() {
    context.read<AppState>().updateTeacherSettings(TeacherSettings(
          teacherName: _teacherNameController.text.trim(),
          schoolName: _schoolNameController.text.trim(),
        ));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم الحفظ.')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('اسم المعلم', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(controller: _teacherNameController),
          const SizedBox(height: 16),
          const Text('اسم المدرسة', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(controller: _schoolNameController),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _save, child: const Text('حفظ')),
        ],
      ),
    );
  }
}
