// mobile/js/mobile-db.js — IndexedDB wrapper for the standalone mobile
// grading app. Two object stores in one database:
//   - `meta` (key-value): 'roster' (last-synced grading-relevant snapshot),
//     'config' ({laptopUrl, deviceId}), 'lastSyncedAt' (timestamp).
//   - `changeQueue` (autoincrement rows): one row per grade edit made since
//     the last successful sync — {classId, studentId, periodId, subjectId,
//     categoryId, kind, index, value, arrayLength, clientTimestamp}.
//
// This is the ONLY place that talks to IndexedDB directly — mobile/js/
// store.js and mobile/js/mobile-sync.js both go through the functions
// below instead of opening their own transactions.

const MOBILE_DB_NAME = 'student-tracker-mobile';
const MOBILE_DB_VERSION = 1;

let _dbPromise = null;

function openMobileDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(MOBILE_DB_NAME, MOBILE_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('changeQueue')) {
                db.createObjectStore('changeQueue', { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbPromise;
}

function tx(db, storeName, mode) {
    return db.transaction(storeName, mode).objectStore(storeName);
}

window.mobileDb = {
    async getMeta(key) {
        const db = await openMobileDb();
        return new Promise((resolve, reject) => {
            const req = tx(db, 'meta', 'readonly').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
            req.onerror = () => reject(req.error);
        });
    },

    async setMeta(key, value) {
        const db = await openMobileDb();
        return new Promise((resolve, reject) => {
            const req = tx(db, 'meta', 'readwrite').put({ key, value });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    // Appends one change-queue row, returns its assigned id.
    async queueChange(change) {
        const db = await openMobileDb();
        return new Promise((resolve, reject) => {
            const req = tx(db, 'changeQueue', 'readwrite').add(change);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async listQueuedChanges() {
        const db = await openMobileDb();
        return new Promise((resolve, reject) => {
            const req = tx(db, 'changeQueue', 'readonly').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    // Removes exactly the given ids (a successful sync's `accepted` list) —
    // never clears the whole queue outright, since more edits may have been
    // queued after the sync request was already sent.
    async removeQueuedChanges(ids) {
        if (!ids || ids.length === 0) return;
        const db = await openMobileDb();
        return new Promise((resolve, reject) => {
            const store = tx(db, 'changeQueue', 'readwrite');
            ids.forEach(id => store.delete(id));
            const t = store.transaction;
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
        });
    }
};
