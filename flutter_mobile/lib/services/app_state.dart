// The Flutter equivalent of mobile/js/store.js + mobile/js/mobile-sync.js
// combined into one ChangeNotifier — same responsibilities: hold the
// grading-relevant roster, debounce-and-diff saves into a change queue,
// and drive the sync protocol against server.js's 3 /api/mobile/*
// endpoints. See the plan file for why this exists instead of reusing the
// web version's code directly (Dart, not JS).
import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../models/grading_category.dart';
import '../models/grading_logic.dart';
import '../models/roster.dart';
import 'api_client.dart';
import 'local_store.dart';

enum SyncStatus { idle, syncing, pending, error }

enum AppScreen { connect, classes, grading }

class AppState extends ChangeNotifier {
  final LocalStore _localStore = LocalStore();

  Roster roster = Roster();
  String? activeClassId;
  String? activeSubjectId;
  AppScreen currentScreen = AppScreen.connect;
  bool dataLoaded = false;
  SyncStatus syncStatus = SyncStatus.idle;
  String? laptopUrl;
  String? _deviceId;
  int pendingChangeCount = 0;

  List<Map<String, dynamic>> _lastPersistedSnapshot = [];
  Timer? _saveDebounceTimer;
  Timer? _probeTimer;
  bool _isSyncing = false;

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
    final cfg = await _localStore.getConfig();
    laptopUrl = cfg?['laptopUrl'] as String?;
    _deviceId = cfg?['deviceId'] as String?;

    final rosterJson = await _localStore.getRoster();
    if (rosterJson == null) {
      currentScreen = AppScreen.connect;
      notifyListeners();
      return;
    }
    await _applyRosterAndReapplyPending(rosterJson);
    currentScreen = roster.classes.isNotEmpty ? AppScreen.classes : AppScreen.connect;
    dataLoaded = true;
    await _refreshPendingCount();
    _startProbeTimer();
    notifyListeners();
  }

  void _startProbeTimer() {
    _probeTimer?.cancel();
    _probeTimer = Timer.periodic(const Duration(seconds: 25), (_) => probeAndMaybeSync());
  }

  Future<void> connect(String url) async {
    final rosterJson = await MobileApiClient.fetchRoster(url);
    final cleanUrl = url.trim();
    _deviceId ??= _generateDeviceId();
    await _localStore.setConfig(laptopUrl: cleanUrl, deviceId: _deviceId!);
    laptopUrl = cleanUrl;
    await _localStore.setRoster(rosterJson);
    await _localStore.setLastSyncedAt(DateTime.now().millisecondsSinceEpoch);

    await _applyRosterAndReapplyPending(rosterJson);
    currentScreen = roster.classes.isNotEmpty ? AppScreen.classes : AppScreen.connect;
    dataLoaded = true;
    syncStatus = SyncStatus.idle;
    await _refreshPendingCount();
    _startProbeTimer();
    notifyListeners();
  }

  String _generateDeviceId() {
    final rnd = Random.secure();
    final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  Future<void> _applyRosterAndReapplyPending(Map<String, dynamic> rosterJson) async {
    _applyRoster(rosterJson);
    final pending = await _localStore.listQueuedChanges();
    if (pending.isNotEmpty) {
      _applyChangesToClasses(roster.classes, pending);
      _lastPersistedSnapshot = _cloneClasses(roster.classes);
    }
  }

  void _applyRoster(Map<String, dynamic> rosterJson) {
    final defaults = (rosterJson['defaultGradingCategories'] as List?) ?? _defaultCategoriesJson;
    roster = Roster.fromJson({
      ...rosterJson,
      if (rosterJson['defaultGradingCategories'] == null) 'defaultGradingCategories': defaults,
    });

    // Mirrors mobile/js/store.js's applyRoster exactly: keep the current
    // selection if it's still valid, else fall back to the roster's own
    // active id, else the first item, else null.
    if (!roster.classes.any((c) => c.id == activeClassId)) {
      activeClassId = (rosterJson['activeClassId'] as String?) ??
          (roster.classes.isNotEmpty ? roster.classes.first.id : null);
    }
    if (!roster.subjects.any((s) => s.id == activeSubjectId)) {
      activeSubjectId = (rosterJson['activeSubjectId'] as String?) ??
          (roster.subjects.isNotEmpty ? roster.subjects.first.id : null);
    }

    // Warm up every student/subject's grade object now (mirrors
    // mobile/js/store.js's applyRoster) so the diff snapshot below is
    // taken AFTER normalization, not before — otherwise the first render's
    // own normalization side-effect would look like a real edit.
    for (final cls in roster.classes) {
      for (final student in cls.students) {
        for (final subj in roster.subjects) {
          getStudentSubjectGrades(student, roster, subj.id, roster.activePeriodId ?? 'period-1');
        }
      }
    }

    _lastPersistedSnapshot = _cloneClasses(roster.classes);
  }

  List<Map<String, dynamic>> _cloneClasses(List<SchoolClass> classes) {
    return jsonDecode(jsonEncode(classes.map((c) => c.toJson()).toList()))
        .cast<Map<String, dynamic>>();
  }

  void _applyChangesToClasses(List<SchoolClass> classes, List<QueuedChange> changes) {
    for (final change in changes) {
      SchoolClass? cls;
      for (final c in classes) {
        if (c.id == change.classId) {
          cls = c;
          break;
        }
      }
      if (cls == null) continue;
      Student? student;
      for (final s in cls.students) {
        if (s.id == change.studentId) {
          student = s;
          break;
        }
      }
      if (student == null) continue;

      // Map.from(...) (a real copy with dynamic value slots), not
      // .cast<String, dynamic>() — see grading_logic.dart's comment on
      // getStudentSubjectGrades for why the latter throws a CastError the
      // moment a differently-typed value is written through it.
      final periodMap = Map<String, dynamic>.from(
        (student.grades[change.periodId] as Map?) ?? <String, dynamic>{},
      );
      student.grades[change.periodId] = periodMap;
      final g = Map<String, dynamic>.from(
        (periodMap[change.subjectId] as Map?) ?? <String, dynamic>{},
      );
      periodMap[change.subjectId] = g;

      if (change.kind == 'numeric') {
        g[change.categoryId] = change.value;
      } else {
        if (g[change.categoryId] is! List) g[change.categoryId] = <dynamic>[];
        final arr = (g[change.categoryId] as List);
        final targetLen = max(change.arrayLength ?? 0, (change.index ?? 0) + 1);
        while (arr.length < targetLen) {
          arr.add(false);
        }
        if (change.index != null) arr[change.index!] = change.value;
      }
    }
  }

  // ------------------------------------------------------------
  // Save path: call after mutating a grade in place (mirrors
  // onDotClick/onNumericChange calling saveData() in GradingTable.js).
  // Debounces (300ms, same rationale as js/store.js and mobile/js/
  // store.js: batch a burst of taps into one diff+queue pass).
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
    final changes = _diffChangedCells();
    for (final change in changes) {
      await _localStore.queueChange(change);
    }
    _lastPersistedSnapshot = _cloneClasses(roster.classes);

    await _localStore.setRoster({
      'classes': _lastPersistedSnapshot,
      'activeClassId': activeClassId,
      'subjects': roster.subjects.map((s) => s.toJson()).toList(),
      'activeSubjectId': activeSubjectId,
      'periods': roster.periods,
      'activePeriodId': roster.activePeriodId,
      'defaultGradingCategories': roster.defaultGradingCategories.map((c) => c.toJson()).toList(),
    });

    if (changes.isNotEmpty) {
      syncStatus = SyncStatus.pending;
      await _refreshPendingCount();
      notifyListeners();
      // Fire-and-forget, same as mobile/js/store.js calling
      // window.triggerMobileSync() without awaiting it.
      // ignore: discarded_futures
      triggerSync();
    }
  }

  List<Map<String, dynamic>> _diffChangedCells() {
    final changes = <Map<String, dynamic>>[];
    final periodId = roster.activePeriodId ?? 'period-1';
    final now = DateTime.now().millisecondsSinceEpoch;

    for (final cls in roster.classes) {
      Map<String, dynamic>? prevCls;
      for (final p in _lastPersistedSnapshot) {
        if (p['id'] == cls.id) {
          prevCls = p;
          break;
        }
      }
      for (final student in cls.students) {
        Map<String, dynamic>? prevStudent;
        if (prevCls != null) {
          for (final p in (prevCls['students'] as List? ?? [])) {
            if ((p as Map)['id'] == student.id) {
              prevStudent = p.cast<String, dynamic>();
              break;
            }
          }
        }
        for (final subj in roster.subjects) {
          final periodMap = student.grades[periodId];
          if (periodMap is! Map) continue;
          final g = periodMap[subj.id];
          if (g is! Map) continue;

          Map? prevG;
          final prevPeriodMap = prevStudent?['grades']?[periodId];
          if (prevPeriodMap is Map) prevG = prevPeriodMap[subj.id] as Map?;

          final categories = getActiveSubjectGradingCategories(roster, subj.id);
          for (final cat in categories) {
            if (cat.type == 'numeric') {
              final newVal = g[cat.id];
              final oldVal = prevG?[cat.id];
              if (newVal != oldVal && newVal != null) {
                changes.add({
                  'classId': cls.id,
                  'studentId': student.id,
                  'periodId': periodId,
                  'subjectId': subj.id,
                  'categoryId': cat.id,
                  'kind': 'numeric',
                  'index': null,
                  'value': newVal,
                  'arrayLength': null,
                  'clientTimestamp': now,
                });
              }
              continue;
            }
            final newArr = g[cat.id] is List ? (g[cat.id] as List) : const [];
            final oldArr = prevG?[cat.id] is List ? (prevG![cat.id] as List) : const [];
            final len = max(newArr.length, oldArr.length);
            for (var i = 0; i < len; i++) {
              final nv = i < newArr.length ? newArr[i] : false;
              final ov = i < oldArr.length ? oldArr[i] : false;
              if (nv != ov) {
                changes.add({
                  'classId': cls.id,
                  'studentId': student.id,
                  'periodId': periodId,
                  'subjectId': subj.id,
                  'categoryId': cat.id,
                  'kind': cat.type == 'participation' ? 'participation' : 'dot',
                  'index': i,
                  'value': nv,
                  'arrayLength': newArr.length,
                  'clientTimestamp': now,
                });
              }
            }
          }
        }
      }
    }
    return changes;
  }

  // ------------------------------------------------------------
  // Sync
  // ------------------------------------------------------------
  Future<void> triggerSync() async {
    if (_isSyncing) return;
    if (laptopUrl == null || laptopUrl!.isEmpty) return;

    _isSyncing = true;
    syncStatus = SyncStatus.syncing;
    notifyListeners();
    try {
      final changes = await _localStore.listQueuedChanges();
      final result = await MobileApiClient.sync(
        laptopUrl: laptopUrl!,
        deviceId: _deviceId ?? _generateDeviceId(),
        changes: changes.map((c) => c.toJson()).toList(),
      );
      final accepted = ((result['accepted'] as List?) ?? []).cast<int>();
      await _localStore.removeQueuedChanges(accepted);
      await _localStore.setLastSyncedAt(DateTime.now().millisecondsSinceEpoch);

      final freshRoster = (result['roster'] as Map).cast<String, dynamic>();
      await _localStore.setRoster(freshRoster);
      await _applyRosterAndReapplyPending(freshRoster);

      await _refreshPendingCount();
      syncStatus = pendingChangeCount > 0 ? SyncStatus.pending : SyncStatus.idle;
    } catch (e) {
      syncStatus = SyncStatus.error;
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> probeAndMaybeSync() async {
    if (laptopUrl == null || laptopUrl!.isEmpty) return;
    final version = await MobileApiClient.fetchVersion(laptopUrl!);
    if (version == null) return;
    final queued = await _localStore.listQueuedChanges();
    final lastKnown = await _localStore.getLastKnownServerVersion();
    if (queued.isNotEmpty || version != lastKnown) {
      await _localStore.setLastKnownServerVersion(version);
      await triggerSync();
    }
  }

  Future<void> _refreshPendingCount() async {
    final queued = await _localStore.listQueuedChanges();
    pendingChangeCount = queued.length;
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

  /// Returns true if this click needs the caller to show a reason-picker
  /// dialog next (participation category, 2nd click on an already-true
  /// dot) — nothing is mutated in that case until applyParticipationReason
  /// is called with the chosen reason, mirroring ReasonModal.js: cancelling
  /// the picker leaves the dot exactly as it was.
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
      if (val == null || val == false) {
        arr[index] = true;
        if (g['participation'] is List) (g['participation'] as List)[index] = true;
        saveData();
        notifyListeners();
        return false;
      } else if (val == true) {
        return true; // caller must show the reason picker now
      } else {
        arr[index] = false;
        if (g['participation'] is List) (g['participation'] as List)[index] = false;
        saveData();
        notifyListeners();
        return false;
      }
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
    _probeTimer?.cancel();
    super.dispose();
  }
}
