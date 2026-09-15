// Ported from js/grading-model.js. Keep this file behavior-identical to
// that one — it's the source of truth for category classification and
// normalization rules; any divergence here means a student's grade would
// be computed differently on the phone than on the laptop.
class GradingCategory {
  final String id;
  String name;
  final String type; // 'numeric' | 'dots' | 'participation'
  double max;
  int? dotsCount;
  double? pointValue;
  String? noorBucket;
  final String? key; // legacy alias some older categories carry

  GradingCategory({
    required this.id,
    required this.name,
    required this.type,
    required this.max,
    this.dotsCount,
    this.pointValue,
    this.noorBucket,
    this.key,
  });

  factory GradingCategory.fromJson(Map<String, dynamic> json) {
    return GradingCategory(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? 'dots',
      max: (json['max'] as num?)?.toDouble() ?? 10,
      dotsCount: (json['dotsCount'] as num?)?.toInt(),
      pointValue: (json['pointValue'] as num?)?.toDouble(),
      noorBucket: json['noorBucket'] as String?,
      key: json['key'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type,
        'max': max,
        if (dotsCount != null) 'dotsCount': dotsCount,
        if (pointValue != null) 'pointValue': pointValue,
        if (noorBucket != null) 'noorBucket': noorBucket,
        if (key != null) 'key': key,
      };
}

bool isAssignmentsCategory(GradingCategory? cat) {
  if (cat == null) return false;
  return cat.id == 'cat_assignments' ||
      cat.key == 'assignments' ||
      cat.name == 'الواجبات';
}

bool isActivitiesCategory(GradingCategory? cat) {
  if (cat == null) return false;
  return cat.id == 'cat_activities' ||
      cat.key == 'activities' ||
      cat.name == 'الأنشطة' ||
      cat.name == 'الأنشطة الصفية';
}

/// Maps a category to the fixed legacy field name it mirrors (backward
/// compatibility with the desktop app's older exports/reports). A genuinely
/// custom category has no legacy alias.
String? legacyGradeFieldFor(GradingCategory cat) {
  if (isAssignmentsCategory(cat)) return 'assignments';
  if (isActivitiesCategory(cat)) return 'activities';
  if (cat.id == 'cat_research' || cat.name == 'البحث والمشاريع') return 'research';
  if (cat.id == 'cat_participation' || cat.type == 'participation') return 'participation';
  if (cat.id == 'cat_practical' || cat.name == 'الاختبار العملي') return 'practical';
  if (cat.id == 'cat_exam' || cat.name == 'الاختبار النهائي') return 'exam';
  return null;
}

void normalizeGradingCategory(GradingCategory cat) {
  if ((cat.type == 'dots' || cat.type == 'participation') && !isAssignmentsCategory(cat)) {
    if (cat.dotsCount == null || cat.dotsCount! < 1) {
      cat.dotsCount = cat.max > 0 ? cat.max.round() : 10;
    }
    if (cat.pointValue == null || cat.pointValue! <= 0) {
      cat.pointValue = 1;
    }
  }
  if (cat.noorBucket == null) {
    final legacyKey = legacyGradeFieldFor(cat);
    if (legacyKey == 'assignments' ||
        legacyKey == 'activities' ||
        legacyKey == 'research' ||
        legacyKey == 'participation') {
      cat.noorBucket = '40';
    } else if (legacyKey == 'practical' || legacyKey == 'exam') {
      cat.noorBucket = '60';
    }
  }
}
