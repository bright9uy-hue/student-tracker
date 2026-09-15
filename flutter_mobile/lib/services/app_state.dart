// Central state for the standalone app. This used to also drive a sync
// protocol against a laptop's server.js (mobile/js/mobile-sync.js
// equivalent) - that's gone now (see the plan file): the phone is the sole
// source of truth, so this is just local CRUD + local persistence.
import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../models/grading_category.dart';
import '../models/grading_logic.dart';
import '../models/roster.dart';
import '../models/student_group.dart';
import '../models/teacher_settings.dart';
import 'local_store.dart';

enum AppScreen { classes, grading }

class AppState extends ChangeNotifier {
  final LocalStore _localStore = LocalStore();

  Roster roster = Roster();
  TeacherSettings teacherSettings = TeacherSettings();
  String? activeClassId;
  String? activeSubjectId;
  AppScreen currentScreen = AppScreen.classes;
  bool dataLoaded = false;

  Timer? _saveDebounceTimer;

  static const _defaultCategoriesJson = [
    {'id': 'cat_assignments', 'name': 'الواجبات', 'max': 20, 'type': 'dots'},
    {'id': 'cat_participation', 'name': 'المشاركة والتفاعل', 'max': 10, 'type': 'participation'},
    {'id': 'cat_research', 'name': 'البحث والمشاريع', 'max': 10, 'type': 'dots'},
    {'id': 'cat_practical', 'name': 'الاختبار العملي', 'max': 40, 'type': 'numeric'},
    {'id': 'cat_exam', 'name': 'الاختبار النهائي', 'max': 20, 'type': 'numeric'},
  ];

  SchoolClass? get activeClass {
    for (final c in roster.classes) {
      if (c.id == activeClassId) return c;
    }
    return null;
  }

  Subject? get activeSubject {
    for (final s in roster.subjects) {
      if (s.id == activeSubjectId) return s;
    }
    return null;
  }

  List<GradingCategory> get activeCategories {
    if (activeSubjectId == null) return [];
    return getActiveSubjectGradingCategories(roster, activeSubjectId);
  }

  Future<void> init() async {
    final rosterJson = await _localStore.getRoster();
    final settingsJson = await _localStore.getTeacherSettings();
    if (settingsJson != null) teacherSettings = TeacherSettings.fromJson(settingsJson);

    if (rosterJson == null) {
      // Fresh install: seed one subject with the standard default grading
      // categories so grading is immediately usable without an extra
      // "set up a subject first" step - matches the desktop app seeding
      // its own default subject on first run (js/store.js's loadData).
      roster = Roster(
        subjects: [
          Subject(
            id: 'subject-1',
            name: 'المادة',
            gradingCategories: _defaultCategoriesJson
                .map((c) => GradingCategory.fromJson(Map<String, dynamic>.from(c)))
                .toList(),
          ),
        ],
        periods: [
          {'id': 'period-1', 'name': 'الفترة الأولى'},
        ],
        activePeriodId: 'period-1',
        defaultGradingCategories:
            _defaultCategoriesJson.map((c) => GradingCategory.fromJson(Map<String, dynamic>.from(c))).toList(),
      );
      activeSubjectId = roster.subjects.first.id;
    } else {
      _applyRoster(rosterJson);
    }

    dataLoaded = true;
    notifyListeners();
  }

  void _applyRoster(Map<String, dynamic> rosterJson) {
    final defaults = (rosterJson['defaultGradingCategories'] as List?) ?? _defaultCategoriesJson;
    roster = Roster.fromJson({
      ...rosterJson,
      if (rosterJson['defaultGradingCategories'] == null) 'defaultGradingCategories': defaults,
    });

    if (!roster.classes.any((c) => c.id == activeClassId)) {
      activeClassId = (rosterJson['activeClassId'] as String?) ??
          (roster.classes.isNotEmpty ? roster.classes.first.id : null);
    }
    if (!roster.subjects.any((s) => s.id == activeSubjectId)) {
      activeSubjectId = (rosterJson['activeSubjectId'] as String?) ??
          (roster.subjects.isNotEmpty ? roster.subjects.first.id : null);
    }

    // Warm up every student/subject's grade object now so normalization
    // (array resizing etc.) happens once up front rather than looking like
    // a real edit the first time a grading screen reads it.
    for (final cls in roster.classes) {
      for (final student in cls.students) {
        for (final subj in roster.subjects) {
          getStudentSubjectGrades(student, roster, subj.id, roster.activePeriodId ?? 'period-1');
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Save path: debounce a burst of edits (grading taps, CRUD actions) into
  // one persist pass. No more diff-and-queue - there's nowhere to sync a
  // diff to, so this just writes the whole roster.
  // ------------------------------------------------------------
  void saveData() {
    _saveDebounceTimer?.cancel();
    _saveDebounceTimer = Timer(const Duration(milliseconds: 300), _performSave);
  }

  Future<void> flushPendingSave() async {
    if (_saveDebounceTimer != null) {
      _saveDebounceTimer!.cancel();
      _saveDebounceTimer = null;
      await _performSave();
    }
  }

  Future<void> _performSave() async {
    await _localStore.setRoster({
      'classes': roster.classes.map((c) => c.toJson()).toList(),
      'activeClassId': activeClassId,
      'subjects': roster.subjects.map((s) => s.toJson()).toList(),
      'activeSubjectId': activeSubjectId,
      'periods': roster.periods,
      'activePeriodId': roster.activePeriodId,
      'defaultGradingCategories': roster.defaultGradingCategories.map((c) => c.toJson()).toList(),
    });
  }

  Future<void> updateTeacherSettings(TeacherSettings settings) async {
    teacherSettings = settings;
    await _localStore.setTeacherSettings(settings.toJson());
    notifyListeners();
  }

  // ------------------------------------------------------------
  // Class / student / subject CRUD - previously all came ready-made from
  // the laptop's roster; the standalone app needs to manage them itself.
  // ------------------------------------------------------------
  final _idRandom = Random();

  // A plain millisecond timestamp collides whenever two IDs are minted
  // within the same millisecond (trivially reachable from two synchronous
  // calls, e.g. addClass() twice in a row) - the random suffix makes that
  // practically impossible instead of just unlikely.
  String _newId(String prefix) {
    final suffix = _idRandom.nextInt(1 << 32).toRadixString(16).padLeft(8, '0');
    return '$prefix-${DateTime.now().millisecondsSinceEpoch}-$suffix';
  }

  void addClass(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    final cls = SchoolClass(id: _newId('class'), name: trimmed);
    roster.classes.add(cls);
    saveData();
    notifyListeners();
  }

  void renameClass(String classId, String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    for (final c in roster.classes) {
      if (c.id == classId) {
        c.name = trimmed;
        break;
      }
    }
    saveData();
    notifyListeners();
  }

  void deleteClass(String classId) {
    roster.classes.removeWhere((c) => c.id == classId);
    if (activeClassId == classId) activeClassId = null;
    saveData();
    notifyListeners();
  }

  void addStudent(String classId, String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    for (final c in roster.classes) {
      if (c.id == classId) {
        c.students.add(Student(id: _newId('student'), name: trimmed));
        break;
      }
    }
    saveData();
    notifyListeners();
  }

  void renameStudent(String classId, String studentId, String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    final cls = roster.classes.where((c) => c.id == classId).firstOrNull;
    final student = cls?.students.where((s) => s.id == studentId).firstOrNull;
    if (student != null) student.name = trimmed;
    saveData();
    notifyListeners();
  }

  void deleteStudent(String classId, String studentId) {
    final cls = roster.classes.where((c) => c.id == classId).firstOrNull;
    cls?.students.removeWhere((s) => s.id == studentId);
    _removeStudentFromGroups(classId, studentId);
    saveData();
    notifyListeners();
  }

  void transferStudent(String studentId, String fromClassId, String toClassId) {
    if (fromClassId == toClassId) return;
    final fromCls = roster.classes.where((c) => c.id == fromClassId).firstOrNull;
    final toCls = roster.classes.where((c) => c.id == toClassId).firstOrNull;
    if (fromCls == null || toCls == null) return;
    final student = fromCls.students.where((s) => s.id == studentId).firstOrNull;
    if (student == null) return;
    fromCls.students.removeWhere((s) => s.id == studentId);
    toCls.students.add(student);
    // Group membership is scoped to the class it was created in - a
    // transferred student no longer belongs to either.
    _removeStudentFromGroups(fromClassId, studentId);
    saveData();
    notifyListeners();
  }

  void _removeStudentFromGroups(String classId, String studentId) {
    final cls = roster.classes.where((c) => c.id == classId).firstOrNull;
    if (cls == null) return;
    for (final group in cls.groups) {
      group.studentIds.remove(studentId);
    }
  }

  // ------------------------------------------------------------
  // Student groups - a named subset of a class's students (group work,
  // seating, etc). Auto-distribute is the primary flow (shuffle everyone
  // into N groups); groups can also just be renamed or cleared.
  // ------------------------------------------------------------
  List<StudentGroup> groupsFor(String classId) {
    return roster.classes.where((c) => c.id == classId).firstOrNull?.groups ?? [];
  }

  void autoDistributeGroups(String classId, int groupCount) {
    final cls = roster.classes.where((c) => c.id == classId).firstOrNull;
    if (cls == null || groupCount < 1 || cls.students.isEmpty) return;
    final shuffled = List<Student>.from(cls.students)..shuffle();
    final groups = List.generate(
      groupCount,
      (i) => StudentGroup(id: _newId('group'), name: 'المجموعة ${i + 1}'),
    );
    for (var i = 0; i < shuffled.length; i++) {
      groups[i % groupCount].studentIds.add(shuffled[i].id);
    }
    cls.groups = groups;
    saveData();
    notifyListeners();
  }

  void renameGroup(String classId, String groupId, String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    final group = groupsFor(classId).where((g) => g.id == groupId).firstOrNull;
    if (group != null) group.name = trimmed;
    saveData();
    notifyListeners();
  }

  void clearGroups(String classId) {
    final cls = roster.classes.where((c) => c.id == classId).firstOrNull;
    cls?.groups = [];
    saveData();
    notifyListeners();
  }

  void addSubject(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    final subject = Subject(
      id: _newId('subject'),
      name: trimmed,
      gradingCategories:
          _defaultCategoriesJson.map((c) => GradingCategory.fromJson(Map<String, dynamic>.from(c))).toList(),
    );
    roster.subjects.add(subject);
    activeSubjectId = subject.id;
    saveData();
    notifyListeners();
  }

  void renameSubject(String subjectId, String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    for (final s in roster.subjects) {
      if (s.id == subjectId) {
        s.name = trimmed;
        break;
      }
    }
    saveData();
    notifyListeners();
  }

  void deleteSubject(String subjectId) {
    if (roster.subjects.length <= 1) return;
    // Mirrors the desktop's deleteSubject: drop this subject's grades from
    // every student in every period, not just the roster metadata.
    for (final cls in roster.classes) {
      for (final student in cls.students) {
        for (final periodId in student.grades.keys.toList()) {
          final periodMap = student.grades[periodId];
          if (periodMap is Map) periodMap.remove(subjectId);
        }
      }
    }
    roster.subjects.removeWhere((s) => s.id == subjectId);
    if (activeSubjectId == subjectId) {
      activeSubjectId = roster.subjects.isNotEmpty ? roster.subjects.first.id : null;
    }
    saveData();
    notifyListeners();
  }

  void selectClass(String classId) {
    activeClassId = classId;
    currentScreen = AppScreen.grading;
    notifyListeners();
  }

  void goToClasses() {
    currentScreen = AppScreen.classes;
    notifyListeners();
  }

  void switchSubject(String subjectId) {
    activeSubjectId = subjectId;
    notifyListeners();
  }

  // ------------------------------------------------------------
  // Grading interactions — ported 1:1 from GradingTable.js's
  // onDotClick/onNumericChange. Only the participation category's 2nd
  // click needs a UI dialog (pick a deduction reason); everything else is
  // a direct, synchronous state mutation.
  // ------------------------------------------------------------
  Map<String, dynamic> gradesFor(Student student) {
    return getStudentSubjectGrades(
      student,
      roster,
      activeSubjectId ?? '',
      roster.activePeriodId ?? 'period-1',
    );
  }

  /// Per teacher feedback: a normal tap on a participation dot only ever
  /// toggles empty/green now (never opens the reason picker) — the picker
  /// is reachable exclusively via long-press (see onParticipationLongPress
  /// below), regardless of the dot's current state. A tap on an already
  /// red (deducted) dot resets it to empty, giving a quick one-tap undo.
  /// Returns true if this click needs the caller to show a reason-picker
  /// dialog next — always false now, kept as a return value only so other
  /// call sites don't need to change; no category still triggers this via
  /// a plain tap.
  bool onDotClick(Student student, GradingCategory cat, int index) {
    final g = gradesFor(student);
    final isAssign = isAssignmentsCategory(cat);
    final isActivity = isActivitiesCategory(cat);
    final isParticipation = cat.type == 'participation';
    final arr = (g[cat.id] as List);

    if (isAssign) {
      final val = arr[index];
      if (val == null || val == false) {
        arr[index] = true;
      } else if (val == true) {
        arr[index] = 'لم يحل الواجب';
      } else {
        arr[index] = false;
      }
      if (g['assignments'] is List) (g['assignments'] as List)[index] = arr[index];
      saveData();
      notifyListeners();
      return false;
    }

    if (isActivity) {
      final val = arr[index];
      if (val == null || val == false) {
        arr[index] = true;
      } else if (val == true) {
        arr[index] = 'لم يشارك في النشاط';
      } else {
        arr[index] = false;
      }
      if (g['activities'] is List) (g['activities'] as List)[index] = arr[index];
      saveData();
      notifyListeners();
      return false;
    }

    if (isParticipation) {
      final val = arr[index];
      // false/null -> true; true -> false; an existing deduction reason
      // (string) -> false too (one-tap undo) — the reason picker is
      // long-press-only now, never reachable via a plain tap.
      final next = (val == null || val == false);
      arr[index] = next;
      if (g['participation'] is List) (g['participation'] as List)[index] = next;
      saveData();
      notifyListeners();
      return false;
    }

    // Simple 2-state toggle for other dot categories.
    arr[index] = !(arr[index] == true);
    saveData();
    notifyListeners();
    return false;
  }

  void applyParticipationReason(Student student, GradingCategory cat, int index, String reason) {
    final g = gradesFor(student);
    final arr = (g[cat.id] as List);
    arr[index] = reason;
    if (g['participation'] is List) (g['participation'] as List)[index] = reason;
    saveData();
    notifyListeners();
  }

  void onNumericChange(Student student, GradingCategory cat, double value) {
    var val = value;
    if (val.isNaN || val < 0) val = 0;
    if (val > cat.max) val = cat.max;
    final g = gradesFor(student);
    g[cat.id] = val;
    saveData();
    notifyListeners();
  }

  @override
  void dispose() {
    _saveDebounceTimer?.cancel();
    super.dispose();
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
