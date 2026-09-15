import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:student_tracker_mobile/main.dart';

void main() {
  testWidgets('App boots to the connect screen with no saved roster', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const StudentTrackerMobileApp());
    await tester.pumpAndSettle();
    expect(find.text('الاتصال بجهاز المعلم'), findsOneWidget);
  });
}
