import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/roster.dart';
import '../services/app_state.dart';
import '../widgets/simple_dialogs.dart';

class GroupsScreen extends StatefulWidget {
  const GroupsScreen({super.key, required this.classId});
  final String classId;

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  int _groupCount = 2;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    SchoolClass? cls;
    for (final c in state.roster.classes) {
      if (c.id == widget.classId) cls = c;
    }
    if (cls == null) return const Scaffold(body: SizedBox.shrink());

    final groups = state.groupsFor(widget.classId);
    final studentById = {for (final s in cls.students) s.id: s};

    return Scaffold(
      appBar: AppBar(
        title: Text('مجموعات ${cls.name}'),
        actions: [
          if (groups.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              tooltip: 'مسح المجموعات',
              onPressed: () async {
                final ok = await confirmDelete(context, 'مسح كل المجموعات الحالية؟');
                if (!context.mounted) return;
                if (ok) context.read<AppState>().clearGroups(widget.classId);
              },
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Text('عدد المجموعات:', style: TextStyle(color: Colors.white70)),
                const SizedBox(width: 12),
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline),
                  onPressed: _groupCount > 2 ? () => setState(() => _groupCount--) : null,
                ),
                Text('$_groupCount', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline),
                  onPressed: cls.students.isEmpty || _groupCount >= cls.students.length
                      ? null
                      : () => setState(() => _groupCount++),
                ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: cls.students.isEmpty
                      ? null
                      : () => context.read<AppState>().autoDistributeGroups(widget.classId, _groupCount),
                  icon: const Icon(Icons.shuffle, size: 18),
                  label: const Text('توزيع عشوائي'),
                ),
              ],
            ),
          ),
          Expanded(
            child: groups.isEmpty
                ? const Center(
                    child: Text('لا يوجد مجموعات بعد — اختر العدد واضغط "توزيع عشوائي".',
                        style: TextStyle(color: Colors.white70), textAlign: TextAlign.center),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: groups.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final group = groups[i];
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(group.name,
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.edit, size: 18, color: Colors.white54),
                                  onPressed: () async {
                                    final name = await promptForName(context, title: 'إعادة تسمية المجموعة', initial: group.name);
                                    if (!context.mounted) return;
                                    if (name != null && name.trim().isNotEmpty) {
                                      context.read<AppState>().renameGroup(widget.classId, group.id, name);
                                    }
                                  },
                                ),
                              ],
                            ),
                            const Divider(color: Colors.white12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: group.studentIds
                                  .map((id) => studentById[id])
                                  .whereType<Student>()
                                  .map((s) => Chip(
                                        label: Text(s.name),
                                        backgroundColor: const Color(0xFF0F172A),
                                        labelStyle: const TextStyle(color: Colors.white70),
                                      ))
                                  .toList(),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
