// v2/js/components/ReasonModal.js — the shared "why was this deducted"
// picker for a participation dot's second click. Whoever opens it
// (GradingTable / BulkGradeModal / StudentForm) registers its own write-back
// via setReasonCallback() right before calling openReasonModal().
window.ReasonModal = {
    template: `
        <div class="modal-overlay" :class="{ active: uiState.reasonModalOpen }">
            <div class="modal-container" style="max-width: 450px;">
                <div class="modal-header">
                    <h3 style="font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--danger-color);">
                        <i class="fa-solid fa-circle-minus"></i> سبب الخصم من المشاركة
                    </h3>
                    <button class="modal-close" @click="cancel">×</button>
                </div>
                <div class="modal-body">
                    <p style="color:var(--text-muted);margin-bottom:1rem;font-size:0.9rem;">
                        اختر سبب الخصم لتحويل النقطة إلى حمراء (خصم درجة واحدة):
                    </p>
                    <div class="reason-options" style="display:grid; grid-template-columns:repeat(2,1fr); gap:0.65rem; margin-bottom:1rem;">
                        <button type="button" class="reason-btn" @click="selectReason('نائم')"><i class="fa-solid fa-moon"></i> نائم</button>
                        <button type="button" class="reason-btn" @click="selectReason('التحدث أثناء الدرس')"><i class="fa-solid fa-comments"></i> التحدث أثناء الدرس</button>
                        <button type="button" class="reason-btn" @click="selectReason('عدم الكتابة')"><i class="fa-solid fa-file-pen"></i> عدم الكتابة</button>
                        <button type="button" class="reason-btn" @click="customOpen = !customOpen"><i class="fa-solid fa-pen-to-square"></i> سبب مخصص...</button>
                    </div>
                    <div v-if="customOpen" style="background: rgba(0,0,0,0.25); padding:1rem; border-radius:10px; border:1px solid var(--surface-border); margin-bottom:0.5rem;">
                        <label style="font-weight:700; font-size:0.85rem; margin-bottom:0.5rem; display:block;">أدخل سبب الخصم المخصص:</label>
                        <div style="display:flex; gap:0.5rem;">
                            <input type="text" class="form-control" v-model="customText" placeholder="مثال: عدم إحضار الكتاب..." style="font-size:0.9rem;" @keydown.enter="submitCustom">
                            <button type="button" class="btn" @click="submitCustom" style="background: var(--danger-color); color:white; padding:0.5rem 1rem; white-space:nowrap; font-weight:700;">تأكيد الخصم</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="cancel">إلغاء (إبقاء النقطة إيجابية)</button>
                </div>
            </div>
        </div>
    `,
    setup() {
        const customOpen = Vue.ref(false);
        const customText = Vue.ref('');

        function selectReason(reason) {
            window.selectReason(reason);
            reset();
        }
        function submitCustom() {
            window.selectReason(customText.value.trim() || 'سبب مخصص');
            reset();
        }
        function cancel() {
            closeReasonModal();
            reset();
        }
        function reset() {
            customOpen.value = false;
            customText.value = '';
        }
        return { uiState, customOpen, customText, selectReason, submitCustom, cancel };
    }
};
