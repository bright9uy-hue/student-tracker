// Verifies the new student-name search within a class's grading screen.
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
            {'id': 's1', 'name': 'أحمد الشمري', 'grades': {}},
            {'id': 's2', 'name': 'سالم القحطاني', 'grades': {}},
            {'id': 's3', 'name': 'خالد أحمد', 'grades': {}},
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

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'roster': jsonEncode(_roster()),
      'config': jsonEncode({'laptopUrl': 'http://192.168.1.1:8000', 'deviceId': 'test-device'}),
    });
  });

  testWidgets('typing a name filters the student list, case/partial-insensitive to substring match', (tester) async {
    await tester.pumpWidget(const StudentTrackerMobileApp());
    await tester.pumpAndSettle();
    await tester.tap(find.text('فصل الاختبار'));
    await tester.pumpAndSettle();

    expect(find.text('أحمد الشمري'), findsOneWidget);
    expect(find.text('سالم القحطاني'), findsOneWidget);
    expect(find.text('خالد أحمد'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'أحمد');
    await tester.pumpAndSettle();

    // Both students with "أحمد" somewhere in their name should remain...
    expect(find.text('أحمد الشمري'), findsOneWidget);
    expect(find.text('خالد أحمد'), findsOneWidget);
    // ...and the non-matching one should be filtered out.
    expect(find.text('سالم القحطاني'), findsNothing);
  });

  testWidgets('a query matching nobody shows the empty-state message, not a blank list', (tester) async {
    await tester.pumpWidget(const StudentTrackerMobileApp());
    await tester.pumpAndSettle();
    await tester.tap(find.text('فصل الاختبار'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'زيد');
    await tester.pumpAndSettle();

    expect(find.text('لا يوجد طلاب مطابقون.'), findsOneWidget);
  });
}
