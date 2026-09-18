// js/components/MadrasatiImportConfirmModal.js — confirmation for the
// browser extension's automated Madrasati import (see ui-common.js's
// showMadrasatiImportConfirm and madrasati-noor.js's MadrasatiGradesImported
// listener). Replaces a native window.confirm(), which sits invisible
// whenever this tab isn't focused - exactly the normal case here, since the
// teacher is looking at the Madrasati tab, not this one, when the data
// arrives.
window.MadrasatiImportConfirmModal = {
    template: `
        <div class="modal-overlay" :class="{ active: uiState.madrasatiConfirmOpen }">
            <div class="modal-container" style="max-width: 460px;" v-if="info">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem; color:#f59e0b;">
                        <i class="fa-solid fa-chalkboard-user"></i> رصد آلي جديد من مدرستي
                    </h3>
                    <button class="modal-close" @click="cancel">×</button>
                </div>
                <div class="modal-body">
                    <p v-if="info.assignmentTitle" style="font-weight:700; margin-bottom:0.75rem;">
                        الواجب المكتشف على مدرستي: "{{ info.assignmentTitle }}"
                    </p>
                    <p style="margin-bottom:0.5rem;">تم العثور على بيانات <strong>{{ info.count }}</strong> طالب.</p>
                    <p>سيتم رصدها في خانة "واجب {{ info.nextSlot + 1 }}" بالفصل "<strong>{{ info.className }}</strong>".</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="cancel">إلغاء</button>
                    <button type="button" class="btn" style="background:#f59e0b; color:white;" @click="confirmImport">
                        <i class="fa-solid fa-check"></i> متابعة والحفظ
                    </button>
                </div>
            </div>
        </div>
    `,
    setup() {
        const info = Vue.computed(() => uiState.madrasatiConfirmInfo);
        function confirmImport() { resolveMadrasatiImportConfirm(true); }
        function cancel() { resolveMadrasatiImportConfirm(false); }
        return { uiState, info, confirmImport, cancel };
    }
};
