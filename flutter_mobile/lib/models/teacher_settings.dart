/// Replaces the desktop's portfolioSettings/whatsappNumber for the
/// standalone app. Deliberately minimal for now (Phase 0) - a school
/// logo/letterhead field is added later (Phase 3) once report generation
/// actually needs it.
class TeacherSettings {
  String teacherName;
  String schoolName;

  TeacherSettings({this.teacherName = '', this.schoolName = ''});

  factory TeacherSettings.fromJson(Map<String, dynamic> json) => TeacherSettings(
        teacherName: json['teacherName'] as String? ?? '',
        schoolName: json['schoolName'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'teacherName': teacherName,
        'schoolName': schoolName,
      };
}
