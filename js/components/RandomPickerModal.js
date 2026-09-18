// v2/js/components/RandomPickerModal.js — random student picker for cold
// calling/participation, with an instant +1/-1 participation-grade shortcut
// for whoever gets picked. The old app drove the spin animation by mutating
// DOM text nodes on a setTimeout loop; here the same loop just writes to
// reactive refs and the template re-renders itself.
window.RandomPickerModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 480px; padding: 22px; text-align: center;">
                <div class="modal-header" style="border-bottom: 1px solid var(--surface-border); padding-bottom: 0.85rem; justify-content: space-between;">
                    <h3 style="font-weight: 800; font-size: 1.15rem; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                        <i class="fa-solid fa-dice" style="color: #818cf8;"></i> قرعة الاختيار العشوائي للطلاب
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>

                <div class="modal-body" style="padding: 1.5rem 0.5rem; display: flex; flex-direction: column; align-items: center;">
                    <div class="picker-stage-card" :class="{ spinning: stage === 'spinning', winner: stage === 'winner' }"
                         style="width: 100%; min-height: 170px; background: linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95)); border: 2px solid rgba(99, 102, 241, 0.35); border-radius: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.4), inset 0 0 20px rgba(99, 102, 241, 0.1); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.25rem;">

                        <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #10b981); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; margin-bottom: 0.85rem; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);">
                            {{ avatarText }}
                        </div>

                        <div style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.3rem; min-height: 38px; display: flex; align-items: center; justify-content: center; text-align: center;">
                            <span v-if="stage === 'winner'" style="color:#10b981; font-weight:800; font-size:1.4rem;">{{ displayName }}</span>
                            <span v-else>{{ displayName }}</span>
                        </div>

                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">{{ subText }}</div>
                    </div>

                    <div style="margin-top: 1.5rem; width: 100%;">
                        <button type="button" :disabled="stage === 'spinning'" @click="start" class="btn" style="width: 100%; padding: 0.85rem; font-size: 1.05rem; font-weight: 800; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border-radius: 12px; box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); display: flex; align-items: center; justify-content: center; gap: 0.6rem;">
                            <template v-if="stage === 'spinning'"><i class="fa-solid fa-circle-notch fa-spin"></i> جاري السحب العشوائي...</template>
                            <template v-else-if="stage === 'winner'"><i class="fa-solid fa-rotate-right"></i> سحب طالب آخر 🔄</template>
                            <template v-else><i class="fa-solid fa-play"></i> ابدأ السحب العشوائي 🎲</template>
                        </button>
                    </div>

                    <div v-if="stage === 'winner'" style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%; margin-top: 1.25rem; border-top: 1px solid var(--surface-border); padding-top: 1.25rem;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.25rem;">رصد تقييم فوري للطالب المختار:</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                            <button type="button" class="btn" @click="quickGrade('positive')" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1.5px solid #10b981; font-weight: 700; padding: 0.6rem; border-radius: 8px;">
                                <i class="fa-solid fa-plus"></i> مشاركة ممتازة (+1)
                            </button>
                            <button type="button" class="btn" @click="quickGrade('negative')" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1.5px solid #ef4444; font-weight: 700; padding: 0.6rem; border-radius: 8px;">
                                <i class="fa-solid fa-minus"></i> ملاحظة / خصم (-1)
                            </button>
                        </div>
                    </div>
                </div>

                <div class="modal-footer" style="display: flex; justify-content: center; border-top: 1px solid var(--surface-border); padding-top: 0.85rem; width: 100%;">
                    <button type="button" class="btn btn-secondary" @click="close" style="min-width: 140px;">إغلاق</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const stage = Vue.ref('idle'); // idle | spinning | winner
        const displayName = Vue.ref('اضغط على الزر أدناه لبدء القرعة');
        const subText = Vue.ref('سحب عشوائي عادل وممتع');
        const avatarText = Vue.ref('🎲');
        const pickedStudent = Vue.ref(null);
        let spinTimer = null;

        Vue.watch(() => props.modelValue, (open) => {
            if (!open) { clearTimeout(spinTimer); return; }
            const cls = getActiveClass();
            stage.value = 'idle';
            displayName.value = 'اضغط على الزر أدناه لبدء القرعة';
            avatarText.value = '🎲';
            pickedStudent.value = null;
            subText.value = cls ? `فصل: ${cls.name} (عدد الطلاب: ${(cls.students || []).length})` : '';
        });

        function close() { emit('update:modelValue', false); }

        // Weighted so a student with fewer recorded positive-participation
        // marks is more likely to come up - weight = 1/(count+1), so 0
        // participations gets weight 1, 1 gets 0.5, 2 gets 0.33, etc.
        // Nobody ever hits zero probability (a very active student can
        // still occasionally be picked), it just skews toward the quiet
        // ones - matching what the smart-alerts panel already tells
        // teachers to use this picker for.
        function pickWeightedStudent(students) {
            const categories = getActiveSubjectGradingCategories(store.activeSubjectId);
            const partCat = categories.find(c => c.type === 'participation') || { id: 'participation', max: 10 };
            const catKey = partCat.id || 'participation';

            const weights = students.map(s => {
                const grades = getStudentSubjectGrades(s);
                const arr = grades[catKey] || grades.participation;
                const count = Array.isArray(arr) ? arr.filter(v => v === true).length : 0;
                return 1 / (count + 1);
            });
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (let i = 0; i < students.length; i++) {
                r -= weights[i];
                if (r <= 0) return students[i];
            }
            return students[students.length - 1];
        }

        function start() {
            if (stage.value === 'spinning') return;
            const students = getActiveStudents();
            if (!students || students.length === 0) return;

            // Decided up front so the spin animation actually lands on the
            // real winner - previously the animation cycled through random
            // names, then a SEPARATE random pick decided the winner, so the
            // name it visually settled on and the announced winner often
            // didn't match.
            const winner = pickWeightedStudent(students);

            stage.value = 'spinning';
            subText.value = 'جاري السحب العادل بين جميع طلاب الفصل...';

            let counter = 0;
            const totalSteps = 26 + Math.floor(Math.random() * 8);
            let speed = 45;

            function spinStep() {
                counter++;
                if (counter < totalSteps) {
                    const tempStudent = students[Math.floor(Math.random() * students.length)];
                    displayName.value = tempStudent.name;
                    avatarText.value = tempStudent.name.charAt(0);
                    if (counter > totalSteps - 10) speed += 25;
                    else if (counter > totalSteps - 5) speed += 45;
                    spinTimer = setTimeout(spinStep, speed);
                } else {
                    pickedStudent.value = winner;
                    stage.value = 'winner';
                    avatarText.value = winner.name.charAt(0);
                    displayName.value = winner.name;
                    subText.value = '';
                }
            }
            spinStep();
        }

        function quickGrade(type) {
            const student = pickedStudent.value;
            if (!student) { showNotification('لم يتم تحديد طالب بعد!', 'warning'); return; }

            const gradesObj = getStudentSubjectGrades(student);
            const categories = getActiveSubjectGradingCategories(store.activeSubjectId);
            const partCat = categories.find(c => c.id === 'participation' || c.id === 'cat_participation' || c.type === 'participation') || { id: 'participation', max: 10 };
            const catKey = partCat.id || 'participation';
            const maxVal = partCat.max || 10;

            if (!Array.isArray(gradesObj[catKey])) {
                const n = parseInt(gradesObj[catKey]) || 0;
                gradesObj[catKey] = Array(maxVal).fill(false).map((_, i) => i < n);
            }
            if (!Array.isArray(gradesObj.participation)) gradesObj.participation = gradesObj[catKey];
            else gradesObj[catKey] = gradesObj.participation;

            if (type === 'positive') {
                const emptyIdx = gradesObj[catKey].findIndex(v => !v || v === false);
                if (emptyIdx !== -1) {
                    gradesObj[catKey][emptyIdx] = true;
                    gradesObj.participation[emptyIdx] = true;
                    saveData();
                    showNotification(`✅ تم رصد نقطة مشاركة إيجابية للطالب "${student.name}" بنجاح!`, 'success');
                } else {
                    showNotification(`الطالب "${student.name}" مكتمل نقاط المشاركة بالفعل (${maxVal}/${maxVal})! 👏`, 'info');
                }
            } else {
                // Only an actually-empty slot (never one already holding
                // true) - the old `v === true` clause here meant a
                // negative note could land on a slot with an existing
                // positive mark and silently erase it.
                const emptyIdx = gradesObj[catKey].findIndex(v => !v);
                if (emptyIdx !== -1) {
                    gradesObj[catKey][emptyIdx] = 'ملاحظة صفية';
                    gradesObj.participation[emptyIdx] = 'ملاحظة صفية';
                    saveData();
                    showNotification(`⚠️ تم تسجيل ملاحظة صفية للطالب "${student.name}".`, 'warning');
                } else {
                    showNotification(`لا توجد خانة مشاركة فارغة لتسجيل ملاحظة للطالب "${student.name}" (كل الخانات مستخدمة بالفعل).`, 'info');
                }
            }
        }

        return { stage, displayName, subText, avatarText, close, start, quickGrade };
    }
};
