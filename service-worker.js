// v2/service-worker.js — PWA app-shell cache for the Vue rewrite.
//
// This file is written as it will look AFTER cutover (Stage 9 moves it to
// the repo root verbatim, no content rewrite), so every path below is
// root-relative to match where these files will actually live once v2/*
// replaces the old index.html/js/*. It is not registered by v2/index.html
// yet — only the production index.html registers a service worker — so
// this has no effect until cutover.
//
// Cache name bumped from the old app's 'student-tracker-shell-v2' so an
// already-installed PWA discards the stale old-app-shell cache (which
// listed js/core.js, js/ui.js, etc. — files that no longer exist after
// cutover) instead of serving a stale mix of old and new files.
//
// Bumped again to v4: static assets below used to be served cache-first
// (instant from cache, refreshed in the background for *next* time), so an
// already-installed PWA kept showing old JS (e.g. the mobile grading view,
// the auto-collapsing sidebar) even after the server had the new code —
// the stale cached bytes were served before the background refresh ever
// ran. Bumping the name forces every existing install to discard its old
// cache once on this update. The fetch handler below is also changed to
// network-first so this class of bug can't recur.
//
// Bumped again to v5: added cache-first handling for the CDN library
// scripts (see CDN_ORIGINS below) - a fresh cache name isn't strictly
// required for that alone, but keeping the bump-per-behavior-change habit
// makes it obvious from the cache name alone which fetch logic a given
// install is running.
const CACHE_NAME = 'student-tracker-shell-v5';

// Versioned, immutable CDN URLs (index.html pins an exact version for
// each) - a given URL's content can never change, so caching them
// cache-first is always safe, unlike the app's own same-origin files
// below (which need network-first so a teacher always gets the latest
// code). Without this, the phone re-downloads Vue + Chart.js +
// html2canvas + html2pdf.js + xlsx.js (roughly 1-2MB combined) from the
// open internet on every single page load - fine on good wifi, but a
// real, repeatable source of slow loads on a classroom mobile hotspot
// with limited bandwidth, which has nothing to do with the local network
// to the teacher's laptop (that part is already fast).
const CDN_ORIGINS = ['https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'];

// Only the static "app shell" is cached — never API responses (grades data
// must always come from the live server, or the teacher would see stale
// data with no way to tell).
const APP_SHELL = [
    '/',
    '/index.html',
    '/style.css',
    '/js/store.js',
    '/js/ui-common.js',
    '/js/grading.js',
    '/js/whatsapp.js',
    '/js/reports.js',
    '/js/portfolio.js',
    '/js/madrasati-noor.js',
    '/js/components/NotificationToasts.js',
    '/js/components/ReasonModal.js',
    '/js/components/StudentModal.js',
    '/js/components/AddStudentsModal.js',
    '/js/components/GradingSetupModal.js',
    '/js/components/BulkGradeModal.js',
    '/js/components/GradingTable.js',
    '/js/components/StudentReportModal.js',
    '/js/components/ReferralModal.js',
    '/js/components/WeeklyReportModal.js',
    '/js/components/WhatsappSettingsModal.js',
    '/js/components/PortfolioPanel.js',
    '/js/components/NoorImportModal.js',
    '/js/components/MadrasatiImportModal.js',
    '/js/components/WhatsappEngineModal.js',
    '/js/components/NewPeriodModal.js',
    '/js/components/RandomPickerModal.js',
    '/js/components/TeacherSettingsModal.js',
    '/js/components/TransferStudentModal.js',
    '/js/components/StudentGroupsModal.js',
    '/js/components/ClassesPanel.js',
    '/js/components/Dashboard.js',
    '/js/main.js',
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

    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        // Cross-origin: only the pinned CDN library scripts get handled
        // (cache-first - see CDN_ORIGINS above); anything else crossing
        // origins goes straight to the network untouched, unchanged from
        // before.
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

    // Same-origin only below this point. API calls and POST/PUT requests
    // go straight to the network untouched — the data behind /api/* must
    // always be live.
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

    // Static assets: try the network first, same as page navigations above,
    // so the teacher always gets the current code while the server is
    // reachable (the normal case for this local-network app). Only fall
    // back to the cached copy when the network request actually fails
    // (server unreachable / offline) — never serve a possibly-stale cached
    // file just because it happens to be there.
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
