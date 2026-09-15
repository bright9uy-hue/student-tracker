// mobile/service-worker.js — PWA app-shell cache for the standalone mobile
// grading app. Deliberately separate from the root service-worker.js (own
// cache name, own scope /mobile/, own smaller shell) rather than sharing
// it - this app never needs chart.js/html2canvas/html2pdf.js/xlsx.js, and
// keeping the two workers independent means a change to one's cache
// version never forces an unrelated re-cache of the other.
const CACHE_NAME = 'student-tracker-mobile-shell-v1';

// Same reasoning as the root service worker's CDN_ORIGINS: these are
// versioned, immutable CDN URLs (index.html pins exact versions), so
// cache-first is always safe and avoids re-downloading them over
// whatever internet connection happens to be available.
const CDN_ORIGINS = ['https://cdnjs.cloudflare.com'];

const APP_SHELL = [
    '/mobile/',
    '/mobile/index.html',
    '/mobile/mobile.css',
    '/mobile/manifest.json',
    '/mobile/js/main.js',
    '/mobile/js/mobile-db.js',
    '/mobile/js/mobile-sync.js',
    '/mobile/js/store.js',
    // Shared, unmodified files this app also loads (see mobile/index.html)
    '/style.css',
    '/js/grading-model.js',
    '/js/ui-common.js',
    '/js/grading.js',
    '/js/components/ReasonModal.js',
    '/js/components/NotificationToasts.js',
    '/js/components/GradingTable.js',
    '/favicon.png',
    '/icon-192.png',
    '/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        if (CDN_ORIGINS.includes(url.origin)) {
            event.respondWith(
                caches.match(request).then((cached) => cached || fetch(request).then((response) => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                }))
            );
        }
        return;
    }

    // /api/mobile/* must always hit the network live - the whole point of
    // /version and /roster is to reflect the laptop's CURRENT state, and
    // caching either would silently defeat the reachability probe and the
    // staleness check that drive auto-sync.
    if (url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/mobile/index.html'))
        );
        return;
    }

    // Static assets: network-first, same reasoning as the root service
    // worker - a teacher should get current code whenever the laptop is
    // reachable, falling back to cache only when it genuinely isn't.
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
