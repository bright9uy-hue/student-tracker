// v2/js/main.js — creates and mounts the Vue app. Also re-establishes the
// external contracts the rest of the system depends on:
//   - window.appInitComplete: server.js's headless weekly-report scheduler
//     polls this via page.waitForFunction before calling sendWeeklyReport().
//   - window.sendWeeklyReport(): same scheduler calls this directly (zero
//     args) and awaits a `weeklyReportSendComplete` window event.
//   - a `MadrasatiGradesImported` window-event listener: the browser
//     extension (extension/content.js, not touched by this rewrite)
//     dispatches this exact event name/shape (added in Stage 5).
const app = Vue.createApp({
    setup() {
        const sidebarCollapsed = Vue.ref(false);
        const activeClass = Vue.computed(() => getActiveClass());

        const showWhatsappSettings = Vue.ref(false);
        const showWeeklyReport = Vue.ref(false);
        const showPortfolio = Vue.ref(false);
        const showTeacherSettings = Vue.ref(false);
        const weeklyBannerDismissed = Vue.ref(false);

        const showWeeklyBanner = Vue.computed(() => {
            if (weeklyBannerDismissed.value || !store.dataLoaded || !store.lastReportDate) return false;
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
            return (Date.now() - store.lastReportDate) >= oneWeekMs;
        });

        // Same trigger as the old app: any click anywhere re-checks whether
        // a week has elapsed since the last report and auto-sends if so.
        document.addEventListener('click', () => { if (store.dataLoaded) checkAndAutoSendWeeklyReport(); });

        return {
            store, sidebarCollapsed, activeClass,
            showWhatsappSettings, showWeeklyReport, showPortfolio, showTeacherSettings, weeklyBannerDismissed, showWeeklyBanner,
            exportAllClassesToCSV
        };
    }
});

app.component('classes-panel', window.ClassesPanel);
app.component('dashboard-panel', window.Dashboard);
app.component('notification-toasts', window.NotificationToasts);
app.component('reason-modal', window.ReasonModal);
app.component('student-modal', window.StudentModal);
app.component('grading-setup-modal', window.GradingSetupModal);
app.component('bulk-grade-modal', window.BulkGradeModal);
app.component('grading-table', window.GradingTable);
app.component('student-report-modal', window.StudentReportModal);
app.component('referral-modal', window.ReferralModal);
app.component('weekly-report-modal', window.WeeklyReportModal);
app.component('whatsapp-settings-modal', window.WhatsappSettingsModal);
app.component('portfolio-panel', window.PortfolioPanel);
app.component('evidence-file-input', window.EvidenceFileInput);
app.component('noor-import-modal', window.NoorImportModal);
app.component('madrasati-import-modal', window.MadrasatiImportModal);
app.component('whatsapp-engine-modal', window.WhatsappEngineModal);
app.component('new-period-modal', window.NewPeriodModal);
app.component('random-picker-modal', window.RandomPickerModal);
app.component('teacher-settings-modal', window.TeacherSettingsModal);
app.component('add-students-modal', window.AddStudentsModal);
app.component('transfer-student-modal', window.TransferStudentModal);
app.component('student-groups-modal', window.StudentGroupsModal);

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

    // First-ever load: arm the weekly-report timer without immediately
    // showing the reminder banner (matches the old checkWeeklyReportStatus).
    if (!store.lastReportDate) {
        store.lastReportDate = Date.now();
        saveData();
    }

    app.mount('#app');

    // Readiness signal for headless automation — set only after data has
    // actually loaded, matching the old app's exact semantics.
    window.appInitComplete = true;
})();
