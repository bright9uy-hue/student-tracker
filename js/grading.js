// v2/js/grading.js — pure scoring logic, no DOM. Ported from js/grading.js's
// GRADE CALCULATIONS section. Components call these to get numbers; they
// never build HTML strings for them (that was the core problem with the
// old app — this file has zero document.* references).

window.getCheckboxSum = function(arr, pointValue = 1, maxVal = Infinity) {
    if (!Array.isArray(arr)) return parseFloat(arr) || 0;
    const count = arr.filter(v => v === true).length;
    return Math.max(0, Math.min(maxVal, Math.round(count * pointValue * 100) / 100));
};

// Highest assignment slot index any student in the class has a recorded
// value for, +1 — i.e. "how many assignments have actually been given so
// far" (used to score assignments as a ratio of what's been given, not the
// category's full max, since ungraded-yet slots shouldn't count against a
// student).
window.getActiveAssignmentsCount = function(activeClass, subjectId = store.activeSubjectId) {
    if (!activeClass || !Array.isArray(activeClass.students) || activeClass.students.length === 0) return 0;
    const categories = getActiveSubjectGradingCategories(subjectId);
    const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
    const maxAssignmentsCount = cat ? cat.max : 10;

    let highestSlotIndex = -1;
    for (let i = maxAssignmentsCount - 1; i >= 0; i--) {
        const hasAnyStudentMarked = activeClass.students.some(s => {
            const grades = getStudentSubjectGrades(s, subjectId);
            const assignArr = grades ? (grades.assignments || grades['cat_assignments']) : null;
            if (!Array.isArray(assignArr)) return false;
            const val = assignArr[i];
            return val === true || (typeof val === 'string' && val.trim() !== '');
        });
        if (hasAnyStudentMarked) { highestSlotIndex = i; break; }
    }
    return highestSlotIndex + 1;
};

window.getStudentAssignmentScore = function(student, subjectId = store.activeSubjectId, maxVal = 10, cls = null) {
    const totalGiven = getActiveAssignmentsCount(cls || getActiveClass(), subjectId);
    if (totalGiven === 0) return 0;

    const gradesObj = getStudentSubjectGrades(student, subjectId);
    const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : null;
    if (!Array.isArray(assignArr)) return 0;

    let solvedCount = 0;
    for (let i = 0; i < totalGiven; i++) {
        if (assignArr[i] === true) solvedCount++;
    }
    const score = (solvedCount / totalGiven) * maxVal;
    return Math.max(0, Math.min(maxVal, Math.round(score)));
};

window.getParticipationScore = function(arr, maxVal, pointValue = 1) {
    if (!Array.isArray(arr)) return parseFloat(arr) || 0;
    if (maxVal === undefined) maxVal = store.gradingDistribution ? store.gradingDistribution.participation : 10;
    let score = 0;
    arr.forEach(v => {
        if (v === true) score += pointValue;
        else if (typeof v === 'string' && v) score -= pointValue;
    });
    score = Math.round(score * 100) / 100;
    return Math.max(0, Math.min(maxVal, score));
};

// Earned score for one student in one grading category — the single place
// that dispatches on category type, used by the table, dashboard, exports,
// and reports alike so a scoring fix only has to be made once.
window.getCategoryEarnedScore = function(student, cat, subjectId = store.activeSubjectId, cls = null) {
    if (cat.max <= 0) return 0;
    const gradesObj = getStudentSubjectGrades(student, subjectId);
    const val = gradesObj[cat.id] !== undefined ? gradesObj[cat.id] : (gradesObj[cat.key] || 0);
    if (isAssignmentsCategory(cat)) {
        return getStudentAssignmentScore(student, subjectId, cat.max, cls);
    } else if (cat.type === 'dots') {
        return getCheckboxSum(val, cat.pointValue, cat.max);
    } else if (cat.type === 'participation') {
        return getParticipationScore(val, cat.max, cat.pointValue);
    } else if (cat.type === 'numeric') {
        return parseFloat(val) || 0;
    }
    return 0;
};

window.getStudentTotal = function(student, subjectId = store.activeSubjectId, cls = null) {
    const categories = getActiveSubjectGradingCategories(subjectId);
    let total = 0;
    categories.forEach(cat => { total += getCategoryEarnedScore(student, cat, subjectId, cls); });
    return Math.round(total);
};

window.getStudentStatus = function(total) {
    if (total >= 90) return 'excellent';
    if (total >= 50) return 'pass';
    return 'fail';
};

// { text, color, icon } for a status badge — components render this,
// instead of a function returning an HTML string (buildStatusBadge() in
// the old app).
window.getStatusBadgeInfo = function(status) {
    if (status === 'excellent') return { text: 'ممتاز', color: '#10b981', icon: 'fa-star' };
    if (status === 'pass') return { text: 'ناجح', color: '#f59e0b', icon: 'fa-circle-check' };
    return { text: 'متعثر', color: '#ef4444', icon: 'fa-triangle-exclamation' };
};

// Visual state {cls, tip} for one grading dot — shared by the table and the
// bulk-grade dots so both stay pixel/wording-identical to before.
window.getDotVisual = function(val, isAssign, index) {
    let cls = 'table-checkbox';
    let tip = `الدرجة ${index + 1}`;
    if (isAssign) {
        if (val === true) { cls += ' checked'; tip = `واجب ${index + 1}: تم الحل والتسليم ✅`; }
        else if (typeof val === 'string' && val) { cls += ' deduction'; tip = `واجب ${index + 1}: لم يحل الواجب (خصم) ❌`; }
        else { tip = `واجب ${index + 1}: لم نصل إليه بعد ⚪`; }
    } else {
        if (val === true) { cls += ' checked'; tip = `إيجابية ${index + 1}`; }
        else if (typeof val === 'string' && val) { cls += ' deduction'; tip = `خصم: ${val}`; }
    }
    return { cls, tip };
};
