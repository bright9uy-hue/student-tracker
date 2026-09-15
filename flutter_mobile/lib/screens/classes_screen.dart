import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/app_state.dart';
import '../widgets/sync_status_chip.dart';

class ClassesScreen extends StatelessWidget {
  const ClassesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('الفصول الدراسية'),
        actions: const [Padding(padding: EdgeInsets.only(left: 12), child: SyncStatusChip())],
      ),
      body: state.roster.classes.isEmpty
          ? const Center(
              child: Text('لا يوجد فصول في هذي النسخة بعد.', style: TextStyle(color: Colors.white70)),
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
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              cls.name,
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                          Text('${cls.students.length} طالب', style: const TextStyle(color: Colors.white54)),
                          const SizedBox(width: 8),
                          const Icon(Icons.chevron_left, color: Colors.white38),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
