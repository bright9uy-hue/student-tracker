// mobile/js/main.js — creates and mounts the standalone mobile app. Much
// smaller than the main app's js/main.js: no WhatsApp/portfolio/reports
// wiring, no window.appInitComplete contract (nothing external polls
// this page), just the connect/classes/grading screen state plus the
// sync-status chip.

const app = Vue.createApp({
    setup() {
        const laptopUrlInput = Vue.ref('');
        const connecting = Vue.ref(false);
        const connectError = Vue.ref('');

        async function connectToLaptop() {
            if (connecting.value) return;
            connecting.value = true;
            connectError.value = '';
            try {
                await mobileConnect(laptopUrlInput.value);
            } catch (e) {
                connectError.value = e.message;
            } finally {
                connecting.value = false;
            }
        }

        function openClass(cls) {
            store.activeClassId = cls.id;
            store.currentScreen = 'grading';
        }

        function manualSync() {
            triggerMobileSync();
        }

        const activeClassName = Vue.computed(() => {
            const cls = getActiveClass();
            return cls ? cls.name : '';
        });

        const syncChipClass = Vue.computed(() => 'status-' + store.syncStatus);
        const syncChipIcon = Vue.computed(() => ({
            idle: 'fa-check',
            pending: 'fa-clock',
            syncing: 'fa-arrows-rotate fa-spin',
            error: 'fa-triangle-exclamation'
        }[store.syncStatus] || 'fa-check'));
        const syncChipText = Vue.computed(() => ({
            idle: 'متصل',
            pending: 'بانتظار المزامنة',
            syncing: 'جارٍ المزامنة...',
            error: 'تعذر الاتصال'
        }[store.syncStatus] || ''));

        // Pre-fill the connect screen with a best guess: if this page was
        // itself loaded from the laptop (the normal case - the teacher
        // opened it by typing the laptop's LAN address), that's almost
        // certainly the right value.
        if (location.hostname && location.hostname !== 'localhost') {
            laptopUrlInput.value = location.protocol + '//' + location.host;
        }

        return {
            store, laptopUrlInput, connecting, connectError, connectToLaptop,
            openClass, manualSync, activeClassName,
            syncChipClass, syncChipIcon, syncChipText
        };
    }
});

app.component('grading-table', window.GradingTable);
app.component('reason-modal', window.ReasonModal);
app.component('notification-toasts', window.NotificationToasts);

(async () => {
    await loadData();
    app.mount('#app');
})();
