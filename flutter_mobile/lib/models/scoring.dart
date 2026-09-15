// Ported from js/grading.js. Same rules as the desktop/web app so a grade
// entered here computes to the exact same total.
import 'grading_category.dart';
import 'grading_logic.dart';
import 'roster.dart';

double getCheckboxSum(dynamic value, double pointValue, double maxVal) {
  if (value is! List) {
    return double.tryParse('$value') ?? 0;
  }
  final count = value.where((v) => v == true).length;
  final raw = count * pointValue;
  final rounded = (raw * 100).round() / 100;
  return rounded.clamp(0, maxVal).toDouble();
}

/// Highest slot index any student in the class has a recorded value for,
/// +1 — "how many [assignments/activities] have actually been given so
/// far", so an ungraded-yet slot never counts against a student. Shared by
/// assignments and classroom activities scoring, which are otherwise
/// identical apart from which grade field they read.
int getActiveGivenCount(
  SchoolClass activeClass,
  Roster roster,
  String subjectId,
  String periodId,
  String fieldName,
  bool Function(GradingCategory) matchesCategory,
) {
  if (activeClass.students.isEmpty) return 0;

  final categories = getActiveSubjectGradingCategories(roster, subjectId);
  GradingCategory? cat;
  for (final c in categories) {
    if (matchesCategory(c)) {
      cat = c;
      break;
    }
  }
  final maxCount = cat != null && cat.max > 0 ? cat.max.round() : 10;

  int highestSlotIndex = -1;
  for (var i = maxCount - 1; i >= 0; i--) {
    final hasAnyStudentMarked = activeClass.students.any((s) {
      final grades = getStudentSubjectGrades(s, roster, subjectId, periodId);
      final arr = (grades[fieldName] ?? grades['cat_$fieldName']);
      if (arr is! List || i >= arr.length) return false;
      final val = arr[i];
      return val == true || (val is String && val.trim().isNotEmpty);
    });
    if (hasAnyStudentMarked) {
      highestSlotIndex = i;
      break;
    }
  }
  return highestSlotIndex + 1;
}

double getGivenRatioScore(
  Student student,
  Roster roster,
  SchoolClass activeClass,
  String subjectId,
  String periodId,
  double maxVal,
  String fieldName,
  bool Function(GradingCategory) matchesCategory,
) {
  final totalGiven = getActiveGivenCount(activeClass, roster, subjectId, periodId, fieldName, matchesCategory);
  if (totalGiven == 0) return 0;

  final gradesObj = getStudentSubjectGrades(student, roster, subjectId, periodId);
  final arr = gradesObj[fieldName] ?? gradesObj['cat_$fieldName'];
  if (arr is! List) return 0;

  var solvedCount = 0;
  for (var i = 0; i < totalGiven && i < arr.length; i++) {
    if (arr[i] == true) solvedCount++;
  }
  final score = (solvedCount / totalGiven) * maxVal;
  return score.clamp(0, maxVal).roundToDouble();
}

double getStudentAssignmentScore(
  Student student,
  Roster roster,
  SchoolClass activeClass,
  String subjectId,
  String periodId,
  double maxVal,
) {
  return getGivenRatioScore(
      student, roster, activeClass, subjectId, periodId, maxVal, 'assignments', isAssignmentsCategory);
}

double getStudentActivityScore(
  Student student,
  Roster roster,
  SchoolClass activeClass,
  String subjectId,
  String periodId,
  double maxVal,
) {
  return getGivenRatioScore(
      student, roster, activeClass, subjectId, periodId, maxVal, 'activities', isActivitiesCategory);
}

double getParticipationScore(dynamic value, double maxVal, double pointValue) {
  if (value is! List) return double.tryParse('$value') ?? 0;
  double score = 0;
  for (final v in value) {
    if (v == true) {
      score += pointValue;
    } else if (v is String && v.isNotEmpty) {
      score -= pointValue;
    }
  }
  score = (score * 100).round() / 100;
  return score.clamp(0, maxVal).toDouble();
}

/// Earned score for one student in one grading category — the single place
/// that dispatches on category type, mirroring js/grading.js's
/// getCategoryEarnedScore so a scoring fix stays made in one place.
double getCategoryEarnedScore(
  Student student,
  Roster roster,
  SchoolClass activeClass,
  GradingCategory cat,
  String subjectId,
  String periodId,
) {
  if (cat.max <= 0) return 0;
  final gradesObj = getStudentSubjectGrades(student, roster, subjectId, periodId);
  final val = gradesObj[cat.id] ?? gradesObj[cat.key ?? ''] ?? 0;
  if (isAssignmentsCategory(cat)) {
    return getStudentAssignmentScore(student, roster, activeClass, subjectId, periodId, cat.max);
  } else if (isActivitiesCategory(cat)) {
    return getStudentActivityScore(student, roster, activeClass, subjectId, periodId, cat.max);
  } else if (cat.type == 'dots') {
    return getCheckboxSum(val, cat.pointValue ?? 1, cat.max);
  } else if (cat.type == 'participation') {
    return getParticipationScore(val, cat.max, cat.pointValue ?? 1);
  } else if (cat.type == 'numeric') {
    return double.tryParse('$val') ?? 0;
  }
  return 0;
}

int getStudentTotal(
  Student student,
  Roster roster,
  SchoolClass activeClass,
  String subjectId,
  String periodId,
) {
  final categories = getActiveSubjectGradingCategories(roster, subjectId);
  double total = 0;
  for (final cat in categories) {
    total += getCategoryEarnedScore(student, roster, activeClass, cat, subjectId, periodId);
  }
  return total.round();
}

String getStudentStatus(int total) {
  if (total >= 90) return 'excellent';
  if (total >= 50) return 'pass';
  return 'fail';
}

class StatusBadgeInfo {
  final String text;
  final int color; // 0xAARRGGBB-ready hex without alpha, e.g. 0x10b981
  StatusBadgeInfo(this.text, this.color);
}

StatusBadgeInfo getStatusBadgeInfo(String status) {
  if (status == 'excellent') return StatusBadgeInfo('ممتاز', 0x10b981);
  if (status == 'pass') return StatusBadgeInfo('ناجح', 0xf59e0b);
  return StatusBadgeInfo('متعثر', 0xef4444);
}

class DotVisual {
  final String state; // 'empty' | 'checked' | 'deduction'
  final String tip;
  DotVisual(this.state, this.tip);
}

DotVisual getDotVisual(dynamic value, bool isAssign, int index, bool isActivity) {
  if (isAssign) {
    if (value == true) return DotVisual('checked', 'واجب ${index + 1}: تم الحل والتسليم ✅');
    if (value is String && value.isNotEmpty) {
      return DotVisual('deduction', 'واجب ${index + 1}: لم يحل الواجب (خصم) ❌');
    }
    return DotVisual('empty', 'واجب ${index + 1}: لم نصل إليه بعد ⚪');
  } else if (isActivity) {
    if (value == true) return DotVisual('checked', 'نشاط ${index + 1}: تم الإنجاز والمشاركة ✅');
    if (value is String && value.isNotEmpty) {
      return DotVisual('deduction', 'نشاط ${index + 1}: لم يشارك في النشاط (خصم) ❌');
    }
    return DotVisual('empty', 'نشاط ${index + 1}: لم نصل إليه بعد ⚪');
  } else {
    if (value == true) return DotVisual('checked', 'إيجابية ${index + 1}');
    if (value is String && value.isNotEmpty) return DotVisual('deduction', 'خصم: $value');
    return DotVisual('empty', 'الدرجة ${index + 1}');
  }
}
