// Verifies the Dart port of js/grading-model.js + js/grading.js computes
// identically to the original — these are the exact scenarios the web
// app's own Playwright tests covered earlier this session (assignments/
// activities given-ratio scoring, participation deduction cycling, dot
// array resizing), re-expressed as Dart unit tests since there's no
// browser to drive here.
import 'package:flutter_test/flutter_test.dart';
import 'package:student_tracker_mobile/models/grading_category.dart';
import 'package:student_tracker_mobile/models/grading_logic.dart';
import 'package:student_tracker_mobile/models/roster.dart';
import 'package:student_tracker_mobile/models/scoring.dart';

Roster buildRoster({required List<GradingCategory> categories, required List<Student> students}) {
  final subject = Subject(id: 'subj-1', name: 'العلوم', gradingCategories: categories);
  final cls = SchoolClass(id: 'class-1', name: 'فصل الاختبار', students: students);
  return Roster(
    classes: [cls],
    subjects: [subject],
    periods: [
      {'id': 'period-1', 'name': 'الفترة الأولى'}
    ],
    activePeriodId: 'period-1',
    defaultGradingCategories: categories,
  );
}

void main() {
  group('getStudentSubjectGrades normalization', () {
    test('creates a false-filled array sized to dotsCount for a fresh student', () {
      final cat = GradingCategory(id: 'cat_p1', name: 'المشاركة', type: 'dots', max: 10);
      final student = Student(id: 's1', name: 'أحمد');
      final roster = buildRoster(categories: [cat], students: [student]);

      final g = getStudentSubjectGrades(student, roster, 'subj-1', 'period-1');
      expect(g['cat_p1'], List.filled(10, false));
    });

    test('resizes an existing array to a changed dotsCount, keeping earned trues and moving deductions to the tail', () {
      final cat = GradingCategory(id: 'cat_p1', name: 'المشاركة', type: 'dots', max: 5, dotsCount: 5);
      final student = Student(id: 's1', name: 'أحمد', grades: {
        'period-1': {
          'subj-1': {
            'cat_p1': [true, true, 'نائم', false, false, false, false, false, false, false] // was sized 10
          }
        }
      });
      final roster = buildRoster(categories: [cat], students: [student]);

      final g = getStudentSubjectGrades(student, roster, 'subj-1', 'period-1');
      final arr = g['cat_p1'] as List;
      expect(arr.length, 5);
      // 2 trues kept at the front, the one string violation moved to the tail.
      expect(arr[0], true);
      expect(arr[1], true);
      expect(arr[4], 'نائم');
    });

    test('numeric category clamps to [0, max]', () {
      final cat = GradingCategory(id: 'cat_exam', name: 'الاختبار', type: 'numeric', max: 20);
      final student = Student(id: 's1', name: 'أحمد', grades: {
        'period-1': {
          'subj-1': {'cat_exam': 999}
        }
      });
      final roster = buildRoster(categories: [cat], students: [student]);
      final g = getStudentSubjectGrades(student, roster, 'subj-1', 'period-1');
      expect(g['cat_exam'], 20.0);
    });
  });

  group('assignments/activities given-ratio scoring', () {
    test('only the highest given slot across the class counts, ungraded-yet slots do not penalize', () {
      final cat = GradingCategory(id: 'cat_assignments', name: 'الواجبات', type: 'dots', max: 10);
      // Slot 0 and 1 have been given (someone marked them); slots 2-9 are
      // untouched (still all-false, meaning "not assigned yet").
      final s1 = Student(id: 's1', name: 'أحمد', grades: {
        'period-1': {
          'subj-1': {
            'cat_assignments': [true, true, false, false, false, false, false, false, false, false]
          }
        }
      });
      final s2 = Student(id: 's2', name: 'سالم', grades: {
        'period-1': {
          'subj-1': {
            'cat_assignments': [true, false, false, false, false, false, false, false, false, false]
          }
        }
      });
      final roster = buildRoster(categories: [cat], students: [s1, s2]);
      final cls = roster.classes.first;

      // s1 solved 2 of 2 given -> full 10; s2 solved 1 of 2 given -> 5.
      expect(getStudentAssignmentScore(s1, roster, cls, 'subj-1', 'period-1', 10), 10);
      expect(getStudentAssignmentScore(s2, roster, cls, 'subj-1', 'period-1', 10), 5);
    });

    test('activities category is scored identically via its own field', () {
      final cat = GradingCategory(id: 'cat_activities', name: 'الأنشطة الصفية', type: 'dots', max: 10);
      final s1 = Student(id: 's1', name: 'أحمد', grades: {
        'period-1': {
          'subj-1': {
            'cat_activities': [true, false, false, false, false, false, false, false, false, false]
          }
        }
      });
      final roster = buildRoster(categories: [cat], students: [s1]);
      final cls = roster.classes.first;
      expect(getStudentActivityScore(s1, roster, cls, 'subj-1', 'period-1', 10), 10);
    });
  });

  group('participation scoring and dot visuals', () {
    test('true adds pointValue, a deduction string subtracts it, clamped to [0, max]', () {
      final arr = [true, true, 'نائم', false];
      expect(getParticipationScore(arr, 10, 1), 1); // 2 - 1 = 1
    });

    test('getDotVisual distinguishes checked/deduction/empty with the right Arabic tooltips', () {
      expect(getDotVisual(true, false, 0, false).state, 'checked');
      expect(getDotVisual('نائم', false, 0, false).state, 'deduction');
      expect(getDotVisual(false, false, 0, false).state, 'empty');
      expect(getDotVisual(true, true, 2, false).tip, contains('واجب 3'));
      expect(getDotVisual(true, false, 4, true).tip, contains('نشاط 5'));
    });
  });

  group('category classification', () {
    test('isAssignmentsCategory matches by id, key, or Arabic name', () {
      expect(isAssignmentsCategory(GradingCategory(id: 'cat_assignments', name: 'x', type: 'dots', max: 10)), true);
      expect(isAssignmentsCategory(GradingCategory(id: 'other', name: 'الواجبات', type: 'dots', max: 10)), true);
      expect(isAssignmentsCategory(GradingCategory(id: 'other', name: 'شيء آخر', type: 'dots', max: 10)), false);
    });

    test('isActivitiesCategory matches both Arabic name variants', () {
      expect(isActivitiesCategory(GradingCategory(id: 'x', name: 'الأنشطة', type: 'dots', max: 10)), true);
      expect(isActivitiesCategory(GradingCategory(id: 'x', name: 'الأنشطة الصفية', type: 'dots', max: 10)), true);
    });
  });

  group('getStudentTotal + status', () {
    test('sums every category and rounds to a whole grade', () {
      final numeric = GradingCategory(id: 'cat_exam', name: 'الاختبار', type: 'numeric', max: 20);
      final dots = GradingCategory(id: 'cat_p1', name: 'المشاركة', type: 'dots', max: 10, pointValue: 1, dotsCount: 10);
      final student = Student(id: 's1', name: 'أحمد', grades: {
        'period-1': {
          'subj-1': {
            'cat_exam': 15,
            'cat_p1': [true, true, true, false, false, false, false, false, false, false]
          }
        }
      });
      final roster = buildRoster(categories: [numeric, dots], students: [student]);
      final cls = roster.classes.first;
      final total = getStudentTotal(student, roster, cls, 'subj-1', 'period-1');
      expect(total, 18); // 15 + 3
      expect(getStudentStatus(total), 'fail'); // < 50 on this small 2-category example
    });
  });
}
