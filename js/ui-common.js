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
    reasonModalOpen: false
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
