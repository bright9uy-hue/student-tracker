// js/grading-model.js — pure grading-category/grade-object logic, shared
// between the main app (js/store.js) and the standalone mobile grading app
// (mobile/js/store.js). Extracted out of js/store.js so the mobile app can
// load exactly this and nothing else (no WhatsApp/portfolio/full-overwrite
// -save code it has no business touching). No fetch, no DOM, no unrelated
// subsystem references — just functions that read/write a `store` object
// (assumed to already exist as `window.store`, with at least `subjects`
// and `defaultGradingCategories`) and category/grade objects passed to them.
//
// Load this before store.js in any page that uses it — see index.html and
// mobile/index.html.

window.isAssignmentsCategory = function(cat) {
    return !!cat && (cat.id === 'cat_assignments' || cat.key === 'assignments' || cat.name === 'الواجبات');
};

window.isActivitiesCategory = function(cat) {
    return !!cat && (cat.id === 'cat_activities' || cat.key === 'activities' || cat.name === 'الأنشطة' || cat.name === 'الأنشطة الصفية');
};

// Maps a category to the fixed legacy field name it mirrors (for backward
// compatibility with any code/exports that still read student.grades.*
// by the old fixed names). A genuinely custom category has no legacy alias.
window.legacyGradeFieldFor = function(cat) {
    if (isAssignmentsCategory(cat)) return 'assignments';
    if (isActivitiesCategory(cat)) return 'activities';
    if (cat.id === 'cat_research' || cat.name === 'البحث والمشاريع') return 'research';
    if (cat.id === 'cat_participation' || cat.type === 'participation') return 'participation';
    if (cat.id === 'cat_practical' || cat.name === 'الاختبار العملي') return 'practical';
    if (cat.id === 'cat_exam' || cat.name === 'الاختبار النهائي') return 'exam';
    return null;
};

window.normalizeGradingCategory = function(cat) {
    if (!cat) return cat;
    if ((cat.type === 'dots' || cat.type === 'participation') && !isAssignmentsCategory(cat)) {
        if (!cat.dotsCount || cat.dotsCount < 1) cat.dotsCount = cat.max || 10;
        if (!cat.pointValue || cat.pointValue <= 0) cat.pointValue = 1;
    }
    if (cat.noorBucket === undefined) {
        const legacyKey = legacyGradeFieldFor(cat);
        if (legacyKey === 'assignments' || legacyKey === 'activities' || legacyKey === 'research' || legacyKey === 'participation') {
            cat.noorBucket = '40';
        } else if (legacyKey === 'practical' || legacyKey === 'exam') {
            cat.noorBucket = '60';
        }
    }
    return cat;
};

const _normalizedCategoryArrays = new WeakSet();

// Maps a student's grade object (student.grades[periodId][subjectId]) to
// the exact categories array it was last normalized/sized against, so
// getStudentSubjectGrades can skip redundant re-normalization on every
// read (see its usage below).
const _normalizedGradeObjects = new WeakMap();

window.ensureSubjectCategories = function(subject) {
    if (!subject) return [];
    if (subject.gradingCategories && Array.isArray(subject.gradingCategories) && subject.gradingCategories.length > 0) {
        if (!_normalizedCategoryArrays.has(subject.gradingCategories)) {
            subject.gradingCategories.forEach(normalizeGradingCategory);
            _normalizedCategoryArrays.add(subject.gradingCategories);
        }
        return subject.gradingCategories;
    }
    subject.gradingCategories = JSON.parse(JSON.stringify(store.defaultGradingCategories));
    subject.gradingCategories.forEach(normalizeGradingCategory);
    _normalizedCategoryArrays.add(subject.gradingCategories);
    return subject.gradingCategories;
};

window.getActiveSubjectGradingCategories = function(subjectId = store.activeSubjectId) {
    const subj = store.subjects.find(s => s.id === subjectId);
    if (subj) return ensureSubjectCategories(subj);
    const fallback = JSON.parse(JSON.stringify(store.defaultGradingCategories));
    fallback.forEach(normalizeGradingCategory);
    return fallback;
};

// ------------------------------------------------------------
// Student grade object access — the single source of truth every scoring/
// report/export function reads from. Sizes/migrates each category's stored
// value to match its OWN dotsCount/max (not a stale global distribution),
// and mirrors legacy field names for older code that still reads them.
// ------------------------------------------------------------
window.getStudentSubjectGrades = function(student, subjectId = store.activeSubjectId, periodId = store.activePeriodId) {
    if (!student) return { assignments: [], activities: [], research: [], participation: [], practical: 0, exam: 0 };
    if (!student.grades) student.grades = {};
    if (!student.grades[periodId]) student.grades[periodId] = {};

    const categories = getActiveSubjectGradingCategories(subjectId);

    const isCurrentPeriodEmpty = !student.grades[periodId][subjectId] ||
        typeof student.grades[periodId][subjectId] !== 'object' ||
        Object.keys(student.grades[periodId][subjectId]).length === 0;

    if (isCurrentPeriodEmpty) {
        if (student.grades['period-1'] && student.grades['period-1'][subjectId] && typeof student.grades['period-1'][subjectId] === 'object') {
            student.grades[periodId][subjectId] = JSON.parse(JSON.stringify(student.grades['period-1'][subjectId]));
        } else if (student.grades[subjectId] && typeof student.grades[subjectId] === 'object') {
            student.grades[periodId][subjectId] = JSON.parse(JSON.stringify(student.grades[subjectId]));
        }
    }

    if (!student.grades[periodId][subjectId] || typeof student.grades[periodId][subjectId] !== 'object') {
        student.grades[periodId][subjectId] = {};
    }

    const g = student.grades[periodId][subjectId];

    // Skip the whole normalization pass below if this exact grade object was
    // already sized/mirrored against this exact categories array. Without
    // this, every read (including ones triggered purely by re-rendering,
    // e.g. once per dot per cell) re-runs the array-resize/legacy-mirroring
    // logic AND writes to reactive fields even when nothing changed, which
    // itself re-triggers Vue's reactivity and cascades into far more calls
    // than there are actual grades — measured at ~90,000 calls (~2.1s) for
    // a single dot click on a 35-student class before this cache existed.
    // Safe to skip: nothing about `g`'s own data changes between calls
    // except through onDotClick/onNumericChange (which write values, not
    // array shapes), and grading-setup edits assign a brand-new categories
    // array (see GradingSetupModal.js), which naturally misses this cache.
    if (_normalizedGradeObjects.get(g) !== categories) {
        categories.forEach(cat => {
            if (cat.max <= 0) return;
            const legacyKey = legacyGradeFieldFor(cat);

            if (cat.type === 'numeric') {
                const raw = g[cat.id] !== undefined ? g[cat.id] : (legacyKey ? g[legacyKey] : undefined);
                let val = parseFloat(raw) || 0;
                if (val < 0) val = 0;
                if (val > cat.max) val = cat.max;
                g[cat.id] = val;
                if (legacyKey) g[legacyKey] = val;
                return;
            }

            const targetLen = cat.dotsCount || cat.max || 10;
            let arr = Array.isArray(g[cat.id]) ? g[cat.id] : (legacyKey && Array.isArray(g[legacyKey]) ? g[legacyKey] : null);

            if (!arr) {
                arr = Array(targetLen).fill(false);
            } else if (arr.length !== targetLen) {
                const stringViolations = arr.filter(v => typeof v === 'string' && v.trim() !== '');
                const countTrue = arr.filter(v => v === true).length;
                const keep = Math.min(countTrue, targetLen);
                const resized = Array(targetLen).fill(false);
                for (let i = 0; i < keep; i++) resized[i] = true;
                stringViolations.forEach((v, idx) => {
                    const pos = targetLen - 1 - idx;
                    if (pos >= 0) resized[pos] = v;
                });
                arr = resized;
            }

            g[cat.id] = arr;
            if (legacyKey) g[legacyKey] = arr;
        });

        if (g.practical === undefined) g.practical = 0;
        if (g.exam === undefined) g.exam = 0;
        if (!Array.isArray(g.assignments)) g.assignments = [];
        if (!Array.isArray(g.activities)) g.activities = [];
        if (!Array.isArray(g.research)) g.research = [];
        if (!Array.isArray(g.participation)) g.participation = [];

        _normalizedGradeObjects.set(g, categories);
    }

    return g;
};
