import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/app_state.dart';
import '../widgets/simple_dialogs.dart';
import 'settings_screen.dart';

class ClassesScreen extends StatelessWidget {
  const ClassesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('الفصول الدراسية'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'الإعدادات',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      body: state.roster.classes.isEmpty
          ? const Center(
              child: Text('لا يوجد فصول بعد — اضغط + لإضافة أول فصل.', style: TextStyle(color: Colors.white70)),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: state.roster.classes.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final cls = state.roster.classes[i];
                return Material(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => context.read<AppState>().selectClass(cls.id),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              cls.name,
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                          Text('${cls.students.length} طالب', style: const TextStyle(color: Colors.white54)),
                          PopupMenuButton<String>(
                            icon: const Icon(Icons.more_vert, color: Colors.white38),
                            onSelected: (value) async {
                              final appState = context.read<AppState>();
                              if (value == 'rename') {
                                final name = await promptForName(context, title: 'إعادة تسمية الفصل', initial: cls.name);
                                if (name != null && name.trim().isNotEmpty) appState.renameClass(cls.id, name);
                              } else if (value == 'delete') {
                                final ok = await confirmDelete(context, 'حذف فصل "${cls.name}" وكل طلابه؟');
                                if (ok) appState.deleteClass(cls.id);
                              }
                            },
                            itemBuilder: (context) => const [
                              PopupMenuItem(value: 'rename', child: Text('إعادة تسمية')),
                              PopupMenuItem(value: 'delete', child: Text('حذف')),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final name = await promptForName(context, title: 'اسم الفصل الجديد');
          if (!context.mounted) return;
          if (name != null && name.trim().isNotEmpty) {
            context.read<AppState>().addClass(name);
          }
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
