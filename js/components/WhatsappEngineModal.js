// v2/js/components/WhatsappEngineModal.js — status/QR-link modal for the
// WhatsApp engine integrated directly into server.js (not the separate,
// unused whats-web.js). Polls /api/whatsapp/status while INITIALIZING,
// same as the old app.
window.WhatsappEngineModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 420px; text-align: center;">
                <div class="modal-header">
                    <h3 style="font-weight:700;"><i class="fa-brands fa-whatsapp" style="color:#25d366;"></i> محرك واتساب المدمج</h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div v-html="statusHtml"></div>
                    <div v-html="qrHtml"></div>
                    <div v-if="userDetailsHtml" v-html="userDetailsHtml"></div>
                </div>
                <div class="modal-footer" style="justify-content: space-between;">
                    <button type="button" class="btn btn-secondary" @click="fetchStatus"><i class="fa-solid fa-rotate"></i> تحديث الحالة</button>
                    <button type="button" class="btn" style="background:#ef4444; color:white;" @click="logout"><i class="fa-solid fa-right-from-bracket"></i> تسجيل الخروج</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const statusHtml = Vue.ref('');
        const qrHtml = Vue.ref('');
        const userDetailsHtml = Vue.ref('');

        async function fetchStatus() {
            statusHtml.value = '<i class="fa-solid fa-circle-notch fa-spin"></i> جاري فحص حالة محرك واتساب المدمج...';
            qrHtml.value = '';
            userDetailsHtml.value = '';
            try {
                const res = await fetch(getApiUrl('/api/whatsapp/status')).catch(() => null);
                if (!res || !res.ok) {
                    statusHtml.value = `<div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; color:#ef4444; padding:10px; border-radius:8px; font-weight:bold; margin-top:10px;">⚠️ تعذر الاتصال بخادم البرنامج الرئيسي. تأكد أن البرنامج (server.js) مايزال يعمل، ثم اضغط "تحديث الحالة".</div>`;
                    return;
                }
                const data = await res.json();
                if (data.status === 'READY') {
                    statusHtml.value = '<span style="color:#10b981; font-weight:800;">✅ المحرك متصل وجاهز للإرسال التلقائي!</span>';
                    if (data.user) userDetailsHtml.value = `الحساب المرتبط: <strong>${data.user.name || ''}</strong> (${data.user.phone || ''})`;
                } else if (data.status === 'QR_READY' && data.qr) {
                    statusHtml.value = '<span style="color:#f59e0b; font-weight:800;">📲 امسح رمز الـ QR أدناه عبر تطبيق الواتساب:</span>';
                    qrHtml.value = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr)}" alt="WhatsApp QR Code" style="border:4px solid white; border-radius:10px; margin-top:10px;">`;
                } else if (data.status === 'INITIALIZING') {
                    statusHtml.value = '<span style="color:#6366f1; font-weight:700;"><i class="fa-solid fa-circle-notch fa-spin"></i> جاري فتح متصفح Chrome وتوليد الـ QR... (سيظهر كود الـ QR هنا تلقائياً خلال ثوانٍ)</span>';
                    if (props.modelValue) setTimeout(fetchStatus, 2500);
                } else {
                    statusHtml.value = `<span style="color:#6366f1; font-weight:700;">حالة المحرك: ${data.status}</span>`;
                }
            } catch (err) {
                statusHtml.value = `<span style="color:#ef4444; font-weight:bold;">حدث خطأ في قراءة حالة المحرك: ${err.message}</span>`;
            }
        }

        async function logout() {
            if (!confirm('هل أنت متأكد من تسجيل الخروج وتصفير جلسة محرك الواتساب؟')) return;
            try {
                const res = await fetch(getApiUrl('/api/whatsapp/logout'), { method: 'POST' });
                const data = await res.json();
                if (data.success) { showNotification('تم تسجيل الخروج بنجاح.'); fetchStatus(); }
            } catch (err) {
                showNotification('فشل تسجيل الخروج: ' + err.message, 'error');
            }
        }

        Vue.watch(() => props.modelValue, (open) => { if (open) fetchStatus(); });

        function close() { emit('update:modelValue', false); }
        return { statusHtml, qrHtml, userDetailsHtml, fetchStatus, logout, close };
    }
};
