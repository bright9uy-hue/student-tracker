// mobile/js/store.js — the standalone mobile grading app's own, much
// smaller reactive store. Deliberately NOT the same file as js/store.js:
// that one's saveData() is a full-overwrite POST to /api/data and carries
// WhatsApp/portfolio/settings state this app has no business touching.
// This file instead persists to IndexedDB (via mobile-db.js) and queues a
// change-log entry per edited grade cell for mobile-sync.js to push later.
//
// Reuses js/grading-model.js's category/grade-object logic unchanged
// (loaded before this file — see mobile/index.html) by providing the same
// `window.store` shape those functions expect (subjects, activeSubjectId,
// activePeriodId, defaultGradingCategories).

window.store = Vue.reactive({
    classes: [],
    activeClassId: null,
    subjects: [],
    activeSubjectId: null,
    periods: [{ id: 'period-1', name: 'الفترة الأولى', isArchived: false, createdAt: Date.now() }],
    activePeriodId: 'period-1',

    // Same defaults as js/store.js's — kept as a literal copy rather than
    // fetched from the server, since it's a small, effectively-static
    // constant and this app has no /api/data to read it from anyway. Only
    // used as a fallback if a subject genuinely has no gradingCategories
    // of its own, which shouldn't happen for a roster synced from the
    // real app.
    defaultGradingCategories: [
        { id: 'cat_assignments', name: 'الواجبات', max: 20, type: 'dots' },
        { id: 'cat_participation', name: 'المشاركة والتفاعل', max: 10, type: 'participation' },
        { id: 'cat_research', name: 'البحث والمشاريع', max: 10, type: 'dots' },
        { id: 'cat_practical', name: 'الاختبار العملي', max: 40, type: 'numeric' },
        { id: 'cat_exam', name: 'الاختبار النهائي', max: 20, type: 'numeric' }
    ],

    // 'connect' (first-run / laptop unreachable and no local roster yet),
    // 'classes' (pick a class), 'grading' (GradingTable for the active class)
    currentScreen: 'connect',
    dataLoaded: false,
    syncStatus: 'idle' // 'idle' | 'syncing' | 'pending' | 'error'
});

window.getActiveClass = function() {
    return store.classes.find(c => c.id === store.activeClassId);
};
window.getActiveStudents = function() {
    const cls = getActiveClass();
    return cls ? (cls.students || []) : [];
};

// ------------------------------------------------------------
// Subject management — GradingTable.js calls these unconditionally (its
// subject tabs' add/rename/delete/switch controls). Only switching is a
// real, local, harmless view-state change here; the roster's actual shape
// (which subjects exist) is the laptop's responsibility, so the other
// three are no-ops that just explain why nothing happened.
// ------------------------------------------------------------
window.switchSubject = function(id) { store.activeSubjectId = id; };
window.addSubject = function() { showNotification('إضافة مادة تكون من جهاز اللابتوب فقط.', 'warning'); };
window.renameSubject = function() { showNotification('تعديل اسم المادة يكون من جهاز اللابتوب فقط.', 'warning'); };
window.deleteSubject = function() { showNotification('حذف مادة يكون من جهاز اللابتوب فقط.', 'warning'); };

// ------------------------------------------------------------
// Load — seeds the store from whatever roster IndexedDB already has (set
// by mobile-sync.js's first-run connect flow or a later sync). If none
// exists yet, dataLoaded stays false and index.html shows the connect
// screen instead of an empty grading view.
// ------------------------------------------------------------
window.loadData = async function() {
    const roster = await mobileDb.getMeta('roster');
    if (!roster) {
        store.currentScreen = 'connect';
        return;
    }
    // Reapply-pending (not plain applyRoster) in case a previous session
    // queued changes but never got the chance to sync them (app closed/
    // crashed before a sync completed) - those edits should still show.
    await applyRosterAndReapplyPending(roster);
    store.currentScreen = store.classes.length > 0 ? 'classes' : 'connect';
    store.dataLoaded = true;
};

// Used both by loadData() at boot and by mobile-sync.js after a
// successful roster fetch/sync response — replaces the roster-relevant
// fields wholesale (this IS a full replace, but of the phone's own local
// mirror, not of the laptop's data.json, so it carries none of the
// clobbering risk /api/data's full overwrite has).
window.applyRoster = function(roster) {
    store.classes = roster.classes || [];
    store.activeClassId = (store.classes.find(c => c.id === store.activeClassId) && store.activeClassId)
        || roster.activeClassId
        || (store.classes[0] && store.classes[0].id)
        || null;
    store.subjects = roster.subjects || [];
    store.activeSubjectId = (store.subjects.find(s => s.id === store.activeSubjectId) && store.activeSubjectId)
        || roster.activeSubjectId
        || (store.subjects[0] && store.subjects[0].id)
        || null;
    store.periods = roster.periods && roster.periods.length > 0 ? roster.periods : store.periods;
    store.activePeriodId = roster.activePeriodId || store.activePeriodId;

    // Warm up every student/subject's grade object NOW, synchronously,
    // rather than letting GradingTable.js's first render do it lazily.
    // getStudentSubjectGrades() (js/grading-model.js) normalizes a
    // student's grades as a SIDE EFFECT of merely reading them the first
    // time (sizing arrays, mirroring legacy fields) — without this warm-up
    // the snapshot below would be taken BEFORE that normalization runs,
    // so the next saveData() diff would see it happen (triggered by the
    // table finally rendering) and misreport it as a real edit on
    // students nobody actually touched.
    store.classes.forEach(cls => {
        (cls.students || []).forEach(student => {
            store.subjects.forEach(subj => getStudentSubjectGrades(student, subj.id));
        });
    });

    __lastPersistedSnapshot = JSON.parse(JSON.stringify(store.classes));
};

// Applies a list of changeQueue rows directly onto a classes array — same
// merge logic as the server's POST /api/mobile/sync handler, kept in sync
// with it deliberately. Used client-side for one specific race: a sync
// request captures the queue, then a NEW edit lands (or an edit is
// rejected) before the response arrives; applyRoster() alone would
// silently revert that edit by replacing store.classes with the
// (slightly older, relative to that one edit) server response.
function applyChangesToClasses(classesArr, changes) {
    changes.forEach(change => {
        const cls = classesArr.find(c => c.id === change.classId);
        const student = cls && (cls.students || []).find(s => s.id === change.studentId);
        if (!student) return;
        if (!student.grades) student.grades = {};
        if (!student.grades[change.periodId]) student.grades[change.periodId] = {};
        if (!student.grades[change.periodId][change.subjectId]) student.grades[change.periodId][change.subjectId] = {};
        const g = student.grades[change.periodId][change.subjectId];
        if (change.kind === 'numeric') {
            g[change.categoryId] = change.value;
        } else {
            if (!Array.isArray(g[change.categoryId])) g[change.categoryId] = [];
            const arr = g[change.categoryId];
            const targetLen = Math.max(change.arrayLength || 0, change.index + 1);
            while (arr.length < targetLen) arr.push(false);
            arr[change.index] = change.value;
        }
    });
}

// The one function mobile-sync.js actually calls after a roster fetch
// (first connect) or a sync response: applies the fresh roster, then
// replays whatever is STILL in the local queue (rejected changes, or ones
// queued during the request's round-trip) on top, so the teacher's latest
// taps are never visually reverted. Also re-clones the snapshot from this
// fully-reapplied state — not from the bare roster — so the next saveData()
// diff doesn't mistake these already-queued edits for brand-new ones and
// queue duplicates.
window.applyRosterAndReapplyPending = async function(roster) {
    applyRoster(roster);
    const pending = await mobileDb.listQueuedChanges();
    if (pending.length > 0) {
        applyChangesToClasses(store.classes, pending);
        __lastPersistedSnapshot = JSON.parse(JSON.stringify(store.classes));
    }
};

// ------------------------------------------------------------
// Save — mirrors js/store.js's debounce (batches rapid taps into one pass
// instead of one per tap), but instead of a server POST: (1) diffs the
// current classes against the last-known-persisted snapshot to find
// exactly which grade cells changed, (2) queues one changeQueue row per
// changed cell for mobile-sync.js to push, (3) persists the roster back
// to IndexedDB so a reload before the next sync doesn't lose anything.
// ------------------------------------------------------------
let __lastPersistedSnapshot = [];
let __saveDebounceTimer = null;

function diffChangedCells() {
    const changes = [];
    const periodId = store.activePeriodId;
    const prevClasses = __lastPersistedSnapshot;

    store.classes.forEach(cls => {
        const prevCls = prevClasses.find(c => c.id === cls.id);
        (cls.students || []).forEach(student => {
            const prevStudent = prevCls && (prevCls.students || []).find(s => s.id === student.id);
            store.subjects.forEach(subj => {
                const g = student.grades && student.grades[periodId] && student.grades[periodId][subj.id];
                if (!g) return;
                const prevG = prevStudent && prevStudent.grades && prevStudent.grades[periodId] && prevStudent.grades[periodId][subj.id];
                const categories = getActiveSubjectGradingCategories(subj.id);

                categories.forEach(cat => {
                    if (cat.type === 'numeric') {
                        const newVal = g[cat.id];
                        const oldVal = prevG ? prevG[cat.id] : undefined;
                        if (newVal !== oldVal && newVal !== undefined) {
                            changes.push({
                                classId: cls.id, studentId: student.id, periodId, subjectId: subj.id,
                                categoryId: cat.id, kind: 'numeric', index: null, value: newVal,
                                arrayLength: null, clientTimestamp: Date.now()
                            });
                        }
                        return;
                    }
                    const newArr = Array.isArray(g[cat.id]) ? g[cat.id] : [];
                    const oldArr = (prevG && Array.isArray(prevG[cat.id])) ? prevG[cat.id] : [];
                    const len = Math.max(newArr.length, oldArr.length);
                    for (let i = 0; i < len; i++) {
                        if (newArr[i] !== oldArr[i]) {
                            changes.push({
                                classId: cls.id, studentId: student.id, periodId, subjectId: subj.id,
                                categoryId: cat.id, kind: cat.type === 'participation' ? 'participation' : 'dot',
                                index: i, value: newArr[i], arrayLength: newArr.length, clientTimestamp: Date.now()
                            });
                        }
                    }
                });
            });
        });
    });

    return changes;
}

async function performMobileSave() {
    const changes = diffChangedCells();
    for (const change of changes) {
        await mobileDb.queueChange(change);
    }
    __lastPersistedSnapshot = JSON.parse(JSON.stringify(store.classes));

    // IndexedDB's structured-clone can't clone Vue's reactive Proxy
    // objects directly ("could not be cloned") - JSON round-tripping
    // (already needed for __lastPersistedSnapshot above) also happens to
    // produce a plain, clone-safe copy, so reuse it here instead of
    // stringifying the same data twice.
    await mobileDb.setMeta('roster', {
        classes: __lastPersistedSnapshot,
        activeClassId: store.activeClassId,
        subjects: JSON.parse(JSON.stringify(store.subjects)),
        activeSubjectId: store.activeSubjectId,
        periods: JSON.parse(JSON.stringify(store.periods)),
        activePeriodId: store.activePeriodId
    });

    if (changes.length > 0) {
        store.syncStatus = 'pending';
        if (window.triggerMobileSync) window.triggerMobileSync();
    }
}

window.saveData = async function() {
    clearTimeout(__saveDebounceTimer);
    __saveDebounceTimer = setTimeout(performMobileSave, 300);
};

// Forces a pending debounced save to happen right now — used on
// beforeunload/visibilitychange so a grade tapped a moment before the
// teacher locks their phone isn't lost.
window.flushMobileSave = function() {
    if (__saveDebounceTimer) {
        clearTimeout(__saveDebounceTimer);
        __saveDebounceTimer = null;
        performMobileSave();
    }
};
window.addEventListener('beforeunload', () => flushMobileSave());
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushMobileSave();
});
