// js/smart-insights.js — rule-based "smart alerts" for a class: detects
// patterns already implied by grading.js's own scoring functions (low
// total, a drop vs. the previous period, missed assignments, zero
// participation, repeated behavior violations) and surfaces each with a
// concrete next step. No external AI/service involved - every rule reads
// data the app already stores. Where a sensible next step already exists
// as a feature (ReferralModal, RandomPickerModal), the alert points at it
// via actionType/actionLabel instead of inventing a new one.
// Re-derives "assignments given so far" and a student's total for an
// ARBITRARY (possibly non-active) period, without touching
// store.activePeriodId. getActiveAssignmentsCount/getStudentTotal always
// read the CURRENT active period implicitly, so they can't be reused
// directly for a past period; the natural fix of temporarily swapping
// store.activePeriodId and restoring it is unsafe here, since this file's
// alerts get computed inside a live Vue computed (SmartAlertsPanel) that
// itself depends on store.activePeriodId - mutating a computed's own
// dependency while it's mid-evaluation is a reactivity footgun (observed
// as the app hanging/crashing during testing). This stays a pure read.
function _givenAssignmentsForPeriod(activeClass, subjectId, periodId, maxCount) {
    for (let i = maxCount - 1; i >= 0; i--) {
        const anyMarked = activeClass.students.some(s => {
            const grades = getStudentSubjectGrades(s, subjectId, periodId);
            const arr = grades ? (grades.assignments || grades['cat_assignments']) : null;
            if (!Array.isArray(arr)) return false;
            const val = arr[i];
            return val === true || (typeof val === 'string' && val.trim() !== '');
        });
        if (anyMarked) return i + 1;
    }
    return 0;
}

function _studentTotalForPeriod(student, subjectId, activeClass, periodId) {
    const categories = getActiveSubjectGradingCategories(subjectId);
    const gradesObj = getStudentSubjectGrades(student, subjectId, periodId);
    let total = 0;
    categories.forEach(cat => {
        if (cat.max <= 0) return;
        const val = gradesObj[cat.id] !== undefined ? gradesObj[cat.id] : (gradesObj[cat.key] || 0);
        if (isAssignmentsCategory(cat)) {
            const given = _givenAssignmentsForPeriod(activeClass, subjectId, periodId, cat.max);
            if (given === 0) return;
            const arr = Array.isArray(val) ? val : [];
            let solved = 0;
            for (let i = 0; i < given; i++) { if (arr[i] === true) solved++; }
            total += Math.max(0, Math.min(cat.max, Math.round((solved / given) * cat.max)));
        } else if (cat.type === 'dots') {
            total += getCheckboxSum(val, cat.pointValue, cat.max);
        } else if (cat.type === 'participation') {
            total += getParticipationScore(val, cat.max, cat.pointValue);
        } else if (cat.type === 'numeric') {
            total += parseFloat(val) || 0;
        }
    });
    return Math.round(total);
}

window.getStudentSmartAlerts = function(student, activeClass, subjectId = store.activeSubjectId, periodId = store.activePeriodId) {
    const alerts = [];
    if (!student || !activeClass) return alerts;

    const total = getStudentTotal(student, subjectId, activeClass);
    const categories = getActiveSubjectGradingCategories(subjectId);
    const gradesObj = getStudentSubjectGrades(student, subjectId, periodId);

    // 1. Low overall level.
    if (total < 50) {
        alerts.push({
            type: 'low_total', severity: 'high', icon: 'fa-triangle-exclamation',
            title: 'مستوى متدنٍ',
            message: `المجموع الحالي ${total} من 100 (أقل من درجة النجاح).`,
            suggestion: 'يُنصح بالتواصل مع ولي الأمر ومتابعة الطالب عن قرب.',
            actionType: 'referral', actionLabel: 'فتح نموذج الإحالة'
        });
    }

    // 2. Drop compared to the period immediately before this one.
    const periodIdx = store.periods.findIndex(p => p.id === periodId);
    if (periodIdx > 0) {
        const prevPeriod = store.periods[periodIdx - 1];
        const prevTotal = _studentTotalForPeriod(student, subjectId, activeClass, prevPeriod.id);

        if (prevTotal - total >= 15) {
            alerts.push({
                type: 'drop', severity: 'high', icon: 'fa-arrow-trend-down',
                title: 'تراجع في المستوى',
                message: `انخفض المجموع من ${prevTotal} في "${prevPeriod.name}" إلى ${total} حالياً.`,
                suggestion: 'يُنصح بمعرفة سبب التراجع ومتابعة الطالب عن قرب.',
                actionType: 'referral', actionLabel: 'فتح نموذج الإحالة'
            });
        }
    }

    // 3. Missed assignments (only once a meaningful number have actually
    // been given, so a brand-new subject with 0-1 assignments so far never
    // triggers this).
    const assignCat = categories.find(isAssignmentsCategory);
    if (assignCat) {
        const given = getActiveAssignmentsCount(activeClass, subjectId);
        if (given > 0) {
            const arr = gradesObj[assignCat.id] || gradesObj.assignments || gradesObj['cat_assignments'] || [];
            let missed = 0;
            for (let i = 0; i < given; i++) { if (arr[i] !== true) missed++; }
            if (missed >= 3 && missed / given >= 0.4) {
                alerts.push({
                    type: 'missed_assignments', severity: 'medium', icon: 'fa-file-circle-exclamation',
                    title: 'تعثر في تسليم الواجبات',
                    message: `لم يُسلّم ${missed} من ${given} واجبات مطلوبة.`,
                    suggestion: 'يُنصح بمنحه مهلة إضافية ومتابعة أسباب التأخر.',
                    actionType: 'referral', actionLabel: 'فتح نموذج الإحالة'
                });
            }
        }
    }

    // 4. Zero positive participation recorded this period.
    const participCat = categories.find(c => c.type === 'participation');
    if (participCat) {
        const arr = gradesObj[participCat.id] || gradesObj[participCat.key] || gradesObj.participation || [];
        const hasPositive = Array.isArray(arr) && arr.some(v => v === true);
        if (!hasPositive) {
            alerts.push({
                type: 'no_participation', severity: 'low', icon: 'fa-comment-slash',
                title: 'لم يشارك حتى الآن',
                message: 'لم تُسجَّل له أي مشاركة إيجابية في هذه الفترة.',
                suggestion: 'استخدم القرعة العشوائية في الحصص القادمة لزيادة فرصة مشاركته.',
                actionType: 'random_picker', actionLabel: 'فتح القرعة العشوائية'
            });
        }
    }

    // 5. Repeated behavior violations - any non-empty string in a
    // dots/participation category array is a logged deduction reason.
    let violationCount = 0;
    categories.forEach(cat => {
        if (cat.type !== 'dots' && cat.type !== 'participation') return;
        const arr = gradesObj[cat.id] || gradesObj[cat.key] || [];
        if (Array.isArray(arr)) violationCount += arr.filter(v => typeof v === 'string' && v.trim() !== '').length;
    });
    if (violationCount >= 2) {
        alerts.push({
            type: 'behavior', severity: 'medium', icon: 'fa-flag',
            title: 'تكرار ملاحظات سلوكية',
            message: `تم تسجيل ${violationCount} ملاحظة/خصم سلوكي لهذا الطالب.`,
            suggestion: 'يُنصح بتعبئة نموذج إحالة سلوكية رسمي لتوثيق الحالة.',
            actionType: 'referral', actionLabel: 'فتح نموذج الإحالة'
        });
    }

    return alerts;
};

// Flattened, severity-sorted alerts for every student in a class - what
// the Dashboard's smart-alerts panel renders.
window.getClassSmartAlerts = function(activeClass, subjectId = store.activeSubjectId, periodId = store.activePeriodId) {
    if (!activeClass || !Array.isArray(activeClass.students)) return [];
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const result = [];
    activeClass.students.forEach(student => {
        getStudentSmartAlerts(student, activeClass, subjectId, periodId).forEach(alert => {
            result.push({ student, ...alert });
        });
    });
    result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    return result;
};
