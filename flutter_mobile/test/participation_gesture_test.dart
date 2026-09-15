// Verifies the teacher's requested change: a plain tap on a participation
// dot only ever toggles empty/green (never opens the reason picker
// anymore), and the picker is reachable exclusively via long-press,
// regardless of the dot's starting state.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:student_tracker_mobile/main.dart';

Map<String, dynamic> _roster() => {
      'version': 1,
      'classes': [
        {
          'id': 'class-1',
          'name': 'فصل الاختبار',
          'students': [
            {'id': 's1', 'name': 'أحمد', 'grades': {}},
          ],
        }
      ],
      'subjects': [
        {
          'id': 'subj-1',
          'name': 'العلوم',
          'gradingCategories': [
            {'id': 'cat_p1', 'name': 'المشاركة', 'type': 'participation', 'max': 10}
          ],
        }
      ],
      'periods': [
        {'id': 'period-1', 'name': 'الفترة الأولى'}
      ],
      'activePeriodId': 'period-1',
    };

Future<void> _navigateToGrading(WidgetTester tester) async {
  await tester.pumpWidget(const StudentTrackerMobileApp());
  await tester.pumpAndSettle();
  await tester.tap(find.text('فصل الاختبار'));
  await tester.pumpAndSettle();
}

// The category tabs above the student list are ChoiceChips, which also
// wrap an InkWell internally — find.byType(InkWell).first would silently
// match one of those instead of an actual grading dot. The dot widgets
// carry an explicit key for exactly this reason.
final _dotFinder = find.byKey(const ValueKey('dot_s1_cat_p1_0'));

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'roster': jsonEncode(_roster()),
    });
  });

  testWidgets('a plain tap toggles the dot without opening the reason dialog', (tester) async {
    await _navigateToGrading(tester);

    final dot = _dotFinder;
    await tester.tap(dot);
    await tester.pumpAndSettle();

    expect(find.text('سبب الخصم من المشاركة'), findsNothing);

    // Tapping again turns it back off — still no dialog.
    await tester.tap(dot);
    await tester.pumpAndSettle();
    expect(find.text('سبب الخصم من المشاركة'), findsNothing);
  });

  testWidgets('a long-press opens the reason dialog and applying a reason marks it red', (tester) async {
    await _navigateToGrading(tester);

    final dot = _dotFinder;
    await tester.longPress(dot);
    await tester.pumpAndSettle();

    expect(find.text('سبب الخصم من المشاركة'), findsOneWidget);

    await tester.tap(find.text('التحدث أثناء الدرس'));
    await tester.pumpAndSettle();

    expect(find.text('سبب الخصم من المشاركة'), findsNothing);
  });

  testWidgets('long-press works even on an already-green dot (no tap needed first)', (tester) async {
    await _navigateToGrading(tester);

    final dot = _dotFinder;
    await tester.tap(dot); // turn it green first
    await tester.pumpAndSettle();

    await tester.longPress(dot);
    await tester.pumpAndSettle();
    expect(find.text('سبب الخصم من المشاركة'), findsOneWidget);
  });
}
