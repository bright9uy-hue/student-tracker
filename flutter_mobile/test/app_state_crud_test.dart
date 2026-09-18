// Verifies the CRUD operations added when the app dropped its laptop
// dependency (Phase 0 of the standalone rewrite) - classes/students/
// subjects previously always arrived ready-made from the laptop's roster,
// so the app never needed to create/rename/delete them itself before now.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:student_tracker_mobile/models/grading_logic.dart';
import 'package:student_tracker_mobile/services/app_state.dart';

void main() {
  late AppState state;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    state = AppState();
    await state.init();
  });

  test('fresh install seeds exactly one subject with the 5 default categories', () {
    expect(state.roster.subjects.length, 1);
    expect(state.roster.subjects.first.gradingCategories.length, 5);
    expect(state.activeSubjectId, state.roster.subjects.first.id);
  });

  test('addClass adds a class, and it survives a reload from local storage', () async {
    state.addClass('فصل 1');
    expect(state.roster.classes.length, 1);
    expect(state.roster.classes.first.name, 'فصل 1');
    await state.flushPendingSave();

    final reloaded = AppState();
    await reloaded.init();
    expect(reloaded.roster.classes.length, 1);
    expect(reloaded.roster.classes.first.name, 'فصل 1');
  });

  test('addClass ignores a blank/whitespace-only name', () {
    state.addClass('   ');
    expect(state.roster.classes, isEmpty);
  });

  test('renameClass updates the name in place', () {
    state.addClass('قديم');
    final id = state.roster.classes.first.id;
    state.renameClass(id, 'جديد');
    expect(state.roster.classes.first.name, 'جديد');
  });

  test('deleteClass removes it and clears activeClassId if it was the active one', () {
    state.addClass('فصل');
    final id = state.roster.classes.first.id;
    state.selectClass(id);
    expect(state.activeClassId, id);
    state.deleteClass(id);
    expect(state.roster.classes, isEmpty);
    expect(state.activeClassId, isNull);
  });

  test('addStudent/renameStudent/deleteStudent operate on the right class', () {
    state.addClass('فصل');
    final classId = state.roster.classes.first.id;
    state.addStudent(classId, 'طالب 1');
    expect(state.roster.classes.first.students.length, 1);

    final studentId = state.roster.classes.first.students.first.id;
    state.renameStudent(classId, studentId, 'طالب معدل');
    expect(state.roster.classes.first.students.first.name, 'طالب معدل');

    state.deleteStudent(classId, studentId);
    expect(state.roster.classes.first.students, isEmpty);
  });

  test('transferStudent moves a student from one class to another', () {
    state.addClass('أ');
    state.addClass('ب');
    final classA = state.roster.classes[0];
    final classB = state.roster.classes[1];
    state.addStudent(classA.id, 'سالم');
    final studentId = classA.students.first.id;

    state.transferStudent(studentId, classA.id, classB.id);

    expect(classA.students, isEmpty);
    expect(classB.students.length, 1);
    expect(classB.students.first.id, studentId);
  });

  test('addSubject adds a subject with default categories and makes it active', () {
    final firstSubjectId = state.roster.subjects.first.id;
    state.addSubject('رياضيات');
    expect(state.roster.subjects.length, 2);
    expect(state.roster.subjects.last.gradingCategories.length, 5);
    expect(state.activeSubjectId, state.roster.subjects.last.id);
    expect(state.activeSubjectId, isNot(firstSubjectId));
  });

  test('renameSubject updates the name in place', () {
    state.addSubject('رياضيات');
    final id = state.roster.subjects.last.id;
    state.renameSubject(id, 'رياضيات ٢');
    expect(state.roster.subjects.last.name, 'رياضيات ٢');
  });

  test('deleteSubject refuses to delete the only remaining subject', () {
    expect(state.roster.subjects.length, 1);
    final id = state.roster.subjects.first.id;
    state.deleteSubject(id);
    expect(state.roster.subjects.length, 1);
  });

  test('deleteSubject drops only that subject\'s grades from every student', () {
    state.addClass('فصل');
    final classId = state.roster.classes.first.id;
    state.addStudent(classId, 'طالب');
    final student = state.roster.classes.first.students.first;
    final subj1Id = state.roster.subjects.first.id;

    state.addSubject('مادة ثانية');
    final subj2Id = state.roster.subjects.last.id;

    // Warm up both subjects' grade objects so they actually exist on the
    // student before deleting one of them.
    getStudentSubjectGrades(student, state.roster, subj1Id, 'period-1');
    getStudentSubjectGrades(student, state.roster, subj2Id, 'period-1');
    final periodMapBefore = student.grades['period-1'] as Map;
    expect(periodMapBefore.containsKey(subj1Id), isTrue);
    expect(periodMapBefore.containsKey(subj2Id), isTrue);

    state.deleteSubject(subj1Id);

    final periodMapAfter = student.grades['period-1'] as Map;
    expect(periodMapAfter.containsKey(subj1Id), isFalse);
    expect(periodMapAfter.containsKey(subj2Id), isTrue);
    expect(state.activeSubjectId, subj2Id);
  });

  test('updateTeacherSettings persists across a reload', () async {
    await state.updateTeacherSettings(
      state.teacherSettings
        ..teacherName = 'أحمد'
        ..schoolName = 'مدرسة النور',
    );

    final reloaded = AppState();
    await reloaded.init();
    expect(reloaded.teacherSettings.teacherName, 'أحمد');
    expect(reloaded.teacherSettings.schoolName, 'مدرسة النور');
  });
}
