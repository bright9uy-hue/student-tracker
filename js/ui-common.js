// v2/js/ui-common.js — small cross-cutting UI primitives used from many
// components starting this stage: toast notifications and the shared
// "deduction reason" picker (used by the grading table, the bulk-grade
// modal, and later the student form). Kept separate from store.js since
// this is transient UI state, never persisted to data.json.

window.uiState = Vue.reactive({
    notifications: [],
    // Which grading dot is waiting on a reason pick, and where to write it
    // back to once chosen. context: 'table' | 'bulk' | 'form'.
    pendingReason: { studentId: null, index: null, context: null, catKey: null },
    reasonModalOpen: false,
    // Backs showPrompt() below — a single shared text-input dialog, since
    // window.prompt() is not implemented in Electron's renderer (it
    // returns null immediately, no dialog at all, which is why the
    // desktop-app build silently "did nothing" on add/rename actions that
    // used to call the browser's native prompt()).
    promptOpen: false,
    promptMessage: '',
    promptValue: '',
    // Backs showMadrasatiImportConfirm() below - the automated-import
    // confirmation used to be a native window.confirm(), which silently
    // sits invisible whenever this tab isn't the focused one (exactly the
    // case here: the teacher is looking at the Madrasati tab, not this
    // one, right when the extension's data arrives) - Chrome defers
    // alert()/confirm() on background tabs until the user switches to
    // them, so the teacher had no way to know a confirmation was even
    // pending. An in-page modal has no such focus requirement.
    madrasatiConfirmOpen: false,
    madrasatiConfirmInfo: null,
    // Lets a teacher hide the smart-alerts panel (student-specific
    // low-grade/behavior notes) while projecting the screen to the class,
    // without navigating away from the dashboard. Global (not per-class).
    // Defaults to hidden on every launch, regardless of how the previous
    // session was left - a teacher may well close the app with the
    // laptop still connected to the projector, and this is the safer
    // default either way (revealing it takes one click/F9, whereas an
    // accidental reveal to a projected class cannot be undone).
    hideSmartAlerts: true
});

window.toggleSmartAlertsVisibility = function() {
    uiState.hideSmartAlerts = !uiState.hideSmartAlerts;
};

// F9 toggles the same presentation-mode hide, for a teacher standing away
// from the mouse. Ignored while typing in a text field/textarea so it
// doesn't interfere with anything using F9 as a normal character context
// (none currently does, but this keeps the shortcut safe long-term).
window.addEventListener('keydown', (e) => {
    if (e.key !== 'F9') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    toggleSmartAlertsVisibility();
});

let __notifId = 0;
window.showNotification = function(message, type = 'success') {
    const id = ++__notifId;
    uiState.notifications.push({ id, message, type, active: false });
    setTimeout(() => {
        const n = uiState.notifications.find(n => n.id === id);
        if (n) n.active = true;
    }, 10);
    setTimeout(() => {
        const n = uiState.notifications.find(n => n.id === id);
        if (n) n.active = false;
        setTimeout(() => {
            const idx = uiState.notifications.findIndex(n => n.id === id);
            if (idx !== -1) uiState.notifications.splice(idx, 1);
        }, 300);
    }, 3500);
};

window.openReasonModal = function(pending) {
    uiState.pendingReason = pending;
    uiState.reasonModalOpen = true;
};

window.closeReasonModal = function() {
    uiState.reasonModalOpen = false;
    uiState.pendingReason = { studentId: null, index: null, context: null, catKey: null };
};

// Applies the chosen reason to whichever array (table cell / bulk-grade
// state / student form state) the pending context points at, then closes
// the modal. Each caller (GradingTable, BulkGradeModal, StudentModal) hands
// this its own state-writing callback via `onReason` registered right
// before opening the modal, since those arrays live in different
// components' local reactive state, not in the shared store.
let __reasonCallback = null;
window.setReasonCallback = function(fn) { __reasonCallback = fn; };

window.selectReason = function(reason) {
    const todayStr = new Date().toLocaleDateString('ar-SA');
    const fullReason = (reason && reason.includes('بتاريخ:')) ? reason : `${reason || 'ملاحظة سلوكية'} (بتاريخ: ${todayStr})`;
    if (__reasonCallback) __reasonCallback(fullReason, uiState.pendingReason);
    closeReasonModal();
};

// Drop-in async replacement for window.prompt(message, defaultValue):
// `const name = await showPrompt('...')` — resolves with the trimmed text,
// or null on cancel, matching prompt()'s own null-on-cancel contract so
// every existing `if (!name || !name.trim()) return;` guard still works
// unchanged.
let __promptResolve = null;
window.showPrompt = function(message, defaultValue = '') {
    uiState.promptMessage = message;
    uiState.promptValue = defaultValue || '';
    uiState.promptOpen = true;
    return new Promise((resolve) => { __promptResolve = resolve; });
};
window.resolvePrompt = function(confirmed) {
    uiState.promptOpen = false;
    const value = confirmed ? uiState.promptValue : null;
    if (__promptResolve) { __promptResolve(value); __promptResolve = null; }
};

// Confirmation for the Madrasati auto-import (see madrasati-noor.js) - an
// in-page modal instead of window.confirm(), plus a flashing tab title so
// the teacher notices even while this tab sits in the background. The
// title keeps flashing until the modal is actually resolved (confirmed or
// cancelled), not just on a timer, since the whole point is "don't let the
// teacher miss this."
let __madrasatiConfirmResolve = null;
let __titleFlashInterval = null;
window.showMadrasatiImportConfirm = function(info) {
    uiState.madrasatiConfirmInfo = info;
    uiState.madrasatiConfirmOpen = true;

    const originalTitle = document.title;
    let showingAlert = false;
    __titleFlashInterval = setInterval(() => {
        showingAlert = !showingAlert;
        document.title = showingAlert ? '🔴 رصد جديد بانتظار تأكيدك...' : originalTitle;
    }, 1000);

    return new Promise((resolve) => {
        __madrasatiConfirmResolve = (confirmed) => {
            clearInterval(__titleFlashInterval);
            __titleFlashInterval = null;
            document.title = originalTitle;
            resolve(confirmed);
        };
    });
};
window.resolveMadrasatiImportConfirm = function(confirmed) {
    uiState.madrasatiConfirmOpen = false;
    uiState.madrasatiConfirmInfo = null;
    if (__madrasatiConfirmResolve) { __madrasatiConfirmResolve(confirmed); __madrasatiConfirmResolve = null; }
};
