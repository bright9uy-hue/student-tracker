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

            <smart-alerts-panel v-if="cls" :active-class="cls" @view-referral="s => { referralStudent = s; showReferral = true; }" @open-random-picker="showRandomPicker = true"></smart-alerts-panel>

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

            <!-- Compact icon-only action row, matching the old app's header
                 button treatment exactly (same icons/colors/order). Teleported
                 into the real <header> (index.html's #dashboardHeaderActions)
                 so it sits in the top bar instead of the page body. -->
            <teleport to="#dashboardHeaderActions" v-if="cls && store.activeSubjectId">
                <button class="btn btn-icon-header" @click="showAddStudents = true" title="إضافة طالب أو مجموعة طلاب">
                    <i class="fa-solid fa-user-plus"></i>
                </button>
                <button class="btn btn-secondary btn-icon-header" @click="showMadrasatiImport = true" title="رصد واجب آلياً من منصة مدرستي" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35);">
                    <i class="fa-solid fa-chalkboard-user"></i>
                </button>
                <button class="btn btn-secondary btn-icon-header" @click="showRandomPicker = true" title="اختيار طالب عشوائي للمشاركة والتفاعل" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.35);">
                    <i class="fa-solid fa-dice"></i>
                </button>
                <button class="btn btn-secondary btn-icon-header" @click="showGroups = true" title="تقسيم المجموعات الصفية (التعلم التعاوني)" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35);">
                    <i class="fa-solid fa-people-group"></i>
                </button>
                <button class="btn btn-secondary btn-icon-header" @click="showBulkGrade = true" title="رصد درجات جماعي">
                    <i class="fa-solid fa-graduation-cap"></i>
                </button>
                <button class="btn btn-secondary btn-icon-header" @click="exportCurrentClassToCSV()" title="تصدير كشف الفصل (CSV)">
                    <i class="fa-solid fa-file-export" style="color: #10b981;"></i>
                </button>
                <button class="btn btn-secondary btn-icon-header" @click="exportNoorGrades()" title="تصدير درجات نور (خانة 40 وخانة 60)" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.35);">
                    <i class="fa-solid fa-file-invoice-dollar"></i>
                </button>
            </teleport>

            <grading-table v-if="cls && store.activeSubjectId"
                @edit-student="s => { editingStudent = s; showStudentModal = true; }"
                @view-report="s => { reportStudent = s; showStudentReport = true; }"
                @view-referral="s => { referralStudent = s; showReferral = true; }"
                @transfer-student="s => { transferStudent = s; showTransfer = true; }"
                @open-grading-setup="id => { gradingSetupSubjectId = id; showGradingSetup = true; }">
            </grading-table>
            <p v-else-if="cls" style="color: var(--text-muted);">أضف مادة دراسية أولاً لبدء رصد الدرجات.</p>

            <student-modal v-model="showStudentModal" :editing-student="editingStudent"></student-modal>
            <add-students-modal v-model="showAddStudents"></add-students-modal>
            <bulk-grade-modal v-model="showBulkGrade"></bulk-grade-modal>
            <grading-setup-modal v-model="showGradingSetup" :for-subject-id="gradingSetupSubjectId" :is-global-default="false"></grading-setup-modal>
            <student-report-modal v-model="showStudentReport" :student="reportStudent" @open-referral="s => { referralStudent = s; showReferral = true; }"></student-report-modal>
            <referral-modal v-model="showReferral" :student="referralStudent"></referral-modal>
            <madrasati-import-modal v-model="showMadrasatiImport"></madrasati-import-modal>
            <random-picker-modal v-model="showRandomPicker"></random-picker-modal>
            <student-groups-modal v-model="showGroups"></student-groups-modal>
            <transfer-student-modal v-model="showTransfer" :student="transferStudent"></transfer-student-modal>
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
        const showMadrasatiImport = Vue.ref(false);
        const showAddStudents = Vue.ref(false);
        const showRandomPicker = Vue.ref(false);
        const showGroups = Vue.ref(false);
        const showTransfer = Vue.ref(false);
        const transferStudent = Vue.ref(null);

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

        return {
            store, cls, studentCount, classAverage, passRate, topScore,
            showStudentModal, editingStudent, showBulkGrade, showGradingSetup, gradingSetupSubjectId,
            showStudentReport, reportStudent, showReferral, referralStudent,
            showMadrasatiImport,
            showAddStudents, showRandomPicker, showGroups, showTransfer, transferStudent,
            exportCurrentClassToCSV, exportNoorGrades
        };
    }
};
