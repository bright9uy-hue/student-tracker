/// A named subset of a class's students (e.g. for group activities).
/// Membership is a plain list of student IDs rather than embedded Student
/// objects, so a group never goes stale relative to the roster's own
/// Student list (renames, deletions) - it's just references.
class StudentGroup {
  final String id;
  String name;
  List<String> studentIds;

  StudentGroup({required this.id, required this.name, List<String>? studentIds})
      : studentIds = studentIds ?? [];

  factory StudentGroup.fromJson(Map<String, dynamic> json) => StudentGroup(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        studentIds: ((json['studentIds'] as List?) ?? []).map((e) => e as String).toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'studentIds': studentIds,
      };
}
