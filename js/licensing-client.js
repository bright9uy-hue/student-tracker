// v2/js/licensing-client.js — thin renderer-side wrapper around the
// /api/license/* endpoints served by licensing.js (server.js). Holds no
// crypto or trust decisions itself (those live server-side, verified
// against the signed payload from the Supabase Edge Function) - this file
// only reflects that state into the UI and lets the teacher submit a key.

uiState.license = { activated: false, valid: false, ownerName: null, expiresAt: null };
uiState.licenseModalOpen = false;
uiState.licenseActivating = false;
uiState.licenseError = '';

const LICENSE_ERROR_MESSAGES = {
    missing_key: 'الرجاء إدخال مفتاح الترخيص.',
    invalid_key: 'مفتاح الترخيص غير صحيح.',
    revoked: 'تم إلغاء هذا المفتاح، تواصل مع جهة البيع.',
    expired: 'انتهت صلاحية هذا الترخيص.',
    network: 'تعذر الاتصال بخادم التفعيل، تحقق من اتصال الإنترنت وحاول مرة أخرى.',
    not_configured: 'خدمة التفعيل غير مهيأة بعد في هذه النسخة.',
    module_unavailable: 'هذه النسخة تحتاج إعادة تثبيت كاملة لتفعيل هذه الميزة.',
    bad_response: 'استجابة غير متوقعة من خادم التفعيل، حاول مرة أخرى.'
};

window.refreshLicenseStatus = async function() {
    try {
        const res = await fetch(getApiUrl('/api/license/status'));
        if (!res.ok) return;
        const status = await res.json();
        uiState.license = status;
    } catch (e) {
        // Offline or server not reachable yet at page load - leave the
        // last known status in place.
    }
};

window.activateLicense = async function(key) {
    uiState.licenseActivating = true;
    uiState.licenseError = '';
    try {
        const res = await fetch(getApiUrl('/api/license/activate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        const body = await res.json();
        if (!res.ok || !body.success) {
            uiState.licenseError = LICENSE_ERROR_MESSAGES[body.error] || LICENSE_ERROR_MESSAGES.bad_response;
            return false;
        }
        uiState.license = body.status;
        uiState.licenseModalOpen = false;
        showNotification(`تم تفعيل الترخيص بنجاح باسم: ${body.status.ownerName}`, 'success');
        return true;
    } catch (e) {
        uiState.licenseError = LICENSE_ERROR_MESSAGES.network;
        return false;
    } finally {
        uiState.licenseActivating = false;
    }
};

refreshLicenseStatus();
setInterval(refreshLicenseStatus, 5 * 60 * 1000);
