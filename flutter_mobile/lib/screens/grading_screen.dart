import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/grading_category.dart';
import '../models/roster.dart';
import '../models/scoring.dart';
import '../services/app_state.dart';
import '../widgets/reason_dialog.dart';
import '../widgets/simple_dialogs.dart';

class GradingScreen extends StatefulWidget {
  const GradingScreen({super.key});

  @override
  State<GradingScreen> createState() => _GradingScreenState();
}

class _GradingScreenState extends State<GradingScreen> {
  String? _activeCatId;
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cls = state.activeClass;
    final categories = state.activeCategories;

    if (cls == null) {
      // Roster changed under us (e.g. class deleted on the laptop) —
      // bounce back to the class list instead of showing a blank screen.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<AppState>().goToClasses();
      });
      return const Scaffold(body: SizedBox.shrink());
    }

    if (_activeCatId == null || !categories.any((c) => c.id == _activeCatId)) {
      _activeCatId = categories.isNotEmpty ? categories.first.id : null;
    }
    GradingCategory? activeCat;
    for (final c in categories) {
      if (c.id == _activeCatId) activeCat = c;
    }

    final query = _searchQuery.trim();
    final displayedStudents = query.isEmpty
        ? cls.students
        : cls.students.where((s) => s.name.toLowerCase().contains(query.toLowerCase())).toList();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward),
          onPressed: () => context.read<AppState>().goToClasses(),
        ),
        title: Text(cls.name, style: const TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1),
            tooltip: 'إضافة طالب',
            onPressed: () async {
              final name = await promptForName(context, title: 'اسم الطالب الجديد');
              if (name != null && name.trim().isNotEmpty) {
                context.read<AppState>().addStudent(cls.id, name);
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: TextField(
              onChanged: (v) => setState(() => _searchQuery = v),
              decoration: const InputDecoration(
                hintText: 'ابحث باسم الطالب...',
                prefixIcon: Icon(Icons.search, size: 20),
                isDense: true,
              ),
            ),
          ),
          _SubjectManagementRow(subjects: state.roster.subjects, activeSubjectId: state.activeSubjectId),
          if (categories.isNotEmpty)
            _ChipRow<GradingCategory>(
              items: categories,
              labelOf: (c) => c.name,
              idOf: (c) => c.id,
              activeId: _activeCatId,
              activeColor: const Color(0xFF6366F1),
              onSelected: (c) => setState(() => _activeCatId = c.id),
            ),
          Expanded(
            child: activeCat == null
                ? const Center(
                    child: Text('لا يوجد بنود تقييم لهذي المادة.', style: TextStyle(color: Colors.white70)))
                : displayedStudents.isEmpty
                    ? const Center(
                        child: Text('لا يوجد طلاب مطابقون.', style: TextStyle(color: Colors.white70)))
                    : _StudentList(
                        cls: cls,
                        students: displayedStudents,
                        activeCat: activeCat,
                        categories: categories,
                      ),
          ),
        ],
      ),
    );
  }
}

class _ChipRow<T> extends StatelessWidget {
  const _ChipRow({
    required this.items,
    required this.labelOf,
    required this.idOf,
    required this.activeId,
    required this.activeColor,
    required this.onSelected,
    super.key,
  });

  final List<T> items;
  final String Function(T) labelOf;
  final String Function(T) idOf;
  final String? activeId;
  final Color activeColor;
  final void Function(T) onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final item = items[i];
          final active = idOf(item) == activeId;
          return ChoiceChip(
            label: Text(labelOf(item)),
            selected: active,
            onSelected: (_) => onSelected(item),
            selectedColor: activeColor,
            backgroundColor: const Color(0xFF1E293B),
            labelStyle: TextStyle(color: active ? Colors.white : Colors.white70),
          );
        },
      ),
    );
  }
}

/// A subject is more than just a filter tab here (unlike categories) — it's
/// something the teacher creates/renames/deletes, so unlike the generic
/// _ChipRow above, each chip needs a long-press management menu and there's
/// a trailing "+" to add a new subject. Always shown (even with a single
/// subject) so "add a subject" stays reachable.
class _SubjectManagementRow extends StatelessWidget {
  const _SubjectManagementRow({required this.subjects, required this.activeSubjectId});
  final List<Subject> subjects;
  final String? activeSubjectId;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        itemCount: subjects.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          if (i == subjects.length) {
            return InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () async {
                final name = await promptForName(context, title: 'اسم المادة الجديدة');
                if (name != null && name.trim().isNotEmpty) {
                  context.read<AppState>().addSubject(name);
                }
              },
              child: const CircleAvatar(
                radius: 18,
                backgroundColor: Color(0xFF1E293B),
                child: Icon(Icons.add, color: Colors.white70, size: 18),
              ),
            );
          }
          final subject = subjects[i];
          final active = subject.id == activeSubjectId;
          return InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => context.read<AppState>().switchSubject(subject.id),
            onLongPress: () async {
              final appState = context.read<AppState>();
              final action = await showModalBottomSheet<String>(
                context: context,
                backgroundColor: const Color(0xFF1E1B4B),
                builder: (context) => SafeArea(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ListTile(
                        leading: const Icon(Icons.edit, color: Colors.white70),
                        title: const Text('إعادة تسمية', style: TextStyle(color: Colors.white)),
                        onTap: () => Navigator.pop(context, 'rename'),
                      ),
                      if (subjects.length > 1)
                        ListTile(
                          leading: const Icon(Icons.delete, color: Color(0xFFEF4444)),
                          title: const Text('حذف المادة', style: TextStyle(color: Color(0xFFEF4444))),
                          onTap: () => Navigator.pop(context, 'delete'),
                        ),
                    ],
                  ),
                ),
              );
              if (action == 'rename') {
                final name = await promptForName(context, title: 'إعادة تسمية المادة', initial: subject.name);
                if (name != null && name.trim().isNotEmpty) appState.renameSubject(subject.id, name);
              } else if (action == 'delete') {
                final ok = await confirmDelete(context, 'حذف مادة "${subject.name}" وكل درجاتها؟');
                if (ok) appState.deleteSubject(subject.id);
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: active ? const Color(0xFF14B8A6) : const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
              ),
              alignment: Alignment.center,
              child: Text(
                subject.name,
                style: TextStyle(color: active ? Colors.white : Colors.white70, fontWeight: FontWeight.w600),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _StudentList extends StatelessWidget {
  const _StudentList({
    required this.cls,
    required this.students,
    required this.activeCat,
    required this.categories,
  });
  final SchoolClass cls;
  // The (possibly search-filtered) students to actually display — `cls`
  // itself is still passed through to _StudentRow/scoring unfiltered,
  // since given-ratio scoring (assignments/activities) needs the WHOLE
  // class to compute "how many slots have been given so far", not just
  // whichever students the search happens to match.
  final List<Student> students;
  final GradingCategory activeCat;
  final List<GradingCategory> categories;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: students.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final student = students[i];
        return _StudentRow(student: student, cls: cls, activeCat: activeCat, categories: categories, state: state);
      },
    );
  }
}

class _StudentRow extends StatelessWidget {
  const _StudentRow({
    required this.student,
    required this.cls,
    required this.activeCat,
    required this.categories,
    required this.state,
  });

  final Student student;
  final SchoolClass cls;
  final GradingCategory activeCat;
  final List<GradingCategory> categories;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final periodId = state.roster.activePeriodId ?? 'period-1';
    final total = getStudentTotal(student, state.roster, cls, state.activeSubjectId ?? '', periodId);
    final status = getStudentStatus(total);
    final badge = getStatusBadgeInfo(status);
    final badgeColor = Color(0xFF000000 | badge.color);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  student.name,
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.15),
                  border: Border.all(color: badgeColor.withOpacity(0.35)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('$total', style: TextStyle(color: badgeColor, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
              PopupMenuButton<String>(
                padding: EdgeInsets.zero,
                icon: const Icon(Icons.more_vert, color: Colors.white38, size: 20),
                onSelected: (value) async {
                  final appState = context.read<AppState>();
                  if (value == 'rename') {
                    final name = await promptForName(context, title: 'إعادة تسمية الطالب', initial: student.name);
                    if (name != null && name.trim().isNotEmpty) {
                      appState.renameStudent(cls.id, student.id, name);
                    }
                  } else if (value == 'delete') {
                    final ok = await confirmDelete(context, 'حذف الطالب "${student.name}"؟');
                    if (ok) appState.deleteStudent(cls.id, student.id);
                  } else if (value.startsWith('transfer:')) {
                    appState.transferStudent(student.id, cls.id, value.substring('transfer:'.length));
                  }
                },
                itemBuilder: (context) {
                  final otherClasses = state.roster.classes.where((c) => c.id != cls.id).toList();
                  return [
                    const PopupMenuItem(value: 'rename', child: Text('إعادة تسمية')),
                    if (otherClasses.isNotEmpty)
                      PopupMenuItem(
                        enabled: false,
                        height: 28,
                        child: Text('نقل إلى فصل آخر', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                      ),
                    for (final other in otherClasses)
                      PopupMenuItem(value: 'transfer:${other.id}', child: Text(other.name)),
                    const PopupMenuItem(value: 'delete', child: Text('حذف', style: TextStyle(color: Color(0xFFEF4444)))),
                  ];
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (activeCat.type == 'numeric')
            _NumericField(student: student, cat: activeCat, state: state)
          else
            _DotGroup(student: student, cat: activeCat, state: state),
        ],
      ),
    );
  }
}

class _NumericField extends StatefulWidget {
  const _NumericField({required this.student, required this.cat, required this.state});
  final Student student;
  final GradingCategory cat;
  final AppState state;

  @override
  State<_NumericField> createState() => _NumericFieldState();
}

class _NumericFieldState extends State<_NumericField> {
  late TextEditingController _controller;
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _currentValue().toString());
  }

  double _currentValue() {
    final g = widget.state.gradesFor(widget.student);
    final v = g[widget.cat.id];
    return (v is num) ? v.toDouble() : (double.tryParse('$v') ?? 0);
  }

  @override
  void didUpdateWidget(covariant _NumericField oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Never overwrite text the teacher is actively typing (e.g. a
    // background sync completing mid-keystroke would otherwise yank the
    // cursor and discard what they'd typed so far).
    if (_focusNode.hasFocus) return;
    final current = _currentValue().toString();
    if (_controller.text != current) _controller.text = current;
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submit() {
    final val = double.tryParse(_controller.text) ?? 0;
    context.read<AppState>().onNumericChange(widget.student, widget.cat, val);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 110,
      child: TextField(
        controller: _controller,
        focusNode: _focusNode,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        textAlign: TextAlign.center,
        onSubmitted: (_) => _submit(),
        onEditingComplete: _submit,
        onTapOutside: (_) => _submit(),
        decoration: InputDecoration(hintText: 'من ${widget.cat.max.toStringAsFixed(0)}'),
      ),
    );
  }
}

class _DotGroup extends StatelessWidget {
  const _DotGroup({required this.student, required this.cat, required this.state});
  final Student student;
  final GradingCategory cat;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final g = state.gradesFor(student);
    final isAssign = isAssignmentsCategory(cat);
    final isActivity = isActivitiesCategory(cat);
    final count = (isAssign || isActivity) ? cat.max.round() : (cat.dotsCount ?? cat.max.round());
    final arr = g[cat.id] is List ? (g[cat.id] as List) : const [];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: List.generate(count, (i) {
        final value = i < arr.length ? arr[i] : false;
        final visual = getDotVisual(value, isAssign, i, isActivity);
        final isParticipation = cat.type == 'participation';
        return Tooltip(
          message: isParticipation
              ? '${visual.tip} — اضغط مطولًا لتسجيل سبب خصم'
              : visual.tip,
          child: InkWell(
            key: ValueKey('dot_${student.id}_${cat.id}_$i'),
            borderRadius: BorderRadius.circular(17),
            onTap: () => context.read<AppState>().onDotClick(student, cat, i),
            // Participation only: long-press always opens the reason
            // picker regardless of the dot's current state, per the
            // teacher's request — a plain tap never opens it anymore
            // (see AppState.onDotClick).
            onLongPress: isParticipation
                ? () async {
                    final appState = context.read<AppState>();
                    final reason = await showReasonDialog(context);
                    if (reason != null) {
                      appState.applyParticipationReason(student, cat, i, reason);
                    }
                  }
                : null,
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _dotColor(visual.state),
                border: Border.all(color: Colors.white24),
              ),
            ),
          ),
        );
      }),
    );
  }

  Color _dotColor(String state) {
    switch (state) {
      case 'checked':
        return const Color(0xFF14B8A6);
      case 'deduction':
        return const Color(0xFFEF4444);
      default:
        return Colors.white.withOpacity(0.08);
    }
  }
}
