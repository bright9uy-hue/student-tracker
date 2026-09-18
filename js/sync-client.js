// v2/js/sync-client.js — thin renderer-side wrapper around the
// /api/sync/* endpoints served by sync.js (server.js). Holds no merge
// logic itself (that lives entirely in the sync-data Edge Function) —
// this file only reflects the pairing/last-synced state into the UI and
// triggers a sync round trip, same shape as js/licensing-client.js.

uiState.sync = { code: null, lastSyncedAt: null };
uiState.syncModalOpen = false;
uiState.syncRunning = false;
uiState.syncError = '';
uiState.syncCodeInput = '';

const SYNC_ERROR_MESSAGES = {
    no_code: 'ولّد رمز مزامنة أو أدخل رمز من الجهاز الآخر أولاً.',
    missing_code: 'الرجاء إدخال رمز المزامنة.',
    network: 'تعذر الاتصال بخدمة المزامنة، تحقق من اتصال الإنترنت وحاول مرة أخرى.',
    bad_response: 'استجابة غير متوقعة من خدمة المزامنة، حاول مرة أخرى.'
};

window.refreshSyncStatus = async function() {
    try {
        const res = await fetch(getApiUrl('/api/sync/status'));
        if (!res.ok) return;
        uiState.sync = await res.json();
    } catch (e) {
        // Offline or server not reachable yet at page load - leave the
        // last known status in place.
    }
};

window.generateSyncCode = async function() {
    try {
        const res = await fetch(getApiUrl('/api/sync/generate'), { method: 'POST' });
        uiState.sync = await res.json();
    } catch (e) {
        uiState.syncError = SYNC_ERROR_MESSAGES.network;
    }
};

window.pairSyncCode = async function(code) {
    if (!code || !code.trim()) return false;
    uiState.syncError = '';
    try {
        const res = await fetch(getApiUrl('/api/sync/code'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code.trim() })
        });
        const body = await res.json();
        if (!res.ok) {
            uiState.syncError = SYNC_ERROR_MESSAGES[body.error] || SYNC_ERROR_MESSAGES.bad_response;
            return false;
        }
        uiState.sync = body;
        return true;
    } catch (e) {
        uiState.syncError = SYNC_ERROR_MESSAGES.network;
        return false;
    }
};

// Runs one sync round trip, then reloads local data so the UI reflects
// whatever the merge brought in from the other device (same pattern
// store.js's own auto-refresh already uses after a mobile-merge save).
window.runSyncNow = async function({ silent = false } = {}) {
    if (uiState.syncRunning) return;
    if (!uiState.sync.code) {
        if (!silent) uiState.syncError = SYNC_ERROR_MESSAGES.no_code;
        return;
    }
    uiState.syncRunning = true;
    if (!silent) uiState.syncError = '';
    try {
        const res = await fetch(getApiUrl('/api/sync/run'), { method: 'POST' });
        const body = await res.json();
        if (!res.ok || !body.success) {
            if (!silent) uiState.syncError = SYNC_ERROR_MESSAGES[body.error] || SYNC_ERROR_MESSAGES.bad_response;
            return;
        }
        uiState.sync.lastSyncedAt = body.lastSyncedAt;
        await loadData();
        if (!silent) showNotification('تمت المزامنة بنجاح.', 'success');
    } catch (e) {
        if (!silent) uiState.syncError = SYNC_ERROR_MESSAGES.network;
    } finally {
        uiState.syncRunning = false;
    }
};

refreshSyncStatus();
// Background auto-sync while the app is open, in addition to the manual
// "مزامنة الآن" button — silent (no error popups, no success toast) since
// this fires on its own without the teacher having asked for it right now.
setInterval(() => runSyncNow({ silent: true }), 5 * 60 * 1000);
