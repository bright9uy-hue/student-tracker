// v2/js/components/ClassesPanel.js — classes landing grid (list classes,
// add/rename/delete, open a class into the dashboard). Stage 1 keeps the
// cards simple (name + student count); the class-average/level badge from
// the old renderClassesLandingCards() is added back in Stage 2 once
// grading.js (getStudentTotal) exists.
window.ClassesPanel = {
    template: `
        <section class="classes-landing-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                <h2 style="font-size:1.1rem; font-weight:800;">فصولي الدراسية</h2>
                <button class="btn" @click="addClass">
                    <i class="fa-solid fa-plus"></i> إضافة فصل جديد
                </button>
            </div>

            <div v-if="store.classes.length === 0" style="grid-column:1/-1; background: var(--surface-color); border: 1px dashed var(--surface-border); border-radius: 16px; padding: 3rem; text-align: center;">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">لا تملك أي فصول حالياً</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.35rem; margin-bottom: 1.5rem;">اضغط على زر "إضافة فصل جديد" للبدء.</p>
                <button class="btn" @click="addClass" style="display:inline-flex; margin:0 auto;">
                    <i class="fa-solid fa-plus"></i> إضافة فصل جديد
                </button>
            </div>

            <div v-else style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem;">
                <div v-for="cls in store.classes" :key="cls.id" class="content-card"
                     style="display:flex; flex-direction:column; justify-content:space-between; gap:1.25rem; cursor:pointer;"
                     @click="openClass(cls.id)">
                    <div>
                        <h3 style="font-size:1.25rem; font-weight:800; display:flex; align-items:center; gap:0.5rem;">
                            <i class="fa-solid fa-graduation-cap" style="color: var(--primary-color);"></i>
                            {{ cls.name }}
                        </h3>
                        <div style="color: var(--text-muted); font-size:0.88rem; margin-top:0.5rem;">
                            <i class="fa-solid fa-users"></i>
                            إجمالي الطلاب: <strong style="color: var(--text-main);">{{ (cls.students || []).length }} طالب</strong>
                        </div>
                        <div style="margin-top:0.5rem;">
                            <span v-if="!(cls.students || []).length" style="color: var(--text-muted); font-size:0.82rem;">لا توجد درجات حتى الآن</span>
                            <span v-else :style="levelBadgeStyle(cls)">
                                <i class="fa-solid fa-chart-line"></i> المستوى العام: {{ levelInfo(cls).text }} ({{ classAvg(cls) }}%)
                            </span>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:0.4rem; border-top:1px solid var(--surface-border); padding-top:0.85rem;">
                        <button class="btn btn-sm btn-secondary" @click.stop="openNewPeriod" title="بدء فترة تقييم جديدة" style="color:#f59e0b; border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.1);">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" @click.stop="renameClass(cls)" title="تعديل اسم الفصل">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" @click.stop="deleteClass(cls.id)" title="حذف الفصل">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>

            <new-period-modal v-model="showNewPeriod"></new-period-modal>
        </section>
    `,
    setup() {
        const showNewPeriod = Vue.ref(false);
        function openNewPeriod() { showNewPeriod.value = true; }

        function addClass() {
            const name = prompt('اسم الفصل الجديد:');
            if (!name || !name.trim()) return;
            const cls = { id: 'class-' + Date.now(), name: name.trim(), students: [] };
            store.classes.push(cls);
            store.activeClassId = cls.id;
            saveData();
        }
        function renameClass(cls) {
            const name = prompt('أدخل الاسم الجديد للفصل:', cls.name);
            if (name && name.trim()) {
                cls.name = name.trim();
                saveData();
            }
        }
        function deleteClass(classId) {
            if (!confirm('هل أنت متأكد من حذف هذا الفصل؟ سيتم حذف جميع بيانات طلابه.')) return;
            const idx = store.classes.findIndex(c => c.id === classId);
            if (idx === -1) return;
            store.classes.splice(idx, 1);
            if (store.activeClassId === classId) {
                store.activeClassId = store.classes.length > 0 ? store.classes[0].id : null;
            }
            saveData();
        }
        function openClass(classId) {
            store.activeClassId = classId;
            saveData();
            store.currentScreen = 'dashboard';
        }

        function classAvg(cls) {
            const students = cls.students || [];
            if (students.length === 0) return 0;
            const sum = students.reduce((s, student) => s + getStudentTotal(student, store.activeSubjectId, cls), 0);
            return Math.round(sum / students.length);
        }
        function levelInfo(cls) {
            const avg = classAvg(cls);
            if (avg >= 90) return { text: 'متميز (ممتاز)', color: '#10b981' };
            if (avg >= 50) return { text: 'ناجح (جيد)', color: '#f59e0b' };
            return { text: 'متعثر', color: '#ef4444' };
        }
        function levelBadgeStyle(cls) {
            const info = levelInfo(cls);
            return `background:${info.color}1f; color:${info.color}; border:1px solid ${info.color}59; font-size:0.8rem; font-weight:700; padding:0.3rem 0.75rem; border-radius:8px; display:inline-flex; align-items:center; gap:0.35rem;`;
        }

        return { store, showNewPeriod, openNewPeriod, addClass, renameClass, deleteClass, openClass, classAvg, levelInfo, levelBadgeStyle };
    }
};
