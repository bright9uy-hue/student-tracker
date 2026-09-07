// js/electron-update-ui.js — wires the header's "تحديث" button to the
// self-update IPC call exposed by electron/preload.js. window.electronAPI
// only exists inside the Electron desktop app (never in a plain browser
// tab), so this whole file is a no-op there and the button stays hidden.
(function () {
    if (!window.electronAPI) return;

    const btn = document.getElementById('updateAppBtn');
    if (!btn) return;
    btn.style.display = 'inline-flex';

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
})();
