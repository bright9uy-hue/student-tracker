window.BulkGradeModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 560px;">
                <div class="modal-header">
                    <h3 style="font-weight:700;">
                        <i class="fa-solid fa-layer-group" style="color:var(--accent-teal);"></i>
                        رصد جماعي لمادة: <span style="color:var(--accent-teal);">{{ subjectName }}</span>
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group full-width">
                        <label>اختر بند التقييم</label>
                        <select class="form-control" v-model="selectedCatId">
                            <option v-for="c in scorableCategories" :key="c.id" :value="c.id">{{ c.name }} (من {{ c.max }})</option>
                        </select>
                    </div>

                    <div v-if="selectedCat && selectedCat.type === 'dots'" style="margin-top:1rem;">
                        <p style="color:var(--text-muted); font-size:0.88rem;">حدد النقاط المستحقة لجميع الطلاب:</p>
                        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                            <div class="checkbox-item" v-for="i in (selectedCat.dotsCount || selectedCat.max)" :key="i">
                                <input type="checkbox" :id="'bulk_cb_' + i" v-model="dotsChecked[i - 1]">
                                <label :for="'bulk_cb_' + i">{{ i }}</label>
                            </div>
                        </div>
                    </div>

                    <div v-else-if="selectedCat && selectedCat.type === 'participation'" style="margin-top:1rem;">
                        <p style="color:var(--text-muted); font-size:0.88rem;">حدد حالة كل نقطة مشاركة لجميع الطلاب:</p>
                        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                            <span v-for="(val, i) in participationState" :key="i" class="participation-form-dot"
                                  :class="{ positive: val === true, deduction: typeof val === 'string' && val }"
                                  @click="toggleParticipationDot(i)">{{ i + 1 }}</span>
                        </div>
                    </div>

                    <div v-else-if="selectedCat && selectedCat.type === 'numeric'" style="margin-top:1rem;">
                        <label>{{ 'الدرجة المُراد رصدها لـ (' + selectedCat.name + ') من ' + selectedCat.max + ':' }}</label>
                        <input type="number" class="form-control" v-model.number="numericValue" min="0" :max="selectedCat.max">
                        <span style="color:var(--text-muted); font-size:0.82rem;">الحد الأقصى: {{ selectedCat.max }} درجة.</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button type="button" class="btn" @click="apply">تطبيق على الفصل بالكامل</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const selectedCatId = Vue.ref('');
        const dotsChecked = Vue.ref([]);
        const participationState = Vue.ref([]);
        const numericValue = Vue.ref(0);

        const scorableCategories = Vue.computed(() => getActiveSubjectGradingCategories(store.activeSubjectId).filter(c => c.max > 0));
        const selectedCat = Vue.computed(() => scorableCategories.value.find(c => c.id === selectedCatId.value));
        const subjectName = Vue.computed(() => {
            const s = store.subjects.find(s => s.id === store.activeSubjectId);
            return s ? s.name : '';
        });

        Vue.watch(() => props.modelValue, (open) => {
            if (open) {
                if (scorableCategories.value.length > 0) selectedCatId.value = scorableCategories.value[0].id;
            }
        });

        Vue.watch(selectedCat, (cat) => {
            if (!cat) return;
            if (cat.type === 'dots') {
                dotsChecked.value = Array(cat.dotsCount || cat.max).fill(false);
            } else if (cat.type === 'participation') {
                participationState.value = Array(cat.dotsCount || cat.max).fill(false);
            } else if (cat.type === 'numeric') {
                numericValue.value = 0;
            }
        });

        function toggleParticipationDot(i) {
            const val = participationState.value[i];
            if (!val || val === false) {
                participationState.value[i] = true;
            } else if (val === true) {
                setReasonCallback((fullReason) => { participationState.value[i] = fullReason; });
                openReasonModal({ studentId: null, index: i, context: 'bulk' });
            } else {
                participationState.value[i] = false;
            }
        }

        function close() { emit('update:modelValue', false); }

        function apply() {
            const cat = selectedCat.value;
            const students = getActiveStudents();
            if (!cat || students.length === 0) return;
            if (!confirm(`هل أنت متأكد من تطبيق الرصد الجماعي لبند "${cat.name}" على جميع طلاب هذا الفصل؟ سيؤدي ذلك لمسح الدرجات القديمة في هذه الخانة.`)) return;

            if (cat.type === 'dots') {
                students.forEach(s => { getStudentSubjectGrades(s)[cat.id] = [...dotsChecked.value]; });
            } else if (cat.type === 'participation') {
                students.forEach(s => { getStudentSubjectGrades(s)[cat.id] = [...participationState.value]; });
            } else if (cat.type === 'numeric') {
                let val = numericValue.value || 0;
                if (val < 0) val = 0;
                if (val > cat.max) val = cat.max;
                students.forEach(s => { getStudentSubjectGrades(s)[cat.id] = val; });
            }
            saveData();
            showNotification(`تم تطبيق الرصد الجماعي بنجاح لبند "${cat.name}" لجميع طلاب الفصل.`, 'success');
            close();
        }

        return { selectedCatId, dotsChecked, participationState, numericValue, scorableCategories, selectedCat, subjectName, toggleParticipationDot, close, apply };
    }
};
