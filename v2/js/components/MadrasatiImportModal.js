// v2/js/components/MadrasatiImportModal.js — manual paste path for
// Madrasati assignment results (the automated path goes through the
// window 'MadrasatiGradesImported' listener in v2/js/madrasati-noor.js).
window.MadrasatiImportModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 550px;">
                <div class="modal-header">
                    <h3 style="font-weight:700;"><i class="fa-solid fa-chalkboard-user" style="color:#f59e0b;"></i> استيراد من منصة مدرستي</h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
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

        return { pasteText, assignIdx, nextSlot, maxVal, close, submit };
    }
};
