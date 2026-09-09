// v2/js/components/GradingTable.js — the main grading table: search/filter,
// one column per active grading category, dot-click cycling, inline numeric
// inputs, per-row total/status. Old app.js rebuilt the whole <tbody>
// innerHTML on every single edit (renderTable()); here each cell is a real
// Vue-tracked binding, so a dot click only re-renders that cell + the row's
// total, and the search/filter list is just a computed property.
window.GradingTable = {
    template: `
        <div>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
                    <input type="text" class="search-input" v-model="query" placeholder="ابحث باسم الطالب...">
                    <select class="form-control" v-model="statusFilterVal" style="max-width:180px;">
                        <option value="all">الكل</option>
                        <option value="pass">ناجح</option>
                        <option value="fail">متعثر</option>
                        <option value="excellent">ممتاز</option>
                    </select>
                </div>

                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                    <div v-for="subj in store.subjects" :key="subj.id" class="class-tab subject-tab" :class="{ active: subj.id === store.activeSubjectId }"
                         @click="switchSubject(subj.id)" @dblclick="renameSubject(subj)">
                        <span>{{ subj.name }}</span>
                        <button v-if="subj.id === store.activeSubjectId" class="delete-class-btn" style="color:var(--warning-color); margin-right:0.35rem;" title="بنود التقييم" @click.stop="$emit('open-grading-setup', subj.id)">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                        <button v-if="store.subjects.length > 1" class="delete-class-btn" title="حذف المادة" @click.stop="deleteSubject(subj)">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <button class="class-tab subject-tab" style="background: rgba(20,184,166,0.15); border-color: rgba(20,184,166,0.35); color: var(--accent-teal); font-weight:700;" @click="addSubject">
                        <i class="fa-solid fa-plus"></i> مادة جديدة
                    </button>
                </div>
            </div>

            <div v-if="rows.length === 0" class="empty-state" style="display:flex; flex-direction:column; align-items:center; padding:3rem; color:var(--text-muted);">
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
                        <tr v-for="(row, index) in rows" :key="row.student.id" class="student-row">
                            <td style="text-align:center; font-weight:700; color:var(--text-muted);">{{ index + 1 }}</td>
                            <td><strong>{{ row.student.name }}</strong></td>
                            <td v-for="cell in row.cells" :key="cell.cat.id">
                                <template v-if="cell.type === 'numeric'">
                                    <input type="number" class="table-input" :value="cell.value"
                                           min="0" :max="cell.cat.max" step="0.5" :title="cell.cat.name + ' (من ' + cell.cat.max + ')'"
                                           @change="onNumericChange(row.student, cell.cat, $event)" @keydown.enter="$event.target.blur()">
                                </template>
                                <template v-else>
                                    <div style="font-weight:700; margin-bottom:4px;">{{ cell.earned }}</div>
                                    <div class="table-checkbox-group">
                                        <span v-for="(dot, i) in cell.dots" :key="i"
                                              :class="dot.cls" :title="dot.tip"
                                              @click="onDotClick(row.student, cell.cat, i)"></span>
                                    </div>
                                </template>
                            </td>
                            <td :style="{ fontWeight: 800, fontSize: '1.1rem', color: row.total >= 50 ? 'var(--accent-teal)' : 'var(--danger-color)' }">{{ row.total }}</td>
                            <td>
                                <span class="badge" :style="row.badgeStyle">
                                    <i class="fa-solid" :class="row.badge.icon"></i> {{ row.badge.text }}
                                </span>
                            </td>
                            <td>
                                <div class="action-dropdown">
                                    <button class="action-menu-btn" @click.stop="openMenuId = (openMenuId === row.student.id ? null : row.student.id)"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                                    <div class="action-dropdown-menu" :class="{ active: openMenuId === row.student.id }">
                                        <div class="action-dropdown-item" @click="openMenuId = null; $emit('view-report', row.student)">
                                            <i class="fa-solid fa-file-invoice" style="color:var(--accent-teal);"></i><span>تقرير مستوى الطالب</span>
                                        </div>
                                        <div class="action-dropdown-item" @click="openMenuId = null; $emit('view-referral', row.student)">
                                            <i class="fa-solid fa-file-signature" style="color:#f59e0b;"></i><span>إصدار نموذج إحالة</span>
                                        </div>
                                        <div class="action-dropdown-item" @click="openMenuId = null; $emit('edit-student', row.student)">
                                            <i class="fa-solid fa-pen-to-square" style="color:#6366f1;"></i><span>تعديل الاسم والبيانات</span>
                                        </div>
                                        <div class="action-dropdown-item" @click="openMenuId = null; $emit('transfer-student', row.student)">
                                            <i class="fa-solid fa-right-left" style="color:#38bdf8;"></i><span>نقل الطالب إلى فصل آخر</span>
                                        </div>
                                        <div class="action-dropdown-divider"></div>
                                        <div class="action-dropdown-item danger" @click="openMenuId = null; deleteStudent(row.student)">
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
    emits: ['edit-student', 'view-report', 'view-referral', 'transfer-student', 'open-grading-setup'],
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

        // Precomputes every cell/total/badge for every visible row ONCE per
        // actual data change, instead of calling getStudentSubjectGrades /
        // getStudentTotal repeatedly from the template (once per dot, again
        // for the earned-score label, again for the total column, again for
        // the badge...). That per-template-expression-call pattern measured
        // at ~90,000 getStudentSubjectGrades calls for a single dot click on
        // a 35-student class (~2.1s) — this computed makes it one pass:
        // O(students × categories), reused by every template binding below.
        const rows = Vue.computed(() => {
            const cats = categories.value;
            return filtered.value.map(student => {
                const g = getStudentSubjectGrades(student);
                const cells = cats.map(cat => {
                    const val = g[cat.id] !== undefined ? g[cat.id] : (g[cat.key] || 0);
                    if (cat.type === 'numeric') return { cat, type: 'numeric', value: val };

                    const isAssign = isAssignmentsCategory(cat);
                    let earnedVal;
                    if (isAssign) earnedVal = getStudentAssignmentScore(student, store.activeSubjectId, cat.max);
                    else if (cat.type === 'dots') earnedVal = getCheckboxSum(val, cat.pointValue, cat.max);
                    else earnedVal = getParticipationScore(val, cat.max, cat.pointValue);

                    const count = isAssign ? cat.max : (cat.dotsCount || cat.max);
                    const dots = [];
                    for (let i = 0; i < count; i++) dots.push(getDotVisual(val[i], isAssign, i));

                    return { cat, type: 'dots', earned: earnedVal, dots };
                });

                const totalVal = getStudentTotal(student);
                const badge = getStatusBadgeInfo(getStudentStatus(totalVal));
                const badgeStyleObj = { background: badge.color + '26', color: badge.color, border: '1px solid ' + badge.color + '59', fontWeight: 800 };

                return { student, cells, total: totalVal, badge, badgeStyle: badgeStyleObj };
            });
        });

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
            store, query, statusFilterVal, openMenuId, categories, totalMax, rows,
            onNumericChange, onDotClick, deleteStudent,
            switchSubject, addSubject, renameSubject, deleteSubject
        };
    }
};
