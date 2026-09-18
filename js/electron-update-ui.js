// js/electron-update-ui.js — wires the header's "تحديث" button to the
// self-update IPC call exposed by electron/preload.js. window.electronAPI
// only exists inside the Electron desktop app (never in a plain browser
// tab), so this whole file is a no-op there and the button stays hidden.
//
// Must wait for Vue to actually mount before touching the button: this
// script (a plain <script defer>) runs before main.js's async app.mount()
// resolves, since the #updateAppBtn element lives inside #app - the exact
// DOM subtree Vue's in-DOM-template mount replaces wholesale with freshly
// created elements. Wiring the click listener to the pre-mount button was a
// real bug (confirmed via a direct DOM-identity test): the button visibly
// looked normal afterward, but clicking it did nothing at all, because the
// listener lived on a node Vue had already discarded. window.appInitComplete
// is set by main.js immediately after app.mount() succeeds, so waiting for
// it guarantees getElementById returns the final, stable button.
(function () {
    if (!window.electronAPI) return;

    function init() {
        const btn = document.getElementById('updateAppBtn');
        if (!btn) return;
        btn.style.display = 'flex';

        const idleHTML = btn.innerHTML;

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
            try {
                const result = await window.electronAPI.checkForUpdate();
                if (result.status === 'up-to-date') {
                    showNotification('البرنامج محدث بالفعل لآخر إصدار.', 'info');
                } else if (result.status === 'updated') {
                    showNotification('تم تنزيل آخر تحديث بنجاح، سيُعاد تشغيل البرنامج الآن...', 'success');
                    return; // app restarts itself shortly; leave the button disabled.
                } else {
                    showNotification(result.message || 'تعذر التحقق من التحديثات.', 'error');
                }
            } catch (e) {
                showNotification('حدث خطأ أثناء التحديث: ' + e.message, 'error');
            }
            btn.disabled = false;
            btn.innerHTML = idleHTML;
        });
    }

    if (window.appInitComplete) {
        init();
    } else {
        const poll = setInterval(() => {
            if (!window.appInitComplete) return;
            clearInterval(poll);
            init();
        }, 50);
    }
})();
