// v2/js/components/WeeklyReportModal.js — displays progress while
// window.sendWeeklyReport() (a zero-arg global, also called directly by
// server.js's headless scheduler) runs. Status lives in uiState.weeklyReportStatus
// rather than local component state, precisely because sendWeeklyReport()
// must stay callable with no arguments from outside this component.
window.WeeklyReportModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 850px; padding: 25px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fa-solid fa-file-lines" style="color: var(--accent-teal);"></i> معاينة التقرير الرسمي الأسبوعي
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body" style="max-height:70vh; overflow-y:auto; text-align:center;">
                    <p :style="{ color: uiState.weeklyReportStatus.isError ? '#ef4444' : 'var(--text-muted)' }">{{ uiState.weeklyReportStatus.text }}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إغلاق</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        function close() { emit('update:modelValue', false); }
        Vue.watch(() => props.modelValue, (open) => { if (open) sendWeeklyReport(); });
        return { uiState, close };
    }
};
