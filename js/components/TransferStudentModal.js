// v2/js/components/TransferStudentModal.js — moves one student from the
// active class to another class, optionally wiping their grades/behavior
// history in the process. Opened from GradingTable's per-row action menu.
window.TransferStudentModal = {
    props: { modelValue: Boolean, student: Object },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 480px;">
                <div class="modal-header" style="border-bottom: 1px solid var(--surface-border); padding-bottom: 0.85rem;">
                    <h3 style="font-weight: 700; display: flex; align-items: center; gap: 0.5rem; color: #38bdf8;">
                        <i class="fa-solid fa-right-left"></i> نقل الطالب إلى فصل آخر
                    </h3>
                    <button class="modal-close" @click="close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.25rem 1rem;">
                    <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="color: var(--text-muted);">اسم الطالب:</span>
                            <strong style="font-size: 1rem;">{{ student ? student.name : '-' }}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                            <span style="color: var(--text-muted);">الفصل الحالي:</span>
                            <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-weight: 700;">{{ currentClassName }}</span>
                        </div>
                    </div>

                    <form @submit.prevent="confirm">
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem; display: block;">اختر الفصل المراد النقل إليه:</label>
                            <select class="form-control" v-model="targetClassId" style="font-size: 0.95rem; font-weight: bold;" required>
                                <option v-for="c in otherClasses" :key="c.id" :value="c.id">{{ c.name }} ({{ (c.students || []).length }} طالب)</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.88rem; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--surface-border);">
                                <input type="checkbox" v-model="preserveGrades" style="width: 18px; height: 18px; accent-color: var(--accent-teal);">
                                <span>الاحتفاظ بكامل درجات الطالب وسجلاته المسجلة ونقلها معه (موصى به)</span>
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="border-top: 1px solid var(--surface-border); padding-top: 0.85rem; display: flex; justify-content: space-between;">
                    <button type="button" class="btn btn-secondary" @click="close" style="min-width: 100px;">إلغاء</button>
                    <button type="button" class="btn" style="min-width: 150px; background: #38bdf8; color: #0f172a; font-weight: 700;" @click="confirm">
                        <i class="fa-solid fa-right-left"></i> تأكيد النقل
                    </button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const targetClassId = Vue.ref('');
        const preserveGrades = Vue.ref(true);

        const otherClasses = Vue.computed(() => store.classes.filter(c => c.id !== store.activeClassId));
        const currentClassName = Vue.computed(() => (getActiveClass() || {}).name || '-');

        Vue.watch(() => props.modelValue, (open) => {
            if (!open) return;
            preserveGrades.value = true;
            if (otherClasses.value.length === 0) {
                showNotification('لا يوجد فصول أخرى لنقل الطالب إليها. أضف فصلاً جديداً أولاً!', 'warning');
                close();
                return;
            }
            targetClassId.value = otherClasses.value[0].id;
        });

        function close() { emit('update:modelValue', false); }

        function confirm() {
            const activeClass = getActiveClass();
            if (!activeClass || !props.student) return;

            const studentIndex = activeClass.students.findIndex(s => s.id === props.student.id);
            if (studentIndex === -1) {
                showNotification('لم يتم العثور على الطالب في الفصل الحالي!', 'error');
                close();
                return;
            }

            const targetClass = store.classes.find(c => c.id === targetClassId.value);
            if (!targetClass) { showNotification('يرجى اختيار فصل صالح لنقل الطالب إليه!', 'warning'); return; }

            const [studentToMove] = activeClass.students.splice(studentIndex, 1);
            if (!preserveGrades.value) {
                studentToMove.grades = {};
                studentToMove.behaviorPoints = [];
            }
            if (!targetClass.students) targetClass.students = [];
            targetClass.students.push(studentToMove);

            saveData();
            close();
            showNotification(`✅ تم نقل الطالب "${studentToMove.name}" بنجاح إلى "${targetClass.name}"`, 'success');
        }

        return { targetClassId, preserveGrades, otherClasses, currentClassName, close, confirm };
    }
};
