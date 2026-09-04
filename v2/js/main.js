// v2/js/main.js — creates and mounts the Vue app. Also re-establishes the
// external contracts the rest of the system depends on:
//   - window.appInitComplete: server.js's headless weekly-report scheduler
//     polls this via page.waitForFunction before calling sendWeeklyReport().
//   - window.sendWeeklyReport(): same scheduler calls this directly and
//     awaits a `weeklyReportSendComplete` window event (added in Stage 3).
//   - a `MadrasatiGradesImported` window-event listener: the browser
//     extension (extension/content.js, not touched by this rewrite)
//     dispatches this exact event name/shape (added in Stage 5).
const app = Vue.createApp({
    setup() {
        const sidebarCollapsed = Vue.ref(false);
        const activeClass = Vue.computed(() => getActiveClass());
        return { store, sidebarCollapsed, activeClass };
    }
});

app.component('classes-panel', window.ClassesPanel);
app.component('dashboard-panel', window.Dashboard);

(async () => {
    if (window.location.protocol === 'file:') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600);
            const checkRes = await fetch('http://localhost:8000/api/data', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (checkRes.ok) {
                window.location.href = 'http://localhost:8000/v2/index.html' + window.location.search;
                return;
            }
        } catch (e) { /* server not running in background; continue and mount normally */ }
    }

    await loadData();
    app.mount('#app');

    // Readiness signal for headless automation — set only after data has
    // actually loaded, matching the old app's exact semantics.
    window.appInitComplete = true;
})();
