// v2/js/components/GradingTable.js — the main grading table: search/filter,
// one column per active grading category, dot-click cycling, inline numeric
// inputs, per-row total/status. Old app.js rebuilt the whole <tbody>
// innerHTML on every single edit (renderTable()); here each cell is a real
// Vue-tracked binding, so a dot click only re-renders that cell + the row's
// total, and the search/filter list is just a computed property.
window.GradingTable = {
    template: `
        <div>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem;">
                <input type="text" class="search-input" v-model="query" placeholder="ابحث باسم الطالب...">
                <select class="form-control" v-model="statusFilterVal" style="max-width:180px;">
                    <option value="all">الكل</option>
                    <option value="pass">ناجح</option>
                    <option value="fail">متعثر</option>
                    <option value="excellent">ممتاز</option>
                </select>
                <div style="flex:1;"></div>
                <button class="btn btn-secondary btn-sm" @click="$emit('add-student')"><i class="fa-solid fa-user-plus"></i> إضافة طالب</button>
                <button class="btn btn-secondary btn-sm" @click="$emit('bulk-grade')"><i class="fa-solid fa-graduation-cap"></i> رصد جماعي</button>
                <button class="btn btn-secondary btn-sm" @click="$emit('grading-setup')"><i class="fa-solid fa-sliders"></i> بنود التقييم</button>
            </div>

            <div v-if="filtered.length === 0" class="empty-state" style="display:flex; flex-direction:column; align-items:center; padding:3rem; color:var(--text-muted);">
                <i class="fa-solid fa-user-slash" style="font-size:2rem; margin-bottom:0.75rem;"></i>
                <span>لا يوجد طلاب مطابقون.</span>
            </div>

            <div v-else style="overflow-x:auto;">
                <table class="students-table">
                    <thead>
                        <tr>
                            <th style="width:45px; text-align:center;">م</th>
                            <th>اسم الطالب</th>
                            <th v-for="cat in categories" :key="cat.id">{{ cat.name }} ({{ cat.max }})</th>
                            <th>المجموع ({{ totalMax }})</th>
                            <th>التقدير</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(student, index) in filtered" :key="student.id" class="student-row">
                            <td style="text-align:center; font-weight:700; color:var(--text-muted);">{{ index + 1 }}</td>
                            <td><strong>{{ student.name }}</strong></td>
                            <td v-for="cat in categories" :key="cat.id">
                                <template v-if="cat.type === 'numeric'">
                                    <input type="number" class="table-input" :value="gradeVal(student, cat)"
                                           min="0" :max="cat.max" step="0.5" :title="cat.name + ' (من ' + cat.max + ')'"
                                           @change="onNumericChange(student, cat, $event)" @keydown.enter="$event.target.blur()">
                                </template>
                                <template v-else>
                                    <div style="font-weight:700; margin-bottom:4px;">{{ earned(student, cat) }}</div>
                                    <div class="table-checkbox-group">
                                        <span v-for="i in dotCount(cat)" :key="i - 1"
                                              :class="dotVisual(student, cat, i - 1).cls"
                                              :title="dotVisual(student, cat, i - 1).tip"
                                              @click="onDotClick(student, cat, i - 1)"></span>
                                    </div>
                                </template>
                            </td>
                            <td :style="{ fontWeight: 800, fontSize: '1.1rem', color: total(student) >= 50 ? 'var(--accent-teal)' : 'var(--danger-color)' }">{{ total(student) }}</td>
                            <td>
                                <span class="badge" :style="badgeStyle(student)">
                                    <i class="fa-solid" :class="badgeInfo(student).icon"></i> {{ badgeInfo(student).text }}
                                </span>
                            </td>
                            <td>
                                <div class="action-dropdown">
                                    <button class="action-menu-btn" @click.stop="openMenuId = (openMenuId === student.id ? null : student.id)"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                                    <div class="action-dropdown-menu" :class="{ active: openMenuId === student.id }">
                                        <div class="action-dropdown-item" @click="openMenuId = null; $emit('edit-student', student)">
                                            <i class="fa-solid fa-pen-to-square" style="color:#6366f1;"></i><span>تعديل الاسم والبيانات</span>
                                        </div>
                                        <div class="action-dropdown-divider"></div>
                                        <div class="action-dropdown-item danger" @click="openMenuId = null; deleteStudent(student)">
                                            <i class="fa-solid fa-trash" style="color:#ef4444;"></i><span>حذف الطالب</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `,
    emits: ['add-student', 'bulk-grade', 'grading-setup', 'edit-student'],
    setup() {
        const query = Vue.ref('');
        const statusFilterVal = Vue.ref('all');
        const openMenuId = Vue.ref(null);

        const categories = Vue.computed(() => getActiveSubjectGradingCategories(store.activeSubjectId).filter(c => c.max > 0));
        const totalMax = Vue.computed(() => categories.value.reduce((s, c) => s + (c.max || 0), 0));

        const filtered = Vue.computed(() => {
            const q = query.value.toLowerCase().trim();
            return getActiveStudents().filter(student => {
                const match = student.name.toLowerCase().includes(q);
                if (!match) return false;
                if (statusFilterVal.value === 'all') return true;
                const status = getStudentStatus(getStudentTotal(student));
                if (statusFilterVal.value === 'pass') return status === 'pass' || status === 'excellent';
                return status === statusFilterVal.value;
            });
        });

        function gradeVal(student, cat) {
            const g = getStudentSubjectGrades(student);
            return g[cat.id] !== undefined ? g[cat.id] : (g[cat.key] || 0);
        }
        function dotCount(cat) { return isAssignmentsCategory(cat) ? cat.max : (cat.dotsCount || cat.max); }
        function earned(student, cat) {
            if (isAssignmentsCategory(cat)) return getStudentAssignmentScore(student, store.activeSubjectId, cat.max);
            if (cat.type === 'dots') return getCheckboxSum(gradeVal(student, cat), cat.pointValue, cat.max);
            if (cat.type === 'participation') return getParticipationScore(gradeVal(student, cat), cat.max, cat.pointValue);
            return gradeVal(student, cat);
        }
        function dotVisual(student, cat, index) {
            const val = gradeVal(student, cat)[index];
            return getDotVisual(val, isAssignmentsCategory(cat), index);
        }
        function total(student) { return getStudentTotal(student); }
        function badgeInfo(student) { return getStatusBadgeInfo(getStudentStatus(total(student))); }
        function badgeStyle(student) {
            const info = badgeInfo(student);
            return { background: info.color + '26', color: info.color, border: '1px solid ' + info.color + '59', fontWeight: 800 };
        }

        function onNumericChange(student, cat, evt) {
            let val = parseFloat(evt.target.value);
            if (isNaN(val) || val < 0) val = 0;
            if (val > cat.max) val = cat.max;
            evt.target.value = val;
            getStudentSubjectGrades(student)[cat.id] = val;
            saveData();
            showNotification(`تم حفظ درجة "${cat.name}".`);
        }

        function onDotClick(student, cat, index) {
            const g = getStudentSubjectGrades(student);
            const isAssign = isAssignmentsCategory(cat);
            const isParticipation = cat.type === 'participation';
            const arr = g[cat.id];

            if (isAssign) {
                const val = arr[index];
                if (!val || val === false) arr[index] = true;
                else if (val === true) arr[index] = 'لم يحل الواجب';
                else arr[index] = false;
                if (Array.isArray(g.assignments)) g.assignments[index] = arr[index];
                saveData();
                return;
            }

            if (isParticipation) {
                const val = arr[index];
                if (!val || val === false) {
                    arr[index] = true;
                    if (Array.isArray(g.participation)) g.participation[index] = true;
                    saveData();
                } else if (val === true) {
                    setReasonCallback((fullReason) => {
                        arr[index] = fullReason;
                        if (Array.isArray(g.participation)) g.participation[index] = fullReason;
                        saveData();
                    });
                    openReasonModal({ studentId: student.id, index, context: 'table', catKey: cat.id });
                } else {
                    arr[index] = false;
                    if (Array.isArray(g.participation)) g.participation[index] = false;
                    saveData();
                }
                return;
            }

            // Simple 2-state toggle for other dot categories
            arr[index] = !arr[index];
            saveData();
        }

        function deleteStudent(student) {
            if (!confirm(`هل أنت متأكد من حذف الطالب "${student.name}"؟`)) return;
            const cls = getActiveClass();
            cls.students = cls.students.filter(s => s.id !== student.id);
            saveData();
            showNotification(`تم حذف "${student.name}".`, 'warning');
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.action-dropdown')) openMenuId.value = null;
        });

        return {
            query, statusFilterVal, openMenuId, categories, totalMax, filtered,
            gradeVal, dotCount, earned, dotVisual, total, badgeInfo, badgeStyle,
            onNumericChange, onDotClick, deleteStudent
        };
    }
};
