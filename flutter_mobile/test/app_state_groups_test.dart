// Verifies student groups (Phase 1 free-tier feature): auto-distributing a
// class into N groups, renaming a group, clearing groups, and that a
// student removed from the class (deleted or transferred) doesn't linger
// as a dangling ID in a group's membership list.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:student_tracker_mobile/services/app_state.dart';

void main() {
  late AppState state;
  late String classId;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    state = AppState();
    await state.init();
    state.addClass('فصل');
    classId = state.roster.classes.first.id;
    for (var i = 0; i < 7; i++) {
      state.addStudent(classId, 'طالب $i');
    }
  });

  test('autoDistributeGroups splits every student into exactly N groups', () {
    state.autoDistributeGroups(classId, 3);
    final groups = state.groupsFor(classId);
    expect(groups.length, 3);

    final allAssigned = groups.expand((g) => g.studentIds).toList();
    expect(allAssigned.length, 7); // every student placed exactly once
    expect(allAssigned.toSet().length, 7); // no duplicates

    // Balanced within 1 of each other (7 students / 3 groups -> 3,2,2).
    final sizes = groups.map((g) => g.studentIds.length).toList()..sort();
    expect(sizes, [2, 2, 3]);
  });

  test('autoDistributeGroups replaces any previous grouping', () {
    state.autoDistributeGroups(classId, 2);
    final firstGroupIds = state.groupsFor(classId).map((g) => g.id).toSet();
    state.autoDistributeGroups(classId, 4);
    final groups = state.groupsFor(classId);
    expect(groups.length, 4);
    expect(groups.map((g) => g.id).toSet().intersection(firstGroupIds), isEmpty);
  });

  test('renameGroup updates the name in place', () {
    state.autoDistributeGroups(classId, 2);
    final groupId = state.groupsFor(classId).first.id;
    state.renameGroup(classId, groupId, 'الفريق الأحمر');
    expect(state.groupsFor(classId).first.name, 'الفريق الأحمر');
  });

  test('clearGroups removes all groups for the class', () {
    state.autoDistributeGroups(classId, 2);
    expect(state.groupsFor(classId), isNotEmpty);
    state.clearGroups(classId);
    expect(state.groupsFor(classId), isEmpty);
  });

  test('deleteStudent removes that student from every group', () {
    state.autoDistributeGroups(classId, 2);
    final studentId = state.roster.classes.first.students.first.id;
    final wasInAGroup = state.groupsFor(classId).any((g) => g.studentIds.contains(studentId));
    expect(wasInAGroup, isTrue);

    state.deleteStudent(classId, studentId);

    final stillInAGroup = state.groupsFor(classId).any((g) => g.studentIds.contains(studentId));
    expect(stillInAGroup, isFalse);
  });

  test('transferStudent removes the student from the source class\'s groups', () {
    state.addClass('فصل آخر');
    final otherClassId = state.roster.classes.last.id;
    state.autoDistributeGroups(classId, 2);
    final studentId = state.roster.classes.first.students.first.id;

    state.transferStudent(studentId, classId, otherClassId);

    final stillInAGroup = state.groupsFor(classId).any((g) => g.studentIds.contains(studentId));
    expect(stillInAGroup, isFalse);
  });
}
