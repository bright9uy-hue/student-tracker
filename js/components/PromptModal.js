// v2/js/components/PromptModal.js — single shared text-input dialog behind
// window.showPrompt() (see ui-common.js). Replaces window.prompt() calls,
// which Electron's renderer never implements natively (it returns null
// immediately with no dialog shown at all — window.confirm()/alert() do
// work there, only prompt() doesn't, so only the "enter a name" actions
// needed this replacement).
window.PromptModal = {
    template: `
        <div class="modal-overlay" :class="{ active: uiState.promptOpen }">
            <div class="modal-container" style="max-width: 420px;">
                <div class="modal-header">
                    <h3 style="font-weight:700;">{{ uiState.promptMessage }}</h3>
                    <button class="modal-close" @click="cancel">×</button>
                </div>
                <div class="modal-body">
                    <input type="text" class="form-control" v-model="uiState.promptValue"
                           ref="inputEl" @keydown.enter="confirm" @keydown.esc="cancel">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="cancel">إلغاء</button>
                    <button type="button" class="btn" :disabled="!uiState.promptValue || !uiState.promptValue.trim()" @click="confirm">موافق</button>
                </div>
            </div>
        </div>
    `,
    setup() {
        const inputEl = Vue.ref(null);

        Vue.watch(() => uiState.promptOpen, (open) => {
            if (open) Vue.nextTick(() => { if (inputEl.value) { inputEl.value.focus(); inputEl.value.select(); } });
        });

        function confirm() {
            if (!uiState.promptValue || !uiState.promptValue.trim()) return;
            resolvePrompt(true);
        }
        function cancel() { resolvePrompt(false); }

        return { uiState, inputEl, confirm, cancel };
    }
};
