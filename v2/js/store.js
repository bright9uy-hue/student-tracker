// v2/js/store.js — the single reactive state object for the Vue rewrite.
//
// Replaces the scattered top-level `let` variables from the old js/core.js
// (classes, activeClassId, subjects, ...) with one Vue.reactive() object,
// `store`, that every component reads/writes directly. Also carries the
// data-layer functions that read/write it (getStudentSubjectGrades,
// ensureSubjectCategories, load/saveData) — these were previously spread
// across core.js/ui.js in the old split; they belong together with the
// state they operate on.
//
// No ES modules (matches the old app's "no bundler" deployment) — this
// file just attaches `window.store` and a handful of plain functions that
// close over it, loaded before every other v2/js/*.js file.

window.store = Vue.reactive({
    // Core data
    classes: [],
    activeClassId: null,
    subjects: [],
    activeSubjectId: null,
    periods: [
        { id: 'period-1', name: 'الفترة الأولى', isArchived: false, createdAt: Date.now() }
    ],
    activePeriodId: 'period-1',

    // Legacy global distribution, kept only for backward-compatible reads of
    // very old data.json files that predate the per-subject gradingCategories
    // model; new/normalized subjects never rely on this.
    gradingDistribution: null,
    defaultGradingCategories: [
        { id: 'cat_assignments', name: 'الواجبات', max: 20, type: 'dots' },
        { id: 'cat_participation', name: 'المشاركة والتفاعل', max: 10, type: 'participation' },
        { id: 'cat_research', name: 'البحث والمشاريع', max: 10, type: 'dots' },
        { id: 'cat_practical', name: 'الاختبار العملي', max: 40, type: 'numeric' },
        { id: 'cat_exam', name: 'الاختبار النهائي', max: 20, type: 'numeric' }
    ],
    isConfiguringGlobalDefault: false,

    // WhatsApp / reporting settings
    whatsappNumber: '966578162072',
    lastReportDate: null,
    weeklyReportSchedule: { enabled: false, dayOfWeek: 4, hour: 15, minute: 0, lastAutoSentAt: null },

    portfolioSettings: {
        teacherName: '', jobTitle: '', jobNum: '', specialization: '',
        schoolName: '', schoolYear: '', vision: '', mission: '', philosophy: '',
        visitsRecord: '', strategyReport: '', classroomEnv: '',
        customForms: [],
        visitsImage: '', visitsImageName: '',
        strategyImage: '', strategyImageName: '',
        classroomEnvImage: '', classroomEnvImageName: ''
    },

    // UI-only state (not persisted) — replaces switchAppScreen()'s manual
    // style.display toggling with something components can just react to.
    currentScreen: 'classes', // 'classes' | 'dashboard'
    dataLoaded: false
});

// ------------------------------------------------------------
// Small utilities
// ------------------------------------------------------------
const safeStorage = {
    getItem(key) {
        try { return localStorage.getItem(key); }
        catch (e) { console.warn('localStorage is blocked, using memory fallback:', e); return safeStorage.mem[key] || null; }
    },
    setItem(key, value) {
        try { localStorage.setItem(key, value); }
        catch (e) { console.warn('localStorage is blocked, using memory fallback:', e); safeStorage.mem[key] = value; }
    },
    mem: {}
};

function getApiUrl(endpoint) {
    return window.location.protocol.startsWith('http') ? endpoint : 'http://localhost:8000' + endpoint;
}

window.getActiveClass = function() {
    return store.classes.find(c => c.id === store.activeClassId);
};
window.getActiveStudents = function() {
    const cls = getActiveClass();
    return cls ? (cls.students || []) : [];
};

// ------------------------------------------------------------
// Grading category helpers (operate on store.subjects)
// ------------------------------------------------------------
window.isAssignmentsCategory = function(cat) {
    return !!cat && (cat.id === 'cat_assignments' || cat.key === 'assignments' || cat.name === 'الواجبات');
};

// Maps a category to the fixed legacy field name it mirrors (for backward
// compatibility with any code/exports that still read student.grades.*
// by the old fixed names). A genuinely custom category has no legacy alias.
window.legacyGradeFieldFor = function(cat) {
    if (isAssignmentsCategory(cat)) return 'assignments';
    if (cat.id === 'cat_activities' || cat.name === 'الأنشطة' || cat.name === 'الأنشطة الصفية') return 'activities';
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

    return g;
};

// ------------------------------------------------------------
// Load / save
// ------------------------------------------------------------
function migrateStudentsData() {
    let migrated = false;
    const defaultSubjId = store.activeSubjectId || 'subject-1';
    store.classes.forEach(cls => {
        (cls.students || []).forEach(student => {
            if (!student.grades) {
                student.grades = {};
                student.grades[defaultSubjId] = {
                    assignments: Array.isArray(student.assignments) ? student.assignments : [],
                    activities: Array.isArray(student.activities) ? student.activities : [],
                    research: Array.isArray(student.research) ? student.research : [],
                    participation: Array.isArray(student.participation) ? student.participation : [],
                    practical: typeof student.practical === 'number' ? student.practical : 0,
                    exam: typeof student.exam === 'number' ? student.exam : 0
                };
                delete student.assignments; delete student.activities; delete student.research;
                delete student.participation; delete student.practical; delete student.exam;
                migrated = true;
            }
        });
    });
    if (migrated) saveData();
}

window.loadData = async function() {
    let stored = null;
    try {
        const res = await fetch(getApiUrl('/api/data'));
        const json = await res.json();
        if (json && Object.keys(json).length > 0) stored = JSON.stringify(json);
    } catch (e) {
        console.error('Failed to load from local server:', e);
    }

    const localStored = safeStorage.getItem('student_tracker_classes_v2');
    if (!stored && localStored) {
        stored = localStored;
        try {
            await fetch(getApiUrl('/api/data'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: localStored
            });
        } catch (e) {
            console.error('Failed to migrate data to server:', e);
        }
    }

    const defaults = () => ({
        teacherName: '', jobTitle: '', jobNum: '', specialization: '', schoolName: '',
        schoolYear: '', vision: '', mission: '', philosophy: '', visitsRecord: '',
        strategyReport: '', classroomEnv: ''
    });

    if (stored) {
        const parsed = JSON.parse(stored);
        store.classes = parsed.classes || [];
        store.activeClassId = parsed.activeClassId || null;
        store.whatsappNumber = parsed.whatsappNumber || '966578162072';
        store.lastReportDate = parsed.lastReportDate || null;
        store.weeklyReportSchedule = parsed.weeklyReportSchedule || { enabled: false, dayOfWeek: 4, hour: 15, minute: 0, lastAutoSentAt: null };
        store.gradingDistribution = parsed.gradingDistribution || null;
        store.subjects = parsed.subjects || [];
        store.activeSubjectId = parsed.activeSubjectId || null;
        store.periods = parsed.periods || [{ id: 'period-1', name: 'الفترة الأولى', isArchived: false, createdAt: Date.now() }];
        store.activePeriodId = parsed.activePeriodId || 'period-1';
        store.portfolioSettings = parsed.portfolioSettings || defaults();
    } else {
        store.classes = [];
        store.activeClassId = null;
        store.whatsappNumber = '966578162072';
        store.lastReportDate = null;
        store.weeklyReportSchedule = { enabled: false, dayOfWeek: 4, hour: 15, minute: 0, lastAutoSentAt: null };
        store.gradingDistribution = null;
        store.subjects = [];
        store.activeSubjectId = null;
        store.portfolioSettings = defaults();
    }
    store.portfolioSettings.customForms = store.portfolioSettings.customForms || [];

    if (store.gradingDistribution && store.subjects.length === 0) {
        store.subjects = [{ id: 'subject-1', name: 'رقمية 2' }];
        store.activeSubjectId = 'subject-1';
        store.activeClassId = store.activeClassId || null;
        await saveData();
    }

    if (store.classes.length > 0 && (!store.activeClassId || !store.classes.find(c => c.id === store.activeClassId))) {
        store.activeClassId = store.classes[0].id;
    }
    if (store.subjects.length > 0 && (!store.activeSubjectId || !store.subjects.find(s => s.id === store.activeSubjectId))) {
        store.activeSubjectId = store.subjects[0].id;
    }

    if (store.subjects.length > 0) {
        store.subjects.forEach(s => { if (!s.name || s.name.includes('?')) s.name = 'رقمية 2'; });
    }
    if (store.periods.length > 0) {
        store.periods.forEach(p => { if (!p.name || p.name.includes('?')) p.name = 'الفترة الأولى'; });
    }

    migrateStudentsData();
    store.dataLoaded = true;
};

let __pendingServerSave = null;
let __serverSaveTimer = null;

function __flushServerSave() {
    clearTimeout(__serverSaveTimer);
    __serverSaveTimer = null;
    if (!__pendingServerSave) return;
    const dataObj = __pendingServerSave;
    __pendingServerSave = null;
    fetch(getApiUrl('/api/data'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataObj)
    }).catch(e => console.error('Failed to save to local server:', e));
}
window.addEventListener('beforeunload', __flushServerSave);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') __flushServerSave();
});

window.saveData = async function() {
    store.classes.forEach(cls => {
        if (Array.isArray(cls.students)) cls.students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    });

    // Plain (non-reactive) snapshot for JSON serialization / server save.
    const dataObj = {
        classes: JSON.parse(JSON.stringify(store.classes)),
        activeClassId: store.activeClassId,
        whatsappNumber: store.whatsappNumber,
        lastReportDate: store.lastReportDate,
        weeklyReportSchedule: JSON.parse(JSON.stringify(store.weeklyReportSchedule)),
        gradingDistribution: store.gradingDistribution,
        subjects: JSON.parse(JSON.stringify(store.subjects)),
        activeSubjectId: store.activeSubjectId,
        portfolioSettings: JSON.parse(JSON.stringify(store.portfolioSettings)),
        periods: JSON.parse(JSON.stringify(store.periods)),
        activePeriodId: store.activePeriodId
    };

    safeStorage.setItem('student_tracker_classes_v2', JSON.stringify(dataObj));

    __pendingServerSave = dataObj;
    clearTimeout(__serverSaveTimer);
    __serverSaveTimer = setTimeout(__flushServerSave, 600);
};
