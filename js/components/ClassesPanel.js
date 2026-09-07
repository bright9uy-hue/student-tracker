// v2/js/components/ClassesPanel.js — classes landing grid (list classes,
// add/rename/delete, open a class into the dashboard). Stage 1 keeps the
// cards simple (name + student count); the class-average/level badge from
// the old renderClassesLandingCards() is added back in Stage 2 once
// grading.js (getStudentTotal) exists.
window.ClassesPanel = {
    template: `
        <section class="classes-landing-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
                <h2 style="font-size:1.1rem; font-weight:800;">فصولي الدراسية</h2>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-secondary" @click="addClassViaNoor" title="إنشاء فصل واستيراد كشف أسماء الطلاب من نظام نور">
                        <i class="fa-solid fa-file-import" style="color:var(--accent-teal);"></i> استيراد من نور
                    </button>
                    <button class="btn" @click="addClass">
                        <i class="fa-solid fa-plus"></i> إضافة فصل جديد
                    </button>
                </div>
            </div>

            <div v-if="store.classes.length === 0" style="grid-column:1/-1; background: var(--surface-color); border: 1px dashed var(--surface-border); border-radius: 16px; padding: 3rem; text-align: center;">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">لا تملك أي فصول حالياً</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.35rem; margin-bottom: 1.5rem;">اضغط على زر "إضافة فصل جديد" للبدء، أو استورد كشف أسماء جاهز من نظام نور.</p>
                <div style="display:flex; gap:0.75rem; justify-content:center;">
                    <button class="btn" @click="addClass">
                        <i class="fa-solid fa-plus"></i> إضافة فصل جديد
                    </button>
                    <button class="btn btn-secondary" @click="addClassViaNoor">
                        <i class="fa-solid fa-file-import" style="color:var(--accent-teal);"></i> استيراد من نور
                    </button>
                </div>
            </div>

            <div v-else style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem;">
                <div v-for="card in classCards" :key="card.cls.id" class="content-card"
                     style="display:flex; flex-direction:column; justify-content:space-between; gap:1.25rem; cursor:pointer;"
                     @click="openClass(card.cls.id)">
                    <div>
                        <h3 style="font-size:1.25rem; font-weight:800; display:flex; align-items:center; gap:0.5rem;">
                            <i class="fa-solid fa-graduation-cap" style="color: var(--primary-color);"></i>
                            {{ card.cls.name }}
                        </h3>
                        <div style="color: var(--text-muted); font-size:0.88rem; margin-top:0.5rem;">
                            <i class="fa-solid fa-users"></i>
                            إجمالي الطلاب: <strong style="color: var(--text-main);">{{ card.studentCount }} طالب</strong>
                        </div>
                        <div style="margin-top:0.5rem;">
                            <span v-if="!card.studentCount" style="color: var(--text-muted); font-size:0.82rem;">لا توجد درجات حتى الآن</span>
                            <span v-else :style="card.badgeStyle">
                                <i class="fa-solid fa-chart-line"></i> المستوى العام: {{ card.levelText }} ({{ card.avg }}%)
                            </span>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:0.4rem; border-top:1px solid var(--surface-border); padding-top:0.85rem;">
                        <button class="btn btn-sm btn-secondary" @click.stop="openNewPeriod" title="بدء فترة تقييم جديدة" style="color:#f59e0b; border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.1);">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" @click.stop="renameClass(card.cls)" title="تعديل اسم الفصل">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" @click.stop="deleteClass(card.cls.id)" title="حذف الفصل">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>

            <new-period-modal v-model="showNewPeriod"></new-period-modal>
            <noor-import-modal v-model="showNoorImport"></noor-import-modal>
        </section>
    `,
    setup() {
        const showNewPeriod = Vue.ref(false);
        function openNewPeriod() { showNewPeriod.value = true; }
        const showNoorImport = Vue.ref(false);

        async function addClass() {
            const name = await showPrompt('اسم الفصل الجديد:');
            if (!name || !name.trim()) return;
            const cls = { id: 'class-' + Date.now(), name: name.trim(), students: [] };
            store.classes.push(cls);
            store.activeClassId = cls.id;
            saveData();
        }

        // Matches the old app's "add class" flow: Noor import creates the
        // class first (its save handler writes into the active class), then
        // opens the roster-paste modal.
        async function addClassViaNoor() {
            const name = await showPrompt('اسم الفصل الجديد:');
            if (!name || !name.trim()) return;
            const cls = { id: 'class-' + Date.now(), name: name.trim(), students: [] };
            store.classes.push(cls);
            store.activeClassId = cls.id;
            saveData();
            showNoorImport.value = true;
        }
        async function renameClass(cls) {
            const name = await showPrompt('أدخل الاسم الجديد للفصل:', cls.name);
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

        // Precomputes each card's average/level/badge once per actual data
        // change instead of calling classAvg/levelInfo/levelBadgeStyle
        // separately from the template (levelBadgeStyle called levelInfo
        // which called classAvg again, tripling the per-card student scan)
        // — the same fix applied to GradingTable's rows for the same reason.
        const classCards = Vue.computed(() => store.classes.map(cls => {
            const students = cls.students || [];
            const avg = students.length === 0 ? 0 : Math.round(
                students.reduce((s, student) => s + getStudentTotal(student, store.activeSubjectId, cls), 0) / students.length
            );
            let levelText, color;
            if (avg >= 90) { levelText = 'متميز (ممتاز)'; color = '#10b981'; }
            else if (avg >= 50) { levelText = 'ناجح (جيد)'; color = '#f59e0b'; }
            else { levelText = 'متعثر'; color = '#ef4444'; }
            const badgeStyle = `background:${color}1f; color:${color}; border:1px solid ${color}59; font-size:0.8rem; font-weight:700; padding:0.3rem 0.75rem; border-radius:8px; display:inline-flex; align-items:center; gap:0.35rem;`;
            return { cls, studentCount: students.length, avg, levelText, badgeStyle };
        }));

        return { store, classCards, showNewPeriod, openNewPeriod, showNoorImport, addClass, addClassViaNoor, renameClass, deleteClass, openClass };
    }
};
