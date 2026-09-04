// v2/js/components/Dashboard.js — per-class dashboard: stat cards, subject
// tabs, and the grading table + its modals (student add/edit, bulk grade,
// grading setup).
window.Dashboard = {
    template: `
        <section>
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.25rem; flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" @click="store.currentScreen = 'classes'">
                    <i class="fa-solid fa-arrow-right"></i> رجوع للفصول
                </button>
                <h2 style="font-size:1.1rem; font-weight:800;" v-if="cls">{{ cls.name }}</h2>
            </div>

            <div v-if="cls" class="dashboard-stats" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                <div class="content-card" style="text-align:center;">
                    <div style="font-size:1.6rem; font-weight:800; color: var(--accent-teal);">{{ studentCount }}</div>
                    <div style="color: var(--text-muted); font-size:0.85rem; margin-top:0.35rem;">إجمالي الطلاب</div>
                </div>
                <div class="content-card" style="text-align:center;">
                    <div style="font-size:1.6rem; font-weight:800; color: var(--accent-teal);">{{ classAverage }}%</div>
                    <div style="color: var(--text-muted); font-size:0.85rem; margin-top:0.35rem;">متوسط الفصل</div>
                </div>
                <div class="content-card" style="text-align:center;">
                    <div style="font-size:1.6rem; font-weight:800; color: var(--accent-teal);">{{ passRate }}%</div>
                    <div style="color: var(--text-muted); font-size:0.85rem; margin-top:0.35rem;">نسبة النجاح</div>
                </div>
                <div class="content-card" style="text-align:center;">
                    <div style="font-size:1.6rem; font-weight:800; color: var(--accent-teal);">{{ topScore }}</div>
                    <div style="color: var(--text-muted); font-size:0.85rem; margin-top:0.35rem;">أعلى درجة</div>
                </div>
            </div>

            <div v-if="cls" style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-bottom:1.25rem;">
                <div v-for="subj in store.subjects" :key="subj.id" class="class-tab subject-tab" :class="{ active: subj.id === store.activeSubjectId }"
                     @click="switchSubject(subj.id)" @dblclick="renameSubject(subj)">
                    <span>{{ subj.name }}</span>
                    <button v-if="subj.id === store.activeSubjectId" class="delete-class-btn" style="color:var(--warning-color); margin-right:0.35rem;" title="بنود التقييم" @click.stop="gradingSetupSubjectId = subj.id; showGradingSetup = true;">
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

            <div v-if="cls && store.activeSubjectId" style="display:flex; justify-content:flex-end; gap:0.5rem; margin-bottom:0.75rem; flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" @click="showNoorImport = true"><i class="fa-solid fa-file-import" style="color:var(--accent-teal);"></i> استيراد من نور</button>
                <button class="btn btn-secondary btn-sm" @click="showMadrasatiImport = true"><i class="fa-solid fa-chalkboard-user" style="color:#f59e0b;"></i> استيراد من مدرستي</button>
                <button class="btn btn-secondary btn-sm" @click="triggerAutoMadrasatiSync()"><i class="fa-solid fa-bolt" style="color:#f59e0b;"></i> رصد آلي كامل من مدرستي</button>
                <button class="btn btn-secondary btn-sm" @click="exportCurrentClassToCSV()"><i class="fa-solid fa-file-export" style="color:#10b981;"></i> تصدير CSV</button>
                <button class="btn btn-secondary btn-sm" @click="exportNoorGrades()"><i class="fa-solid fa-file-invoice-dollar" style="color:#6366f1;"></i> تصدير درجات نور</button>
            </div>

            <grading-table v-if="cls && store.activeSubjectId"
                @add-student="editingStudent = null; showStudentModal = true;"
                @edit-student="s => { editingStudent = s; showStudentModal = true; }"
                @bulk-grade="showBulkGrade = true"
                @grading-setup="gradingSetupSubjectId = store.activeSubjectId; showGradingSetup = true;"
                @view-report="s => { reportStudent = s; showStudentReport = true; }"
                @view-referral="s => { referralStudent = s; showReferral = true; }">
            </grading-table>
            <p v-else-if="cls" style="color: var(--text-muted);">أضف مادة دراسية أولاً لبدء رصد الدرجات.</p>

            <student-modal v-model="showStudentModal" :editing-student="editingStudent"></student-modal>
            <bulk-grade-modal v-model="showBulkGrade"></bulk-grade-modal>
            <grading-setup-modal v-model="showGradingSetup" :for-subject-id="gradingSetupSubjectId" :is-global-default="false"></grading-setup-modal>
            <student-report-modal v-model="showStudentReport" :student="reportStudent" @open-referral="s => { referralStudent = s; showReferral = true; }"></student-report-modal>
            <referral-modal v-model="showReferral" :student="referralStudent"></referral-modal>
            <noor-import-modal v-model="showNoorImport"></noor-import-modal>
            <madrasati-import-modal v-model="showMadrasatiImport"></madrasati-import-modal>
        </section>
    `,
    setup() {
        const cls = Vue.computed(() => getActiveClass());
        const studentCount = Vue.computed(() => (cls.value?.students || []).length);

        const showStudentModal = Vue.ref(false);
        const editingStudent = Vue.ref(null);
        const showBulkGrade = Vue.ref(false);
        const showGradingSetup = Vue.ref(false);
        const gradingSetupSubjectId = Vue.ref(null);
        const showStudentReport = Vue.ref(false);
        const reportStudent = Vue.ref(null);
        const showReferral = Vue.ref(false);
        const referralStudent = Vue.ref(null);
        const showNoorImport = Vue.ref(false);
        const showMadrasatiImport = Vue.ref(false);

        const totals = Vue.computed(() => (cls.value?.students || []).map(s => getStudentTotal(s, store.activeSubjectId, cls.value)));
        const classAverage = Vue.computed(() => {
            if (totals.value.length === 0) return 0;
            return Math.round(totals.value.reduce((a, b) => a + b, 0) / totals.value.length);
        });
        const passRate = Vue.computed(() => {
            if (totals.value.length === 0) return 0;
            const passing = totals.value.filter(t => t >= 50).length;
            return Math.round((passing / totals.value.length) * 100);
        });
        const topScore = Vue.computed(() => totals.value.length === 0 ? 0 : Math.max(...totals.value));

        function switchSubject(id) { store.activeSubjectId = id; saveData(); }

        function addSubject() {
            const name = prompt('اسم المادة الجديدة:');
            if (!name || !name.trim()) return;
            const newSubject = { id: 'subject-' + Date.now(), name: name.trim() };
            store.subjects.push(newSubject);
            store.activeSubjectId = newSubject.id;
            saveData();
            showNotification(`تمت إضافة مادة "${newSubject.name}".`);
        }

        function renameSubject(subj) {
            const name = prompt('أدخل الاسم الجديد للمادة:', subj.name);
            if (name && name.trim()) { subj.name = name.trim(); saveData(); showNotification('تم تعديل اسم المادة.'); }
        }

        function deleteSubject(subj) {
            if (store.subjects.length === 1) { showNotification('لا يمكن حذف المادة الوحيدة!', 'error'); return; }
            if (!confirm(`هل أنت متأكد من حذف مادة "${subj.name}"؟ سيتم حذف جميع درجات هذه المادة فقط لكافة الطلاب في جميع الفصول!`)) return;
            store.classes.forEach(c => (c.students || []).forEach(s => { if (s.grades && s.grades[subj.id]) delete s.grades[subj.id]; }));
            store.subjects = store.subjects.filter(s => s.id !== subj.id);
            if (store.activeSubjectId === subj.id) store.activeSubjectId = store.subjects[0].id;
            saveData();
            showNotification(`تم حذف مادة "${subj.name}".`, 'warning');
        }

        return {
            store, cls, studentCount, classAverage, passRate, topScore,
            showStudentModal, editingStudent, showBulkGrade, showGradingSetup, gradingSetupSubjectId,
            showStudentReport, reportStudent, showReferral, referralStudent,
            showNoorImport, showMadrasatiImport,
            switchSubject, addSubject, renameSubject, deleteSubject,
            exportCurrentClassToCSV, exportNoorGrades, triggerAutoMadrasatiSync
        };
    }
};
