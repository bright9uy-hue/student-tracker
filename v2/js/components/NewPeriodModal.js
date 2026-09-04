// v2/js/components/NewPeriodModal.js — archives the current evaluation
// period and starts a fresh one (each period is a clean 100-point slate,
// grades from earlier periods stay intact under their own period id).
window.NewPeriodModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 480px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem; color:#f59e0b;">
                        <i class="fa-solid fa-box-archive"></i> بدء فترة جديدة وأرشفة الفترة الحالية
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.85rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.85rem; line-height: 1.6;">
                        <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; margin-left: 0.4rem;"></i>
                        سيتم أرشفة الفترة الحالية بكل درجاتها وسجلاتها بأمان تام، وفتح فترة رصد جديدة نظيفة (من 100 درجة) مع الحفاظ الكامل على فصولك وأسماء طلابك.
                    </div>
                    <div class="form-group">
                        <label>اسم الفترة الجديدة</label>
                        <input type="text" class="form-control" v-model="name" @keydown.enter="submit">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button type="button" class="btn" style="background:#f59e0b; color:white;" @click="submit">تأكيد البدء والأرشفة</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const name = Vue.ref('الفترة الثانية');

        Vue.watch(() => props.modelValue, (open) => {
            if (!open) return;
            const arabicNums = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'];
            const nextNum = (store.periods ? store.periods.length : 0) + 1;
            name.value = `الفترة ${arabicNums[nextNum - 1] || nextNum}`;
        });

        function close() { emit('update:modelValue', false); }

        function submit() {
            const trimmed = name.value.trim();
            if (!trimmed) return;

            const currentActive = store.periods.find(p => p.id === store.activePeriodId);
            if (currentActive) currentActive.isArchived = true;

            const newPeriod = { id: 'period-' + Date.now(), name: trimmed, isArchived: false, createdAt: Date.now() };
            store.periods.push(newPeriod);
            store.activePeriodId = newPeriod.id;

            saveData();
            showNotification(`تمت أرشفة الفترة السابقة وبدء "${trimmed}" بنجاح!`, 'success');
            close();
        }

        return { name, close, submit };
    }
};
