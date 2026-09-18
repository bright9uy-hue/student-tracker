import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/roster.dart';
import '../models/scoring.dart';
import '../services/app_state.dart';

/// A simple per-class overview: average score, pass-rate breakdown, and
/// students ranked by total - reuses the exact same scoring.dart functions
/// the grading screen's per-row badge already uses, so this can never
/// disagree with what the teacher sees while grading.
class ClassStatsScreen extends StatelessWidget {
  const ClassStatsScreen({super.key, required this.classId});
  final String classId;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    SchoolClass? cls;
    for (final c in state.roster.classes) {
      if (c.id == classId) cls = c;
    }
    if (cls == null) {
      return const Scaffold(body: SizedBox.shrink());
    }

    final subjectId = state.activeSubjectId ?? '';
    final periodId = state.roster.activePeriodId ?? 'period-1';
    final ranked = cls.students
        .map((s) => (student: s, total: getStudentTotal(s, state.roster, cls!, subjectId, periodId)))
        .toList()
      ..sort((a, b) => b.total.compareTo(a.total));

    final excellent = ranked.where((r) => getStudentStatus(r.total) == 'excellent').length;
    final pass = ranked.where((r) => getStudentStatus(r.total) == 'pass').length;
    final fail = ranked.where((r) => getStudentStatus(r.total) == 'fail').length;
    final average = ranked.isEmpty ? 0.0 : ranked.map((r) => r.total).reduce((a, b) => a + b) / ranked.length;

    return Scaffold(
      appBar: AppBar(title: Text('إحصائيات ${cls.name}')),
      body: ranked.isEmpty
          ? const Center(child: Text('لا يوجد طلاب في هذا الفصل.', style: TextStyle(color: Colors.white70)))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(child: _StatCard(label: 'المعدل العام', value: average.toStringAsFixed(1))),
                    const SizedBox(width: 10),
                    Expanded(child: _StatCard(label: 'عدد الطلاب', value: '${ranked.length}')),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _StatCard(label: 'ممتاز', value: '$excellent', color: const Color(0xFF10B981))),
                    const SizedBox(width: 10),
                    Expanded(child: _StatCard(label: 'ناجح', value: '$pass', color: const Color(0xFFF59E0B))),
                    const SizedBox(width: 10),
                    Expanded(child: _StatCard(label: 'متعثر', value: '$fail', color: const Color(0xFFEF4444))),
                  ],
                ),
                const SizedBox(height: 20),
                const Text('ترتيب الطلاب', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 10),
                for (var i = 0; i < ranked.length; i++)
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        SizedBox(width: 28, child: Text('${i + 1}', style: const TextStyle(color: Colors.white54))),
                        Expanded(
                          child: Text(ranked[i].student.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                        ),
                        Text('${ranked[i].total}', style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(color: color ?? Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12)),
        ],
      ),
    );
  }
}
