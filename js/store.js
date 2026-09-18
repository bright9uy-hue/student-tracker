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
        classroomEnvImage: '', classroomEnvImageName: '',
        viceNumber: ''
    },

    // Student counselors ({ id, name, phone }) - a school can have more than
    // one, split by grade/stage, so each class picks which one it belongs to
    // (class.counselorId) instead of there being a single school-wide number.
    counselors: [],

    // Cross-device sync bookkeeping (see js/sync.js) - tombstones for
    // classes/subjects deleted locally (id -> deletedAt ms) so a merge
    // against the mobile app's data doesn't silently resurrect them, plus
    // a single updatedAt for the periods/activePeriodId/
    // defaultGradingCategories bundle (edited rarely enough that one
    // shared timestamp is fine, unlike classes/subjects below).
    deletedClassIds: {},
    deletedSubjectIds: {},
    metaUpdatedAt: 0,

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
// Grading category + grade-object helpers (isAssignmentsCategory,
// isActivitiesCategory, legacyGradeFieldFor, normalizeGradingCategory,
// ensureSubjectCategories, getActiveSubjectGradingCategories,
// getStudentSubjectGrades) now live in js/grading-model.js, shared with
// the standalone mobile grading app (mobile/js/store.js) — index.html
// loads that file before this one.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Subject management — global (not Dashboard-local) since the subject
// tabs/add/rename/delete controls render inside GradingTable's own
// toolbar, not Dashboard's template.
// ------------------------------------------------------------
window.switchSubject = function(id) { store.activeSubjectId = id; saveData(); };

window.addSubject = async function() {
    const name = await showPrompt('اسم المادة الجديدة:');
    if (!name || !name.trim()) return;
    const newSubject = { id: 'subject-' + Date.now(), name: name.trim() };
    store.subjects.push(newSubject);
    store.activeSubjectId = newSubject.id;
    saveData();
    showNotification(`تمت إضافة مادة "${newSubject.name}".`);
};

window.renameSubject = async function(subj) {
    const name = await showPrompt('أدخل الاسم الجديد للمادة:', subj.name);
    if (name && name.trim()) { subj.name = name.trim(); saveData(); showNotification('تم تعديل اسم المادة.'); }
};

window.deleteSubject = function(subj) {
    if (store.subjects.length === 1) { showNotification('لا يمكن حذف المادة الوحيدة!', 'error'); return; }
    if (!confirm(`هل أنت متأكد من حذف مادة "${subj.name}"؟ سيتم حذف جميع درجات هذه المادة فقط لكافة الطلاب في جميع الفصول!`)) return;
    store.classes.forEach(c => (c.students || []).forEach(s => { if (s.grades && s.grades[subj.id]) delete s.grades[subj.id]; }));
    store.subjects = store.subjects.filter(s => s.id !== subj.id);
    if (store.activeSubjectId === subj.id) store.activeSubjectId = store.subjects[0].id;
    saveData();
    showNotification(`تم حذف مادة "${subj.name}".`, 'warning');
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

// Tracks the server's data.json mtime (from GET /api/mobile/version - a
// tiny endpoint that already existed for the mobile app's own polling) so
// the periodic auto-refresh below can tell "something changed elsewhere
// (e.g. a mobile sync)" apart from "nothing new, skip the reload".
let __lastKnownDataVersion = null;

async function __refreshKnownDataVersion() {
    try {
        const res = await fetch(getApiUrl('/api/mobile/version'));
        const { version } = await res.json();
        __lastKnownDataVersion = version;
    } catch (e) { /* best-effort - a stale version just means one extra poll cycle */ }
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
        strategyReport: '', classroomEnv: '', viceNumber: ''
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
        store.counselors = parsed.counselors || [];
        store.deletedClassIds = parsed.deletedClassIds || {};
        store.deletedSubjectIds = parsed.deletedSubjectIds || {};
        store.metaUpdatedAt = parsed.metaUpdatedAt || 0;
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
        store.counselors = [];
        store.deletedClassIds = {};
        store.deletedSubjectIds = {};
        store.metaUpdatedAt = 0;
    }
    store.portfolioSettings.customForms = store.portfolioSettings.customForms || [];
    if (store.portfolioSettings.viceNumber == null) store.portfolioSettings.viceNumber = '';

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
    __captureSyncSnapshot();
    store.dataLoaded = true;
    await __refreshKnownDataVersion();
};

// ------------------------------------------------------------
// Sync bookkeeping (see js/sync.js): every mutation already funnels
// through saveData() -> __performSave() (the single choke point below),
// so instead of hunting down and manually bumping a timestamp at every
// individual mutation call site across the codebase (GradingTable.js,
// ClassesPanel.js, StudentModal.js, ...), __stampSyncMetadata() diffs the
// current state against a cached snapshot of what was last persisted and
// stamps only the parts that actually changed. This is what lets the
// sync-data Edge Function do a field-level merge (roster/attendance/
// groups independently per class) instead of a whole-roster overwrite
// that would risk losing edits made on the other device.
// ------------------------------------------------------------
let __lastSyncSnapshot = null;

function __rosterKey(cls) { return JSON.stringify({ name: cls.name, students: cls.students || [] }); }
function __attendanceKey(cls) { return JSON.stringify(cls.attendance || {}); }
function __groupsKey(cls) { return JSON.stringify(cls.groups || []); }
function __subjectKey(subj) { return JSON.stringify({ name: subj.name, gradingCategories: subj.gradingCategories || [] }); }
function __metaKey() {
    return JSON.stringify({
        periods: store.periods,
        activePeriodId: store.activePeriodId,
        defaultGradingCategories: store.defaultGradingCategories
    });
}

function __captureSyncSnapshot() {
    __lastSyncSnapshot = {
        classesById: Object.fromEntries(store.classes.map(c => [c.id, {
            roster: __rosterKey(c), attendance: __attendanceKey(c), groups: __groupsKey(c)
        }])),
        subjectsById: Object.fromEntries(store.subjects.map(s => [s.id, __subjectKey(s)])),
        meta: __metaKey()
    };
}

function __stampSyncMetadata() {
    if (!__lastSyncSnapshot) { __captureSyncSnapshot(); return; }
    const now = Date.now();
    const prev = __lastSyncSnapshot;

    const currentClassIds = new Set(store.classes.map(c => c.id));
    for (const cls of store.classes) {
        const old = prev.classesById[cls.id];
        if (!old) {
            cls.rosterUpdatedAt = now;
            cls.attendanceUpdatedAt = now;
            cls.groupsUpdatedAt = now;
            continue;
        }
        if (__rosterKey(cls) !== old.roster) cls.rosterUpdatedAt = now;
        if (__attendanceKey(cls) !== old.attendance) cls.attendanceUpdatedAt = now;
        if (__groupsKey(cls) !== old.groups) cls.groupsUpdatedAt = now;
    }
    for (const id of Object.keys(prev.classesById)) {
        if (!currentClassIds.has(id)) store.deletedClassIds[id] = now;
    }
    for (const id of currentClassIds) delete store.deletedClassIds[id];

    const currentSubjectIds = new Set(store.subjects.map(s => s.id));
    for (const subj of store.subjects) {
        const oldKey = prev.subjectsById[subj.id];
        if (oldKey === undefined || __subjectKey(subj) !== oldKey) subj.updatedAt = now;
    }
    for (const id of Object.keys(prev.subjectsById)) {
        if (!currentSubjectIds.has(id)) store.deletedSubjectIds[id] = now;
    }
    for (const id of currentSubjectIds) delete store.deletedSubjectIds[id];

    if (__metaKey() !== prev.meta) store.metaUpdatedAt = now;

    __captureSyncSnapshot();
}

let __pendingServerSave = null;
let __serverSaveTimer = null;

// True from the moment saveData() is first called until the resulting
// POST /api/data has actually resolved - spans both debounce stages plus
// the network round trip. This (not the debounce timer IDs below, which
// stay non-null forever after they first fire and so are useless as an
// "is anything pending" check) is what the auto-refresh poll relies on to
// never reload while a local edit hasn't reached the server yet.
let __hasPendingLocalEdit = false;

function __flushServerSave() {
    clearTimeout(__serverSaveTimer);
    __serverSaveTimer = null;
    if (!__pendingServerSave) { __hasPendingLocalEdit = false; return; }
    const dataObj = __pendingServerSave;
    __pendingServerSave = null;
    fetch(getApiUrl('/api/data'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataObj)
    }).then(res => res.json()).then(async json => {
        if (json && json.mergedMobileChanges > 0) {
            // The server just merged grade cells recorded on the phone into
            // what we saved - what we hold in `store` right now is now
            // behind what's actually on disk (our own save didn't know
            // about those cells). Pull the merged result back in, or those
            // cells would sit invisible until some unrelated later change
            // happened to trigger a reload.
            await loadData();
        } else if (json && typeof json.version === 'number') {
            // Remember the version our own save just produced, so the
            // auto-refresh poll below doesn't mistake it for an
            // externally-made change and reload right after we just saved.
            __lastKnownDataVersion = json.version;
        }
    }).catch(e => console.error('Failed to save to local server:', e))
      .finally(() => { __hasPendingLocalEdit = false; });
}
window.addEventListener('beforeunload', () => __flushAllPendingSaves());
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') __flushAllPendingSaves();
});

// The actual save is a synchronous, non-trivial chunk of work (a
// localeCompare sort across every class's students, plus several full
// JSON.stringify/parse deep clones of the whole store) - fine once per
// edit, but every prior caller invoked it directly on every single grade
// tap/keystroke with no batching at all (only the *server* push below was
// debounced). On a phone's weaker CPU that's enough per-tap work to read
// as real lag during fast repeated grading. __saveDebounceTimer batches
// bursts of edits into one pass instead, same trailing-debounce idea as
// the server push, just covering the whole function now.
let __saveDebounceTimer = null;

function __performSave() {
    store.classes.forEach(cls => {
        if (Array.isArray(cls.students)) cls.students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    });

    __stampSyncMetadata();

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
        activePeriodId: store.activePeriodId,
        counselors: JSON.parse(JSON.stringify(store.counselors)),
        deletedClassIds: JSON.parse(JSON.stringify(store.deletedClassIds)),
        deletedSubjectIds: JSON.parse(JSON.stringify(store.deletedSubjectIds)),
        metaUpdatedAt: store.metaUpdatedAt
    };

    safeStorage.setItem('student_tracker_classes_v2', JSON.stringify(dataObj));

    __pendingServerSave = dataObj;
    clearTimeout(__serverSaveTimer);
    __serverSaveTimer = setTimeout(__flushServerSave, 600);
}

window.saveData = async function() {
    __hasPendingLocalEdit = true;
    clearTimeout(__saveDebounceTimer);
    __saveDebounceTimer = setTimeout(__performSave, 300);
};

// Forces any batched-but-not-yet-run save (both the debounce above and the
// server push's own) to happen right now - used when the page is about to
// actually go away, where waiting out either debounce could lose the last
// edit entirely.
function __flushAllPendingSaves() {
    if (__saveDebounceTimer) {
        clearTimeout(__saveDebounceTimer);
        __saveDebounceTimer = null;
        __performSave();
    }
    __flushServerSave();
}

// ------------------------------------------------------------
// Auto-refresh: picks up changes made elsewhere (namely, grades recorded
// via the phone's Flutter app, which write straight to data.json through
// /api/mobile/sync and never touch this browser tab's `store` directly) so
// the teacher doesn't have to press F5 to see them. Polls the same cheap
// version endpoint the mobile app itself already polls, and only reloads
// when the version actually moved.
//
// Two guards keep this from ever fighting a live edit: it skips the reload
// entirely while __hasPendingLocalEdit is set (a local edit hasn't reached
// the server yet, so a reload right now would show a value older than
// what's on screen, or get overwritten by that edit's own save moments
// later anyway), and while focus is inside any text input (a numeric grade
// field only saves on blur, so mid-typing there's no pending-save flag to
// catch it yet - the focus check is what does).
// ------------------------------------------------------------
let __autoRefreshInFlight = false;

async function __checkForExternalDataChanges() {
    if (__autoRefreshInFlight) return;
    if (__hasPendingLocalEdit) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

    __autoRefreshInFlight = true;
    try {
        const res = await fetch(getApiUrl('/api/mobile/version'));
        const { version } = await res.json();
        if (__lastKnownDataVersion !== null && version !== __lastKnownDataVersion) {
            await loadData();
        } else {
            __lastKnownDataVersion = version;
        }
    } catch (e) {
        // Best-effort background poll - a real connectivity problem will
        // already surface loudly via the next manual save attempt.
    } finally {
        __autoRefreshInFlight = false;
    }
}

setInterval(__checkForExternalDataChanges, 8000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') __checkForExternalDataChanges();
});
