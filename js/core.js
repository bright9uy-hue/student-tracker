// core.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 1-20: SIDEBAR TEACHER PROFILE HELPER
//   lines 21-43: SAFE STORAGE HELPER
//   lines 44-178: STATE MANAGEMENT
//   lines 179-193: MOCK DATA
//   lines 194-217: DOM REFERENCES
//   lines 218-450: INITIALIZATION
//   lines 714-952: DATA MANAGEMENT (CLASSES)
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.


function updateSidebarTeacherProfile() {
    try {
        const sideTeacher = document.getElementById('sidebarTeacherName');
        const sideSchool = document.getElementById('sidebarSchoolName');
        if (sideTeacher) {
            sideTeacher.textContent = (portfolioSettings && portfolioSettings.teacherName && portfolioSettings.teacherName.trim()) 
                ? portfolioSettings.teacherName 
                : 'اسم المعلم';
        }
        if (sideSchool) {
            sideSchool.textContent = (portfolioSettings && portfolioSettings.schoolName && portfolioSettings.schoolName.trim()) 
                ? portfolioSettings.schoolName 
                : 'متابعة أداء الطلاب';
        }
    } catch (e) {
        console.warn('Could not update sidebar profile:', e);
    }
}

// ============================================================
// SAFE STORAGE HELPER (to handle blocked localStorage gracefully)
// ============================================================
const safeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage is blocked, using memory fallback:', e);
            return safeStorage.mem[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage is blocked, using memory fallback:', e);
            safeStorage.mem[key] = value;
        }
    },
    mem: {}
};

// ============================================================
// STATE MANAGEMENT
// ============================================================
let classes = [];
let activeClassId = null;
let activeSubjectId = null; // Current selected subject
let subjects = []; // List of subjects: { id, name }
let periods = [
    { id: 'period-1', name: 'الفترة الأولى', isArchived: false, createdAt: Date.now() }
];
let activePeriodId = 'period-1';
let isConfiguringGlobalDefault = false;
let defaultGradingCategories = [
    { id: 'cat_assignments', name: 'الواجبات', max: 20, type: 'dots' },
    { id: 'cat_participation', name: 'المشاركة والتفاعل', max: 10, type: 'participation' },
    { id: 'cat_research', name: 'البحث والمشاريع', max: 10, type: 'dots' },
    { id: 'cat_practical', name: 'الاختبار العملي', max: 40, type: 'numeric' },
    { id: 'cat_exam', name: 'الاختبار النهائي', max: 20, type: 'numeric' }
];

// A category is treated as "assignments" (special-cased 3-state ratio scoring
// in getStudentAssignmentScore) purely by id/name, independent of its type —
// see isAssign checks in renderTable()/toggleDot(). Point-per-dot doesn't
// apply to it since its score is already a ratio of assignments given so far.
function isAssignmentsCategory(cat) {
    return !!cat && (cat.id === 'cat_assignments' || cat.key === 'assignments' || cat.name === 'الواجبات');
}

// Backfills dotsCount/pointValue on dot-based categories (dots/participation,
// excluding the assignments category) so older saved data without these
// fields keeps behaving exactly as before: dotsCount = max, pointValue = 1
// (i.e. one point per dot). Mutates in place so the fields persist on save.
function normalizeGradingCategory(cat) {
    if (!cat) return cat;
    if ((cat.type === 'dots' || cat.type === 'participation') && !isAssignmentsCategory(cat)) {
        if (!cat.dotsCount || cat.dotsCount < 1) cat.dotsCount = cat.max || 10;
        if (!cat.pointValue || cat.pointValue <= 0) cat.pointValue = 1;
    }
    // Auto-tag which Noor export bucket (40 or 60) this category belongs
    // to, but only for the recognized legacy names — a genuinely new/custom
    // category is left unset so the Noor export flow prompts the teacher
    // to choose explicitly instead of guessing.
    if (cat.noorBucket === undefined) {
        const legacyKey = legacyGradeFieldFor(cat);
        if (legacyKey === 'assignments' || legacyKey === 'activities' || legacyKey === 'research' || legacyKey === 'participation') {
            cat.noorBucket = '40';
        } else if (legacyKey === 'practical' || legacyKey === 'exam') {
            cat.noorBucket = '60';
        }
    }
    return cat;
}

// Categories only need normalizing once per array instance — this function
// is called from getStudentSubjectGrades/getStudentTotal/etc. extremely
// often (every render, every dot click), so re-scanning + re-normalizing
// every category on every single call was pure wasted work once already
// normalized. The WeakSet marks an array as done; a genuinely new/replaced
// array (e.g. saved from the setup wizard) naturally misses the cache.
const _normalizedCategoryArrays = new WeakSet();

window.ensureSubjectCategories = function(subject) {
    if (!subject) return [];
    if (subject.gradingCategories && Array.isArray(subject.gradingCategories) && subject.gradingCategories.length > 0) {
        if (!_normalizedCategoryArrays.has(subject.gradingCategories)) {
            subject.gradingCategories.forEach(normalizeGradingCategory);
            _normalizedCategoryArrays.add(subject.gradingCategories);
        }
        return subject.gradingCategories;
    }
    subject.gradingCategories = JSON.parse(JSON.stringify(defaultGradingCategories));
    subject.gradingCategories.forEach(normalizeGradingCategory);
    _normalizedCategoryArrays.add(subject.gradingCategories);
    return subject.gradingCategories;
};

window.getActiveSubjectGradingCategories = function(subjectId = activeSubjectId) {
    const subj = (subjects && Array.isArray(subjects)) ? subjects.find(s => s.id === subjectId) : null;
    if (subj) {
        return ensureSubjectCategories(subj);
    }
    const fallback = [
        { id: 'cat_assignments', name: 'الواجبات', max: 20, type: 'dots' },
        { id: 'cat_participation', name: 'المشاركة والتفاعل', max: 10, type: 'participation' },
        { id: 'cat_research', name: 'البحث والمشاريع', max: 10, type: 'dots' },
        { id: 'cat_practical', name: 'الاختبار العملي', max: 40, type: 'numeric' },
        { id: 'cat_exam', name: 'الاختبار النهائي', max: 20, type: 'numeric' }
    ];
    fallback.forEach(normalizeGradingCategory);
    return fallback;
};

window.getActiveSubjectGradingDistribution = function(subjectId = activeSubjectId) {
    const subj = (subjects && Array.isArray(subjects)) ? subjects.find(s => s.id === subjectId) : null;
    if (subj && subj.gradingDistribution) {
        return subj.gradingDistribution;
    }
    if (gradingDistribution) return gradingDistribution;
    return { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };
};
let whatsappNumber = '966578162072'; // Default number
let lastReportDate = null; // Last report sent timestamp
// Automated weekly report schedule. Read directly by server.js (from
// data.json) to decide when to run the report headlessly — dayOfWeek
// follows Date.getDay() (0 = Sunday). lastAutoSentAt guards against
// re-sending twice for the same scheduled occurrence.
let weeklyReportSchedule = { enabled: false, dayOfWeek: 4, hour: 15, minute: 0, lastAutoSentAt: null };
let portfolioSettings = {
    teacherName: '',
    jobTitle: '',
    jobNum: '',
    specialization: '',
    schoolName: '',
    schoolYear: '',
    vision: '',
    mission: '',
    philosophy: '',
    visitsRecord: '',
    strategyReport: '',
    classroomEnv: '',
    customForms: [],
    visitsImage: '',
    visitsImageName: '',
    strategyImage: '',
    strategyImageName: '',
    classroomEnvImage: '',
    classroomEnvImageName: ''
};

// Form participation state: array of elements → false | true | 'reason string'
let formParticipationState = [];

// Pending state for the reason selection modal
let pendingReason = { studentId: null, index: null, context: null }; // context: 'table' | 'form'

// ============================================================
// MOCK DATA
// ============================================================
const defaultClass = {
    id: 'class-1',
    name: 'الفصل الأول أ',
    students: [
        { id: '1', name: 'أحمد محمود العتيبي',    assignments: [true,true,true,true,true,true,true,true,true,false],  activities: [true,true,true,true,true,true,true,true,false,false], research: [true,true,true,true,true,true,true,true,true,false],  participation: [true,true,true,true,true,true,true,true,true,true],  practical: 38, exam: 19 },
        { id: '2', name: 'سارة عبد الرحمن الحربي', assignments: [true,true,true,true,true,true,true,true,true,true],   activities: [true,true,true,true,true,true,true,true,true,false],  research: [true,true,true,true,true,true,true,true,true,false],  participation: [true,true,true,true,true,true,true,true,false,false], practical: 39.5, exam: 18.5 },
        { id: '3', name: 'محمد خالد الدوسري',     assignments: [true,true,true,true,true,true,true,false,false,false], activities: [true,true,true,true,true,true,true,false,false,false], research: [true,true,true,true,true,true,true,true,false,false],  participation: [true,true,true,true,true,true,'نائم','التحدث أثناء الدرس',false,false], practical: 32, exam: 14 },
        { id: '4', name: 'فاطمة عمر القحطاني',   assignments: [true,true,true,true,true,true,true,true,true,false],  activities: [true,true,true,true,true,true,true,true,false,false], research: [true,true,true,true,true,true,true,false,false,false], participation: [true,true,true,true,true,true,true,true,true,false],  practical: 35.5, exam: 17.5 },
        { id: '5', name: 'خالد وليد المطيري',    assignments: [true,true,true,true,true,false,false,false,false,false], activities: [true,true,true,true,true,true,false,false,false,false], research: [true,true,true,true,true,false,false,false,false,false], participation: [true,true,true,true,'عدم الكتابة','نائم',false,false,false,false], practical: 22, exam: 9 }
    ]
};

// ============================================================
// DOM REFERENCES
// ============================================================
const studentsTableBody   = document.getElementById('studentsTableBody');
const emptyState          = document.getElementById('emptyState');
const totalStudentsEl     = document.getElementById('totalStudents');
const classAverageEl      = document.getElementById('classAverage');
const passRateEl          = document.getElementById('passRate');
const topStudentScoreEl   = document.getElementById('topStudentScore');
const searchInput         = document.getElementById('searchInput');
const statusFilter        = document.getElementById('statusFilter');
const studentModal        = document.getElementById('studentModal');
const modalTitle          = document.getElementById('modalTitle');
const studentForm         = document.getElementById('studentForm');
const studentIdInput      = document.getElementById('studentId');
const studentNameInput    = document.getElementById('studentName');
const gradePracticalInput = document.getElementById('gradePractical');
const gradeExamInput      = document.getElementById('gradeExam');
const addStudentBtn       = document.getElementById('addStudentBtn');
const exportCsvBtn        = document.getElementById('exportCsvBtn');
const closeModalBtn       = document.getElementById('closeModalBtn');
const cancelModalBtn      = document.getElementById('cancelModalBtn');
const notificationContainer = document.getElementById('notificationContainer');

// ============================================================
// INITIALIZATION
// ============================================================
async function initializeApp() {
    // If opened via file:/// protocol, try to detect if server is running, or show warning
    if (window.location.protocol === 'file:') {
        try {
            // Check if server is alive
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600);
            const checkRes = await fetch('http://localhost:8000/api/data', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (checkRes.ok) {
                // Server is running! Auto-redirect to local server URL
                window.location.href = 'http://localhost:8000/index.html' + window.location.search;
                return;
            }
        } catch (e) {
            console.log('Local server is not running in background.');
        }
        
        // Show warning banner
        showFileProtocolWarning();
    }

    await loadData();
    updateSidebarTeacherProfile();
    setupEventListeners();
    
    if (!gradingDistribution) {
        // First run: automatically set default distribution and save
        gradingDistribution = { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };
        saveData();
    }
    
    // Startup flow: initialize and display Classes Screen first
    buildAllCheckboxes();
    updateSidebarTeacherProfile();
    renderClassesTabs();
    renderSubjectsTabs();
    renderPeriodSelector();
    switchAppScreen('classes');
    checkWeeklyReportStatus();

    // If first-time run (no teacher name configured yet), show the friendly setup modal
    if (!portfolioSettings || !portfolioSettings.teacherName || portfolioSettings.teacherName.trim() === '') {
        setTimeout(() => {
            openTeacherSettingsModal();
        }, 400);
    }

    // Readiness signal for headless automation (the server-side weekly
    // report scheduler waits on this instead of guessing a fixed delay).
    window.appInitComplete = true;
}

window.switchAppScreen = function(screenName) {
    const classesSec = document.getElementById('classesLandingSection');
    const dashboardSec = document.getElementById('dashboardSection');
    const navClasses = document.getElementById('navClassesScreen');
    const navDash = document.getElementById('navDashboardScreen');
    const headerActions = document.getElementById('headerClassActions');

    if (screenName === 'classes') {
        if (classesSec) classesSec.style.display = 'block';
        if (dashboardSec) dashboardSec.style.display = 'none';
        if (navClasses) navClasses.classList.add('active');
        if (navDash) navDash.classList.remove('active');
        if (headerActions) headerActions.style.display = 'none';
        renderClassesLandingCards();
    } else {
        if (classesSec) classesSec.style.display = 'none';
        if (dashboardSec) dashboardSec.style.display = 'flex';
        if (navClasses) navClasses.classList.remove('active');
        if (navDash) navDash.classList.add('active');
        if (headerActions) headerActions.style.display = 'flex';
        updateDashboard();
    }
};

window.openAddClassChoiceModal = function() {
    const modal = document.getElementById('addClassChoiceModal');
    if (modal) modal.classList.add('active');
};

window.closeAddClassChoiceModal = function() {
    const modal = document.getElementById('addClassChoiceModal');
    if (modal) modal.classList.remove('active');
};

function renderClassesLandingCards() {
    const container = document.getElementById('classesGridContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!classes || classes.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; background: var(--surface-color); border: 1px dashed var(--surface-border); border-radius: 16px; padding: 3rem; text-align: center;">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">لا تملك أي فصول حالياً</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.35rem; margin-bottom: 1.5rem;">اضغط على زر "إضافة فصل جديد" للبدء بالاستيراد أو الإضافة اليدوية.</p>
                <button class="btn" onclick="openAddClassChoiceModal()" style="display: inline-flex; margin: 0 auto;">
                    <i class="fa-solid fa-plus"></i> إضافة فصل جديد
                </button>
            </div>
        `;
        return;
    }

    classes.forEach(cls => {
        const studentCount = cls.students ? cls.students.length : 0;
        const isCurrent = (cls.id === activeClassId);

        // Calculate Class Average & Level
        let classAvgPct = 0;
        let levelBadgeHtml = '<span style="color: var(--text-muted); font-size: 0.82rem;">لا توجد درجات حتى الآن</span>';
        if (studentCount > 0) {
            let totalScores = 0;
            cls.students.forEach(s => {
                totalScores += getStudentTotal(s, activeSubjectId, cls);
            });
            classAvgPct = Math.round(totalScores / studentCount);

            let levelText = 'متعثر';
            let levelColor = '#ef4444';
            let levelBg = 'rgba(239, 68, 68, 0.12)';
            if (classAvgPct >= 90) {
                levelText = 'متميز (ممتاز)';
                levelColor = '#10b981';
                levelBg = 'rgba(16, 185, 129, 0.12)';
            } else if (classAvgPct >= 50) {
                levelText = 'ناجح (جيد)';
                levelColor = '#f59e0b';
                levelBg = 'rgba(245, 158, 11, 0.12)';
            }
            levelBadgeHtml = `<span style="background: ${levelBg}; color: ${levelColor}; border: 1px solid ${levelColor}35; font-size: 0.8rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.35rem;"><i class="fa-solid fa-chart-line"></i> المستوى العام: ${levelText} (${classAvgPct}%)</span>`;
        }

        const card = document.createElement('div');
        card.className = 'content-card';
        card.style.cssText = `
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 1.25rem;
            border: 1px solid ${isCurrent ? 'var(--accent-teal)' : 'var(--surface-border)'};
            box-shadow: ${isCurrent ? '0 8px 24px rgba(20, 184, 166, 0.15)' : 'var(--card-shadow)'};
            transition: transform 0.2s, border-color 0.2s;
            cursor: pointer;
        `;

window.openClassDashboard = function(classId) {
    activeClassId = classId;
    try { saveData(); } catch (e) {}
    try { renderClassesTabs(); } catch (e) {}
    switchAppScreen('dashboard');
};

        card.onclick = (e) => {
            if (e.target.closest('.card-action-btn')) return;
            openClassDashboard(cls.id);
        };

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-graduation-cap" style="color: var(--primary-color);"></i>
                        ${cls.name}
                    </h3>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.88rem;">
                        <i class="fa-solid fa-users" style="color: var(--text-muted);"></i>
                        <span>إجمالي الطلاب: <strong style="color: var(--text-main); font-weight: 700;">${studentCount} طالب</strong></span>
                    </div>
                    <div style="margin-top: 0.25rem;">
                        ${levelBadgeHtml}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; align-items: center; border-top: 1px solid var(--surface-border); padding-top: 0.85rem; margin-top: 0.5rem;">
                <div style="display: flex; gap: 0.4rem;">
                    <button class="btn btn-sm btn-secondary card-action-btn" onclick="openNewPeriodModal()" title="بدء فترة تقييم جديدة" style="position: relative; padding: 0; color: #f59e0b; border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.1); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 32px;">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size: 0.95rem;"></i>
                        <span style="position: absolute; top: -4px; right: -4px; background: #f59e0b; color: #0f172a; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 900; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">+</span>
                    </button>
                    <button class="btn btn-sm btn-secondary card-action-btn" onclick="renameClass('${cls.id}')" title="تعديل اسم الفصل" style="padding: 0.45rem 0.75rem;">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-danger card-action-btn" onclick="deleteClass('${cls.id}')" title="حذف الفصل" style="padding: 0.45rem 0.75rem;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function showFileProtocolWarning() {
    const banner = document.createElement('div');
    banner.style.cssText = `
        background: #7f1d1d;
        color: #fca5a5;
        padding: 15px;
        text-align: center;
        font-weight: bold;
        font-size: 0.95rem;
        border-bottom: 2px solid #b91c1c;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        z-index: 9999;
        position: relative;
        font-family: 'Tajawal', sans-serif;
    `;
    banner.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.25rem; color: #f87171;"></i>
        <span><strong>تنبيه هام جداً:</strong> لتجنب فقدان البيانات وعدم حفظ الدرجات، يرجى دائماً فتح البرنامج وتشغيله من ملف <strong>(تشغيل-البرنامج.bat)</strong> الموجود في مجلد المشروع، ولا تفتح ملف المتصفح مباشرة.</span>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
}

// ============================================================
// DATA MANAGEMENT (CLASSES)
// ============================================================
function getApiUrl(endpoint) {
    if (window.location.protocol.startsWith('http')) {
        return endpoint;
    } else {
        return 'http://localhost:8000' + endpoint;
    }
}

async function loadData() {
    let stored = null;
    
    try {
        const res = await fetch(getApiUrl('/api/data'));
        const json = await res.json();
        if (json && Object.keys(json).length > 0) {
            stored = JSON.stringify(json);
        }
    } catch (e) {
        console.error('Failed to load from local server:', e);
    }
    
    // Fallback to localStorage if server has no data or we are offline/file protocol fails
    const localStored = safeStorage.getItem('student_tracker_classes_v2');
    if (!stored && localStored) {
        stored = localStored;
        
        // Migrate local data to server
        try {
            await fetch(getApiUrl('/api/data'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: localStored
            });
            console.log('Successfully migrated localStorage data to the server.');
        } catch (e) {
            console.error('Failed to migrate data to server:', e);
        }
    }
    
    if (stored) {
        const parsed = JSON.parse(stored);
        classes      = parsed.classes || [];
        activeClassId = parsed.activeClassId || null;
        whatsappNumber = parsed.whatsappNumber || '966578162072';
        lastReportDate = parsed.lastReportDate || null;
        weeklyReportSchedule = parsed.weeklyReportSchedule || { enabled: false, dayOfWeek: 4, hour: 15, minute: 0, lastAutoSentAt: null };
        gradingDistribution = parsed.gradingDistribution || null;
        subjects = parsed.subjects || [];
        activeSubjectId = parsed.activeSubjectId || null;
        periods = parsed.periods || [ { id: 'period-1', name: 'الفترة الأولى', isArchived: false, createdAt: Date.now() } ];
        activePeriodId = parsed.activePeriodId || 'period-1';
        portfolioSettings = parsed.portfolioSettings || {
            teacherName: '',
            jobTitle: '',
            jobNum: '',
            specialization: '',
            schoolName: '',
            schoolYear: '',
            vision: '',
            mission: '',
            philosophy: '',
            visitsRecord: '',
            strategyReport: '',
            classroomEnv: ''
        };
    } else {
        classes = [];
        activeClassId = null;
        whatsappNumber = '966578162072';
        lastReportDate = null;
        weeklyReportSchedule = { enabled: false, dayOfWeek: 4, hour: 15, minute: 0, lastAutoSentAt: null };
        gradingDistribution = null;
        subjects = [];
        activeSubjectId = null;
        portfolioSettings = {
            teacherName: '',
            jobTitle: '',
            jobNum: '',
            specialization: '',
            schoolName: '',
            schoolYear: '',
            vision: '',
            mission: '',
            philosophy: '',
            visitsRecord: '',
            strategyReport: '',
            classroomEnv: ''
        };
    }
    portfolioSettings.customForms = portfolioSettings.customForms || [];
    
    // If gradingDistribution is set but subjects is empty, initialize default subject
    if (gradingDistribution && subjects.length === 0) {
        subjects = [{ id: 'subject-1', name: 'رقمية 2' }];
        activeSubjectId = 'subject-1';
        
        if (classes.length === 0) {
            classes = [{
                id: 'class-1',
                name: 'الفصل الأول أ',
                students: defaultClass.students.map(s => ({
                    id: s.id,
                    name: s.name,
                    grades: {
                        'subject-1': {
                            assignments: [...s.assignments],
                            activities: [...s.activities],
                            research: [...s.research],
                            participation: [...s.participation],
                            practical: s.practical,
                            exam: s.exam
                        }
                    }
                }))
            }];
            activeClassId = 'class-1';
        }
        await saveData();
    }
    
    if (classes.length > 0 && (!activeClassId || !classes.find(c => c.id === activeClassId))) {
        activeClassId = classes[0].id;
    }
    if (subjects.length > 0 && (!activeSubjectId || !subjects.find(s => s.id === activeSubjectId))) {
        activeSubjectId = subjects[0].id;
    }

    // Auto-sanitize any corrupted question mark strings in subjects & periods
    if (subjects && subjects.length > 0) {
        subjects.forEach(s => {
            if (!s.name || s.name.includes('?')) s.name = 'رقمية 2';
        });
    }
    if (periods && periods.length > 0) {
        periods.forEach(p => {
            if (!p.name || p.name.includes('?')) p.name = 'الفترة الأولى';
        });
    }
    
    migrateStudentsData();
}

function migrateStudentsData() {
    let migrated = false;
    const defaultSubjId = activeSubjectId || 'subject-1';
    
    classes.forEach(cls => {
        cls.students.forEach(student => {
            if (!student.grades) {
                student.grades = {};
                student.grades[defaultSubjId] = {
                    assignments: Array.isArray(student.assignments) ? student.assignments : [],
                    activities: Array.isArray(student.activities) ? student.activities : [],
                    research: Array.isArray(student.research) ? student.research : [],
                    participation: Array.isArray(student.participation) ? student.participation : [],
                    practical: typeof student.practical === 'number' ? student.practical : 0,
                    exam: typeof student.exam === 'number' ? student.exam : 0
                };
                
                delete student.assignments;
                delete student.activities;
                delete student.research;
                delete student.participation;
                delete student.practical;
                delete student.exam;
                migrated = true;
            }
        });
    });
    
    if (migrated) {
        saveData();
    }
}

let __pendingServerSave = null;
let __serverSaveTimer = null;

function __flushServerSave() {
    clearTimeout(__serverSaveTimer);
    __serverSaveTimer = null;
    if (!__pendingServerSave) return;
    const dataObj = __pendingServerSave;
    __pendingServerSave = null;
    fetch(getApiUrl('/api/data'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataObj)
    }).catch(e => console.error('Failed to save to local server:', e));
}

// Flush any pending server save before the page is closed/hidden so rapid
// edits (e.g. clicking grade dots) aren't lost while the debounce is pending.
window.addEventListener('beforeunload', __flushServerSave);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') __flushServerSave();
});

async function saveData() {
    // Sort students alphabetically by name in Arabic
    classes.forEach(cls => {
        if (Array.isArray(cls.students)) {
            cls.students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        }
    });

    const dataObj = {
        classes,
        activeClassId,
        whatsappNumber,
        lastReportDate,
        weeklyReportSchedule,
        gradingDistribution,
        subjects,
        activeSubjectId,
        portfolioSettings,
        periods,
        activePeriodId
    };

    // Save to localStorage fallback (fast, synchronous, no network round-trip)
    safeStorage.setItem('student_tracker_classes_v2', JSON.stringify(dataObj));

    // Save to local server if running. Debounced so rapid successive edits
    // (e.g. clicking several grade dots in a row) coalesce into one request
    // instead of firing a full network round-trip per click.
    __pendingServerSave = dataObj;
    clearTimeout(__serverSaveTimer);
    __serverSaveTimer = setTimeout(__flushServerSave, 600);
}

function getActiveClass()    { return classes.find(c => c.id === activeClassId); }
function getActiveStudents() { return getActiveClass()?.students || []; }

