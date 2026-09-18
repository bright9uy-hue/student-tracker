// v2/js/components/SyncModal.js — pairing + sync dialog for cross-device
// data sync with the standalone mobile app (see sync.js / js/sync-client.js
// / supabase/functions/sync-data). Same shape as LicenseModal.js.
window.SyncModal = {
    template: `
        <div class="modal-overlay" :class="{ active: uiState.syncModalOpen }">
            <div class="modal-container" style="max-width: 480px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fa-solid fa-arrows-rotate" style="color: var(--accent-teal);"></i> مزامنة البيانات مع الجوال
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div style="font-size:0.85rem; color: var(--text-muted); margin-bottom:14px;">
                        يزامن الفصول والطلاب والدرجات والمواد وبنود التقييم والفترات فقط بين هذا الجهاز
                        وتطبيق الجوال المستقل. أول مزامنة تدمج بيانات الجهازين في قائمة واحدة على الطرفين —
                        تأكد إنك تبي كذا قبل الربط.
                    </div>

                    <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:16px;">
                        <div style="font-size:0.8rem; color: var(--text-muted);">رمز هذا الجهاز (انسخه إلى تطبيق الجوال):</div>
                        <div style="display:flex; gap:8px;">
                            <input type="text" class="form-control" :value="uiState.sync.code || 'لا يوجد بعد'" readonly
                                   dir="ltr" style="text-align:center; font-family:monospace; letter-spacing:1px;">
                            <button type="button" class="btn btn-secondary" @click="confirmAndGenerate" title="توليد رمز جديد">
                                <i class="fa-solid fa-rotate"></i>
                            </button>
                            <button type="button" class="btn btn-secondary" v-if="uiState.sync.code" @click="copyCode" title="نسخ">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                        </div>
                    </div>

                    <hr style="margin:16px 0; border-color: var(--border-color);">

                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div style="font-size:0.8rem; color: var(--text-muted);">أو الصق رمزاً تم توليده من تطبيق الجوال:</div>
                        <div style="display:flex; gap:8px;">
                            <input type="text" class="form-control" v-model="pairInput" placeholder="رمز المزامنة من الجهاز الآخر"
                                   dir="ltr" style="text-align:center; font-family:monospace; letter-spacing:1px;"
                                   @keydown.enter="pair">
                            <button type="button" class="btn btn-secondary" :disabled="!pairInput.trim()" @click="pair">ربط</button>
                        </div>
                    </div>

                    <div v-if="uiState.syncError" style="color:#ef4444; font-size:0.85rem; font-weight:700; text-align:center; margin-top:14px;">
                        {{ uiState.syncError }}
                    </div>

                    <div style="font-size:0.8rem; color: var(--text-muted); margin-top:16px; text-align:center;">
                        آخر مزامنة: {{ formatDate(uiState.sync.lastSyncedAt) }}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إغلاق</button>
                    <button type="button" class="btn" :disabled="uiState.syncRunning || !uiState.sync.code" @click="runSyncNow()">
                        <i class="fa-solid fa-spinner fa-spin" v-if="uiState.syncRunning"></i>
                        {{ uiState.syncRunning ? 'جاري المزامنة...' : 'مزامنة الآن' }}
                    </button>
                </div>
            </div>
        </div>
    `,
    setup() {
        const pairInput = Vue.ref('');

        function close() {
            uiState.syncModalOpen = false;
            uiState.syncError = '';
        }

        async function pair() {
            if (!pairInput.value.trim()) return;
            const ok = await pairSyncCode(pairInput.value);
            if (ok) {
                pairInput.value = '';
                showNotification('تم الربط، اضغط "مزامنة الآن" لإتمام أول مزامنة.', 'success');
            }
        }

        // Regenerating after a pairing already exists silently invalidates
        // the code the other device has stored — without this, the icon
        // reads as a harmless "refresh" when it actually breaks a working
        // sync link.
        async function confirmAndGenerate() {
            if (uiState.sync.code) {
                const ok = confirm('توليد رمز جديد يقطع الربط الحالي مع الجهاز الآخر — لازم تدخل الرمز الجديد هناك يدويًا لإعادة الربط. متابعة؟');
                if (!ok) return;
            }
            await generateSyncCode();
        }

        async function copyCode() {
            if (!uiState.sync.code) return;
            try {
                await navigator.clipboard.writeText(uiState.sync.code);
                showNotification('تم نسخ الرمز.', 'success');
            } catch (e) { /* clipboard permission denied - not fatal, teacher can select+copy manually */ }
        }

        function formatDate(iso) {
            if (!iso) return 'لم تتم بعد';
            try { return new Date(iso).toLocaleString('ar-SA'); } catch (e) { return iso; }
        }

        return { uiState, pairInput, close, pair, confirmAndGenerate, copyCode, formatDate };
    }
};
