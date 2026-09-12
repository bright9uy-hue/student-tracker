// v2/js/components/LicenseModal.js — activation dialog for the paid
// licensing system (see licensing.js / js/licensing-client.js). Shows
// current status when already activated (owner name, expiry, whether the
// app is currently within its offline grace period), and a key-entry form
// otherwise.
window.LicenseModal = {
    template: `
        <div class="modal-overlay" :class="{ active: uiState.licenseModalOpen }">
            <div class="modal-container" style="max-width: 460px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fa-solid fa-key" style="color: var(--accent-teal);"></i> تفعيل الترخيص
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div v-if="uiState.license.activated" style="text-align:center; padding: 10px 0;">
                        <i class="fa-solid fa-circle-check" style="font-size:2.5rem; color:#10b981; margin-bottom:10px;"></i>
                        <div style="font-size:1.05rem; font-weight:800;">مرخّص باسم: {{ uiState.license.ownerName }}</div>
                        <div style="font-size:0.85rem; color: var(--text-muted); margin-top:6px;">
                            ينتهي في: {{ formatDate(uiState.license.expiresAt) }}
                        </div>
                        <div v-if="!uiState.license.valid" style="margin-top:12px; padding:10px; border-radius:8px; background: rgba(239,68,68,0.12); border:1.5px solid rgba(239,68,68,0.4); color:#ef4444; font-size:0.85rem; font-weight:700;">
                            <span v-if="!uiState.license.subscriptionValid">انتهت صلاحية الترخيص. أدخل مفتاحاً جديداً لتجديده.</span>
                            <span v-else-if="!uiState.license.withinGrace">لم يتم التحقق من الترخيص منذ فترة طويلة، وصل البرنامج لآخر مهلة العمل بدون اتصال. وصّل الجهاز بالإنترنت ثم أعد فتح البرنامج.</span>
                        </div>
                        <hr style="margin:16px 0; border-color: var(--border-color);">
                        <div style="font-size:0.85rem; color: var(--text-muted); margin-bottom:8px;">لتجديد الترخيص أو تفعيل مفتاح مختلف على هذا الجهاز:</div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <input type="text" class="form-control" v-model="keyInput" placeholder="أدخل مفتاح الترخيص هنا"
                               dir="ltr" style="text-align:center; font-family:monospace; letter-spacing:1px;"
                               @keydown.enter="submit">
                        <div v-if="uiState.licenseError" style="color:#ef4444; font-size:0.85rem; font-weight:700; text-align:center;">
                            {{ uiState.licenseError }}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إغلاق</button>
                    <button type="button" class="btn" :disabled="uiState.licenseActivating || !keyInput.trim()" @click="submit">
                        <i class="fa-solid fa-spinner fa-spin" v-if="uiState.licenseActivating"></i>
                        {{ uiState.licenseActivating ? 'جاري التفعيل...' : 'تفعيل' }}
                    </button>
                </div>
            </div>
        </div>
    `,
    setup() {
        const keyInput = Vue.ref('');

        function close() {
            uiState.licenseModalOpen = false;
            uiState.licenseError = '';
        }

        async function submit() {
            if (!keyInput.value.trim()) return;
            const ok = await activateLicense(keyInput.value.trim());
            if (ok) keyInput.value = '';
        }

        function formatDate(iso) {
            if (!iso) return '-';
            try { return new Date(iso).toLocaleDateString('ar-SA'); } catch (e) { return iso; }
        }

        return { uiState, keyInput, close, submit, formatDate };
    }
};
