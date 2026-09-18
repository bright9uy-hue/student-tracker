// Ported from js/grading-model.js and js/grading.js. This file is the
// Dart mirror of that pure logic — same rules, same output, so a grade
// entered on the phone computes identically to one entered on the laptop.
//
// One deliberate simplification vs the JS version: js/grading-model.js
// memoizes normalization against Vue's reactivity system (re-running the
// pass on every read was measured at ~90,000 calls / 2.1s for one dot
// click there). Dart/Flutter has no equivalent reactivity-cascade cost,
// so this always re-normalizes — same result, no cache needed.
import 'dart:convert';
import 'grading_category.dart';
import 'roster.dart';

List<GradingCategory> _cloneCategories(List<GradingCategory> src) {
  return src.map((c) => GradingCategory.fromJson(jsonDecode(jsonEncode(c.toJson())))).toList();
}

/// Ensures a subject has a (normalized) gradingCategories list, creating
/// one from the roster's defaults if it doesn't have its own yet.
List<GradingCategory> ensureSubjectCategories(Subject subject, List<GradingCategory> defaultCategories) {
  if (subject.gradingCategories.isNotEmpty) {
    for (final c in subject.gradingCategories) {
      normalizeGradingCategory(c);
    }
    return subject.gradingCategories;
  }
  subject.gradingCategories = _cloneCategories(defaultCategories);
  for (final c in subject.gradingCategories) {
    normalizeGradingCategory(c);
  }
  return subject.gradingCategories;
}

List<GradingCategory> getActiveSubjectGradingCategories(Roster roster, String? subjectId) {
  Subject? subj;
  for (final s in roster.subjects) {
    if (s.id == subjectId) {
      subj = s;
      break;
    }
  }
  if (subj != null) return ensureSubjectCategories(subj, roster.defaultGradingCategories);
  final fallback = _cloneCategories(roster.defaultGradingCategories);
  for (final c in fallback) {
    normalizeGradingCategory(c);
  }
  return fallback;
}

/// The single source of truth every scoring/UI read goes through. Sizes
/// each category's stored value to match its OWN dotsCount/max (not a
/// stale global distribution), and mirrors legacy field names for the
/// desktop app's older exports/reports. Mutates and returns the grade
/// object living at student.grades[periodId][subjectId].
Map<String, dynamic> getStudentSubjectGrades(
  Student student,
  Roster roster,
  String subjectId,
  String periodId,
) {
  // Map<...>.from(...) (a genuine copy with truly-dynamic value slots),
  // never .cast<String, dynamic>() (a lazy VIEW that still enforces the
  // ORIGINAL map's narrower runtime value type on writes - e.g. a map
  // literal like {'cat_p1': [true, false]} is inferred as
  // Map<String, List<bool>>, and writing an unrelated value through a
  // .cast() view of it throws a CastError at runtime instead of actually
  // widening the type). Caught by this port's own unit tests.
  student.grades[periodId] = Map<String, dynamic>.from(
    (student.grades[periodId] as Map?) ?? <String, dynamic>{},
  );
  final periodMap = student.grades[periodId] as Map<String, dynamic>;

  final categories = getActiveSubjectGradingCategories(roster, subjectId);

  final isCurrentPeriodEmpty = periodMap[subjectId] == null ||
      periodMap[subjectId] is! Map ||
      (periodMap[subjectId] as Map).isEmpty;

  if (isCurrentPeriodEmpty) {
    final period1 = student.grades['period-1'];
    final period1Subject = (period1 is Map) ? period1[subjectId] : null;
    final legacySubject = student.grades[subjectId];
    if (period1Subject is Map && period1Subject.isNotEmpty) {
      periodMap[subjectId] = jsonDecode(jsonEncode(period1Subject));
    } else if (legacySubject is Map && legacySubject.isNotEmpty) {
      periodMap[subjectId] = jsonDecode(jsonEncode(legacySubject));
    }
  }

  if (periodMap[subjectId] == null || periodMap[subjectId] is! Map) {
    periodMap[subjectId] = <String, dynamic>{};
  }
  final g = Map<String, dynamic>.from(periodMap[subjectId] as Map);
  periodMap[subjectId] = g;

  for (final cat in categories) {
    if (cat.max <= 0) continue;
    final legacyKey = legacyGradeFieldFor(cat);

    if (cat.type == 'numeric') {
      final raw = g[cat.id] ?? (legacyKey != null ? g[legacyKey] : null);
      double val = double.tryParse('$raw') ?? 0;
      if (val < 0) val = 0;
      if (val > cat.max) val = cat.max;
      g[cat.id] = val;
      if (legacyKey != null) g[legacyKey] = val;
      continue;
    }

    final targetLen = cat.dotsCount ?? (cat.max > 0 ? cat.max.round() : 10);
    List<dynamic>? arr;
    if (g[cat.id] is List) {
      arr = (g[cat.id] as List);
    } else if (legacyKey != null && g[legacyKey] is List) {
      arr = (g[legacyKey] as List);
    }

    List<dynamic> resultArr;
    if (arr == null) {
      resultArr = List<dynamic>.filled(targetLen, false);
    } else if (arr.length != targetLen) {
      final stringViolations = arr.where((v) => v is String && v.trim().isNotEmpty).toList();
      final countTrue = arr.where((v) => v == true).length;
      final keep = countTrue < targetLen ? countTrue : targetLen;
      final resized = List<dynamic>.filled(targetLen, false);
      for (var i = 0; i < keep; i++) {
        resized[i] = true;
      }
      for (var idx = 0; idx < stringViolations.length; idx++) {
        final pos = targetLen - 1 - idx;
        if (pos >= 0) resized[pos] = stringViolations[idx];
      }
      resultArr = resized;
    } else {
      resultArr = arr;
    }

    g[cat.id] = resultArr;
    if (legacyKey != null) g[legacyKey] = resultArr;
  }

  g['practical'] ??= 0.0;
  g['exam'] ??= 0.0;
  if (g['assignments'] is! List) g['assignments'] = <dynamic>[];
  if (g['activities'] is! List) g['activities'] = <dynamic>[];
  if (g['research'] is! List) g['research'] = <dynamic>[];
  if (g['participation'] is! List) g['participation'] = <dynamic>[];

  return g;
}
