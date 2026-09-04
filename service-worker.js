const CACHE_NAME = 'student-tracker-shell-v2';

// Only the static "app shell" is cached — never API responses (grades data
// must always come from the live server, or the teacher would see stale
// data with no way to tell).
const APP_SHELL = [
    '/',
    '/index.html',
    '/style.css',
    '/template_base64.js',
    '/js/core.js',
    '/js/grading.js',
    '/js/students.js',
    '/js/ui.js',
    '/js/reports.js',
    '/js/portfolio.js',
    '/js/madrasati-noor.js',
    '/js/whatsapp-engine.js',
    '/js/groups.js',
    '/favicon.png',
    '/favicon.ico',
    '/manifest.json',
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

    // Only handle simple same-origin GETs. Everything else (API calls,
    // cross-origin CDN scripts, POST/PUT requests) goes straight to the
    // network untouched — the data behind /api/* must always be live.
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        // Page loads: try the network first (so the teacher always gets the
        // latest app build while the server is reachable), and fall back to
        // the cached shell only when the server can't be reached at all.
        event.respondWith(
            fetch(request)
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Static assets: serve from cache instantly, then refresh the cache
    // from the network in the background for next time.
    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || networkFetch;
        })
    );
});
