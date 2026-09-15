// mobile/js/mobile-sync.js — everything that talks to the laptop's
// server.js: the first-run "connect" flow, a periodic reachability probe
// (auto-sync trigger), and the actual sync push/pull. store.js's
// saveData() calls window.triggerMobileSync() itself right after queueing
// a change; this file also re-probes on a timer and on
// online/visibilitychange, to catch "walked back into WiFi range" even
// with nothing freshly queued (e.g. the laptop added a new student).

let _isSyncing = false;

async function getConfig() {
    return mobileDb.getMeta('config');
}

// First-run (or "laptop IP changed") setup: one GET to seed IndexedDB with
// the current roster. Throws with an Arabic message on failure so
// main.js's connect-screen handler can show it directly.
window.mobileConnect = async function(url) {
    const cleanUrl = (url || '').trim().replace(/\/+$/, '');
    if (!cleanUrl) throw new Error('أدخل عنوان جهاز اللابتوب.');

    let res;
    try {
        res = await fetch(cleanUrl + '/api/mobile/roster', { signal: AbortSignal.timeout(6000) });
    } catch (e) {
        throw new Error('تعذر الوصول لهذا العنوان. تأكد إنك على نفس شبكة الواي فاي مع اللابتوب.');
    }
    if (!res.ok) throw new Error('رد الجهاز بخطأ (رمز ' + res.status + ').');

    const roster = await res.json();
    const existingConfig = await getConfig();
    const deviceId = (existingConfig && existingConfig.deviceId) || crypto.randomUUID();

    await mobileDb.setMeta('config', { laptopUrl: cleanUrl, deviceId });
    await mobileDb.setMeta('roster', roster);
    await mobileDb.setMeta('lastSyncedAt', Date.now());

    await applyRosterAndReapplyPending(roster);
    store.currentScreen = store.classes.length > 0 ? 'classes' : 'connect';
    store.dataLoaded = true;
    store.syncStatus = 'idle';
};

// Push whatever is queued, pull the fresh roster back in the same
// round-trip. Safe to call opportunistically (auto-probe, manual button,
// right after queueing a change) - the _isSyncing guard means overlapping
// calls just no-op instead of racing each other.
window.triggerMobileSync = async function() {
    if (_isSyncing) return;
    const cfg = await getConfig();
    if (!cfg || !cfg.laptopUrl) return; // never connected yet

    _isSyncing = true;
    store.syncStatus = 'syncing';
    try {
        const changes = await mobileDb.listQueuedChanges();
        const res = await fetch(cfg.laptopUrl + '/api/mobile/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: cfg.deviceId, changes }),
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) throw new Error('sync http ' + res.status);
        const result = await res.json();

        await mobileDb.removeQueuedChanges(result.accepted || []);
        await mobileDb.setMeta('lastSyncedAt', Date.now());
        await applyRosterAndReapplyPending(result.roster);

        const remaining = await mobileDb.listQueuedChanges();
        store.syncStatus = remaining.length > 0 ? 'pending' : 'idle';
    } catch (e) {
        store.syncStatus = 'error';
    } finally {
        _isSyncing = false;
    }
};

// Cheap probe used by the auto-sync timer/listeners below: only fetches
// /api/mobile/version (not the full roster) to decide whether a real sync
// is worth doing right now.
async function probeAndMaybeSync() {
    const cfg = await getConfig();
    if (!cfg || !cfg.laptopUrl) return;
    try {
        const res = await fetch(cfg.laptopUrl + '/api/mobile/version', { signal: AbortSignal.timeout(2500) });
        if (!res.ok) return;
        const { version } = await res.json();
        const queued = await mobileDb.listQueuedChanges();
        const lastKnownVersion = await mobileDb.getMeta('lastKnownServerVersion');
        if (queued.length > 0 || version !== lastKnownVersion) {
            await mobileDb.setMeta('lastKnownServerVersion', version);
            await triggerMobileSync();
        }
    } catch (e) {
        // Laptop unreachable right now - not an error worth surfacing,
        // just try again on the next probe.
    }
}

setInterval(probeAndMaybeSync, 25000);
window.addEventListener('online', probeAndMaybeSync);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') probeAndMaybeSync();
});
