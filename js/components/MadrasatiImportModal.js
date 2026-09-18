// v2/js/components/MadrasatiImportModal.js — Madrasati assignment results:
// the one-click "auto-sync" trigger (opens the platform's assignments page
// and lets the extension's automated flow, in v2/js/madrasati-noor.js,
// grade the class) alongside the manual paste fallback, combined in one
// modal exactly like the old app's single madrasatiImportModal.
window.MadrasatiImportModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 550px;">
                <div class="modal-header">
                    <h3 style="font-weight:700;"><i class="fa-solid fa-chalkboard-user" style="color:#f59e0b;"></i> رصد الواجبات من منصة مدرستي</h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div style="background: rgba(20, 184, 166, 0.08); border: 1px solid rgba(20, 184, 166, 0.25); border-radius: 12px; padding: 1rem 1.15rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 220px;">
                            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--accent-teal); display: flex; align-items: center; gap: 0.4rem;">
                                <i class="fa-solid fa-bolt" style="color: #fbbf24;"></i> الرصد الآلي المباشر (Auto-Sync)
                            </h4>
                            <p style="margin: 0.3rem 0 0 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
                                فتح صفحة مدرستي وسحب الواجب الشاغر تلقائياً بالكامل في ثوانٍ دون أي جهد يدوي.
                            </p>
                        </div>
                        <button type="button" class="btn btn-sm" @click="triggerAutoMadrasatiSync()" style="background: var(--accent-teal); color: white; white-space: nowrap; font-weight: 700; padding: 0.55rem 1.1rem; box-shadow: 0 4px 12px var(--accent-teal-glow);">
                            <i class="fa-solid fa-cloud-arrow-down"></i> سحب آلي من مدرستي 🚀
                        </button>
                    </div>

                    <div style="text-align: center; margin: 1rem 0; position: relative;">
                        <hr style="border: none; border-top: 1px dashed var(--surface-border); margin: 0;">
                        <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--surface-color); padding: 0 12px; font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">أو الرصد عبر اللصق السريع</span>
                    </div>

                    <div class="form-group full-width">
                        <label>خانة الواجب المستهدفة</label>
                        <select class="form-control" v-model.number="assignIdx">
                            <option v-for="i in maxVal" :key="i-1" :value="i-1">واجب {{ i }}{{ (i-1) === nextSlot ? ' ⭐ (الواجب التالي تلقائياً)' : '' }}</option>
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label>الصق بيانات الاستخراج من إضافة مدرستي (أو نص عادي)</label>
                        <textarea class="form-control" rows="8" v-model="pasteText" placeholder="الصق بيانات الطلاب هنا..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button type="button" class="btn" style="background:#f59e0b; color:white;" @click="submit">استيراد ورصد</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const pasteText = Vue.ref('');
        const assignIdx = Vue.ref(0);
        const nextSlot = Vue.ref(0);
        const maxVal = Vue.ref(10);

        Vue.watch(() => props.modelValue, (open) => {
            if (!open) return;
            const activeClass = getActiveClass();
            if (!activeClass) { showNotification('الرجاء اختيار فصل أولاً لرصد الواجبات له!', 'error'); emit('update:modelValue', false); return; }
            const categories = getActiveSubjectGradingCategories(store.activeSubjectId);
            const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
            maxVal.value = cat ? cat.max : 10;
            nextSlot.value = getNextUnassignedAssignmentIndex(activeClass, store.activeSubjectId);
            assignIdx.value = nextSlot.value;
            pasteText.value = '';
        });

        function close() { emit('update:modelValue', false); }

        function submit() {
            const activeClass = getActiveClass();
            if (!activeClass) return;
            const val = pasteText.value.trim();
            if (!val) return;

            let importedData = [];
            try {
                importedData = JSON.parse(val);
            } catch (err) {
                val.split('\n').forEach(line => {
                    if (!line.trim()) return;
                    let solved = /تم الحل|محلول|تمت الإجابة|مكتمل|تسليم/.test(line);
                    const cleanLine = line.replace(/تم الحل|لم يتم الحل|محلول|غير محلول|تمت الإجابة|مكتمل|غير مكتمل/g, '').trim();
                    if (cleanLine.length > 4) importedData.push({ name: cleanLine, solved });
                });
            }

            if (!Array.isArray(importedData) || importedData.length === 0) {
                showNotification('لم يتم العثور على بيانات طلاب صالحة للاستيراد!', 'error');
                return;
            }
            importMadrasatiGradesList(importedData, assignIdx.value);
            close();
        }

        return { pasteText, assignIdx, nextSlot, maxVal, close, submit, triggerAutoMadrasatiSync };
    }
};
