import 'grading_category.dart';

/// A student's grades are kept as a raw JSON-shaped map
/// (`grades[periodId][subjectId][categoryId or legacy field] = value`)
/// rather than a typed class — the shape is dynamic (arbitrary category
/// ids as keys) and this is also exactly the wire format the server and
/// shared_preferences both expect, so no lossy conversion either way.
class Student {
  final String id;
  String name;
  Map<String, dynamic> grades;

  Student({required this.id, required this.name, Map<String, dynamic>? grades})
      : grades = grades ?? {};

  factory Student.fromJson(Map<String, dynamic> json) {
    return Student(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      grades: (json['grades'] as Map?)?.cast<String, dynamic>() ?? {},
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'grades': grades};
}

class SchoolClass {
  final String id;
  String name;
  List<Student> students;

  SchoolClass({required this.id, required this.name, List<Student>? students})
      : students = students ?? [];

  factory SchoolClass.fromJson(Map<String, dynamic> json) {
    return SchoolClass(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      students: ((json['students'] as List?) ?? [])
          .map((s) => Student.fromJson((s as Map).cast<String, dynamic>()))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'students': students.map((s) => s.toJson()).toList(),
      };
}

class Subject {
  final String id;
  String name;
  List<GradingCategory> gradingCategories;

  Subject({required this.id, required this.name, List<GradingCategory>? gradingCategories})
      : gradingCategories = gradingCategories ?? [];

  factory Subject.fromJson(Map<String, dynamic> json) {
    return Subject(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      gradingCategories: ((json['gradingCategories'] as List?) ?? [])
          .map((c) => GradingCategory.fromJson((c as Map).cast<String, dynamic>()))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'gradingCategories': gradingCategories.map((c) => c.toJson()).toList(),
      };
}

/// The full grading-relevant snapshot synced from the laptop — mirrors
/// GET /api/mobile/roster's response shape exactly (server.js).
class Roster {
  List<SchoolClass> classes;
  List<Subject> subjects;
  List<Map<String, dynamic>> periods;
  String? activePeriodId;
  List<GradingCategory> defaultGradingCategories;
  int version;

  Roster({
    List<SchoolClass>? classes,
    List<Subject>? subjects,
    List<Map<String, dynamic>>? periods,
    this.activePeriodId,
    List<GradingCategory>? defaultGradingCategories,
    this.version = 0,
  })  : classes = classes ?? [],
        subjects = subjects ?? [],
        periods = periods ?? [],
        defaultGradingCategories = defaultGradingCategories ?? [];

  factory Roster.fromJson(Map<String, dynamic> json) {
    return Roster(
      classes: ((json['classes'] as List?) ?? [])
          .map((c) => SchoolClass.fromJson((c as Map).cast<String, dynamic>()))
          .toList(),
      subjects: ((json['subjects'] as List?) ?? [])
          .map((s) => Subject.fromJson((s as Map).cast<String, dynamic>()))
          .toList(),
      periods: ((json['periods'] as List?) ?? [])
          .map((p) => (p as Map).cast<String, dynamic>())
          .toList(),
      activePeriodId: json['activePeriodId'] as String?,
      defaultGradingCategories: ((json['defaultGradingCategories'] as List?) ?? [])
          .map((c) => GradingCategory.fromJson((c as Map).cast<String, dynamic>()))
          .toList(),
      version: (json['version'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'classes': classes.map((c) => c.toJson()).toList(),
        'subjects': subjects.map((s) => s.toJson()).toList(),
        'periods': periods,
        'activePeriodId': activePeriodId,
        'defaultGradingCategories': defaultGradingCategories.map((c) => c.toJson()).toList(),
        'version': version,
      };
}
