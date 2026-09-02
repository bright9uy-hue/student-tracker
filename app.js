
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
    return cat;
}

window.ensureSubjectCategories = function(subject) {
    if (!subject) return [];
    if (subject.gradingCategories && Array.isArray(subject.gradingCategories) && subject.gradingCategories.length > 0) {
        subject.gradingCategories.forEach(normalizeGradingCategory);
        return subject.gradingCategories;
    }
    subject.gradingCategories = JSON.parse(JSON.stringify(defaultGradingCategories));
    subject.gradingCategories.forEach(normalizeGradingCategory);
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
// BUILD FORM CHECKBOXES DYNAMICALLY
// ============================================================
function buildCheckboxes(containerId, sumId, prefix, maxVal) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (maxVal === 0) {
        container.innerHTML = '<span style="font-size:0.85rem;color:var(--text-muted);font-style:italic;">لا توجد درجات مخصصة في هذا البند</span>';
        return;
    }
    for (let i = 1; i <= maxVal; i++) {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `
            <input type="checkbox" id="${prefix}_${i}" value="${i}" onchange="updateCheckboxSum('${containerId}','${sumId}')">
            <label for="${prefix}_${i}">${i}</label>
        `;
        container.appendChild(div);
    }
}

function buildParticipationDots(maxVal) {
    const container = document.getElementById('participationCheckboxes');
    if (!container) return;
    container.innerHTML = '';
    if (maxVal === 0) {
        container.innerHTML = '<span style="font-size:0.85rem;color:var(--text-muted);font-style:italic;">لا توجد درجات مخصصة في هذا البند</span>';
        return;
    }
    for (let i = 0; i < maxVal; i++) {
        const dot = document.createElement('span');
        dot.className = 'participation-form-dot';
        dot.id = `pform_${i}`;
        dot.textContent = i + 1;
        dot.title = `النقطة ${i + 1}`;
        dot.onclick = () => toggleFormParticipation(i);
        container.appendChild(dot);
    }
}

function buildAllCheckboxes() {
    const dist = getActiveSubjectGradingDistribution();
    buildCheckboxes('assignmentsCheckboxes', 'assignmentsSum', 'assign', dist.assignments);
    buildCheckboxes('activitiesCheckboxes',  'activitiesSum',  'activity', dist.activities);
    buildCheckboxes('researchCheckboxes',    'researchSum',    'research', dist.research);
    buildParticipationDots(dist.participation);
    
    // Update max info text in modal
    const assignInfo = document.getElementById('assignmentsSum')?.parentElement;
    if (assignInfo) assignInfo.innerHTML = `المجموع: <span id="assignmentsSum" style="font-weight:bold;color:var(--accent-teal);">0</span> / ${dist.assignments}`;
    formParticipationState = Array(dist.participation || 10).fill(false);
}

window.moveCategoryRowUp = function(btnEl) {
    const row = btnEl.closest('.category-row-item');
    if (row && row.previousElementSibling) {
        row.parentNode.insertBefore(row, row.previousElementSibling);
    }
};

window.moveCategoryRowDown = function(btnEl) {
    const row = btnEl.closest('.category-row-item');
    if (row && row.nextElementSibling) {
        row.parentNode.insertBefore(row.nextElementSibling, row);
    }
};

window.addCustomCategoryRow = function(catName = '', catMax = 10, catType = 'dots', catId = '', catDotsCount = null, catPointValue = null) {
    const list = document.getElementById('customCategoriesList');
    if (!list) return;
    // The assignments category has its own ratio-based scoring (see
    // isAssignmentsCategory) and doesn't support a configurable point value.
    const isAssignmentsRow = (catId === 'cat_assignments' || catName === 'الواجبات');
    const showDotsFields = catType !== 'numeric' && !isAssignmentsRow;
    const dotsCount = catDotsCount || catMax || 10;
    const pointValue = catPointValue || 1;

    const row = document.createElement('div');
    row.className = 'category-row-item';
    if (catId) row.dataset.catId = catId;
    row.style.cssText = 'display:flex;gap:0.4rem;align-items:center;margin-bottom:0.5rem;background:rgba(255,255,255,0.03);padding:0.6rem;border-radius:8px;border:1px solid var(--surface-border);flex-wrap:wrap;';
    row.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:2px;">
            <button type="button" class="btn-icon" onclick="moveCategoryRowUp(this)" title="تقديم البند للأعلى" style="padding:1px 5px;font-size:0.75rem;color:var(--accent-teal);"><i class="fa-solid fa-chevron-up"></i></button>
            <button type="button" class="btn-icon" onclick="moveCategoryRowDown(this)" title="تأخير البند للأسفل" style="padding:1px 5px;font-size:0.75rem;color:var(--accent-teal);"><i class="fa-solid fa-chevron-down"></i></button>
        </div>
        <input type="text" class="form-control cat-name-input" placeholder="اسم البند (مثال: واجبات)" value="${catName}" required style="flex:2.2;font-weight:600;">
        <input type="number" class="form-control cat-max-input" placeholder="الدرجة" value="${catMax}" min="1" max="100" required
            style="flex:1;font-weight:700;color:var(--accent-teal);display:${showDotsFields ? 'none' : 'block'};" ${showDotsFields ? 'readonly' : ''} oninput="calculateSetupTotal()">
        <input type="number" class="form-control cat-dots-input" placeholder="عدد النقاط" value="${dotsCount}" min="1" max="100" title="عدد النقاط"
            style="flex:0.85;display:${showDotsFields ? 'block' : 'none'};" oninput="syncCategoryRowMax(this)">
        <input type="number" class="form-control cat-point-value-input" placeholder="قيمة النقطة" value="${pointValue}" min="0.1" step="0.1" title="قيمة النقطة الواحدة بالدرجة"
            style="flex:0.85;color:var(--accent-teal);display:${showDotsFields ? 'block' : 'none'};" oninput="syncCategoryRowMax(this)">
        <span class="cat-computed-max" style="flex:0.9;font-size:0.78rem;color:var(--text-muted);display:${showDotsFields ? 'block' : 'none'};">= ${Math.round(dotsCount * pointValue * 100) / 100} درجة</span>
        <select class="form-control cat-type-select" onchange="onCategoryTypeChange(this)" style="flex:1.6;font-size:0.85rem;" ${isAssignmentsRow ? 'disabled' : ''}>
            <option value="dots" ${catType === 'dots' ? 'selected' : ''}>نقاط سريعة</option>
            <option value="participation" ${catType === 'participation' ? 'selected' : ''}>مشاركة ملونة (إيجابي/خصم)</option>
            <option value="numeric" ${catType === 'numeric' ? 'selected' : ''}>درجة رقمية (عملي/اختبار)</option>
        </select>
        <button type="button" class="btn-icon delete" onclick="removeCustomCategoryRow(this)" title="حذف البند" style="color:#ef4444;padding:0.4rem;"><i class="fa-solid fa-trash"></i></button>
    `;
    list.appendChild(row);
    calculateSetupTotal();
};

// Recomputes a dots/participation row's total score (dotsCount × pointValue)
// into its hidden cat-max-input, so calculateSetupTotal()'s 100-point check
// keeps working unchanged, and refreshes the "= X درجة" label.
window.syncCategoryRowMax = function(inputEl) {
    const row = inputEl.closest('.category-row-item');
    if (!row) return;
    const dotsInput = row.querySelector('.cat-dots-input');
    const pointInput = row.querySelector('.cat-point-value-input');
    const maxInput = row.querySelector('.cat-max-input');
    const computedEl = row.querySelector('.cat-computed-max');
    const dots = parseInt(dotsInput.value) || 0;
    const point = parseFloat(pointInput.value) || 0;
    const computedMax = Math.round(dots * point * 100) / 100;
    if (maxInput) maxInput.value = computedMax;
    if (computedEl) computedEl.textContent = `= ${computedMax} درجة`;
    calculateSetupTotal();
};

// Toggles a row between the numeric single "الدرجة" input and the
// dots/participation "عدد النقاط" + "قيمة النقطة" pair when its type changes.
window.onCategoryTypeChange = function(selectEl) {
    const row = selectEl.closest('.category-row-item');
    if (!row) return;
    const isNumeric = selectEl.value === 'numeric';
    const maxInput = row.querySelector('.cat-max-input');
    const dotsInput = row.querySelector('.cat-dots-input');
    const pointInput = row.querySelector('.cat-point-value-input');
    const computedEl = row.querySelector('.cat-computed-max');
    if (maxInput) {
        maxInput.style.display = isNumeric ? 'block' : 'none';
        maxInput.readOnly = !isNumeric;
    }
    if (dotsInput) dotsInput.style.display = isNumeric ? 'none' : 'block';
    if (pointInput) pointInput.style.display = isNumeric ? 'none' : 'block';
    if (computedEl) computedEl.style.display = isNumeric ? 'none' : 'block';
    if (!isNumeric) syncCategoryRowMax(dotsInput);
    else calculateSetupTotal();
};

window.removeCustomCategoryRow = function(btnEl) {
    const row = btnEl.closest('.category-row-item');
    if (row) {
        row.remove();
        calculateSetupTotal();
    }
};

window.calculateSetupTotal = function() {
    const inputs = document.querySelectorAll('.cat-max-input');
    let sum = 0;
    inputs.forEach(inp => {
        sum += parseFloat(inp.value) || 0;
    });
    sum = Math.round(sum * 100) / 100;

    const sumEl = document.getElementById('setupTotalSum');
    if (sumEl) sumEl.textContent = sum;

    const saveBtn = document.getElementById('saveGradingSetupBtn');
    const msgEl  = document.getElementById('setupTotalMsg');
    const alertEl = document.getElementById('setupTotalAlert');

    if (sum > 100) {
        if (msgEl) {
            msgEl.textContent = `⚠️ الإجمالي (${sum} درجة) يتجاوز الحد الأقصى المسموح به (100 درجة). الرجاء تعديل التوزيع.`;
            msgEl.style.color = '#ef4444';
        }
        if (alertEl) {
            alertEl.style.background = 'rgba(239, 68, 68, 0.12)';
            alertEl.style.borderColor = '#ef4444';
        }
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
        }
    } else if (sum < 100) {
        if (msgEl) {
            msgEl.textContent = `⚠️ الإجمالي الحالي (${sum}/100). الرجاء استكمال التوزيع ليصل إلى 100 درجة تماماً.`;
            msgEl.style.color = '#f59e0b';
        }
        if (alertEl) {
            alertEl.style.background = 'rgba(245, 158, 11, 0.12)';
            alertEl.style.borderColor = '#f59e0b';
        }
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
        }
    } else {
        if (msgEl) {
            msgEl.textContent = `✅ المجموع مكتمل ومطابق لـ 100 درجة تماماً.`;
            msgEl.style.color = '#10b981';
        }
        if (alertEl) {
            alertEl.style.background = 'rgba(16, 185, 129, 0.12)';
            alertEl.style.borderColor = '#10b981';
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
        }
    }
};

window.updateCheckboxSum = function(containerId, sumId) {
    const container = document.getElementById(containerId);
    document.getElementById(sumId).textContent =
        container.querySelectorAll('input[type="checkbox"]:checked').length;
};

// ============================================================
// FORM PARTICIPATION (3-STATE)
// ============================================================
function syncFormParticipationUI() {
    for (let i = 0; i < 10; i++) {
        const dot = document.getElementById(`pform_${i}`);
        if (!dot) continue;
        const val = formParticipationState[i];
        dot.className = 'participation-form-dot';
        if (val === true) {
            dot.classList.add('positive');
            dot.title = `النقطة ${i+1}: إيجابية (+1)`;
        } else if (typeof val === 'string' && val) {
            dot.classList.add('deduction');
            dot.title = `النقطة ${i+1}: خصم — ${val}`;
        } else {
            dot.title = `النقطة ${i+1}: غير محددة`;
        }
    }
    document.getElementById('participationSum').textContent = getParticipationScore(formParticipationState);
}

window.toggleFormParticipation = function(index) {
    const val = formParticipationState[index];
    if (!val || val === false) {
        formParticipationState[index] = true;
        syncFormParticipationUI();
    } else if (val === true) {
        // Positive → open reason modal
        pendingReason = { studentId: null, index, context: 'form' };
        openReasonModal();
    } else {
        // Deduction → clear
        formParticipationState[index] = false;
        syncFormParticipationUI();
    }
};

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

// ============================================================
// CLASSES TABS UI
// ============================================================
function renderClassesTabs() {
    const nav = document.getElementById('classesNav');
    if (!nav) return;
    nav.innerHTML = '';
    classes.forEach(cls => {
        const tab = document.createElement('div');
        tab.className = 'class-tab' + (cls.id === activeClassId ? ' active' : '');
        tab.title = 'انقر مرتين لتغيير الاسم';
        tab.ondblclick = () => renameClass(cls.id);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = cls.name;
        nameSpan.onclick = () => switchClass(cls.id);
        tab.appendChild(nameSpan);

        if (classes.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-class-btn';
            delBtn.title = 'حذف الفصل';
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.onclick = (e) => { e.stopPropagation(); deleteClass(cls.id); };
            tab.appendChild(delBtn);
        }

        nav.appendChild(tab);
    });
}

window.switchClass = function(classId) {
    activeClassId = classId;
    saveData();
    renderClassesTabs();
    updateDashboard();

    const activeCls = getActiveClass();
    const titleEl = document.getElementById('currentClassNameDisplay');
    if (titleEl && activeCls) {
        titleEl.innerHTML = `<i class="fa-solid fa-graduation-cap" style="color: var(--accent-teal);"></i> الفصل: <span style="color: var(--accent-teal); font-weight: 800;">${activeCls.name}</span>`;
    }
};

window.deleteClass = function(classId) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    if (!confirm(`هل أنت متأكد من حذف فصل "${cls.name}" وجميع بياناته؟`)) return;

    classes = classes.filter(c => c.id !== classId);

    if (classes.length === 0) {
        activeClassId = null;
        showNotification(`تم حذف فصل "${cls.name}" بالكامل.`, 'warning');
    } else {
        if (activeClassId === classId) activeClassId = classes[0].id;
        showNotification(`تم حذف فصل "${cls.name}".`, 'warning');
    }

    saveData();
    renderClassesLandingCards();
    renderClassesTabs();
    updateDashboard();
};

window.renameClass = function(classId) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    const name = prompt('أدخل الاسم الجديد للفصل:', cls.name);
    if (name && name.trim()) {
        cls.name = name.trim();
        saveData();
        renderClassesLandingCards();
        renderClassesTabs();
        showNotification('تم تعديل اسم الفصل.');
    }
};

// ============================================================
// SUBJECTS TABS UI
// ============================================================
function renderSubjectsTabs() {
    const nav = document.getElementById('subjectsNav');
    if (!nav) return;
    nav.innerHTML = '';

    subjects.forEach(subj => {
        const isActive = (subj.id === activeSubjectId);
        const tab = document.createElement('div');
        tab.className = 'class-tab subject-tab' + (isActive ? ' active' : '');
        tab.title = 'انقر مرتين لتغيير اسم المادة';
        tab.ondblclick = () => renameSubject(subj.id);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = subj.name;
        nameSpan.onclick = () => switchSubject(subj.id);
        tab.appendChild(nameSpan);

        if (isActive) {
            const setupBtn = document.createElement('button');
            setupBtn.className = 'delete-class-btn';
            setupBtn.title = 'توزيع درجات هذه المادة';
            setupBtn.style.color = 'var(--warning-color)';
            setupBtn.style.marginRight = '0.35rem';
            setupBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
            setupBtn.onclick = (e) => { e.stopPropagation(); openSubjectGradingSetupModal(subj.id); };
            tab.appendChild(setupBtn);
        }

        if (subjects.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-class-btn';
            delBtn.title = 'حذف المادة';
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.onclick = (e) => { e.stopPropagation(); deleteSubject(subj.id); };
            tab.appendChild(delBtn);
        }

        nav.appendChild(tab);
    });

    // Append clean '+' Add Subject button at the end of subjectsNav
    const addSubjBtn = document.createElement('button');
    addSubjBtn.className = 'class-tab subject-tab';
    addSubjBtn.style.cssText = 'background: rgba(20, 184, 166, 0.15); border-color: rgba(20, 184, 166, 0.35); color: var(--accent-teal); font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.45rem 0.85rem;';
    addSubjBtn.title = 'إضافة مادة جديدة';
    addSubjBtn.innerHTML = '<i class="fa-solid fa-plus"></i> مادة جديدة';
    addSubjBtn.onclick = () => openSubjectModal();
    nav.appendChild(addSubjBtn);
}

window.openSubjectGradingSetupModal = function(subjectId) {
    isConfiguringGlobalDefault = false;
    const subj = subjects.find(s => s.id === subjectId) || subjects.find(s => s.id === activeSubjectId) || subjects[0];
    if (subj) activeSubjectId = subj.id;
    const categories = getActiveSubjectGradingCategories(activeSubjectId);

    const list = document.getElementById('customCategoriesList');
    if (list) {
        list.innerHTML = '';
        categories.forEach(cat => {
            addCustomCategoryRow(cat.name, cat.max, cat.type, cat.id, cat.dotsCount, cat.pointValue);
        });
    }

    const modalTitle = document.querySelector('#gradingSetupModal h3');
    if (modalTitle && subj) {
        modalTitle.innerHTML = `<i class="fa-solid fa-sliders" style="color: var(--warning-color);"></i> بنود درجات مادة: <span style="color: var(--accent-teal);">${subj.name}</span>`;
    }
    const modalDesc = document.querySelector('#gradingSetupModal p');
    if (modalDesc) {
        modalDesc.textContent = 'يمكنك إضافة وتسمية وحذف بنود التقييم المخصصة لهذه المادة، وتحديد درجة كل بند وطريقة رصده. مجموع الدرجات يجب أن يعادل (100 درجة).';
    }

    const modal = document.getElementById('gradingSetupModal');
    if (modal) modal.classList.add('active');
    calculateSetupTotal();
};

window.openGlobalGradingSetupModal = function() {
    isConfiguringGlobalDefault = true;
    const list = document.getElementById('customCategoriesList');
    if (list) {
        list.innerHTML = '';
        defaultGradingCategories.forEach(cat => {
            addCustomCategoryRow(cat.name, cat.max, cat.type, cat.id, cat.dotsCount, cat.pointValue);
        });
    }

    const modalTitle = document.querySelector('#gradingSetupModal h3');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fa-solid fa-sliders" style="color: var(--warning-color);"></i> القالب الافتراضي لتوزيع درجات المواد الجديدة`;
    }
    const modalDesc = document.querySelector('#gradingSetupModal p');
    if (modalDesc) {
        modalDesc.textContent = 'حدد بنود التقييم والدرجات الافتراضية التي سيتم تطبيقها تلقائياً عند إضافة أي مادة جديدة مستقبلاً (المجموع 100 درجة).';
    }

    const modal = document.getElementById('gradingSetupModal');
    if (modal) modal.classList.add('active');
    calculateSetupTotal();
};

function handleGradingSetupFormSubmit(e) {
    e.preventDefault();
    
    const rows = document.querySelectorAll('.category-row-item');
    const newCategories = [];
    let totalSum = 0;

    rows.forEach((row, idx) => {
        const nameInput = row.querySelector('.cat-name-input');
        const maxInput = row.querySelector('.cat-max-input');
        const typeSelect = row.querySelector('.cat-type-select');
        const dotsInput = row.querySelector('.cat-dots-input');
        const pointInput = row.querySelector('.cat-point-value-input');

        const name = nameInput ? nameInput.value.trim() : `البند ${idx + 1}`;
        const type = typeSelect ? typeSelect.value : 'dots';
        const isAssignmentsRow = (row.dataset.catId === 'cat_assignments' || name === 'الواجبات');
        const usesDots = type !== 'numeric' && !isAssignmentsRow;

        let max, dotsCount, pointValue;
        if (usesDots) {
            dotsCount = dotsInput ? (parseInt(dotsInput.value) || 0) : 0;
            pointValue = pointInput ? (parseFloat(pointInput.value) || 0) : 1;
            max = Math.round(dotsCount * pointValue * 100) / 100;
        } else {
            max = maxInput ? (parseFloat(maxInput.value) || 0) : 0;
        }

        if (max > 0) {
            totalSum += max;
            const existingId = row.dataset.catId;
            const catObj = {
                id: existingId || `cat_${Date.now()}_${idx}`,
                name: name || `البند ${idx + 1}`,
                max,
                type
            };
            if (usesDots) {
                catObj.dotsCount = dotsCount > 0 ? dotsCount : 10;
                catObj.pointValue = pointValue > 0 ? pointValue : 1;
            }
            newCategories.push(catObj);
        }
    });

    if (newCategories.length === 0) {
        showNotification('يجب إضافة بند تقييم واحد على الأقل!', 'error');
        return;
    }

    totalSum = Math.round(totalSum * 100) / 100;
    if (Math.abs(totalSum - 100) > 0.01) {
        showNotification(`مجموع الدرجات الموزعة هو (${totalSum}) ويجب أن يكون 100 exact!`, 'error');
        return;
    }

    if (isConfiguringGlobalDefault) {
        defaultGradingCategories = newCategories;
        saveData();
        document.getElementById('gradingSetupModal').classList.remove('active');
        showNotification('تم حفظ التوزيع والبنود الافتراضية للمواد الجديدة بنجاح.', 'success');
        return;
    }

    // If no subjects exist yet, initialize default subject
    if (!subjects || subjects.length === 0) {
        subjects = [{ id: 'subject-1', name: 'رقمية 2' }];
        activeSubjectId = 'subject-1';
    }

    const activeSubj = subjects.find(s => s.id === activeSubjectId) || subjects[0];
    if (activeSubj) {
        activeSubj.gradingCategories = newCategories;
    }

    saveData();

    // Hide Setup Wizard Modal
    document.getElementById('gradingSetupModal').classList.remove('active');
    
    filterAndRenderTable();
    updateDashboard();

    showNotification(`تم حفظ بنود ودرجات مادة "${activeSubj ? activeSubj.name : ''}" وتطبيقها فوراً.`, 'success');
}

window.renderSubjectsDropdown = function() {
    const filter = document.getElementById('subjectFilter');
    if (!filter) return;
    filter.innerHTML = '';

    subjects.forEach(subj => {
        const option = document.createElement('option');
        option.value = subj.id;
        option.textContent = subj.name;
        if (subj.id === activeSubjectId) option.selected = true;
        filter.appendChild(option);
    });
};

window.switchSubject = function(subjectId) {
    activeSubjectId = subjectId;
    saveData();
    renderSubjectsDropdown();
    renderSubjectsTabs();
    filterAndRenderTable();
    updateDashboard();
};

window.deleteSubject = function(subjectId) {
    if (subjects.length === 1) {
        showNotification('لا يمكن حذف المادة الوحيدة!', 'error');
        return;
    }
    const subj = subjects.find(s => s.id === subjectId);
    if (!subj) return;
    if (!confirm(`هل أنت متأكد من حذف مادة "${subj.name}"؟ سيتم حذف جميع درجات هذه المادة فقط لكافة الطلاب في جميع الفصول!`)) return;
    
    classes.forEach(cls => {
        cls.students.forEach(student => {
            if (student.grades && student.grades[subjectId]) {
                delete student.grades[subjectId];
            }
        });
    });
    
    subjects = subjects.filter(s => s.id !== subjectId);
    if (activeSubjectId === subjectId) activeSubjectId = subjects[0].id;
    saveData();
    renderSubjectsTabs();
    updateDashboard();
    showNotification(`تم حذف مادة "${subj.name}".`, 'warning');
};

window.renameSubject = function(subjectId) {
    const subj = subjects.find(s => s.id === subjectId);
    if (!subj) return;
    const name = prompt('أدخل الاسم الجديد للمادة:', subj.name);
    if (name && name.trim()) {
        subj.name = name.trim();
        saveData();
        renderSubjectsTabs();
        showNotification('تم تعديل اسم المادة.');
    }
};

const subjectModal = document.getElementById('subjectModal');
const subjectForm = document.getElementById('subjectForm');
const newSubjectNameInput = document.getElementById('newSubjectName');
const closeSubjectModalBtn = document.getElementById('closeSubjectModalBtn');
const cancelSubjectModalBtn = document.getElementById('cancelSubjectModalBtn');

function openSubjectModal() {
    if (subjectForm) subjectForm.reset();
    if (subjectModal) subjectModal.classList.add('active');
    if (newSubjectNameInput) setTimeout(() => newSubjectNameInput.focus(), 100);
}

function closeSubjectModal() {
    if (subjectModal) subjectModal.classList.remove('active');
}

window.setSubjectNameSuggestion = function(name) {
    if (newSubjectNameInput) {
        newSubjectNameInput.value = name;
        newSubjectNameInput.focus();
    }
};

const classModal = document.getElementById('classModal');
const classForm = document.getElementById('classForm');
const newClassNameInput = document.getElementById('newClassName');
const closeClassModalBtn = document.getElementById('closeClassModalBtn');
const cancelClassModalBtn = document.getElementById('cancelClassModalBtn');

window.populateClassSubjectSelect = function() {
    const select = document.getElementById('classSubjectSelect');
    if (!select) return;
    select.innerHTML = '';
    
    subjects.forEach(subj => {
        const option = document.createElement('option');
        option.value = subj.id;
        option.textContent = subj.name;
        if (subj.id === activeSubjectId) option.selected = true;
        select.appendChild(option);
    });

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '➕ إضافة مادة جديدة...';
    select.appendChild(newOpt);

    handleClassSubjectSelectChange(select.value);
};

window.handleClassSubjectSelectChange = function(val) {
    const group = document.getElementById('newSubjectInputGroup');
    const input = document.getElementById('newSubjectNameInput');
    if (group) group.style.display = (val === '__new__') ? 'block' : 'none';
    if (val === '__new__' && input) setTimeout(() => input.focus(), 100);
};

window.openClassModal = function() {
    if (classForm) classForm.reset();
    populateClassSubjectSelect();
    if (classModal) classModal.classList.add('active');
    if (newClassNameInput) setTimeout(() => newClassNameInput.focus(), 100);
};
window.openAddClassChoiceModal = window.openClassModal;

function closeClassModal() {
    if (classModal) classModal.classList.remove('active');
}

window.setClassNameSuggestion = function(name) {
    if (newClassNameInput) {
        newClassNameInput.value = name;
        newClassNameInput.focus();
    }
};

function handleClassFormSubmit(e) {
    e.preventDefault();
    const name = newClassNameInput ? newClassNameInput.value.trim() : '';
    if (!name) return;

    const select = document.getElementById('classSubjectSelect');
    let selectedSubjId = select ? select.value : activeSubjectId;

    if (selectedSubjId === '__new__') {
        const newSubjNameInput = document.getElementById('newSubjectNameInput');
        const newSubjName = newSubjNameInput ? newSubjNameInput.value.trim() : '';
        if (newSubjName) {
            const newSubj = {
                id: 'subject-' + Date.now(),
                name: newSubjName,
                gradingCategories: [
                    { id: 'cat_assignments', name: 'الواجبات', max: 20, type: 'dots' },
                    { id: 'cat_activities', name: 'الأنشطة', max: 20, type: 'dots' },
                    { id: 'cat_participation', name: 'المشاركة', max: 20, type: 'dots' },
                    { id: 'cat_practical', name: 'العملي', max: 20, type: 'number' },
                    { id: 'cat_exam', name: 'الاختبار', max: 20, type: 'number' }
                ]
            };
            subjects.push(newSubj);
            selectedSubjId = newSubj.id;
            renderSubjectsTabs();
        } else {
            selectedSubjId = activeSubjectId;
        }
    }

    if (selectedSubjId) activeSubjectId = selectedSubjId;

    const newClass = { id: 'class-' + Date.now(), name: name, students: [] };
    classes.push(newClass);
    activeClassId = newClass.id;
    saveData();
    
    // Immediately re-render class cards on landing screen and navigation tabs without force-switching screen
    renderClassesLandingCards();
    renderClassesTabs();
    
    closeClassModal();
    showNotification(`تمت إضافة فصل "${newClass.name}" بنجاح.`);
}

function handleSubjectFormSubmit(e) {
    e.preventDefault();
    const name = newSubjectNameInput ? newSubjectNameInput.value.trim() : '';
    if (!name) return;
    const newSubject = {
        id: 'subject-' + Date.now(),
        name: name,
        gradingCategories: [
            { id: 'cat_assignments', name: 'الواجبات', max: 20, type: 'dots' },
            { id: 'cat_participation', name: 'المشاركة والتفاعل', max: 10, type: 'participation' },
            { id: 'cat_research', name: 'البحث والمشاريع', max: 10, type: 'dots' },
            { id: 'cat_practical', name: 'الاختبار العملي', max: 40, type: 'numeric' },
            { id: 'cat_exam', name: 'الاختبار النهائي', max: 20, type: 'numeric' }
        ]
    };
    subjects.push(newSubject);
    activeSubjectId = newSubject.id;
    
    saveData();
    renderSubjectsTabs();
    updateDashboard();
    closeSubjectModal();
    showNotification(`تمت إضافة مادة "${newSubject.name}".`);
}

// ============================================================
// EVALUATION PERIODS MANAGEMENT
// ============================================================
function renderPeriodSelector() {
    const selector = document.getElementById('periodSelector');
    const badge = document.getElementById('activePeriodBadge');
    if (!selector) return;

    selector.innerHTML = '';
    periods.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === activePeriodId) option.selected = true;
        selector.appendChild(option);
    });

    const activeP = periods.find(p => p.id === activePeriodId);
    if (badge && activeP) {
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = '#10b981';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${activeP.name} (100 درجة)`;
    }
}

window.switchPeriod = function(periodId) {
    activePeriodId = periodId;
    saveData();
    renderPeriodSelector();
    filterAndRenderTable();
    updateDashboard();
    const p = periods.find(item => item.id === periodId);
    showNotification(`تم الانتقال إلى "${p ? p.name : ''}".`);
};

function openNewPeriodModal() {
    const modal = document.getElementById('newPeriodModal');
    const input = document.getElementById('newPeriodName');
    const nextNum = (periods ? periods.length : 0) + 1;
    const arabicNums = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'];
    const numName = arabicNums[nextNum - 1] || `${nextNum}`;
    if (input) input.value = `الفترة ${numName}`;
    if (modal) modal.classList.add('active');
}

function closeNewPeriodModal() {
    const modal = document.getElementById('newPeriodModal');
    if (modal) modal.classList.remove('active');
}

function handleNewPeriodFormSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('newPeriodName');
    const name = input ? input.value.trim() : '';
    if (!name) return;

    // Archive current active period
    const currentActive = periods.find(p => p.id === activePeriodId);
    if (currentActive) {
        currentActive.isArchived = true;
    }

    const newPeriod = {
        id: 'period-' + Date.now(),
        name: name,
        isArchived: false,
        createdAt: Date.now()
    };

    periods.push(newPeriod);
    activePeriodId = newPeriod.id;

    saveData();
    closeNewPeriodModal();
    renderPeriodSelector();
    filterAndRenderTable();
    updateDashboard();

    showNotification(`تمت أرشفة الفترة السابقة وبدء "${name}" بنجاح!`, 'success');
}

// Delays calling fn until `wait` ms have passed since the last call,
// so rapid-fire events (e.g. keystrokes) trigger it only once at the end.
function debounce(fn, wait) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    const addStudent = document.getElementById('addStudentBtn');
    if (addStudent) addStudent.onclick = () => openAddStudentsChoiceModal();

    const closeM = document.getElementById('closeModalBtn');
    if (closeM) closeM.addEventListener('click', closeModal);

    const cancelM = document.getElementById('cancelModalBtn');
    if (cancelM) cancelM.addEventListener('click', closeModal);

    const sForm = document.getElementById('studentForm');
    if (sForm) sForm.addEventListener('submit', handleFormSubmit);

    const sInput = document.getElementById('searchInput');
    if (sInput) sInput.addEventListener('input', debounce(filterAndRenderTable, 200));

    const sFilter = document.getElementById('statusFilter');
    if (sFilter) sFilter.addEventListener('change', filterAndRenderTable);

    const exportCsv = document.getElementById('exportCsvBtn');
    if (exportCsv) exportCsv.addEventListener('click', exportCurrentClassToCSV);

    const sModal = document.getElementById('studentModal');
    if (sModal) sModal.addEventListener('click', e => { if (e.target === sModal) closeModal(); });

    // Sidebar Toggle & Actions
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarNav = document.getElementById('sidebarNav');
    if (sidebarToggleBtn && sidebarNav) {
        // Force collapsed state by default
        sidebarNav.classList.add('collapsed');

        sidebarToggleBtn.addEventListener('click', () => {
            sidebarNav.classList.toggle('collapsed');
            const isCollapsed = sidebarNav.classList.contains('collapsed');
            sessionStorage.setItem('user_toggled_sidebar', '1');
            safeStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
        });

        // Only expand if user explicitly toggled it open in the session
        if (sessionStorage.getItem('user_toggled_sidebar') === '1' && safeStorage.getItem('sidebar_collapsed') === '0') {
            sidebarNav.classList.remove('collapsed');
        } else {
            sidebarNav.classList.add('collapsed');
            safeStorage.setItem('sidebar_collapsed', '1');
        }
    }

    const sAddStudent = document.getElementById('sidebarAddStudentBtn');
    if (sAddStudent) sAddStudent.addEventListener('click', () => openModal());
    const sBulkGrade = document.getElementById('sidebarBulkGradeBtn');
    if (sBulkGrade) sBulkGrade.addEventListener('click', openBulkGradeModal);
    const sImportNoor = document.getElementById('sidebarImportNoorBtn');
    if (sImportNoor) sImportNoor.addEventListener('click', openImportNoorModal);
    const sImportMadrasati = document.getElementById('sidebarImportMadrasatiBtn');
    if (sImportMadrasati) sImportMadrasati.addEventListener('click', openMadrasatiImportModal);
    const sPortfolio = document.getElementById('sidebarPortfolioBtn');
    if (sPortfolio) sPortfolio.addEventListener('click', openPortfolioModal);
    const sPeriods = document.getElementById('sidebarPeriodsBtn');
    if (sPeriods) sPeriods.addEventListener('click', openNewPeriodModal);
    const sGradingSetup = document.getElementById('sidebarGradingSetupBtn');
    if (sGradingSetup) sGradingSetup.addEventListener('click', () => {
        openGlobalGradingSetupModal();
    });
    const sWhatsapp = document.getElementById('sidebarWhatsappBtn');
    if (sWhatsapp) sWhatsapp.addEventListener('click', openWhatsappSettingsModal);
    const sExportCsv = document.getElementById('sidebarExportCsvBtn');
    if (sExportCsv) sExportCsv.addEventListener('click', exportAllClassesToCSV);

    // Class Modal
    const addClassBtnEl = document.getElementById('addClassBtn');
    if (addClassBtnEl) addClassBtnEl.addEventListener('click', openClassModal);
    const closeClassModalBtnEl = document.getElementById('closeClassModalBtn');
    if (closeClassModalBtnEl) closeClassModalBtnEl.addEventListener('click', closeClassModal);
    const cancelClassModalBtnEl = document.getElementById('cancelClassModalBtn');
    if (cancelClassModalBtnEl) cancelClassModalBtnEl.addEventListener('click', closeClassModal);
    const classFormEl = document.getElementById('classForm');
    if (classFormEl) classFormEl.addEventListener('submit', handleClassFormSubmit);
    const classModalEl = document.getElementById('classModal');
    if (classModalEl) classModalEl.addEventListener('click', e => { if (e.target === classModalEl) closeClassModal(); });

    // Subject Modal
    const addSubjectBtnEl = document.getElementById('addSubjectBtn');
    if (addSubjectBtnEl) addSubjectBtnEl.addEventListener('click', openSubjectModal);
    const closeSubjectModalBtnEl = document.getElementById('closeSubjectModalBtn');
    if (closeSubjectModalBtnEl) closeSubjectModalBtnEl.addEventListener('click', closeSubjectModal);
    const cancelSubjectModalBtnEl = document.getElementById('cancelSubjectModalBtn');
    if (cancelSubjectModalBtnEl) cancelSubjectModalBtnEl.addEventListener('click', closeSubjectModal);
    const subjectFormEl = document.getElementById('subjectForm');
    if (subjectFormEl) subjectFormEl.addEventListener('submit', handleSubjectFormSubmit);
    const subjectModalEl = document.getElementById('subjectModal');
    if (subjectModalEl) subjectModalEl.addEventListener('click', e => { if (e.target === subjectModalEl) closeSubjectModal(); });

    // Wizard Form
    const gradingSetupForm = document.getElementById('gradingSetupForm');
    if (gradingSetupForm) gradingSetupForm.addEventListener('submit', handleGradingSetupFormSubmit);

    // Bulk Grade Modal
    const bulkGradeBtnEl = document.getElementById('bulkGradeBtn');
    if (bulkGradeBtnEl) bulkGradeBtnEl.addEventListener('click', openBulkGradeModal);
    const closeBulkGradeModalBtnEl = document.getElementById('closeBulkGradeModalBtn');
    if (closeBulkGradeModalBtnEl) closeBulkGradeModalBtnEl.addEventListener('click', closeBulkGradeModal);
    const cancelBulkGradeModalBtnEl = document.getElementById('cancelBulkGradeModalBtn');
    if (cancelBulkGradeModalBtnEl) cancelBulkGradeModalBtnEl.addEventListener('click', closeBulkGradeModal);
    const bulkGradeModalEl = document.getElementById('bulkGradeModal');
    if (bulkGradeModalEl) bulkGradeModalEl.addEventListener('click', e => { if (e.target === bulkGradeModalEl) closeBulkGradeModal(); });

    // Import Noor Modal
    const importNoorBtnEl = document.getElementById('importNoorBtn');
    if (importNoorBtnEl) importNoorBtnEl.addEventListener('click', openImportNoorModal);
    const closeImportNoorModalBtnEl = document.getElementById('closeImportNoorModalBtn');
    if (closeImportNoorModalBtnEl) closeImportNoorModalBtnEl.addEventListener('click', closeImportNoorModal);
    const cancelImportNoorModalBtnEl = document.getElementById('cancelImportNoorModalBtn');
    if (cancelImportNoorModalBtnEl) cancelImportNoorModalBtnEl.addEventListener('click', closeImportNoorModal);
    const importNoorModalEl = document.getElementById('importNoorModal');
    if (importNoorModalEl) importNoorModalEl.addEventListener('click', e => { if (e.target === importNoorModalEl) closeImportNoorModal(); });

    // Import Madrasati Modal
    const importMadrasatiBtnEl = document.getElementById('importMadrasatiBtn');
    if (importMadrasatiBtnEl) importMadrasatiBtnEl.addEventListener('click', openMadrasatiImportModal);
    const closeMadrasatiImportModalBtnEl = document.getElementById('closeMadrasatiImportModalBtn');
    if (closeMadrasatiImportModalBtnEl) closeMadrasatiImportModalBtnEl.addEventListener('click', closeMadrasatiImportModal);
    const cancelMadrasatiImportModalBtnEl = document.getElementById('cancelMadrasatiImportModalBtn');
    if (cancelMadrasatiImportModalBtnEl) cancelMadrasatiImportModalBtnEl.addEventListener('click', closeMadrasatiImportModal);
    const madrasatiImportModalEl = document.getElementById('madrasatiImportModal');
    if (madrasatiImportModalEl) madrasatiImportModalEl.addEventListener('click', e => { if (e.target === madrasatiImportModalEl) closeMadrasatiImportModal(); });

    // Reason Modal
    const closeReasonModalBtnEl = document.getElementById('closeReasonModalBtn');
    if (closeReasonModalBtnEl) closeReasonModalBtnEl.addEventListener('click', cancelReasonModal);
    const cancelReasonBtnEl = document.getElementById('cancelReasonBtn');
    if (cancelReasonBtnEl) cancelReasonBtnEl.addEventListener('click', cancelReasonModal);
    const reasonModalEl = document.getElementById('reasonModal');
    if (reasonModalEl) reasonModalEl.addEventListener('click', e => { if (e.target === reasonModalEl) cancelReasonModal(); });

    // New Period Modal
    const addNewPeriodBtnEl = document.getElementById('addNewPeriodBtn');
    if (addNewPeriodBtnEl) addNewPeriodBtnEl.addEventListener('click', openNewPeriodModal);
    const closeNewPeriodModalBtnEl = document.getElementById('closeNewPeriodModalBtn');
    if (closeNewPeriodModalBtnEl) closeNewPeriodModalBtnEl.addEventListener('click', closeNewPeriodModal);
    const cancelNewPeriodModalBtnEl = document.getElementById('cancelNewPeriodModalBtn');
    if (cancelNewPeriodModalBtnEl) cancelNewPeriodModalBtnEl.addEventListener('click', closeNewPeriodModal);
    const newPeriodFormEl = document.getElementById('newPeriodForm');
    if (newPeriodFormEl) newPeriodFormEl.addEventListener('submit', handleNewPeriodFormSubmit);
    const newPeriodModalEl = document.getElementById('newPeriodModal');
    if (newPeriodModalEl) newPeriodModalEl.addEventListener('click', e => { if (e.target === newPeriodModalEl) closeNewPeriodModal(); });

    // Grading Setup Modal
    const gradingSetupModalEl = document.getElementById('gradingSetupModal');
    const closeGradingSetupModalBtnEl = document.getElementById('closeGradingSetupModalBtn');
    if (closeGradingSetupModalBtnEl && gradingSetupModalEl) {
        closeGradingSetupModalBtnEl.addEventListener('click', () => { gradingSetupModalEl.classList.remove('active'); });
    }
    const cancelGradingSetupModalBtnEl = document.getElementById('cancelGradingSetupModalBtn');
    if (cancelGradingSetupModalBtnEl && gradingSetupModalEl) {
        cancelGradingSetupModalBtnEl.addEventListener('click', () => { gradingSetupModalEl.classList.remove('active'); });
    }
    if (gradingSetupModalEl) {
        gradingSetupModalEl.addEventListener('click', e => { if (e.target === gradingSetupModalEl) gradingSetupModalEl.classList.remove('active'); });
    }

    // WhatsApp Settings Modal
    const whatsappSettingsBtnEl = document.getElementById('whatsappSettingsBtn');
    if (whatsappSettingsBtnEl) whatsappSettingsBtnEl.addEventListener('click', openWhatsappSettingsModal);
    const closeWhatsappSettingsModalBtnEl = document.getElementById('closeWhatsappSettingsModalBtn');
    if (closeWhatsappSettingsModalBtnEl) closeWhatsappSettingsModalBtnEl.addEventListener('click', closeWhatsappSettingsModal);
    const cancelWhatsappSettingsModalBtnEl = document.getElementById('cancelWhatsappSettingsModalBtn');
    if (cancelWhatsappSettingsModalBtnEl) cancelWhatsappSettingsModalBtnEl.addEventListener('click', closeWhatsappSettingsModal);
    const whatsappSettingsFormEl = document.getElementById('whatsappSettingsForm');
    if (whatsappSettingsFormEl) whatsappSettingsFormEl.addEventListener('submit', handleWhatsappSettingsSubmit);
    const whatsappSettingsModalEl = document.getElementById('whatsappSettingsModal');
    if (whatsappSettingsModalEl) {
        whatsappSettingsModalEl.addEventListener('click', e => {
            if (e.target === whatsappSettingsModalEl) closeWhatsappSettingsModal();
        });
    }

    // PDF Report Preview Modal Overlay click
    const pdfReportModalEl = document.getElementById('pdfReportModal');
    if (pdfReportModalEl) {
        pdfReportModalEl.addEventListener('click', e => {
            if (e.target === pdfReportModalEl) closePdfReportModal();
        });
    }
}

// Maps a grading category to the legacy fixed field name (assignments/
// activities/research/participation/practical/exam) it corresponds to, if
// any, so older code that still reads gradesObj.assignments etc. directly
// (CSV export, legacy reports) keeps working. Custom categories added via
// the setup wizard have no legacy alias and are only stored under cat.id.
function legacyGradeFieldFor(cat) {
    if (isAssignmentsCategory(cat)) return 'assignments';
    if (cat.id === 'cat_activities' || cat.name === 'الأنشطة' || cat.name === 'الأنشطة الصفية') return 'activities';
    if (cat.id === 'cat_research' || cat.name === 'البحث والمشاريع') return 'research';
    if (cat.id === 'cat_participation' || cat.type === 'participation') return 'participation';
    if (cat.id === 'cat_practical' || cat.name === 'الاختبار العملي') return 'practical';
    if (cat.id === 'cat_exam' || cat.name === 'الاختبار النهائي') return 'exam';
    return null;
}

function getStudentSubjectGrades(student, subjectId = activeSubjectId, periodId = activePeriodId) {
    if (!student) return { assignments: [], activities: [], research: [], participation: [], practical: 0, exam: 0 };
    if (!student.grades) student.grades = {};
    if (!student.grades[periodId]) student.grades[periodId] = {};

    const categories = getActiveSubjectGradingCategories(subjectId);

    // Check if current period grade object is empty/unpopulated
    const isCurrentPeriodEmpty = !student.grades[periodId][subjectId] ||
                                 typeof student.grades[periodId][subjectId] !== 'object' ||
                                 Object.keys(student.grades[periodId][subjectId]).length === 0;

    if (isCurrentPeriodEmpty) {
        if (student.grades['period-1'] && student.grades['period-1'][subjectId] && typeof student.grades['period-1'][subjectId] === 'object') {
            student.grades[periodId][subjectId] = JSON.parse(JSON.stringify(student.grades['period-1'][subjectId]));
        } else if (student.grades[subjectId] && typeof student.grades[subjectId] === 'object') {
            student.grades[periodId][subjectId] = JSON.parse(JSON.stringify(student.grades[subjectId]));
        }
    }

    if (!student.grades[periodId][subjectId] || typeof student.grades[periodId][subjectId] !== 'object') {
        student.grades[periodId][subjectId] = {};
    }

    const g = student.grades[periodId][subjectId];

    // Size/migrate each active category's stored value to match its OWN
    // dotsCount/max (not a stale global gradingDistribution), so a category
    // customized via the setup wizard (e.g. a smaller dotsCount with a
    // point value) doesn't get silently resized back to the old default.
    categories.forEach(cat => {
        if (cat.max <= 0) return;
        const legacyKey = legacyGradeFieldFor(cat);

        if (cat.type === 'numeric') {
            const raw = g[cat.id] !== undefined ? g[cat.id] : (legacyKey ? g[legacyKey] : undefined);
            let val = parseFloat(raw) || 0;
            if (val < 0) val = 0;
            if (val > cat.max) val = cat.max;
            g[cat.id] = val;
            if (legacyKey) g[legacyKey] = val;
            return;
        }

        // dots / participation: array-backed
        const targetLen = cat.dotsCount || cat.max || 10;
        let arr = Array.isArray(g[cat.id]) ? g[cat.id] : (legacyKey && Array.isArray(g[legacyKey]) ? g[legacyKey] : null);

        if (!arr) {
            arr = Array(targetLen).fill(false);
        } else if (arr.length !== targetLen) {
            const stringViolations = arr.filter(v => typeof v === 'string' && v.trim() !== '');
            const countTrue = arr.filter(v => v === true).length;
            const keep = Math.min(countTrue, targetLen);
            const resized = Array(targetLen).fill(false);
            for (let i = 0; i < keep; i++) resized[i] = true;
            stringViolations.forEach((v, idx) => {
                const pos = targetLen - 1 - idx;
                if (pos >= 0) resized[pos] = v;
            });
            arr = resized;
        }

        g[cat.id] = arr;
        if (legacyKey) g[legacyKey] = arr; // same array reference, kept mirrored for legacy consumers
    });

    // Defensive defaults so older code reading these fixed fields directly
    // (CSV export, legacy reports) never sees undefined, even if the
    // corresponding category was renamed/removed via the setup wizard.
    if (g.practical === undefined) g.practical = 0;
    if (g.exam === undefined) g.exam = 0;
    if (!Array.isArray(g.assignments)) g.assignments = [];
    if (!Array.isArray(g.activities)) g.activities = [];
    if (!Array.isArray(g.research)) g.research = [];
    if (!Array.isArray(g.participation)) g.participation = [];

    return g;
}

// ============================================================
// STUDENT MODAL
// ============================================================
function openModal(student = null) {
    studentForm.reset();
    const dist = getActiveSubjectGradingDistribution();
    
    // Always rebuild form checkboxes & dots for active subject distribution
    buildAllCheckboxes();

    // Set max inputs dynamically based on grading distribution
    const maxPrac = dist.practical !== undefined ? dist.practical : 40;
    const maxEx = dist.exam !== undefined ? dist.exam : 20;
    gradePracticalInput.max = maxPrac;
    gradeExamInput.max = maxEx;
    gradePracticalInput.placeholder = `الدرجة العظمى: ${maxPrac}`;
    gradeExamInput.placeholder = `الدرجة العظمى: ${maxEx}`;

    const labelPrac = document.querySelector('label[for="gradePractical"]');
    if (labelPrac) labelPrac.textContent = `الاختبار العملي (من ${maxPrac})`;
    const infoPrac = gradePracticalInput.nextElementSibling;
    if (infoPrac && infoPrac.classList.contains('input-info')) infoPrac.textContent = `الحد الأقصى: ${maxPrac} درجة`;

    const labelEx = document.querySelector('label[for="gradeExam"]');
    if (labelEx) labelEx.textContent = `الاختبار النهائي (من ${maxEx})`;
    const infoEx = gradeExamInput.nextElementSibling;
    if (infoEx && infoEx.classList.contains('input-info')) infoEx.textContent = `الحد الأقصى: ${maxEx} درجة`;

    const gradeSection = document.getElementById('modalGradeSection');

    if (student) {
        modalTitle.innerHTML = `<i class="fa-solid fa-user-pen" style="color:var(--accent-teal);"></i> تعديل اسم الطالب`;
        if (gradeSection) gradeSection.style.display = 'none';
        studentIdInput.value = student.id;
        studentNameInput.value = student.name;
    } else {
        modalTitle.innerHTML = `<i class="fa-solid fa-user-plus" style="color:var(--primary-color);"></i> إضافة طالب جديد`;
        if (gradeSection) gradeSection.style.display = 'none';
        studentIdInput.value = '';
        studentNameInput.value = '';
    }
    studentModal.classList.add('active');
    setTimeout(() => studentNameInput.focus(), 100);
}

function setCheckboxesState(containerId, sumId, states) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
        cb.checked = Array.isArray(states) ? !!states[idx] : idx < (parseInt(states) || 0);
    });
    const sumEl = document.getElementById(sumId);
    if (sumEl) sumEl.textContent = container.querySelectorAll('input[type="checkbox"]:checked').length;
}

function closeModal() { studentModal.classList.remove('active'); }

// ============================================================
// REASON MODAL
// ============================================================
function openReasonModal() {
    const modal = document.getElementById('reasonModal');
    const group = document.getElementById('customReasonInputGroup');
    const input = document.getElementById('customReasonInput');
    if (group) group.style.display = 'none';
    if (input) input.value = '';
    if (modal) modal.classList.add('active');
}

window.toggleCustomReasonInput = function() {
    const group = document.getElementById('customReasonInputGroup');
    const input = document.getElementById('customReasonInput');
    if (group) {
        const isHidden = group.style.display === 'none' || !group.style.display;
        group.style.display = isHidden ? 'block' : 'none';
        if (isHidden && input) {
            input.value = '';
            setTimeout(() => input.focus(), 100);
        }
    }
};

window.submitCustomReason = function() {
    const input = document.getElementById('customReasonInput');
    const reason = input ? input.value.trim() : '';
    selectReason(reason || 'سبب مخصص');
};

function closeReasonModal() { document.getElementById('reasonModal').classList.remove('active'); }

function cancelReasonModal() {
    closeReasonModal();
    pendingReason = { studentId: null, index: null, context: null };
}

window.selectReason = function(reason) {
    const { studentId, index, context, catKey } = pendingReason;
    
    // Automatically record and attach the date of addition
    const todayStr = new Date().toLocaleDateString('ar-SA');
    const fullReason = (reason && reason.includes('بتاريخ:')) ? reason : `${reason || 'ملاحظة سلوكية'} (بتاريخ: ${todayStr})`;

    if (context === 'table') {
        const student = getActiveStudents().find(s => s.id === studentId);
        if (student) {
            ensureParticipationArray(student);
            const gradesObj = getStudentSubjectGrades(student);
            const key = catKey || 'cat_participation';
            if (!Array.isArray(gradesObj[key])) gradesObj[key] = gradesObj.participation;
            gradesObj[key][index] = fullReason;
            gradesObj.participation[index] = fullReason;
            updateDotElement(studentId, key, index, fullReason, false);
            saveData();
            refreshAfterGradeEdit(studentId);
        }
    } else if (context === 'bulk') {
        bulkParticipationState[index] = fullReason;
        syncBulkParticipationUI();
    } else {
        formParticipationState[index] = fullReason;
        syncFormParticipationUI();
    }
    closeReasonModal();
    pendingReason = { studentId: null, index: null, context: null };
};

// getStudentSubjectGrades() already guarantees gradesObj.participation is a
// correctly-sized array (per the category's own dotsCount), so this is now
// just a thin call for that side effect. Kept as a named function since
// callers read as "make sure this student's participation array exists."
function ensureParticipationArray(student, subjectId = activeSubjectId) {
    getStudentSubjectGrades(student, subjectId);
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `notification ${type}`;
    const icons = {
        success: '<i class="fa-solid fa-circle-check" style="color:var(--success-color);"></i>',
        error:   '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger-color);"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning-color);"></i>'
    };
    toast.innerHTML = `${icons[type] || icons.success} <span>${message}</span>`;
    notificationContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('active'), 10);
    setTimeout(() => { toast.classList.remove('active'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ============================================================
// FORM SUBMISSION
// ============================================================
function handleFormSubmit(e) {
    e.preventDefault();
    const id   = studentIdInput.value;
    const name = studentNameInput.value.trim();

    if (!name) return;

    const activeClass = getActiveClass();
    if (!activeClass) return;

    if (id) {
        const student = activeClass.students.find(s => s.id === id);
        if (student) {
            student.name = name;
            showNotification(`تم تعديل اسم الطالب إلى "${name}".`);
        }
    } else {
        const newStudent = {
            id: Date.now().toString(),
            name: name,
            grades: {}
        };
        activeClass.students.push(newStudent);
        showNotification(`تمت إضافة الطالب "${name}".`);
    }
    saveData();
    closeModal();
    filterAndRenderTable();
    updateDashboard();
}

function getCheckboxesArrayState(containerId) {
    return Array.from(
        document.getElementById(containerId).querySelectorAll('input[type="checkbox"]')
    ).map(cb => cb.checked);
}

// ============================================================
// GRADE CALCULATIONS
// ============================================================
// pointValue = how many grade points one checked dot is worth (default 1,
// i.e. the original "one dot = one point" behavior). maxVal clamps the
// resulting score to the category's max, matching getParticipationScore.
function getCheckboxSum(arr, pointValue = 1, maxVal = Infinity) {
    if (!Array.isArray(arr)) return parseFloat(arr) || 0;
    const count = arr.filter(v => v === true).length;
    return Math.max(0, Math.min(maxVal, Math.round(count * pointValue * 100) / 100));
}

window.getActiveAssignmentsCount = function(activeClass, subjectId = activeSubjectId) {
    if (!activeClass || !Array.isArray(activeClass.students) || activeClass.students.length === 0) return 0;
    const categories = getActiveSubjectGradingCategories(subjectId);
    const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
    const maxAssignmentsCount = cat ? cat.max : 10;
    
    // Find the highest slot index that has been assigned/marked by any student in the class
    let highestSlotIndex = -1;
    for (let i = maxAssignmentsCount - 1; i >= 0; i--) {
        const hasAnyStudentMarked = activeClass.students.some(s => {
            const grades = getStudentSubjectGrades(s, subjectId);
            const assignArr = grades ? (grades.assignments || grades['cat_assignments']) : null;
            if (!Array.isArray(assignArr)) return false;
            const val = assignArr[i];
            return val === true || (typeof val === 'string' && val.trim() !== '');
        });
        if (hasAnyStudentMarked) {
            highestSlotIndex = i;
            break;
        }
    }
    
    return highestSlotIndex + 1;
};

window.getStudentAssignmentScore = function(student, subjectId = activeSubjectId, maxVal = 10, cls = null) {
    const totalGiven = getActiveAssignmentsCount(cls || getActiveClass(), subjectId);
    
    // If no assignments given yet in the whole semester, initial score is 0
    if (totalGiven === 0) {
        return 0;
    }
    
    const gradesObj = getStudentSubjectGrades(student, subjectId);
    const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : null;
    if (!Array.isArray(assignArr)) {
        return 0;
    }
    
    // Count how many were solved among the assignments given so far
    let solvedCount = 0;
    for (let i = 0; i < totalGiven; i++) {
        if (assignArr[i] === true) {
            solvedCount++;
        }
    }
    
    const score = (solvedCount / totalGiven) * maxVal;
    return Math.max(0, Math.min(maxVal, Math.round(score)));
};

// pointValue = how many grade points one positive dot is worth (a deduction
// dot subtracts the same amount). Defaults to 1, the original behavior.
// maxVal defaults to the legacy global participation max when omitted, so
// existing single-argument callers keep working unchanged.
function getParticipationScore(arr, maxVal, pointValue = 1) {
    if (!Array.isArray(arr)) return parseFloat(arr) || 0;
    if (maxVal === undefined) maxVal = gradingDistribution ? gradingDistribution.participation : 10;
    let score = 0;
    arr.forEach(v => {
        if (v === true) score += pointValue;
        else if (typeof v === 'string' && v) score -= pointValue; // deduction
    });
    score = Math.round(score * 100) / 100;
    return Math.max(0, Math.min(maxVal, score));
}

// Earned score for one student in one grading category, dispatching on the
// category's type the same way everywhere else does. Centralizes what used
// to be duplicated inline in getStudentTotal/renderTable/printStudentReport
// (and now the portfolio report and CSV export too), so a scoring fix only
// has to be made once. `cls` is the class the student belongs to (needed
// for assignments' "given so far" ratio) — defaults to the active class.
function getCategoryEarnedScore(student, cat, subjectId = activeSubjectId, cls = null) {
    if (cat.max <= 0) return 0;
    const gradesObj = getStudentSubjectGrades(student, subjectId);
    const val = gradesObj[cat.id] !== undefined ? gradesObj[cat.id] : (gradesObj[cat.key] || 0);
    if (isAssignmentsCategory(cat)) {
        return getStudentAssignmentScore(student, subjectId, cat.max, cls);
    } else if (cat.type === 'dots') {
        return getCheckboxSum(val, cat.pointValue, cat.max);
    } else if (cat.type === 'participation') {
        return getParticipationScore(val, cat.max, cat.pointValue);
    } else if (cat.type === 'numeric') {
        return parseFloat(val) || 0;
    }
    return 0;
}

function getStudentTotal(student, subjectId = activeSubjectId, cls = null) {
    const categories = getActiveSubjectGradingCategories(subjectId);
    let total = 0;
    categories.forEach(cat => {
        total += getCategoryEarnedScore(student, cat, subjectId, cls);
    });
    return Math.round(total);
}

function getStudentStatus(total) {
    if (total >= 90) return 'excellent';
    if (total >= 50) return 'pass';
    return 'fail';
}

function buildStatusBadge(status) {
    if (status === 'excellent') return '<span class="badge" style="background: rgba(16, 185, 129, 0.22); color: #10b981; border: 1.5px solid #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.5); font-weight: 800;"><i class="fa-solid fa-star" style="color: #fbbf24; filter: drop-shadow(0 0 2px #fbbf24);"></i> ممتاز</span>';
    if (status === 'pass')      return '<span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35);"><i class="fa-solid fa-circle-check"></i> ناجح</span>';
    return '<span class="badge badge-danger" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35);"><i class="fa-solid fa-triangle-exclamation"></i> متعثر</span>';
}

// ============================================================
// FILTER & RENDER TABLE
// ============================================================
function filterAndRenderTable() {
    const query  = searchInput.value.toLowerCase().trim();
    const filter = statusFilter.value;
    const filtered = getActiveStudents().filter(student => {
        const match  = student.name.toLowerCase().includes(query);
        const total  = getStudentTotal(student);
        const status = getStudentStatus(total);
        if (filter === 'all')       return match;
        if (filter === 'pass')      return match && (status === 'pass' || status === 'excellent');
        if (filter === 'fail')      return match && status === 'fail';
        if (filter === 'excellent') return match && status === 'excellent';
        return match;
    });
    renderTable(filtered);
}

function renderTable(data) {
    if (data === undefined) data = getActiveStudents();
    studentsTableBody.innerHTML = '';
    
    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    let totalDistSum = 0;
    categories.forEach(cat => {
        totalDistSum += (cat.max || 0);
    });

    // Dynamically update main table header according to non-zero categories
    const thead = document.querySelector('.students-table thead');
    if (thead) {
        let thHtml = '<tr><th style="width:45px;text-align:center;">م</th><th>اسم الطالب</th>';
        categories.forEach(cat => {
            if (cat.max > 0) {
                thHtml += `<th>${cat.name} (${cat.max})</th>`;
            }
        });
        thHtml += `<th>المجموع (${totalDistSum})</th>`;
        thHtml += `<th>التقدير</th>`;
        thHtml += `<th>الإجراءات</th></tr>`;
        thead.innerHTML = thHtml;
    }

    emptyState.style.display = data.length === 0 ? 'flex' : 'none';
    if (data.length === 0) return;

    data.forEach((student, index) => {
        const total  = getStudentTotal(student);
        const status = getStudentStatus(total);
        const gradesObj = getStudentSubjectGrades(student);

        const tr = document.createElement('tr');
        tr.className = 'student-row';

        let rowHtml = `<td style="text-align:center;font-weight:700;color:var(--text-muted);">${index + 1}</td><td><strong>${student.name}</strong></td>`;

        categories.forEach(cat => {
            if (cat.max > 0) {
                const val = gradesObj[cat.id] !== undefined ? gradesObj[cat.id] : (gradesObj[cat.key] || 0);
                const isAssign = (cat.id === 'cat_assignments' || cat.key === 'assignments' || cat.name === 'الواجبات');
                if (isAssign) {
                    rowHtml += `<td>
                        <div style="font-weight:700;margin-bottom:4px;">${getStudentAssignmentScore(student, activeSubjectId, cat.max)}</div>
                        ${renderTableDots(student.id, cat.id, val, cat.max)}
                    </td>`;
                } else if (cat.type === 'dots') {
                    rowHtml += `<td>
                        <div style="font-weight:700;margin-bottom:4px;">${getCheckboxSum(val, cat.pointValue, cat.max)}</div>
                        ${renderTableDots(student.id, cat.id, val, cat.dotsCount || cat.max)}
                    </td>`;
                } else if (cat.type === 'participation') {
                    rowHtml += `<td>
                        <div style="font-weight:700;margin-bottom:4px;">${getParticipationScore(val, cat.max, cat.pointValue)}</div>
                        ${renderTableDots(student.id, cat.id, val, cat.dotsCount || cat.max)}
                    </td>`;
                } else if (cat.type === 'numeric') {
                    rowHtml += `<td>
                        <input type="number" class="table-input" value="${val || 0}"
                            min="0" max="${cat.max}" step="0.5" title="${cat.name} (من ${cat.max})"
                            onchange="updateTableGrade('${student.id}','${cat.id}',this,${cat.max})"
                            onkeydown="if(event.key==='Enter')this.blur()">
                    </td>`;
                }
            }
        });

        rowHtml += `<td id="total-${student.id}" style="font-weight:800;font-size:1.1rem;color:${total>=50?'var(--accent-teal)':'var(--danger-color)'}">${total}</td>`;
        rowHtml += `<td id="badge-${student.id}">${buildStatusBadge(status)}</td>`;
        rowHtml += `<td>
            <div class="action-dropdown" id="action-dropdown-${student.id}">
                <button class="action-menu-btn" onclick="toggleActionMenu(event, '${student.id}')" title="خيارات وإجراءات الطالب">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <div class="action-dropdown-menu" id="action-menu-${student.id}">
                    <div class="action-dropdown-item" onclick="closeAllActionMenus(); printStudentReport('${student.id}');">
                        <i class="fa-solid fa-file-invoice" style="color: var(--accent-teal);"></i>
                        <span>تقرير مستوى الطالب</span>
                    </div>
                    <div class="action-dropdown-item" onclick="closeAllActionMenus(); openStudentReferralModal('${student.id}');">
                        <i class="fa-solid fa-file-signature" style="color: #f59e0b;"></i>
                        <span>إصدار نموذج إحالة</span>
                    </div>
                    <div class="action-dropdown-item" onclick="closeAllActionMenus(); openTransferStudentModal('${student.id}');">
                        <i class="fa-solid fa-right-left" style="color: #38bdf8;"></i>
                        <span>نقل الطالب لفصل آخر</span>
                    </div>
                    <div class="action-dropdown-item" onclick="closeAllActionMenus(); editStudent('${student.id}');">
                        <i class="fa-solid fa-pen-to-square" style="color: #6366f1;"></i>
                        <span>تعديل الاسم والبيانات</span>
                    </div>
                    <div class="action-dropdown-divider"></div>
                    <div class="action-dropdown-item danger" onclick="closeAllActionMenus(); deleteStudent('${student.id}');">
                        <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                        <span>حذف الطالب</span>
                    </div>
                </div>
            </div>
        </td>`;

        tr.innerHTML = rowHtml;
        studentsTableBody.appendChild(tr);
    });
}

// Action dropdown helper functions
window.toggleActionMenu = function(e, studentId) {
    if (e) e.stopPropagation();
    const menu = document.getElementById(`action-menu-${studentId}`);
    const wasActive = menu && menu.classList.contains('active');
    closeAllActionMenus();
    if (menu && !wasActive) {
        menu.classList.add('active');
    }
};

window.closeAllActionMenus = function() {
    document.querySelectorAll('.action-dropdown-menu.active').forEach(m => m.classList.remove('active'));
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-dropdown')) {
        closeAllActionMenus();
    }
});

// Shared visual (class + tooltip) for a single grading dot, used both when
// rendering a full row and when live-updating one dot after a click.
function getDotVisual(val, isAssign, index) {
    let cls = 'table-checkbox';
    let tip = `الدرجة ${index+1}`;
    if (isAssign) {
        if (val === true) {
            cls += ' checked';
            tip = `واجب ${index+1}: تم الحل والتسليم ✅`;
        } else if (typeof val === 'string' && val) {
            cls += ' deduction';
            tip = `واجب ${index+1}: لم يحل الواجب (خصم) ❌`;
        } else {
            tip = `واجب ${index+1}: لم نصل إليه بعد ⚪`;
        }
    } else {
        if (val === true)                        { cls += ' checked';   tip = `إيجابية ${index+1}`; }
        else if (typeof val === 'string' && val) { cls += ' deduction'; tip = `خصم: ${val}`; }
    }
    return { cls, tip };
}

// Render dynamic number of dots for a table cell (participation & assignments support 3 states, others are true/false)
function renderTableDots(studentId, category, states, maxVal) {
    let html = '<div class="table-checkbox-group">';
    const isAssign = (category === 'assignments' || category === 'cat_assignments');
    for (let i = 0; i < maxVal; i++) {
        const val = Array.isArray(states) ? states[i] : (i < (parseInt(states) || 0));
        const { cls, tip } = getDotVisual(val, isAssign, i);
        html += `<span id="dot-${studentId}-${category}-${i}" class="${cls}" onclick="toggleDot('${studentId}','${category}',${i})" title="${tip}"></span>`;
    }
    html += '</div>';
    return html;
}

// Live-update a single grading dot's visual by id, without touching the rest
// of the row/table. Works from any code path that knows studentId/category/
// index (a direct click, or a value finalized later e.g. via the deduction
// reason modal).
function updateDotElement(studentId, category, index, val, isAssign) {
    const dotEl = document.getElementById(`dot-${studentId}-${category}-${index}`);
    if (!dotEl) return;
    const { cls, tip } = getDotVisual(val, isAssign, index);
    dotEl.className = cls;
    dotEl.title = tip;
}

// Update just one student's total/status cells after a grade edit, without
// rebuilding the whole table (renderTable() rebuilds every row for every
// student, which is expensive and unnecessary for a single-cell change).
function refreshStudentRowTotals(studentId) {
    const student = getActiveStudents().find(s => s.id === studentId);
    if (!student) return;
    const newTotal  = getStudentTotal(student);
    const newStatus = getStudentStatus(newTotal);

    const totalCell = document.getElementById(`total-${studentId}`);
    if (totalCell) {
        totalCell.textContent = newTotal;
        totalCell.style.color = newTotal >= 50 ? 'var(--accent-teal)' : 'var(--danger-color)';
    }
    const badgeCell = document.getElementById(`badge-${studentId}`);
    if (badgeCell) badgeCell.innerHTML = buildStatusBadge(newStatus);
}

// After a grade edit: refresh the affected row and the dashboard stats
// cheaply. Only falls back to a full table re-render when a status filter is
// active, since a status change could otherwise leave the filtered list stale.
function refreshAfterGradeEdit(studentId) {
    refreshStudentRowTotals(studentId);
    if (statusFilter && statusFilter.value && statusFilter.value !== 'all') {
        filterAndRenderTable();
    } else {
        refreshDashboardStats();
    }
}

window.toggleDot = function(studentId, category, index) {
    const student = getActiveStudents().find(s => s.id === studentId);
    if (!student) return;

    const gradesObj = getStudentSubjectGrades(student);
    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const catObj = categories.find(c => c.id === category || c.key === category);
    const isParticipation = (category === 'participation' || category === 'cat_participation' || (catObj && catObj.type === 'participation'));
    const isAssignments = (category === 'assignments' || category === 'cat_assignments' || (catObj && (catObj.id === 'cat_assignments' || catObj.name === 'الواجبات')));
    const catKey = (catObj ? catObj.id : category);

    const applyDotVisual = (val) => updateDotElement(studentId, category, index, val, isAssignments);

    // 1. ASSIGNMENTS: 3-state cycle (Empty ⚪ -> Green ✅ -> Red ❌ -> Empty ⚪)
    if (isAssignments) {
        const maxVal = catObj ? catObj.max : 10;
        if (!Array.isArray(gradesObj[catKey])) {
            const n = parseInt(gradesObj[catKey]) || 0;
            gradesObj[catKey] = Array(maxVal).fill(false).map((_, i) => i < n);
        }
        if (!Array.isArray(gradesObj.assignments)) {
            gradesObj.assignments = gradesObj[catKey];
        } else {
            gradesObj[catKey] = gradesObj.assignments;
        }

        const val = gradesObj[catKey][index];
        if (!val || val === false) {
            // Empty ⚪ → Green ✅ (تم الحل)
            gradesObj[catKey][index] = true;
            gradesObj.assignments[index] = true;
        } else if (val === true) {
            // Green ✅ → Red ❌ (لم يحل الواجب)
            gradesObj[catKey][index] = 'لم يحل الواجب';
            gradesObj.assignments[index] = 'لم يحل الواجب';
        } else {
            // Red ❌ → Empty ⚪ (لم نصل إليه بعد)
            gradesObj[catKey][index] = false;
            gradesObj.assignments[index] = false;
        }
        applyDotVisual(gradesObj[catKey][index]);
        saveData();
        refreshAfterGradeEdit(studentId);
        return;
    }

    // 2. PARTICIPATION: 3-state cycle (Empty → Positive → Deduction reason modal → Empty)
    if (isParticipation) {
        const maxVal = catObj ? (catObj.dotsCount || catObj.max) : 10;
        if (!Array.isArray(gradesObj[catKey])) {
            const n = parseInt(gradesObj[catKey]) || 0;
            gradesObj[catKey] = Array(maxVal).fill(false).map((_, i) => i < n);
        }

        if (!Array.isArray(gradesObj.participation)) {
            gradesObj.participation = gradesObj[catKey];
        } else {
            gradesObj[catKey] = gradesObj.participation;
        }

        const val = gradesObj[catKey][index];
        if (!val || val === false) {
            // Empty → Positive (Green dot)
            gradesObj[catKey][index] = true;
            gradesObj.participation[index] = true;
            applyDotVisual(true);
            saveData();
            refreshAfterGradeEdit(studentId);
        } else if (val === true) {
            // Positive → open reason modal for red dot (المخالفات السلوكية)
            pendingReason = { studentId, index, context: 'table', catKey };
            openReasonModal();
        } else {
            // Deduction (reason string / red dot) → Empty
            gradesObj[catKey][index] = false;
            gradesObj.participation[index] = false;
            applyDotVisual(false);
            saveData();
            refreshAfterGradeEdit(studentId);
        }
        return;
    }

    // 3. OTHER CATEGORIES: Standard 2-state toggle
    const maxVal = catObj ? (catObj.dotsCount || catObj.max) : 10;
    if (!Array.isArray(gradesObj[catKey])) {
        const n = parseInt(gradesObj[catKey]) || 0;
        gradesObj[catKey] = Array(maxVal).fill(false).map((_, i) => i < n);
    }
    gradesObj[catKey][index] = !gradesObj[catKey][index];
    applyDotVisual(gradesObj[catKey][index]);
    saveData();
    refreshAfterGradeEdit(studentId);
};

// ============================================================
// INLINE TABLE GRADE EDITING (PRACTICAL & EXAM)
// ============================================================
window.updateTableGrade = function(studentId, field, inputEl, max) {
    const student = getActiveStudents().find(s => s.id === studentId);
    if (!student) return;
    let val = parseFloat(inputEl.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > max) val = max;
    inputEl.value  = val;

    const gradesObj = getStudentSubjectGrades(student);
    gradesObj[field] = val;
    saveData();

    refreshAfterGradeEdit(studentId);
    showNotification(`تم حفظ درجة "${field === 'practical' ? 'العملي' : 'الاختبار'}".`);
};

// ============================================================
// EDIT / DELETE
// ============================================================
window.editStudent = function(id) {
    const s = getActiveStudents().find(s => s.id === id);
    if (s) openModal(s);
};

window.deleteStudent = function(id) {
    const s = getActiveStudents().find(s => s.id === id);
    if (!s) return;
    if (!confirm(`هل أنت متأكد من حذف الطالب "${s.name}"؟`)) return;
    const cls = getActiveClass();
    cls.students = cls.students.filter(x => x.id !== id);
    saveData();
    showNotification(`تم حذف "${s.name}".`, 'warning');
    updateDashboard();
};

function renderSubjectsDropdown() {
    const select = document.getElementById('subjectFilter');
    if (!select) return;
    select.innerHTML = '';
    if (!subjects || subjects.length === 0) return;
    subjects.forEach(subj => {
        const opt = document.createElement('option');
        opt.value = subj.id;
        opt.textContent = subj.name;
        if (subj.id === activeSubjectId) opt.selected = true;
        select.appendChild(opt);
    });
}

// ============================================================
// DASHBOARD
// ============================================================
// Recomputes the aggregate stat tiles (average/pass rate/top score/chart)
// only, without touching the subjects UI, title, or the students table.
// Used on the hot grading path so a single dot/cell edit doesn't force a
// full table rebuild (see refreshAfterGradeEdit above).
function refreshDashboardStats() {
    const students = getActiveStudents();
    const count    = students.length;
    totalStudentsEl.textContent = count;

    if (count === 0) {
        classAverageEl.textContent = '0%';
        passRateEl.textContent     = '0%';
        topStudentScoreEl.textContent = '0';
        updateChart(0, 0, 0);
        return;
    }

    let sum = 0, passCount = 0, excellentCount = 0, maxScore = 0;
    students.forEach(s => {
        const score = getStudentTotal(s);
        sum += score;
        if (score >= 50) passCount++;
        if (score >= 90) excellentCount++;
        if (score > maxScore) maxScore = score;
    });

    const totalDistSum = getActiveSubjectGradingCategories(activeSubjectId)
        .reduce((sum, cat) => sum + (cat.max || 0), 0) || 100;
    classAverageEl.textContent    = `${(sum / count).toFixed(1)}%`;
    passRateEl.textContent        = `${((passCount / count) * 100).toFixed(0)}%`;
    topStudentScoreEl.textContent = `${maxScore}/${totalDistSum}`;

    const excEl = document.getElementById('excellentStudentsCount');
    const passEl = document.getElementById('passStudentsCount');
    const failEl = document.getElementById('failStudentsCount');
    if (excEl) excEl.textContent = `${excellentCount} طلاب`;
    if (passEl) passEl.textContent = `${passCount - excellentCount} طلاب`;
    if (failEl) failEl.textContent = `${count - passCount} طلاب`;

    updateChart(excellentCount, passCount - excellentCount, count - passCount);
}

function updateDashboard() {
    renderSubjectsDropdown();
    renderSubjectsTabs();
    filterAndRenderTable();

    const activeCls = getActiveClass();
    const titleEl = document.getElementById('currentClassNameDisplay');
    if (titleEl) {
        titleEl.innerHTML = activeCls
            ? `<i class="fa-solid fa-graduation-cap" style="color: var(--accent-teal);"></i> الفصل: <span style="color: var(--accent-teal); font-weight: 800;">${activeCls.name}</span>`
            : `<i class="fa-solid fa-graduation-cap" style="color: var(--accent-teal);"></i> الفصل: <span style="color: var(--text-muted);">لا يوجد فصل</span>`;
    }

    const teacherEl = document.getElementById('sidebarTeacherName');
    const schoolEl = document.getElementById('sidebarSchoolName');
    if (teacherEl && portfolioSettings && portfolioSettings.teacherName) {
        teacherEl.textContent = portfolioSettings.teacherName;
    }
    if (schoolEl && portfolioSettings && portfolioSettings.schoolName) {
        schoolEl.textContent = portfolioSettings.schoolName;
    }

    refreshDashboardStats();
}

window.highlightTopStudents = function() {
    const students = getActiveStudents();
    if (!students || students.length === 0) {
        showNotification('لا يوجد طلاب في هذا الفصل حالياً.', 'warning');
        return;
    }

    let maxScore = -1;
    students.forEach(s => {
        const score = getStudentTotal(s);
        if (score > maxScore) maxScore = score;
    });

    if (maxScore < 0) return;

    const topStudents = students.filter(s => getStudentTotal(s) === maxScore);

    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    filterAndRenderTable();

    let firstRow = null;
    const rows = document.querySelectorAll('.student-row');
    topStudents.forEach(student => {
        rows.forEach(r => {
            if (r.innerHTML.includes(student.name)) {
                r.classList.add('highlight-top-student');
                if (!firstRow) firstRow = r;
                setTimeout(() => {
                    r.classList.remove('highlight-top-student');
                }, 4500);
            }
        });
    });

    if (firstRow) {
        firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

function drawNativeDoughnutChart(canvas, excellent, pass, fail) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement ? canvas.parentElement.clientWidth || 320 : 320;
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const total = excellent + pass + fail;
    const centerX = width / 2;
    const centerY = (height - 45) / 2;
    const outerRadius = Math.min(centerX, centerY) - 20;
    const innerRadius = outerRadius * 0.60;

    if (total === 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
        return;
    }

    const slices = [
        { label: 'متميز', value: excellent, color: '#10b981' },
        { label: 'ناجح',  value: pass,      color: '#f59e0b' },
        { label: 'متعثر', value: fail,      color: '#ef4444' }
    ];

    let startAngle = -Math.PI / 2;
    slices.forEach(slice => {
        if (slice.value <= 0) return;
        const sliceAngle = (slice.value / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();

        startAngle = endAngle;
    });

    // Draw total in center
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px Tajawal, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${total} طالب`, centerX, centerY);

    // Draw Legend below
    const legendY = height - 20;
    const legendSpacing = (width - 40) / 3;

    slices.forEach((slice, idx) => {
        const lx = 35 + idx * legendSpacing;
        const pct = Math.round((slice.value / total) * 100);

        ctx.fillStyle = slice.color;
        ctx.beginPath();
        ctx.arc(lx, legendY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 12px Tajawal, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${slice.label} (${pct}%)`, lx + 70, legendY + 4);
    });
}

function updateChart(excellent, pass, fail) {
    try {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        if (typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');
            if (performanceChartInstance) {
                try { performanceChartInstance.destroy(); } catch(e) {}
            }
            performanceChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['متميز (>= 90)', 'ناجح (50-89)', 'متعثر (< 50)'],
                    datasets: [{
                        data: [excellent, pass, fail],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderColor: '#1e1b4b', borderWidth: 2, hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: window.devicePixelRatio || 2,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#f8fafc', font: { family: 'Tajawal', size: 12, weight: 'bold' }, padding: 15 } },
                        tooltip: { titleFont: { family: 'Tajawal' }, bodyFont: { family: 'Tajawal' } }
                    },
                    cutout: '65%'
                }
            });
            return;
        }

        drawNativeDoughnutChart(canvas, excellent, pass, fail);
    } catch (err) {
        console.warn('Native chart fallback activated:', err);
        const canvas = document.getElementById('performanceChart');
        if (canvas) drawNativeDoughnutChart(canvas, excellent, pass, fail);
    }
}

// ============================================================
// CSV EXPORT
// ============================================================
// Export current active class only (Header button)
window.exportCurrentClassToCSV = function() {
    const students = getActiveStudents();
    if (students.length === 0) { showNotification('لا توجد بيانات طلاب في هذا الفصل!', 'error'); return; }
    const cls = getActiveClass();
    const activeSubjName = subjects.find(s=>s.id===activeSubjectId)?.name || 'مادة عامة';
    const categories = getActiveSubjectGradingCategories(activeSubjectId).filter(cat => cat.max > 0);
    let csv = `فصل: ${cls.name}\nالمادة: ${activeSubjName}\n`;
    csv += `اسم الطالب,${categories.map(cat => `${cat.name} (${cat.max})`).join(',')},المجموع,التقدير\n`;
    students.forEach(s => {
        const total  = getStudentTotal(s, activeSubjectId, cls);
        const status = total >= 90 ? 'ممتاز' : total >= 50 ? 'ناجح' : 'متعثر';
        const catScores = categories.map(cat => getCategoryEarnedScore(s, cat, activeSubjectId, cls));
        csv += `"${s.name}",${catScores.join(',')},${total},"${status}"\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${cls.name}_${activeSubjName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showNotification(`تم تصدير كشف فصل "${cls.name}" بنجاح.`, 'success');
};

// Export ALL classes data (Sidebar button)
window.exportAllClassesToCSV = function() {
    if (!classes || classes.length === 0) { showNotification('لا توجد فصول دراسية لتصديرها!', 'error'); return; }
    
    let csv = `متابعة أداء الطلاب - تقرير كافة الفصول والدرجات\nتاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}\n\n`;

    classes.forEach((cls, idx) => {
        csv += `==================================================\n`;
        csv += `فصل: ${cls.name} (إجمالي الطلاب: ${cls.students ? cls.students.length : 0})\n`;
        csv += `==================================================\n`;
        
        subjects.forEach(subj => {
            const categories = getActiveSubjectGradingCategories(subj.id).filter(cat => cat.max > 0);
            csv += `المادة الدراسية: ${subj.name}\n`;
            csv += `اسم الطالب,${categories.map(cat => `${cat.name} (${cat.max})`).join(',')},المجموع,التقدير\n`;
            if (cls.students && cls.students.length > 0) {
                cls.students.forEach(s => {
                    const total = getStudentTotal(s, subj.id, cls);
                    const status = total >= 90 ? 'ممتاز' : total >= 50 ? 'ناجح' : 'متعثر';
                    const catScores = categories.map(cat => getCategoryEarnedScore(s, cat, subj.id, cls));
                    csv += `"${s.name}",${catScores.join(',')},${total},"${status}"\n`;
                });
            } else {
                csv += 'لا يوجد طلاب في هذا الفصل\n';
            }
            csv += '\n';
        });
        csv += '\n\n';
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `كافة_الفصول_والدرجات_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showNotification('تم تصدير سجلات جميع الفصول بنجاح.', 'success');
};

// ============================================================
// BULK GRADE MODAL LOGIC
// ============================================================
const bulkGradeModal = document.getElementById('bulkGradeModal');
const bulkGradeCategory = document.getElementById('bulkGradeCategory');
const bulkCheckboxSection = document.getElementById('bulkCheckboxSection');
const bulkCheckboxesContainer = document.getElementById('bulkCheckboxesContainer');
const bulkParticipationSection = document.getElementById('bulkParticipationSection');
const bulkParticipationContainer = document.getElementById('bulkParticipationContainer');
const bulkNumberSection = document.getElementById('bulkNumberSection');
const bulkNumberLabel = document.getElementById('bulkNumberLabel');
const bulkNumberValue = document.getElementById('bulkNumberValue');
const bulkNumberInfo = document.getElementById('bulkNumberInfo');

let bulkParticipationState = [];

function renderBulkCategoryOptions() {
    const select = document.getElementById('bulkGradeCategory');
    if (!select) return;
    select.innerHTML = '';

    const categories = getActiveSubjectGradingCategories(activeSubjectId);

    categories.forEach(cat => {
        if (cat.max > 0) {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = `${cat.name} (من ${cat.max})`;
            select.appendChild(opt);
        }
    });

    if (select.options.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'لا توجد مجالات متاحة للرصد';
        select.appendChild(opt);
    }
}

function openBulkGradeModal() {
    if (getActiveStudents().length === 0) {
        showNotification('لا يوجد طلاب في هذا الفصل لرصدهم جماعياً!', 'error');
        return;
    }
    const activeSubj = subjects ? subjects.find(s => s.id === activeSubjectId) : null;
    const modalTitle = document.querySelector('#bulkGradeModal h3');
    if (modalTitle && activeSubj) {
        modalTitle.innerHTML = `<i class="fa-solid fa-layer-group" style="color:var(--accent-teal);"></i> رصد جماعي لمادة: <span style="color:var(--accent-teal);">${activeSubj.name}</span>`;
    }
    
    renderBulkCategoryOptions();

    bulkGradeModal.classList.add('active');
    onBulkCategoryChange();
}

function closeBulkGradeModal() {
    bulkGradeModal.classList.remove('active');
}

window.onBulkCategoryChange = function() {
    const selectedId = bulkGradeCategory ? bulkGradeCategory.value : '';
    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const cat = categories.find(c => c.id === selectedId || c.key === selectedId);
    
    // Hide all
    bulkCheckboxSection.style.display = 'none';
    bulkParticipationSection.style.display = 'none';
    bulkNumberSection.style.display = 'none';

    if (!cat || cat.max === 0) return;

    if (cat.type === 'dots') {
        bulkCheckboxSection.style.display = 'block';
        bulkCheckboxesContainer.innerHTML = '';
        const dotsCount = cat.dotsCount || cat.max;
        for (let i = 1; i <= dotsCount; i++) {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="bulk_cb_${i}" value="${i}">
                <label for="bulk_cb_${i}">${i}</label>
            `;
            bulkCheckboxesContainer.appendChild(div);
        }
    } else if (cat.type === 'participation') {
        bulkParticipationSection.style.display = 'block';
        const dotsCount = cat.dotsCount || cat.max;
        bulkParticipationState = Array(dotsCount).fill(false);
        renderBulkParticipationDots(dotsCount);
    } else if (cat.type === 'numeric') {
        bulkNumberSection.style.display = 'block';
        bulkNumberLabel.textContent = `الدرجة المُراد رصدها لـ (${cat.name}) من ${cat.max}:`;
        bulkNumberValue.max = cat.max;
        bulkNumberValue.value = 0;
        bulkNumberInfo.textContent = `الحد الأقصى: ${cat.max} درجة لـ ${cat.name}.`;
    }
};

function renderBulkParticipationDots(limit = 10) {
    if (!bulkParticipationContainer) return;
    bulkParticipationContainer.innerHTML = '';
    if (limit === 0) {
        bulkParticipationContainer.innerHTML = '<span style="font-size:0.88rem;color:var(--text-muted);font-style:italic;padding:0.5rem 0;display:block;">لا توجد درجات مشاركة مخصصة لهذه المادة</span>';
        return;
    }
    for (let i = 0; i < limit; i++) {
        const dot = document.createElement('span');
        dot.className = 'participation-form-dot';
        dot.id = `bulk_p_${i}`;
        dot.textContent = i + 1;
        dot.title = `النقطة ${i + 1}`;
        dot.onclick = () => toggleBulkParticipation(i);
        bulkParticipationContainer.appendChild(dot);
    }
    syncBulkParticipationUI();
}

function syncBulkParticipationUI() {
    const selectedId = bulkGradeCategory ? bulkGradeCategory.value : '';
    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const cat = categories.find(c => c.id === selectedId || c.key === selectedId);
    const limit = cat ? (cat.dotsCount || cat.max) : 10;

    for (let i = 0; i < limit; i++) {
        const dot = document.getElementById(`bulk_p_${i}`);
        if (!dot) continue;
        const val = bulkParticipationState[i];
        dot.className = 'participation-form-dot';
        if (val === true) {
            dot.classList.add('positive');
            dot.title = `النقطة ${i+1}: إيجابية (+1)`;
        } else if (typeof val === 'string' && val) {
            dot.classList.add('deduction');
            dot.title = `النقطة ${i+1}: خصم — ${val}`;
        } else {
            dot.title = `النقطة ${i+1}: غير محددة`;
        }
    }
}

window.toggleBulkParticipation = function(index) {
    const val = bulkParticipationState[index];
    if (!val || val === false) {
        bulkParticipationState[index] = true;
    } else if (val === true) {
        pendingReason = { studentId: null, index, context: 'bulk' };
        openReasonModal();
    } else {
        bulkParticipationState[index] = false;
    }
    syncBulkParticipationUI();
};

window.applyBulkGrade = function() {
    const selectedId = bulkGradeCategory ? bulkGradeCategory.value : '';
    const studentsList = getActiveStudents();

    if (studentsList.length === 0 || !selectedId) return;

    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const cat = categories.find(c => c.id === selectedId || c.key === selectedId);
    if (!cat) return;

    if (!confirm(`هل أنت متأكد من تطبيق الرصد الجماعي لبند "${cat.name}" على جميع طلاب هذا الفصل؟ سيؤدي ذلك لمسح الدرجات القديمة في هذه الخانة.`)) {
        return;
    }

    if (cat.type === 'dots') {
        const states = [];
        const dotsCount = cat.dotsCount || cat.max;
        for (let i = 1; i <= dotsCount; i++) {
            const cb = document.getElementById(`bulk_cb_${i}`);
            states.push(cb ? cb.checked : false);
        }
        studentsList.forEach(s => {
            const gradesObj = getStudentSubjectGrades(s);
            gradesObj[cat.id] = [...states];
        });
    } else if (cat.type === 'participation') {
        studentsList.forEach(s => {
            const gradesObj = getStudentSubjectGrades(s);
            gradesObj[cat.id] = [...bulkParticipationState];
        });
    } else if (cat.type === 'numeric') {
        let val = parseFloat(bulkNumberValue.value) || 0;
        if (val < 0) val = 0;
        if (val > cat.max) val = cat.max;
        studentsList.forEach(s => {
            const gradesObj = getStudentSubjectGrades(s);
            gradesObj[cat.id] = val;
        });
    }

    saveData();
    updateDashboard();
    closeBulkGradeModal();
    showNotification(`تم تطبيق الرصد الجماعي بنجاح لبند "${cat.name}" لجميع طلاب الفصل.`, 'success');
};

// ============================================================
// IMPORT FROM NOOR LOGIC
// ============================================================
const importNoorModal = document.getElementById('importNoorModal');
const noorPasteArea = document.getElementById('noorPasteArea');
const noorFileInput = document.getElementById('noorFileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const importPreviewSection = document.getElementById('importPreviewSection');
const previewListContainer = document.getElementById('previewListContainer');
const previewCountEl = document.getElementById('previewCount');
const saveImportNoorBtn = document.getElementById('saveImportNoorBtn');
const parseNoorBtn = document.getElementById('parseNoorBtn');

let importMethod = 'paste';
let parsedNoorStudents = [];

function openImportNoorModal() {
    noorPasteArea.value = '';
    noorFileInput.value = '';
    fileNameDisplay.textContent = '';
    importPreviewSection.style.display = 'none';
    saveImportNoorBtn.style.display = 'none';
    parseNoorBtn.style.display = 'inline-block';
    parsedNoorStudents = [];
    switchImportMethod('paste');
    importNoorModal.classList.add('active');
}

function closeImportNoorModal() {
    importNoorModal.classList.remove('active');
}

window.switchImportMethod = function(method) {
    importMethod = method;
    document.getElementById('importTabPaste').classList.toggle('active', method === 'paste');
    document.getElementById('importTabFile').classList.toggle('active', method === 'file');
    document.getElementById('importPasteSection').style.display = method === 'paste' ? 'block' : 'none';
    document.getElementById('importFileSection').style.display = method === 'file' ? 'block' : 'none';
};

window.handleNoorFileSelect = function(event) {
    const file = event.target.files[0];
    if (file) {
        fileNameDisplay.textContent = `الملف المختار: ${file.name}`;
    }
};

window.selectAllPreview = function(checked) {
    const checkboxes = previewListContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = checked);
};

window.processNoorData = function() {
    if (importMethod === 'paste') {
        const text = noorPasteArea.value;
        if (!text.trim()) {
            showNotification('الرجاء لصق بعض البيانات أولاً!', 'error');
            return;
        }
        extractNamesFromText(text);
    } else {
        const file = noorFileInput.files[0];
        if (!file) {
            showNotification('الرجاء اختيار ملف Excel أو CSV أولاً!', 'error');
            return;
        }

        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            if (typeof XLSX !== 'undefined') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        let fullText = '';
                        workbook.SheetNames.forEach(sheetName => {
                            const worksheet = workbook.Sheets[sheetName];
                            const csvText = XLSX.utils.sheet_to_csv(worksheet);
                            fullText += csvText + '\n';
                        });
                        extractNamesFromText(fullText);
                    } catch (err) {
                        showNotification('حدث خطأ في قراءة ملف Excel، يرجى حفظ الملف وتجربة صيغة CSV.', 'error');
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                showNotification('مكتبة قراءة Excel جاري إعدادها، يرجى المحاولة بعد ثوانٍ.', 'info');
            }
        } else {
            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;
                extractNamesFromText(content);
            };
            reader.readAsText(file, 'utf-8');
        }
    }
};

function extractNamesFromText(text) {
    const lines = text.split('\n');
    const namesSet = new Set();
    const arabicWordPattern = /[\u0621-\u064A]+/g;

    lines.forEach(line => {
        const cleanLine = line.replace(/[0-9a-zA-Z]/g, ' ');
        const parts = cleanLine.split(/\t/);
        parts.forEach(part => {
            const cleanPart = part.trim();
            const partWords = cleanPart.match(arabicWordPattern) || [];
            if (partWords.length >= 3 && partWords.length <= 6) {
                const headerWords = ['وزارة', 'التعليم', 'جدول', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'اسم', 'الطالب', 'رصد', 'درجات', 'الدرجة', 'رقم', 'الفصل', 'مادة', 'الكلية', 'السجل', 'المدني', 'حالة'];
                const hasHeaderWord = partWords.some(w => headerWords.includes(w));
                if (!hasHeaderWord) {
                    namesSet.add(partWords.join(' '));
                }
            }
        });

        if (parts.length <= 1) {
            const lineWords = line.trim().match(arabicWordPattern) || [];
            const headerWords = ['وزارة', 'التعليم', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'الطالب', 'الفصل', 'اسم'];
            const hasHeaderWord = lineWords.some(w => headerWords.includes(w));
            if (!hasHeaderWord && lineWords.length >= 3 && lineWords.length <= 6) {
                namesSet.add(lineWords.join(' '));
            }
        }
    });

    displayPreview(Array.from(namesSet));
}

function extractNamesFromCSV(content) {
    const lines = content.split(/\r?\n/);
    const namesSet = new Set();

    if (lines.length === 0) {
        showNotification('الملف فارغ!', 'error');
        return;
    }

    let nameColIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const cols = lines[i].split(',');
        for (let j = 0; j < cols.length; j++) {
            const clean = cols[j].replace(/["']/g, '').trim();
            if (clean.includes('اسم الطالب') || clean.includes('الاسم') || clean.includes('الطالب')) {
                nameColIndex = j;
                break;
            }
        }
        if (nameColIndex !== -1) break;
    }

    if (nameColIndex === -1) {
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const cols = lines[i].split(';');
            for (let j = 0; j < cols.length; j++) {
                const clean = cols[j].replace(/["']/g, '').trim();
                if (clean.includes('اسم الطالب') || clean.includes('الاسم') || clean.includes('الطالب')) {
                    nameColIndex = j;
                    break;
                }
            }
            if (nameColIndex !== -1) {
                parseCSVWithDelimiter(lines, ';', nameColIndex, namesSet);
                displayPreview(Array.from(namesSet));
                return;
            }
        }
    }

    if (nameColIndex === -1) {
        lines.forEach(line => {
            const cols = line.split(/[;,]/);
            cols.forEach(col => {
                const clean = col.replace(/["']/g, '').trim();
                const words = clean.match(/[\u0621-\u064A]+/g) || [];
                if (words.length >= 3 && words.length <= 6) {
                    const headerWords = ['وزارة', 'التعليم', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'الطالب', 'اسم'];
                    if (!words.some(w => headerWords.includes(w))) {
                        namesSet.add(words.join(' '));
                    }
                }
            });
        });
    } else {
        parseCSVWithDelimiter(lines, ',', nameColIndex, namesSet);
    }

    displayPreview(Array.from(namesSet));
}

function parseCSVWithDelimiter(lines, delimiter, colIndex, namesSet) {
    lines.forEach(line => {
        const cols = line.split(delimiter);
        if (cols.length > colIndex) {
            const name = cols[colIndex].replace(/["']/g, '').trim();
            const words = name.match(/[\u0621-\u064A]+/g) || [];
            if (words.length >= 2) {
                const headerWords = ['وزارة', 'التعليم', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'الطالب', 'اسم'];
                if (!words.some(w => headerWords.includes(w))) {
                    namesSet.add(name);
                }
            }
        }
    });
}

function displayPreview(names) {
    if (names.length === 0) {
        showNotification('لم يتم العثور على أي أسماء طلاب صالحة. تأكد من صحة النص/الملف.', 'error');
        return;
    }
    parsedNoorStudents = names;
    previewListContainer.innerHTML = '';
    
    names.forEach((name, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <input type="checkbox" id="preview_student_${index}" value="${name}" checked>
            <label for="preview_student_${index}" title="${name}">${name}</label>
        `;
        previewListContainer.appendChild(div);
    });

    previewCountEl.textContent = names.length;
    importPreviewSection.style.display = 'block';
    saveImportNoorBtn.style.display = 'inline-block';
    parseNoorBtn.style.display = 'none';
}

window.saveImportedNoorStudents = function() {
    const selectedCheckboxes = previewListContainer.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        showNotification('الرجاء اختيار طالب واحد على الأقل للاستيراد!', 'error');
        return;
    }

    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('الرجاء اختيار فصل نشط أولاً!', 'error');
        return;
    }

    let addedCount = 0;
    selectedCheckboxes.forEach(cb => {
        const name = cb.value;
        const exists = activeClass.students.some(s => s.name === name);
        if (!exists) {
            const newStudent = {
                id: 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                name: name,
                grades: {}
            };
            // Leave grades empty here; getStudentSubjectGrades() lazily
            // initializes them sized to the subject's actual grading
            // categories the first time they're read, instead of a fixed
            // legacy shape that may not match a customized subject.
            activeClass.students.push(newStudent);
            addedCount++;
        }
    });

    saveData();
    updateDashboard();
    closeImportNoorModal();
    showNotification(`تم استيراد ${addedCount} طالب بنجاح إلى "${activeClass.name}".`, 'success');
};

// ============================================================
// IMPORT FROM MADRASATI LOGIC
// ============================================================
const madrasatiImportModal = document.getElementById('madrasatiImportModal');
const madrasatiPasteArea = document.getElementById('madrasatiPasteArea');
const madrasatiAssignIndex = document.getElementById('madrasatiAssignIndex');
const madrasatiImportForm = document.getElementById('madrasatiImportForm');

// Smart Assignment Index Calculator (Finds first slot completely unassigned across the class)
window.getNextUnassignedAssignmentIndex = function(activeClass, subjectId = activeSubjectId) {
    if (!activeClass || !Array.isArray(activeClass.students) || activeClass.students.length === 0) return 0;
    const categories = getActiveSubjectGradingCategories(subjectId);
    const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
    const maxAssignmentsCount = cat ? cat.max : 10;
    
    for (let i = 0; i < maxAssignmentsCount; i++) {
        // Check if ANY student in this active class has a recorded grade in slot i (green true or red string)
        const isOccupied = activeClass.students.some(s => {
            const grades = getStudentSubjectGrades(s, subjectId);
            const assignArr = grades ? (grades.assignments || grades['cat_assignments']) : null;
            if (!Array.isArray(assignArr)) return false;
            const val = assignArr[i];
            return val === true || (typeof val === 'string' && val.trim() !== '');
        });
        
        if (!isOccupied) {
            // First completely unassigned assignment slot for all students in the class
            return i;
        }
    }
    return Math.max(0, maxAssignmentsCount - 1);
};

window.openMadrasatiAssignmentModal = function() {
    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('الرجاء اختيار فصل أولاً لرصد الواجبات له!', 'error');
        return;
    }

    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
    const maxVal = cat ? cat.max : 10;

    const nextSlot = getNextUnassignedAssignmentIndex(activeClass, activeSubjectId);

    if (madrasatiAssignIndex) {
        madrasatiAssignIndex.innerHTML = '';
        for (let i = 0; i < maxVal; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `واجب ${i + 1}${i === nextSlot ? ' ⭐ (الواجب التالي تلقائياً)' : ''}`;
            madrasatiAssignIndex.appendChild(opt);
        }
        madrasatiAssignIndex.value = nextSlot;
    }

    if (madrasatiPasteArea) madrasatiPasteArea.value = '';
    if (madrasatiImportModal) madrasatiImportModal.classList.add('active');
};

function openMadrasatiImportModal() {
    openMadrasatiAssignmentModal();
}

function closeMadrasatiImportModal() {
    if (madrasatiImportModal) madrasatiImportModal.classList.remove('active');
}

// Smart Name Matcher for Arabic names
function matchStudentArabicName(importName, students) {
    const cleanName = (n) => n.trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
    const importClean = cleanName(importName);
    
    // 1. Exact match
    let match = students.find(s => cleanName(s.name) === importClean);
    if (match) return match;
    
    // 2. Substring match (e.g. import name contains student name or vice versa)
    match = students.find(s => {
        const sClean = cleanName(s.name);
        return sClean.includes(importClean) || importClean.includes(sClean);
    });
    if (match) return match;
    
    // 3. Part match (at least 3 parts must match)
    const importParts = importClean.split(' ').filter(p => p.length > 2);
    if (importParts.length >= 3) {
        match = students.find(s => {
            const sClean = cleanName(s.name);
            let matchesCount = 0;
            importParts.forEach(part => {
                if (sClean.includes(part)) matchesCount++;
            });
            return matchesCount >= 3;
        });
    }
    return match;
}

// Form submit handler
if (madrasatiImportForm) {
    madrasatiImportForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const activeClass = getActiveClass();
        if (!activeClass) return;
        
        const pasteVal = madrasatiPasteArea.value.trim();
        if (!pasteVal) return;
        
        let importedData = [];
        try {
            importedData = JSON.parse(pasteVal);
        } catch(err) {
            // Fallback: parse line-by-line text
            const lines = pasteVal.split('\n');
            lines.forEach(line => {
                if (!line.trim()) return;
                let solved = false;
                if (line.includes('تم الحل') || line.includes('محلول') || line.includes('تمت الإجابة') || line.includes('مكتمل') || line.includes('تسليم')) {
                    solved = true;
                }
                
                let cleanLine = line.replace(/تم الحل|لم يتم الحل|محلول|غير محلول|تمت الإجابة|مكتمل|غير مكتمل/g, '').trim();
                if (cleanLine.length > 4) {
                    importedData.push({ name: cleanLine, solved: solved });
                }
            });
        }
        
        if (!Array.isArray(importedData) || importedData.length === 0) {
            showNotification('لم يتم العثور على بيانات طلاب صالحة للاستيراد!', 'error');
            return;
        }
        
        const assignIdx = (madrasatiAssignIndex && madrasatiAssignIndex.value !== '')
            ? parseInt(madrasatiAssignIndex.value)
            : getNextUnassignedAssignmentIndex(activeClass, activeSubjectId);

        window.importMadrasatiGradesList(importedData, assignIdx);
        closeMadrasatiImportModal();
    });
}

// AUTOMATED PULL FROM MADRASATI
window.triggerAutoMadrasatiSync = function() {
    showNotification('جاري الاتصال التلقائي بمنصة مدرستي... سيتم فتح صفحة الواجبات، وسحب الواجب، ورصده تلقائياً بالكامل في ثوانٍ!', 'info');
    window.open("https://schools.madrasati.sa/Teacher/Assignments/Index?autosync=true", "_blank");
};

window.importMadrasatiGradesList = function(importedData, explicitAssignIdx = null) {
    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('لا يوجد فصل نشط لاستيراد الواجبات إليه!', 'error');
        return;
    }

    if (!Array.isArray(importedData) || importedData.length === 0) {
        showNotification('لم يتم العثور على بيانات صالحة للاستيراد!', 'error');
        return;
    }

    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
    const maxVal = cat ? cat.max : 10;

    // Automatically determine the assignment slot if not explicitly provided
    const assignIdx = (explicitAssignIdx !== null && explicitAssignIdx !== undefined && !isNaN(explicitAssignIdx))
        ? explicitAssignIdx
        : getNextUnassignedAssignmentIndex(activeClass, activeSubjectId);

    let solvedCount = 0;
    let unsolvedCount = 0;
    let matchedCount = 0;

    importedData.forEach(item => {
        if (!item.name) return;
        const student = matchStudentArabicName(item.name, activeClass.students);
        if (student) {
            const gradesObj = getStudentSubjectGrades(student);
            if (gradesObj) {
                if (!Array.isArray(gradesObj.assignments)) {
                    gradesObj.assignments = Array(maxVal).fill(false);
                }
                if (!Array.isArray(gradesObj['cat_assignments'])) {
                    gradesObj['cat_assignments'] = gradesObj.assignments;
                }

                if (item.solved === true) {
                    // Solved -> Green dot ✅
                    gradesObj.assignments[assignIdx] = true;
                    gradesObj['cat_assignments'][assignIdx] = true;
                    solvedCount++;
                } else {
                    // Unsolved -> Red dot ❌
                    gradesObj.assignments[assignIdx] = 'لم يحل الواجب';
                    gradesObj['cat_assignments'][assignIdx] = 'لم يحل الواجب';
                    unsolvedCount++;
                }
                matchedCount++;
            }
        }
    });

    saveData();
    updateDashboard();
    showNotification(`✅ تم رصد (واجب ${assignIdx + 1}) تلقائياً من منصة مدرستي: ${solvedCount} تم الحل، و ${unsolvedCount} مقصرين.`, 'success');
};

// Listen to automated grades broadcast event from extension
window.addEventListener('MadrasatiGradesImported', (e) => {
    console.log('[Student Tracker App] Automated grades received from extension:', e.detail);
    window.importMadrasatiGradesList(e.detail);
});

// ============================================================
// WEEKLY WHATSAPP REPORT LOGIC & SETTINGS
// ============================================================
// Pre-load the report template image in memory so it's loaded synchronously when sending reports
const reportTemplateImg = new Image();
reportTemplateImg.src = window.templateBase64 || 'template_blank.png';

// Synchronous base64 to Blob helper
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
          bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    let i = n;
    while(i--){
        u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], {type:mime});
}

let generatedCanvasDataUrl = null;

const whatsappSettingsModal = document.getElementById('whatsappSettingsModal');
const whatsappSettingsForm = document.getElementById('whatsappSettingsForm');
const whatsappNumberInput = document.getElementById('whatsappNumberInput');
const lastReportDateDisplay = document.getElementById('lastReportDateDisplay');

window.checkWeeklyReportStatus = function() {
    const banner = document.getElementById('weeklyReportBanner');
    if (!banner) return;
    
    if (!lastReportDate) {
        // Initialize timer if not set, but don't show alert immediately
        lastReportDate = Date.now();
        saveData();
    }
    
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - lastReportDate;
    if (diff >= oneWeekMs) {
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
};

window.dismissWeeklyBanner = function() {
    const banner = document.getElementById('weeklyReportBanner');
    if (banner) banner.style.display = 'none';
};

const pdfReportModal = document.getElementById('pdfReportModal');
const pdfGenerationStatus = document.getElementById('pdfGenerationStatus');

window.closePdfReportModal = closePdfReportModal;
function closePdfReportModal() {
    pdfReportModal.classList.remove('active');
}

window.sendWeeklyReport = function() {
    if (!classes || classes.length === 0) {
        showNotification('لا توجد أي فصول لإرسال التقرير عنها!', 'error');
        return;
    }

    // Gather violating/deficient students per class, across ALL classes.
    // Classes with no violations and no missed homework are left out of the
    // report entirely (kept short and focused on students who need follow-up).
    const classReports = classes.map(cls => {
        const violatingStudents = (cls.students || []).filter(student => {
            const gradesObj = getStudentSubjectGrades(student);
            if (!Array.isArray(gradesObj.participation)) return false;
            return gradesObj.participation.some(p => typeof p === 'string' && p.trim() !== '');
        });

        const totalGivenAssignments = getActiveAssignmentsCount(cls, activeSubjectId);
        let deficientStudents = [];
        if (totalGivenAssignments > 0) {
            deficientStudents = (cls.students || []).filter(student => {
                const gradesObj = getStudentSubjectGrades(student);
                const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : [];
                if (!Array.isArray(assignArr)) return true;
                for (let i = 0; i < totalGivenAssignments; i++) {
                    if (assignArr[i] !== true) return true; // Missed at least one given assignment
                }
                return false;
            });
        }

        return { cls, violatingStudents, deficientStudents, totalGivenAssignments };
    }).filter(r => r.violatingStudents.length > 0 || r.deficientStudents.length > 0);

    if (classReports.length === 0) {
        showNotification('الحمد لله، لا توجد مخالفات سلوكية أو واجبات مقصر فيها في أي فصل!', 'success');
        // Reset timer as the check was completed
        lastReportDate = Date.now();
        saveData();
        checkWeeklyReportStatus();
        return;
    }

    const pdfReportModal = document.getElementById('pdfReportModal');
    const pdfReportPreviewImage = document.getElementById('pdfReportPreviewImage');
    const pdfGenerationStatus = document.getElementById('pdfGenerationStatus');

    pdfReportModal.classList.add('active');
    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> جاري رسم وإعداد كشف التقرير على النموذج الرسمي...`;

    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'مادة عامة';
    const reportDateStr = new Date().toLocaleDateString('ar-SA');

    // Build dynamic WhatsApp message text as requested
    const messageText = `التقرير الأسبوعي لجميع الفصول \nالمادة : ${activeSubjName} \nالتاريخ : ${reportDateStr}`;

    const drawAndSend = () => {
        const reportArea = document.getElementById('printableReportArea');
        if (!reportArea) return;

        let classSectionsHtml = '';
        classReports.forEach(({ cls, violatingStudents, deficientStudents, totalGivenAssignments }) => {
            let tableRowsHtml = '';
            violatingStudents.forEach((student, index) => {
                const gradesObj = getStudentSubjectGrades(student);
                const violations = Array.isArray(gradesObj.participation) ? gradesObj.participation.filter(p => typeof p === 'string' && p.trim() !== '') : [];
                const count = violations.length;
                const details = violations.join('، ');

                tableRowsHtml += `
                <tr style="border: 1px solid #cbd5e1;">
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${index + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 700;">${student.name}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: #ef4444; font-weight: 800;">${count}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-size: 0.75rem; color: #475569;">${details}</td>
                </tr>`;
            });

            if (violatingStudents.length === 0) {
                tableRowsHtml = `
                <tr>
                    <td colspan="4" style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #10b981; font-weight: bold; background: #f0fdf4;">
                        الحمد لله، لا توجد أي مخالفات سلوكية مرصودة هذا الأسبوع.
                    </td>
                </tr>`;
            }

            let hwRowsHtml = '';
            deficientStudents.forEach((student, index) => {
                const gradesObj = getStudentSubjectGrades(student);
                const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : [];
                const missedIndices = [];
                for (let i = 0; i < totalGivenAssignments; i++) {
                    if (!assignArr || assignArr[i] !== true) {
                        missedIndices.push(`واجب ${i + 1}`);
                    }
                }
                const missedCount = missedIndices.length;
                const details = missedIndices.join('، ');

                hwRowsHtml += `
                <tr style="border: 1px solid #cbd5e1;">
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${index + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 700;">${student.name}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: #ef4444; font-weight: 800;">${missedCount}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-size: 0.75rem; color: #475569;">${details}</td>
                </tr>`;
            });

            if (deficientStudents.length === 0) {
                hwRowsHtml = `
                <tr>
                    <td colspan="4" style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #10b981; font-weight: bold; background: #f0fdf4;">
                        الحمد لله، جميع طلاب الفصل ملتزمون بحل كافة الواجبات المطلوبة.
                    </td>
                </tr>`;
            }

            classSectionsHtml += `
            <div style="text-align: center; margin: 22px 0 12px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 6px;">
                <span style="font-size: 1rem; font-weight: 800; color: #312e81;">الفصل: ${cls.name}</span>
            </div>

            <div style="font-size: 0.85rem; font-weight: 800; color: #ef4444; border-right: 3px solid #ef4444; padding-right: 8px; margin-bottom: 8px; text-align: right;">
                أولاً: كشف رصد الطلاب المخالفين سلوكياً (النقاط الحمراء):
            </div>

            <table class="port-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.8rem; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 8%;">م</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 42%;">اسم الطالب</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 15%;">النقاط الحمراء</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 35%;">أسباب الخصم والمخالفات</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>

            <div style="font-size: 0.85rem; font-weight: 800; color: #ef4444; border-right: 3px solid #ef4444; padding-right: 8px; margin-bottom: 8px; text-align: right;">
                ثانياً: كشف رصد الطلاب المقصرين في حل الواجبات (لم يحلوا الواجب):
            </div>

            <table class="port-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.8rem; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background: #fdf2f2;">
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 8%;">م</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 42%;">اسم الطالب</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 15%;">الواجبات الفائتة</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 35%;">تفاصيل أرقام الواجبات</th>
                    </tr>
                </thead>
                <tbody>
                    ${hwRowsHtml}
                </tbody>
            </table>`;
        });

        reportArea.innerHTML = `
            <table style="width:100%; border-collapse:collapse; margin-bottom:1.25rem; border:none; line-height: 1.2;">
                <tr>
                    <td style="text-align:right; font-size:0.75rem; line-height:1.4; color:#334155; border:none; padding:0; font-weight:bold;">
                        المملكة العربية السعودية<br>
                        وزارة التعليم<br>
                        الإدارة العامة للتعليم بالقصيم<br>
                        مدرسة: ${portfolioSettings.schoolName || '..........'}
                    </td>
                </tr>
            </table>

            <div style="text-align: center; margin-bottom: 1.25rem; border-bottom: 2px solid #0f172a; padding-bottom: 5px;">
                <span style="font-size: 1.15rem; font-weight: 800; color: #1e1b4b; background: #f8fafc; padding: 4px 15px; border: 1.5px solid #0f172a; border-radius: 20px;">
                    نموذج تقرير المتابعة الأسبوعي الموحد لجميع الفصول (المخالفات والواجبات)
                </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    التاريخ: ${reportDateStr}
                </div>
            </div>

            ${classSectionsHtml}

            <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 15px; font-size: 0.8rem; line-height: 1.5; text-align: right;">
                <strong>توصيات المعلم للتسوية الأكاديمية والسلوكية:</strong><br>
                • المتابعة الأسبوعية من أولياء الأمور لتعديل سلوك الطلاب وحثهم على تسليم الواجبات.<br>
                • تنسيق التدخل التربوي السلوكي والتعليمي مع إدارة المدرسة والتوجه الطلابي.
            </div>

            <div style="display: flex; justify-content: flex-start; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 0.85rem; color: #1e293b;">
                <div style="text-align: right; line-height: 1.6;">
                    <span style="font-weight: 700;">معد التقرير / أ. ${portfolioSettings.teacherName || '....................'}</span>
                </div>
            </div>
        `;

        setTimeout(async () => {
            const fileName = `التقرير_الأسبوعي_جميع_الفصول.pdf`;

            try {
                pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> جاري إنشاء ملف الـ PDF عبر المحرك الاحترافي وإرساله للواتساب...`;

                const res = await fetch(getApiUrl('/api/generate-pdf'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        html: reportArea.innerHTML,
                        filename: fileName,
                        landscape: false
                    })
                });

                if (!res.ok) throw new Error(`HTTP error ${res.status}`);

                const pdfBlob = await res.blob();

                // Convert blob to base64
                const reader = new FileReader();
                reader.readAsDataURL(pdfBlob);
                reader.onloadend = async () => {
                    const pdfBase64 = reader.result;

                    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#25d366;"></i> تم إنشاء ملف الـ PDF بنجاح وجاري الإرسال عبر الواتساب...`;

                    const sent = await sendWhatsAppDirectOrWeb(whatsappNumber, messageText, pdfBase64, fileName);
                    if (sent) {
                        setTimeout(() => {
                            closePdfReportModal();
                        }, 1500);
                    }
                };
            } catch (err) {
                console.warn('[WhatsApp PDF Sender] Server PDF failed, falling back to image:', err);
                // Fallback to canvas image
                html2canvas(reportArea, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    windowWidth: 800
                }).then(async (canvas) => {
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    generatedCanvasDataUrl = imgData;
                    pdfReportPreviewImage.src = generatedCanvasDataUrl;
                    pdfReportPreviewImage.style.display = 'block';

                    const imgFileName = `التقرير_الأسبوعي_جميع_الفصول.jpg`;
                    const sent = await sendWhatsAppDirectOrWeb(whatsappNumber, messageText, imgData, imgFileName);
                    if (sent) {
                        setTimeout(() => {
                            closePdfReportModal();
                        }, 1500);
                    }
                }).catch(e => {
                    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> فشل توليد التقرير: ${e.message}`;
                });
            }
        }, 100);
    };

    drawAndSend();
};

window.triggerWeeklyPdfExport = function() {
    const area = document.getElementById('printableReportArea');
    if (!area || !area.innerHTML.trim()) {
        showNotification('لا توجد بيانات تقرير صالحة للتصدير!', 'error');
        return;
    }
    const filename = `التقرير_الأسبوعي_جميع_الفصول_${new Date().toISOString().slice(0,10)}.pdf`;
    window.generateAndDownloadPdf(area, filename, false);
};

window.triggerPdfDownload = triggerPdfDownload;
function triggerPdfDownload() {
    if (!generatedCanvasDataUrl) {
        showNotification('لا توجد صورة تقرير صالحة للتحميل!', 'error');
        return;
    }

    const pdfGenerationStatus = document.getElementById('pdfGenerationStatus');
    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> جاري تنزيل صورة التقرير...`;

    const link = document.createElement('a');
    link.download = `التقرير_الأسبوعي_جميع_الفصول_${new Date().toISOString().slice(0,10)}.png`;
    link.href = generatedCanvasDataUrl;
    link.click();
    
    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#25d366;"></i> تم تحميل صورة التقرير بنجاح!`;
    
    lastReportDate = Date.now();
    saveData();
    checkWeeklyReportStatus();
    
    setTimeout(() => {
        closePdfReportModal();
        showNotification('تم تحميل صورة التقرير بدقة عالية بنجاح!', 'success');
    }, 1200);
}

window.openWhatsappSettingsModal = openWhatsappSettingsModal;
function openWhatsappSettingsModal() {
    whatsappNumberInput.value = whatsappNumber;
    if (lastReportDate) {
        lastReportDateDisplay.textContent = new Date(lastReportDate).toLocaleString('ar-SA');
    } else {
        lastReportDateDisplay.textContent = 'لم يتم الإرسال بعد';
    }
    whatsappSettingsModal.classList.add('active');
}

window.closeWhatsappSettingsModal = closeWhatsappSettingsModal;
function closeWhatsappSettingsModal() {
    whatsappSettingsModal.classList.remove('active');
}

window.handleWhatsappSettingsSubmit = handleWhatsappSettingsSubmit;
function handleWhatsappSettingsSubmit(e) {
    e.preventDefault();
    let num = whatsappNumberInput.value.trim();
    // Clean number (remove +, leading zeros, spaces)
    num = num.replace(/[\s\+\-]/g, '');
    if (/^\d+$/.test(num)) {
        whatsappNumber = num;
        saveData();
        closeWhatsappSettingsModal();
        showNotification('تم حفظ رقم الواتساب بنجاح.');
    } else {
        showNotification('الرجاء إدخال رقم هاتف صحيح (أرقام فقط)!', 'error');
    }
}

window.resetReportTimer = resetReportTimer;
function resetReportTimer() {
    // Set lastReportDate to 8 days ago so it triggers the alert banner immediately
    lastReportDate = Date.now() - (8 * 24 * 60 * 60 * 1000);
    saveData();
    checkWeeklyReportStatus();
    lastReportDateDisplay.textContent = new Date(lastReportDate).toLocaleString('ar-SA') + ' (تم تصفير الموعد لتفعيل التنبيه)';
    showNotification('تم تصفير وقت التنبيه، سيظهر شريط التنبيه الآن.');
}

// ============================================================
// TEACHER PORTFOLIO GENERATOR LOGIC
// ============================================================
// Event Listeners for Portfolio (Safely null-checked)
const portfolioBtnEl = document.getElementById('portfolioBtn') || document.getElementById('sidebarPortfolioBtn');
if (portfolioBtnEl) portfolioBtnEl.addEventListener('click', openPortfolioModal);

const closePortfolioModalBtnEl = document.getElementById('closePortfolioModalBtn');
if (closePortfolioModalBtnEl) closePortfolioModalBtnEl.addEventListener('click', closePortfolioModal);

const cancelPortfolioModalBtnEl = document.getElementById('cancelPortfolioModalBtn');
if (cancelPortfolioModalBtnEl) cancelPortfolioModalBtnEl.addEventListener('click', closePortfolioModal);

const exportPortfolioPdfBtnEl = document.getElementById('exportPortfolioPdfBtn');
if (exportPortfolioPdfBtnEl) exportPortfolioPdfBtnEl.addEventListener('click', exportPortfolioPdf);

if (portfolioModal) {
    portfolioModal.addEventListener('click', e => {
        if (e.target === portfolioModal) closePortfolioModal();
    });
}

// Dynamic Form Builder State & Helper Functions
let builderFields = [];

window.switchPortTab = function(tabId) {
    document.getElementById('tabContentBasic').style.display = tabId === 'basic' ? 'block' : 'none';
    document.getElementById('tabContentStandard').style.display = tabId === 'standard' ? 'block' : 'none';
    document.getElementById('tabContentBuilder').style.display = tabId === 'builder' ? 'block' : 'none';

    document.getElementById('btnTabBasic').classList.toggle('active', tabId === 'basic');
    document.getElementById('btnTabStandard').classList.toggle('active', tabId === 'standard');
    document.getElementById('btnTabBuilder').classList.toggle('active', tabId === 'builder');
};

window.addBuilderField = function(type) {
    let defaultHeaders = '';
    if (type === 'table') {
        defaultHeaders = 'البيان, التفاصيل, الأثر والنتيجة';
    }
    builderFields.push({
        type: type,
        label: type === 'table' ? 'جدول المتابعة' : (type === 'image' ? 'شاهد مصور' : 'عنوان الحقل'),
        value: '',
        fileName: '',
        headersCsv: defaultHeaders
    });
    renderBuilderUI();
};

window.removeBuilderField = function(idx) {
    builderFields.splice(idx, 1);
    renderBuilderUI();
};

window.updateFieldLabel = function(idx, val) {
    builderFields[idx].label = val;
};

window.updateFieldValue = function(idx, val) {
    builderFields[idx].value = val;
};

window.updateFieldHeaders = function(idx, val) {
    builderFields[idx].headersCsv = val;
};

window.handleBuilderFileSelect = function(idx, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert('يرجى اختيار صورة أو ملف PDF فقط.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        builderFields[idx].value = e.target.result;
        builderFields[idx].fileName = file.name;
        renderBuilderUI();
    };
    reader.readAsDataURL(file);
};

window.clearBuilderFile = function(idx) {
    builderFields[idx].value = '';
    builderFields[idx].fileName = '';
    renderBuilderUI();
};

window.renderBuilderUI = function() {
    const container = document.getElementById('builderFieldsContainer');
    container.innerHTML = '';
    
    builderFields.forEach((field, idx) => {
        const div = document.createElement('div');
        div.className = 'builder-field-item';
        
        let typeLabel = field.type === 'text' ? 'نص قصير' : (field.type === 'textarea' ? 'نص طويل' : (field.type === 'image' ? 'شاهد مصور' : 'جدول مخصص'));
        let extraInputs = '';
        
        if (field.type === 'text' || field.type === 'textarea') {
            extraInputs = `
            <input type="text" class="form-control" style="font-size:0.8rem; padding: 0.35rem 0.5rem; margin-top:0.25rem;" 
                   placeholder="القيمة الافتراضية أو النص..." value="${field.value}" 
                   oninput="updateFieldValue(${idx}, this.value)">`;
        } else if (field.type === 'table') {
            extraInputs = `
            <input type="text" class="form-control" style="font-size:0.8rem; padding: 0.35rem 0.5rem; margin-top:0.25rem;" 
                   placeholder="عناوين الأعمدة (مفصولة بفاصلة)..." value="${field.headersCsv}" 
                   oninput="updateFieldHeaders(${idx}, this.value)">`;
        } else if (field.type === 'image') {
            let filePreviewHtml = '';
            if (field.value) {
                const isPdf = field.value.startsWith('data:application/pdf');
                const previewTag = isPdf
                    ? `<i class="fa-solid fa-file-pdf" style="font-size: 1.6rem; color: #ef4444; margin-left: 0.25rem;"></i>`
                    : `<img src="${field.value}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 2px;">`;
                
                filePreviewHtml = `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 4px; overflow: hidden;">
                    ${previewTag}
                    <span style="font-size: 0.7rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${field.fileName || 'ملف الشاهد'}</span>
                    <button type="button" class="btn btn-secondary" onclick="clearBuilderFile(${idx})" style="padding: 2px 6px; font-size: 0.65rem; background: var(--accent-red); color: white; border: none; border-radius: 3px;">حذف</button>
                </div>`;
            } else {
                filePreviewHtml = `
                <div style="margin-top: 0.25rem;">
                    <input type="file" id="builder_file_${idx}" accept="image/*,application/pdf" style="display: none;" onchange="handleBuilderFileSelect(${idx}, this)">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('builder_file_${idx}').click()" style="width: 100%; font-size: 0.75rem; padding: 0.4rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: rgba(255, 255, 255, 0.05); border: 1px dashed var(--surface-border); border-radius: 6px; color: var(--text-muted); cursor: pointer; transition: all 0.2s;">
                        <i class="fa-solid fa-paperclip" style="color: var(--accent-teal);"></i> إرفاق صورة أو مستند PDF
                    </button>
                </div>`;
            }
            extraInputs = filePreviewHtml;
        }
        
        div.innerHTML = `
            <button type="button" class="btn-remove-field" onclick="removeBuilderField(${idx})">&times;</button>
            <div style="font-size:0.75rem; color:var(--accent-teal); font-weight:bold;">${typeLabel}</div>
            <input type="text" class="form-control" style="font-size:0.8rem; padding: 0.35rem 0.5rem;" 
                   placeholder="عنوان الحقل (مثل: الهدف)..." value="${field.label}" 
                   oninput="updateFieldLabel(${idx}, this.value)">
            ${extraInputs}
        `;
        container.appendChild(div);
    });
    
    // Render saved custom forms list
    const listContainer = document.getElementById('addedCustomFormsList');
    listContainer.innerHTML = '';
    
    portfolioSettings.customForms = portfolioSettings.customForms || [];
    if (portfolioSettings.customForms.length === 0) {
        listContainer.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">لا توجد نماذج مخصصة مضافة بعد.</div>';
    } else {
        portfolioSettings.customForms.forEach((form, idx) => {
            const div = document.createElement('div');
            div.className = 'builder-custom-form-item';
            
            let itemNumStr = form.itemNumber ? `${form.itemNumber}: ` : '';
            div.innerHTML = `
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">${itemNumStr}${form.title}</span>
                <button type="button" class="btn btn-secondary" onclick="deleteCustomForm(${idx})" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; background: var(--accent-red); color: white; border: none; border-radius: 4px;">حذف</button>
            `;
            listContainer.appendChild(div);
        });
    }
};

window.saveCustomForm = function() {
    const title = document.getElementById('builderFormTitle').value.trim();
    const itemNum = document.getElementById('builderItemNum').value.trim();
    const targetGroup = document.getElementById('builderTargetGroup').value.trim();
    
    if (!title) {
        alert('يرجى كتابة عنوان للنموذج أولاً.');
        return;
    }
    
    portfolioSettings.customForms = portfolioSettings.customForms || [];
    portfolioSettings.customForms.push({
        title: title,
        itemNumber: itemNum,
        targetGroup: targetGroup,
        fields: [...builderFields]
    });
    
    saveData();
    
    // Clear form builder state
    document.getElementById('builderFormTitle').value = '';
    document.getElementById('builderItemNum').value = '';
    document.getElementById('builderTargetGroup').value = '';
    builderFields = [];
    
    renderBuilderUI();
    renderPortfolioPreview();
};

window.deleteCustomForm = function(idx) {
    if (confirm('هل أنت متأكد من حذف هذا النموذج المخصص؟')) {
        portfolioSettings.customForms.splice(idx, 1);
        saveData();
        renderBuilderUI();
        renderPortfolioPreview();
    }
};

window.renderStandardFilesUI = function() {
    const fileConfigs = [
        { key: 'visitsImage', containerId: 'visitsImagePreviewContainer', label: 'شاهد مصور للزيارة' },
        { key: 'strategyImage', containerId: 'strategyImagePreviewContainer', label: 'شاهد مصور للاستراتيجية' },
        { key: 'classroomEnvImage', containerId: 'classroomEnvImagePreviewContainer', label: 'شاهد مصور للبيئة الصفية' }
    ];
    
    fileConfigs.forEach(cfg => {
        const container = document.getElementById(cfg.containerId);
        if (!container) return;
        
        container.innerHTML = '';
        const val = portfolioSettings[cfg.key];
        const name = portfolioSettings[cfg.key + 'Name'] || 'صورة الشاهد';
        
        if (val) {
            const isPdf = val.startsWith('data:application/pdf');
            const previewTag = isPdf
                ? `<i class="fa-solid fa-file-pdf" style="font-size: 1.6rem; color: #ef4444; margin-left: 0.25rem;"></i>`
                : `<img src="${val}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 2px;">`;

            container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 4px; overflow: hidden; margin-top: 0.25rem;">
                ${previewTag}
                <span style="font-size: 0.7rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${name}</span>
                <button type="button" class="btn btn-secondary" onclick="clearStandardFile('${cfg.key}')" style="padding: 2px 6px; font-size: 0.65rem; background: var(--accent-red); color: white; border: none; border-radius: 3px;">حذف</button>
            </div>`;
        } else {
            container.innerHTML = `
            <div style="margin-top: 0.25rem;">
                <input type="file" id="standard_file_${cfg.key}" accept="image/*,application/pdf" style="display: none;" onchange="handleStandardFileSelect('${cfg.key}', this)">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('standard_file_${cfg.key}').click()" style="width: 100%; font-size: 0.75rem; padding: 0.4rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: rgba(255, 255, 255, 0.05); border: 1px dashed var(--surface-border); border-radius: 6px; color: var(--text-muted); cursor: pointer; transition: all 0.2s;">
                    <i class="fa-solid fa-paperclip" style="color: var(--accent-teal);"></i> إرفاق صورة أو مستند PDF
                </button>
            </div>`;
        }
    });
};

window.handleStandardFileSelect = function(itemKey, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert('يرجى اختيار صورة أو ملف PDF فقط.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        portfolioSettings[itemKey] = e.target.result;
        portfolioSettings[itemKey + 'Name'] = file.name;
        saveData();
        renderStandardFilesUI();
        renderPortfolioPreview();
    };
    reader.readAsDataURL(file);
};

window.clearStandardFile = function(itemKey) {
    portfolioSettings[itemKey] = '';
    portfolioSettings[itemKey + 'Name'] = '';
    saveData();
    renderStandardFilesUI();
    renderPortfolioPreview();
};

window.openPortfolioModal = openPortfolioModal;
function openPortfolioModal() {
    // Populate form with current settings
    document.getElementById('portTeacherName').value = portfolioSettings.teacherName || '';
    document.getElementById('portJobTitle').value = portfolioSettings.jobTitle || '';
    document.getElementById('portJobNum').value = portfolioSettings.jobNum || '';
    document.getElementById('portSpecialization').value = portfolioSettings.specialization || '';
    document.getElementById('portSchool').value = portfolioSettings.schoolName || '';
    document.getElementById('portYear').value = portfolioSettings.schoolYear || '';
    document.getElementById('portVision').value = portfolioSettings.vision || '';
    document.getElementById('portMission').value = portfolioSettings.mission || '';
    document.getElementById('portPhilosophy').value = portfolioSettings.philosophy || '';
    document.getElementById('portVisitsRecord').value = portfolioSettings.visitsRecord || '';
    document.getElementById('portStrategyReport').value = portfolioSettings.strategyReport || '';
    document.getElementById('portClassroomEnv').value = portfolioSettings.classroomEnv || '';

    switchPortTab('basic');
    renderBuilderUI();
    renderStandardFilesUI();

    portfolioModal.classList.add('active');
    renderPortfolioPreview();
}

window.closePortfolioModal = closePortfolioModal;
function closePortfolioModal() {
    // Save settings upon closing to avoid spamming server during typing
    saveData();
    portfolioModal.classList.remove('active');
}

window.renderPortfolioPreview = renderPortfolioPreview;
function renderPortfolioPreview() {
    // Update local state from inputs
    portfolioSettings.teacherName = document.getElementById('portTeacherName').value;
    portfolioSettings.jobTitle = document.getElementById('portJobTitle').value;
    portfolioSettings.jobNum = document.getElementById('portJobNum').value;
    portfolioSettings.specialization = document.getElementById('portSpecialization').value;
    portfolioSettings.schoolName = document.getElementById('portSchool').value;
    portfolioSettings.schoolYear = document.getElementById('portYear').value;
    portfolioSettings.vision = document.getElementById('portVision').value;
    portfolioSettings.mission = document.getElementById('portMission').value;
    portfolioSettings.philosophy = document.getElementById('portPhilosophy').value;
    portfolioSettings.visitsRecord = document.getElementById('portVisitsRecord').value;
    portfolioSettings.strategyReport = document.getElementById('portStrategyReport').value;
    portfolioSettings.classroomEnv = document.getElementById('portClassroomEnv').value;

    const showCover = document.getElementById('pageCover').checked;
    const showCV = document.getElementById('pageCV').checked;
    const showDuties = document.getElementById('itemDuties').checked;
    const showCommunity = document.getElementById('itemCommunity').checked;
    const showParents = document.getElementById('itemParents').checked;
    const showStrategies = document.getElementById('itemStrategies').checked;
    const showImprovement = document.getElementById('itemImprovement').checked;
    const showPlan = document.getElementById('itemPlan').checked;
    const showTech = document.getElementById('itemTech').checked;
    const showEnv = document.getElementById('itemEnv').checked;
    const showClassroom = document.getElementById('itemClassroom').checked;
    const showAnalysis = document.getElementById('itemAnalysis').checked;
    const showEvaluation = document.getElementById('itemEvaluation').checked;

    const container = document.getElementById('portfolioPagesContainer');
    container.innerHTML = '';

    let pageNum = 1;
    const activeClass = getActiveClass() || { name: 'لم يحدد', students: [] };
    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'لم يحدد';

    const createOfficialFormPage = (formTitle, contentHtml, metadataHtml) => {
        const headerTable = `
        <table class="port-header-table" style="width:100%; border-collapse:collapse; margin-bottom:1rem; border:none; line-height: 1.2;">
            <tr>
                <td style="text-align:right; font-size:0.75rem; line-height:1.4; color:#334155; border:none; padding:0; font-weight:bold;">
                    المملكة العربية السعودية<br>
                    وزارة التعليم<br>
                    الإدارة العامة للتعليم بالقصيم<br>
                    مدرسة: ${portfolioSettings.schoolName || '..........'}
                </td>
            </tr>
        </table>`;

        // Draw a thick horizontal border line to separate the header
        const formTitleHeader = `
        <div style="text-align: center; margin-bottom: 1rem; border-bottom: 2px solid #0f172a; padding-bottom: 5px;">
            <span style="font-size: 1.15rem; font-weight: 800; color: #1e1b4b; background: #f8fafc; padding: 4px 15px; border: 1.5px solid #0f172a; border-radius: 20px;">
                ${formTitle}
            </span>
        </div>`;

        const footerSignatures = `
        <div style="display: flex; justify-content: space-between; margin-top: auto; border-top: 1px dashed var(--accent-teal); padding-top: 10px; font-size: 0.8rem; color: #1e293b;">
            <div style="width: 45%; text-align: center; line-height: 1.6;">
                <span style="font-weight: 700; display: block; margin-bottom: 20px;">معد النموذج / ${portfolioSettings.teacherName || '....................'}</span>
                <div style="border-top: 1px solid #cbd5e1; width: 80%; margin: 0 auto; color: #64748b; font-size: 0.7rem; padding-top: 2px;">التوقيع</div>
            </div>
            <div style="width: 45%; text-align: center; line-height: 1.6;">
                <span style="font-weight: 700; display: block; margin-bottom: 20px;">اعتماد قائد المدرسة / ....................................</span>
                <div style="border-top: 1px solid #cbd5e1; width: 80%; margin: 0 auto; color: #64748b; font-size: 0.7rem; padding-top: 2px;">التوقيع والختم الرسمي</div>
            </div>
        </div>`;

        const page = document.createElement('div');
        page.className = 'portfolio-page';
        page.style.display = 'flex';
        page.style.flexDirection = 'column';
        if (pageNum > 1) page.classList.add('html2pdf__page-break');
        
        page.innerHTML = `
            ${headerTable}
            ${formTitleHeader}
            ${metadataHtml}
            <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:flex-start;">
                ${contentHtml}
            </div>
            ${footerSignatures}
            <div class="port-footer" style="margin-top:10px; display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b; border-top:1px solid #e2e8f0; padding-top:5px;">
                <span>ملف الشواهد المهنية للأداء الوظيفي</span>
                <span>النموذج رقم (${pageNum++})</span>
            </div>
        `;
        return page;
    };

    // 1. Cover Page
    if (showCover) {
        const headerTable = `
        <table class="port-header-table" style="width:100%; border-collapse:collapse; margin-bottom:1rem; border:none; line-height: 1.2;">
            <tr>
                <td style="text-align:right; font-size:0.75rem; line-height:1.4; color:#334155; border:none; padding:0; font-weight:bold;">
                    المملكة العربية السعودية<br>
                    وزارة التعليم<br>
                    الإدارة العامة للتعليم بالقصيم<br>
                    مدرسة: ${portfolioSettings.schoolName || '..........'}
                </td>
            </tr>
        </table>`;

        const page = document.createElement('div');
        page.className = 'portfolio-page';
        page.innerHTML = `
            ${headerTable}
            <div class="port-title-section" style="margin-top: 4rem;">
                <h1>ملف الشواهد المهنية</h1>
                <h2>لعناصر تقييم الأداء الوظيفي للمعلم</h2>
                <div style="width: 120px; height: 4px; background: var(--accent-teal); margin: 1.5rem auto 0 auto; border-radius: 2px;"></div>
            </div>
            
            <div class="port-info-box" style="margin-top: 5rem;">
                <div class="port-info-row">
                    <span class="port-info-label">اسم المعلم:</span>
                    <span class="port-info-value" style="font-weight:700; font-size:1.1rem;">${portfolioSettings.teacherName || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">التخصص الدراسي:</span>
                    <span class="port-info-value">${portfolioSettings.specialization || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">المسمى الوظيفي:</span>
                    <span class="port-info-value">${portfolioSettings.jobTitle || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">الرقم الوظيفي:</span>
                    <span class="port-info-value">${portfolioSettings.jobNum || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">العام الدراسي:</span>
                    <span class="port-info-value">${portfolioSettings.schoolYear || '...................................'}</span>
                </div>
            </div>
            
            <div class="port-footer" style="margin-top:auto; display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b; border-top:1px solid #e2e8f0; padding-top:5px;">
                <span>ملف الشواهد المهنية للأداء الوظيفي</span>
                <span>الغلاف</span>
            </div>
        `;
        container.appendChild(page);
    }

    // 2. CV, Vision & Mission Page
    if (showCV) {
        const headerTable = `
        <table class="port-header-table" style="width:100%; border-collapse:collapse; margin-bottom:1rem; border:none; line-height: 1.2;">
            <tr>
                <td style="text-align:right; font-size:0.75rem; line-height:1.4; color:#334155; border:none; padding:0; font-weight:bold;">
                    المملكة العربية السعودية<br>
                    وزارة التعليم<br>
                    الإدارة العامة للتعليم بالقصيم<br>
                    مدرسة: ${portfolioSettings.schoolName || '..........'}
                </td>
            </tr>
        </table>`;

        const page = document.createElement('div');
        page.className = 'portfolio-page';
        if (pageNum > 1) page.classList.add('html2pdf__page-break');
        page.innerHTML = `
            ${headerTable}
            <div class="port-section-title" style="margin-bottom:1.5rem;">السيرة المهنية والتوجهات التربوية للمعلم</div>
            
            <div class="port-content-box">
                <table class="port-table" style="margin-top: 0.5rem; margin-bottom: 1.5rem; font-size:0.85rem;">
                    <tr>
                        <th style="width:30%; text-align:right;">الاسم الكامل</th>
                        <td style="text-align:right; font-weight:700;">${portfolioSettings.teacherName || '...................................'}</td>
                    </tr>
                    <tr>
                        <th style="text-align:right;">المسمى والدرجة</th>
                        <td style="text-align:right;">${portfolioSettings.jobTitle || '...................................'}</td>
                    </tr>
                    <tr>
                        <th style="text-align:right;">الرقم الوظيفي</th>
                        <td style="text-align:right;">${portfolioSettings.jobNum || '...................................'}</td>
                    </tr>
                    <tr>
                        <th style="text-align:right;">المدرسة الحالية</th>
                        <td style="text-align:right;">${portfolioSettings.schoolName || '...................................'}</td>
                    </tr>
                </table>

                <h3 style="color:#1e1b4b; font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;"><i class="fa-solid fa-eye" style="color:var(--accent-teal);"></i> رؤية المعلم:</h3>
                <div style="background:#f8fafc; border-right:4px solid var(--accent-teal); padding:0.85rem; margin:0.25rem 0 1rem 0; font-style:italic; font-size:0.9rem; color:#334155;">
                    ${portfolioSettings.vision ? portfolioSettings.vision.replace(/\n/g, '<br>') : 'لتأسيس جيل مبدع ومتمكن علمياً وتقنياً قادر على المنافسة محلياً ودولياً.'}
                </div>
                
                <h3 style="color:#1e1b4b; font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;"><i class="fa-solid fa-bullseye" style="color:var(--accent-teal);"></i> رسالة المعلم:</h3>
                <div style="background:#f8fafc; border-right:4px solid var(--accent-teal); padding:0.85rem; margin:0.25rem 0 1rem 0; font-style:italic; font-size:0.9rem; color:#334155;">
                    ${portfolioSettings.mission ? portfolioSettings.mission.replace(/\n/g, '<br>') : 'تقديم تعليم متميز يحفز التفكير الإبداعي ويوظف التقنيات الحديثة.'}
                </div>
                
                <h3 style="color:#1e1b4b; font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;"><i class="fa-solid fa-lightbulb" style="color:var(--accent-teal);"></i> الفلسفة التربوية:</h3>
                <div style="background:#f8fafc; border-right:4px solid var(--accent-teal); padding:0.85rem; margin:0.25rem 0 0 0; text-align:justify; font-size:0.9rem; line-height:1.6; color:#334155;">
                    ${portfolioSettings.philosophy ? portfolioSettings.philosophy.replace(/\n/g, '<br>') : 'أؤمن بأن التعليم رسالة سامية محورها الطالب، والتدريس الفعال هو الذي يراعي الفروق الفردية ويسعى لتمكين كل متعلم.'}
                </div>
            </div>
            
            <div class="port-footer" style="margin-top:auto; display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b; border-top:1px solid #e2e8f0; padding-top:5px;">
                <span>ملف الشواهد المهنية للأداء الوظيفي</span>
                <span>السيرة المهنية</span>
            </div>
        `;
        container.appendChild(page);
    }

    // Item 1: أداء الواجبات الوظيفية
    if (showDuties) {
        const content = `
            <div style="margin-top: 0.5rem;">
                <p style="font-size: 0.85rem; line-height: 1.5; color: #334155; margin-bottom: 1rem; text-align: justify;">
                    يوضح هذا الجدول التوزيع الزمني والمنهجي لموضوعات المقرر الدراسي المعتمد، موزعةً بشكل متزن لضمان تغطية كامل المخرجات التعليمية والمعايير الأدائية خلال الفصل الدراسي.
                </p>
                <table class="port-table" style="font-size:0.8rem; width:100%; border-collapse:collapse; border: 1px solid #cbd5e1;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="width:25%; border: 1px solid #cbd5e1; padding: 6px;">الفترة الزمنية</th>
                            <th style="width:50%; border: 1px solid #cbd5e1; padding: 6px;">الوحدات والموضوعات الأساسية للتقييم الدراسي</th>
                            <th style="width:25%; border: 1px solid #cbd5e1; padding: 6px;">وسيلة التحقق والأثر</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">الأسابيع الأولى</td><td style="padding: 6px; border: 1px solid #cbd5e1;">تهيئة وتأسيس الطلاب ورصد مستوياتهم القبلية</td><td style="padding: 6px; border: 1px solid #cbd5e1;">اختبار قبلي وملاحظة صفية</td></tr>
                        <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">منتصف الفصل</td><td style="padding: 6px; border: 1px solid #cbd5e1;">المفاهيم النظرية والتطبيقات العملية والمهام الأدائية للمقرر</td><td style="padding: 6px; border: 1px solid #cbd5e1;">أعمال الطلاب والواجبات الفترية</td></tr>
                        <tr><td style="padding: 6px; border: 1px solid #cbd5e1;">نهاية الفصل</td><td style="padding: 6px; border: 1px solid #cbd5e1;">تقييم المخرجات النهائية ومعالجة الفاقد التعليمي العام</td><td style="padding: 6px; border: 1px solid #cbd5e1;">الاختبار النهائي والتحليل الإحصائي</td></tr>
                    </tbody>
                </table>
            </div>`;
        
        const metaHtml = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المادة: ${activeSubjName}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                الصف / الفصل: ${activeClass.name}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                العام الدراسي: ${portfolioSettings.schoolYear || '1447هـ'}
            </div>
        </div>`;

        container.appendChild(createOfficialFormPage('البند 1: أداء الواجبات الوظيفية', content, metaHtml));
    }

    // Item 2: المجتمع المهني (تبادل الزيارات)
    if (showCommunity) {
        const visits = portfolioSettings.visitsRecord ? portfolioSettings.visitsRecord.split('\n') : [
            'زيارة الزميل أ. محمد الحربي لحضور درس تطبيقي في التعلم التعاوني - 1447/02/10هـ',
            'استضافة الزميل أ. خالد الغامدي لتبادل الخبرات في توظيف أدوات القياس الفتري - 1447/03/15هـ'
        ];
        
        visits.forEach(v => {
            if (!v.trim()) return;
            // Parse visit details dynamically
            let colleague = 'أ. محمد الحربي';
            let date = '1447/02/10هـ';
            let topic = 'التعلم التعاوني النشط';
            let type = 'زيارة زميل (حضور)';

            if (v.includes('خالد الغامدي')) {
                colleague = 'أ. خالد الغامدي';
                date = '1447/03/15هـ';
                topic = 'توظيف أدوات القياس الفتري';
                type = 'استضافة زميل (زيارة صفية)';
            } else {
                // Parse using regex
                const colMatch = v.match(/(?:الزميل\s+)?(?:أ\.\s+)?([\u0600-\u06FF\s]+?)(?=\s+لحضور|\s+لتبادل|\s+-|$)/);
                if (colMatch) colleague = colMatch[1].trim();

                const dateMatch = v.match(/(\d{4}\/\d{2}\/\d{2}هـ|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/);
                if (dateMatch) date = dateMatch[1];

                const topicMatch = v.match(/(?:في\s+)([\u0600-\u06FF\s]+?)(?=\s+-|$)/);
                if (topicMatch) topic = topicMatch[1].trim();

                if (v.includes('استضافة') || v.includes('زائر')) {
                    type = 'استضافة زميل (زيارة صفية)';
                }
            }

            const metaHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    نوع التبادل: ${type}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    تاريخ الزيارة: ${date}
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المعلم الزميل: ${colleague}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف/الفصل: ${activeClass.name}
                </div>
            </div>`;

            let imageHtml = '';
            if (portfolioSettings.visitsImage) {
                const isPdf = portfolioSettings.visitsImage.startsWith('data:application/pdf');
                if (isPdf) {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">مستند الشاهد المرفق (PDF):</strong>
                        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; text-align: right; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-file-pdf" style="font-size: 1.8rem; color: #ef4444;"></i>
                                <div>
                                    <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a;">${portfolioSettings.visitsImageName || 'document.pdf'}</span><br>
                                    <span style="font-size: 0.7rem; color: #64748b;">مستند مرفق</span>
                                </div>
                            </div>
                            <a href="${portfolioSettings.visitsImage}" target="_blank" style="padding: 4px 8px; background: #0f172a; color: white; border-radius: 4px; font-size: 0.7rem; text-decoration: none; font-weight: bold;">عرض المستند</a>
                        </div>
                        <object data="${portfolioSettings.visitsImage}" type="application/pdf" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;">
                            <p>يمكنك <a href="${portfolioSettings.visitsImage}" target="_blank">النقر هنا لعرض ملف الـ PDF المرفق</a>.</p>
                        </object>
                    </div>`;
                } else {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">شاهد مصور للزيارة الصفية المهنية:</strong>
                        <img src="${portfolioSettings.visitsImage}" style="max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 5px;">
                    </div>`;
                }
            }

            const content = `
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #334155; line-height: 1.6;">
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px;">
                        <strong>موضوع ومجال الدرس المزار:</strong><br>
                        ${topic}
                    </div>
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px;">
                        <strong>أبرز الملاحظات المهنية ونقاط القوة:</strong><br>
                        • تنظيم ممتاز للمجموعات داخل الصف والتعاون الإيجابي للطلاب.<br>
                        • تفعيل تقنيات عرض ووسائل رصد تفاعلية سريعة ومحفزة.<br>
                        • انضباط صفي متميز ومشاركة جماعية واسعة من الفئة المستهدفة.
                    </div>
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff;">
                        <strong>المرئيات والتوصيات للتطوير المشترك:</strong><br>
                        • التوسع في استضافة الزملاء لتبادل الخبرات وتوطين التدريب داخل المدرسة.<br>
                        • إدراج المزيد من الأنشطة التقنية التي تراعي الفروق الفردية بين المتعلمين.
                    </div>
                    ${imageHtml}
                </div>`;

            container.appendChild(createOfficialFormPage('البند 2: التفاعل مع المجتمع المهني', content, metaHtml));
        });
    }

    const targetClasses = (classes && classes.length > 0) ? classes : [activeClass || { name: 'لم يحدد', students: [] }];

    // Item 3: التفاعل مع أولياء الأمور
    if (showParents) {
        targetClasses.forEach(currentClass => {
            const content = `
                <div style="margin-top: 0.5rem;">
                    <p style="font-size: 0.85rem; line-height: 1.5; color: #334155; margin-bottom: 1rem; text-align: justify;">
                        يوضح هذا التقرير آلية إرسال التقارير الدورية الأسبوعية وخطط المتابعة لأولياء الأمور للطلاب الحاصلين على سلوك إيجابي أو مخالفات سلوكية (نقاط حمراء) لضمان الشراكة الفعالة وتكامل دور الأسرة مع المدرسة.
                    </p>
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:1rem; border-radius:8px; font-size:0.82rem; color:#166534; line-height:1.5;">
                        <strong>الآلية المتبعة للتواصل الفعال مع المنازل:</strong><br>
                        يتم تصدير وإرسال كشف رصد النقاط الحمراء والخطة الأسبوعية مباشرة بشكل آلي عبر تطبيق الواتساب المدمج بالإشارة إلى أسباب الرصد ونقاط الضعف الفنية، مما يتيح لأولياء الأمور المتابعة الفورية والتفاعل الإيجابي مع معلم المادة والمدرسة.
                    </div>
                </div>`;
            
            const metaHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${currentClass.name}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    قناة الاتصال: رسائل WhatsApp الإلكترونية
                </div>
            </div>`;

            container.appendChild(createOfficialFormPage('البند 3: التفاعل مع أولياء الأمور', content, metaHtml));
        });
    }

    // Item 4: التنويع في استراتيجيات التدريس
    if (showStrategies) {
        targetClasses.forEach(currentClass => {
            const reportStr = portfolioSettings.strategyReport || 'تم تطبيق استراتيجية "التعلم التعاوني النشط" في مجموعات دراسية ثنائية وتكليفهم بحل مشكلات صفية تخصصية، مما رفع نسبة التفاعل والمشاركة النشطة داخل الصف بمتوسط 30%.';
            
            let strategyName = 'التعلم التعاوني النشط';
            const nameMatch = reportStr.match(/استراتيجية\s+["']?([\u0600-\u06FF\s]+?)["']?(?=\s+في|\s+داخل|\s+لتدريس|$)/);
            if (nameMatch) strategyName = nameMatch[1].trim();

            const metaHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الاستراتيجية: ${strategyName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المقرر الدراسي: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${currentClass.name}
                </div>
            </div>`;

            let imageHtml = '';
            if (portfolioSettings.strategyImage) {
                const isPdf = portfolioSettings.strategyImage.startsWith('data:application/pdf');
                if (isPdf) {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">مستند الشاهد المرفق (PDF):</strong>
                        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; text-align: right; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-file-pdf" style="font-size: 1.8rem; color: #ef4444;"></i>
                                <div>
                                    <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a;">${portfolioSettings.strategyImageName || 'document.pdf'}</span><br>
                                    <span style="font-size: 0.7rem; color: #64748b;">مستند مرفق</span>
                                </div>
                            </div>
                            <a href="${portfolioSettings.strategyImage}" target="_blank" style="padding: 4px 8px; background: #0f172a; color: white; border-radius: 4px; font-size: 0.7rem; text-decoration: none; font-weight: bold;">عرض المستند</a>
                        </div>
                        <object data="${portfolioSettings.strategyImage}" type="application/pdf" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;">
                            <p>يمكنك <a href="${portfolioSettings.strategyImage}" target="_blank">النقر هنا لعرض ملف الـ PDF المرفق</a>.</p>
                        </object>
                    </div>`;
                } else {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">شاهد مصور لتطبيق الاستراتيجية:</strong>
                        <img src="${portfolioSettings.strategyImage}" style="max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 5px;">
                    </div>`;
                }
            }

            const content = `
            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #334155; line-height: 1.6;">
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px;">
                    <strong>الهدف من تطبيق الاستراتيجية:</strong><br>
                    تنمية مهارات التفكير العليا، التفاعل التعاوني الإيجابي بين الطلاب، سرعة استيعاب الجانب المهاري والعملي للمقرر، وتدريبهم على القيادة والعمل الجماعي.
                </div>
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px;">
                    <strong>خطوات وإجراءات التطبيق العملي داخل الصف:</strong><br>
                    ${reportStr.replace(/\n/g, '<br>')}
                </div>
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f0fdf4; border-color: #bbf7d0; color: #166534;">
                    <strong>الأثر والنتائج المحققة لرفع التحصيل:</strong><br>
                    تحسن فوري في المشاركة اللحظية ورفع دافعية الطلاب بنسبة 30% مع زيادة إنجاز التقييمات العملية.
                </div>
                ${imageHtml}
            </div>`;
            container.appendChild(createOfficialFormPage('البند 4: التنويع في استراتيجيات التدريس', content, metaHtml));
        });
    }

    // Item 5: تحسين نتائج المتعلمين (الخطة العلاجية والاصرائية)
    if (showImprovement) {
        targetClasses.forEach(currentClass => {
            const students = currentClass.students || [];
            const failingStudentsList = students.filter(s => getStudentTotal(s, activeSubjectId, currentClass) < 60);
            const outstandingStudentsList = students.filter(s => getStudentTotal(s, activeSubjectId, currentClass) >= 90);

            let failingRows = '';
            if (failingStudentsList.length > 0) {
                failingRows = failingStudentsList.map(s => {
                    const total = getStudentTotal(s, activeSubjectId, currentClass);
                    const gradesObj = getStudentSubjectGrades(s);
                    const activeCats = getActiveSubjectGradingCategories(activeSubjectId);
                    const practicalCat = activeCats.find(c => legacyGradeFieldFor(c) === 'practical');
                    const examCat = activeCats.find(c => legacyGradeFieldFor(c) === 'exam');

                    const solvedAssignments = getCheckboxSum(gradesObj.assignments);
                    const totalAssignments  = (gradesObj.assignments || []).length || 10;
                    const solvedActivities   = getCheckboxSum(gradesObj.activities);
                    const totalActivities   = (gradesObj.activities || []).length || 10;
                    const solvedResearch     = getCheckboxSum(gradesObj.research);
                    const totalResearch     = (gradesObj.research || []).length || 10;
                    const maxPrac = practicalCat ? practicalCat.max : 40;
                    const maxEx   = examCat ? examCat.max : 20;
                    const violations = (gradesObj.participation || []).filter(v => typeof v === 'string' && v.trim() !== '');

                    // Calculate deficit ratios for each category to rank severity
                    const deficits = [];

                    // 1. الواجبات المنزلية
                    const assignDeficit = (totalAssignments - solvedAssignments) / totalAssignments;
                    if (assignDeficit > 0) {
                        deficits.push({
                            ratio: assignDeficit,
                            text: '• تأخر الواجبات ◀ (متابعة ومهلة تسليم)'
                        });
                    }

                    // 2. الاختبارات التحريرية والنظرية
                    const examDeficit = (maxEx - (gradesObj.exam || 0)) / maxEx;
                    if (examDeficit > 0.2) {
                        deficits.push({
                            ratio: examDeficit,
                            text: '• ضعف التحصيل النظري ◀ (أوراق عمل ومراجعة)'
                        });
                    }

                    // 3. التطبيق العملي والمهام
                    const pracDeficit = (maxPrac - (gradesObj.practical || 0)) / maxPrac;
                    if (pracDeficit > 0.2) {
                        deficits.push({
                            ratio: pracDeficit,
                            text: '• قصور التطبيق العملي ◀ (تدريب وتطبيق موجه)'
                        });
                    }

                    // 4. الأنشطة والبحث والمشاريع
                    const actResTotal = totalActivities + totalResearch;
                    const actResSolved = solvedActivities + solvedResearch;
                    const actResDeficit = (actResTotal - actResSolved) / actResTotal;
                    if (actResDeficit > 0) {
                        deficits.push({
                            ratio: actResDeficit,
                            text: '• عدم إنجاز المشاريع والأنشطة ◀ (توجيه وتكليف إرشادي)'
                        });
                    }

                    // 5. السلوك والمشاركة
                    if (violations.length > 0) {
                        deficits.push({
                            ratio: (violations.length * 0.2),
                            text: '• تشتت الانضباط الصفي ◀ (تعزيز وتوجيه مباشر)'
                        });
                    }

                    // Sort deficits by ratio descending and take top 2 primary items
                    deficits.sort((a, b) => b.ratio - a.ratio);
                    const top2Deficits = deficits.slice(0, 2);

                    let remedialText = '';
                    if (top2Deficits.length > 0) {
                        remedialText = top2Deficits.map(d => d.text).join('<br>');
                    } else {
                        remedialText = '• متابعة دراسية عامة ◀ (توجيه وحث مستمر)';
                    }

                    return `
                        <tr>
                            <td style="border: 1px solid rgba(239, 68, 68, 0.15); padding: 6px; font-weight: 700; color: #1e293b; vertical-align: middle;">${s.name}</td>
                            <td style="border: 1px solid rgba(239, 68, 68, 0.15); padding: 6px; text-align: center; font-weight: 700; color: #ef4444; vertical-align: middle;">${total} / 100</td>
                            <td style="border: 1px solid rgba(239, 68, 68, 0.15); padding: 6px; color: #334155; line-height: 1.5; font-size: 0.73rem; vertical-align: middle;">${remedialText}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                failingRows = `
                    <tr>
                        <td colspan="3" style="border: 1px solid rgba(239, 68, 68, 0.15); padding: 10px; text-align: center; color: #64748b; font-style: italic;">
                            لا يوجد طلاب متعثرون في هذا الفصل الدراسي (نسبة إتقان 100%).
                        </td>
                    </tr>
                `;
            }

            let outstandingRows = '';
            if (outstandingStudentsList.length > 0) {
                outstandingRows = outstandingStudentsList.map(s => {
                    const total = getStudentTotal(s, activeSubjectId, currentClass);
                    return `
                        <tr>
                            <td style="border: 1px solid rgba(16, 185, 129, 0.15); padding: 5px; font-weight: 700; color: #1e293b;">${s.name}</td>
                            <td style="border: 1px solid rgba(16, 185, 129, 0.15); padding: 5px; text-align: center; font-weight: 700; color: #10b981;">${total} / 100</td>
                            <td style="border: 1px solid rgba(16, 185, 129, 0.15); padding: 5px; color: #475569;">سرعة إتقان المهارات ◀ (الخطة: تكليف بمشروع برمجي متقدم أو روبوت)</td>
                        </tr>
                    `;
                }).join('');
            } else {
                outstandingRows = `
                    <tr>
                        <td colspan="3" style="border: 1px solid rgba(16, 185, 129, 0.15); padding: 10px; text-align: center; color: #64748b; font-style: italic;">
                            لا يوجد طلاب متفوقون (حاصلون على 90 أو أعلى) في هذا الفصل الدراسي حتى الآن.
                        </td>
                    </tr>
                `;
            }

            // Form 5A: الخطة العلاجية للطلاب المتعثرين
            let metaHtmlFailing = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الخطة: علاجية ودعم للطلاب المتعثرين
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${currentClass.name}
                </div>
            </div>`;

            const contentFailing = `
                <div style="margin-top: 0.25rem;">
                    <p style="font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600; color: #475569;">
                        <strong>الأهداف والإجراءات العامة للخطة العلاجية:</strong> معالجة جوانب الضعف التحصيلي عبر تقديم حصص تقوية مركزة، وأوراق عمل مبسطة لتحقيق نواتج التعلم المستهدفة للمقرر الدراسي.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; border: 1px solid rgba(239, 68, 68, 0.15); margin-top: 10px;">
                        <thead>
                            <tr style="background: rgba(239, 68, 68, 0.08); color: #b91c1c;">
                                <th style="border: 1px solid rgba(239, 68, 68, 0.15); padding: 5px; text-align: right; width: 40%;">اسم الطالب</th>
                                <th style="border: 1px solid rgba(239, 68, 68, 0.15); padding: 5px; text-align: center; width: 20%;">الدرجة الحالية</th>
                                <th style="border: 1px solid rgba(239, 68, 68, 0.15); padding: 5px; text-align: right; width: 40%;">جوانب القصور والإجراء العلاجي والمساندة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${failingRows}
                        </tbody>
                    </table>
                </div>`;
            container.appendChild(createOfficialFormPage('البند 5: تحسين نتائج المتعلمين (الخطة العلاجية)', contentFailing, metaHtmlFailing));

            // Form 5B: الخطة الإثرائية للطلاب المتميزين
            let metaHtmlOutstanding = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الخطة: إثرائية وتحفيز للطلاب المتميزين
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${currentClass.name}
                </div>
            </div>`;

            const contentOutstanding = `
                <div style="margin-top: 0.25rem;">
                    <p style="font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600; color: #475569;">
                        <strong>الأهداف والإجراءات العامة للخطة الإثرائية:</strong> تنمية مهارات التفكير العليا والتفكير الإبداعي والابتكاري عبر تكليفهم بمشاريع صفية وبرمجية متقدمة وتوجيههم لمصادر تعلم إضافية.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; border: 1px solid rgba(16, 185, 129, 0.15); margin-top: 10px;">
                        <thead>
                            <tr style="background: rgba(16, 185, 129, 0.08); color: #047857;">
                                <th style="border: 1px solid rgba(16, 185, 129, 0.15); padding: 5px; text-align: right; width: 40%;">اسم الطالب</th>
                                <th style="border: 1px solid rgba(16, 185, 129, 0.15); padding: 5px; text-align: center; width: 20%;">الدرجة الحالية</th>
                                <th style="border: 1px solid rgba(16, 185, 129, 0.15); padding: 5px; text-align: right; width: 40%;">مواطن التميز والمشروع الإثرائي والتعزيز</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${outstandingRows}
                        </tbody>
                    </table>
                </div>`;
            container.appendChild(createOfficialFormPage('البند 5: تحسين نتائج المتعلمين (الخطة الإثرائية)', contentOutstanding, metaHtmlOutstanding));
        });
    }

    // Item 6: إعداد وتنفيذ خطة التعلم
    if (showPlan) {
        const planCategories = getActiveSubjectGradingCategories(activeSubjectId).filter(cat => cat.max > 0);
        const planDescriptionFor = (cat) => {
            switch (legacyGradeFieldFor(cat)) {
                case 'assignments': return 'متابعة أسبوعية عبر نظام الرصد التلقائي ومدرستي';
                case 'activities':
                case 'research': return 'تقديم مشاريع جماعية ومهام تطبيقية مهارية';
                case 'participation': return 'سجل رصد سلوكي وحضوري تفاعلي مستمر للحصة';
                case 'practical': return 'رصد درجات أداء الطلاب في الجوانب التطبيقية';
                case 'exam': return 'اختبار نهاية الفصل الدراسي الموحد إدارياً';
                default: return cat.type === 'numeric' ? 'رصد درجة مباشر حسب أداء الطالب' : 'متابعة وتقييم دوري عبر نظام الرصد الإلكتروني';
            }
        };
        const distRowsHtml = planCategories.map(cat => `
            <tr><td style="border: 1px solid #cbd5e1; padding:6px; font-weight:700;">${cat.name}</td><td style="border: 1px solid #cbd5e1; padding:6px; text-align:center; font-weight:700;">${cat.max} درجة</td><td style="border: 1px solid #cbd5e1; padding:6px;">${planDescriptionFor(cat)}</td></tr>
        `).join('');
        const content = `
            <div style="margin-top: 0.5rem;">
                <p style="font-size: 0.85rem; line-height: 1.5; color: #334155; margin-bottom: 1rem; text-align: justify;">
                    يوضح هذا النموذج التوزيع الرسمي المعتمد لأدوات التقييم الدراسي للمقرر الحالي، وذلك لضمان توازن التقييم وشموليته لجميع مستويات المعرفة والمهارة.
                </p>
                <table class="port-table" style="font-size:0.8rem; width:100%; border-collapse:collapse; border: 1px solid #cbd5e1;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="border: 1px solid #cbd5e1; padding:6px; text-align:right; width:30%;">أداة التقييم الدراسي</th>
                            <th style="border: 1px solid #cbd5e1; padding:6px; text-align:center; width:25%;">الوزن النسبي المخصص</th>
                            <th style="border: 1px solid #cbd5e1; padding:6px; text-align:right; width:45%;">معيار وتوصيف آلية الرصد</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${distRowsHtml}
                    </tbody>
                </table>
            </div>`;
        
        const metaHtml = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المقرر: ${activeSubjName}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                الصف / الفصل: ${activeClass.name}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المؤشر: الأوزان والنسب المئوية للتقييم
            </div>
        </div>`;

        container.appendChild(createOfficialFormPage('البند 6: إعداد وتنفيذ خطة التعلم', content, metaHtml));
    }

    // Item 7: توظيف تقنيات ووسائل التعلم المناسبة
    if (showTech) {
        const content = `
            <div style="margin-top: 0.5rem;">
                <p style="font-size: 0.85rem; line-height: 1.5; color: #334155; margin-bottom: 1rem; text-align: justify;">
                    يوضح هذا التقرير المنصة البرمجية والأدوات الرقمية المعتمدة من قبل المعلم لإدارة درجات الطلاب ورصد السلوك إلكترونياً بما يواكب رؤية المملكة 2030 للتحول الرقمي.
                </p>
                <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:1rem; border-radius:8px; font-size:0.85rem; line-height:1.5; color:#334155;">
                    <strong>أداة الرصد والتحليل المعتمدة:</strong> متابعة أداء الطلاب (Student Performance Tracker)<br>
                    <strong>التقنيات المستخدمة:</strong><br>
                    • شاشة تقييم صفية مباشرة وتفاعلية لتسجيل السلوك الفوري والتعزيز.<br>
                    • ربط آلي مباشر مع منصة مدرستي الرسمية لسحب الواجبات تلقائياً.<br>
                    • تصدير تلقائي للتقارير الأسبوعية للتحصيل السلوكي وإرسالها الفوري لأولياء الأمور عبر الواتساب.<br>
                    • رسم بياني وتحليل إحصائي لمستويات الطلاب ودعم خطط التحسين الدراسي الفورية.
                </div>
            </div>`;
        
        const metaHtml = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                التقنية: Student Tracker System
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المقرر الدراسي: ${activeSubjName}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                الصف / الفصل: ${activeClass.name}
            </div>
        </div>`;

        container.appendChild(createOfficialFormPage('البند 7: توظيف تقنيات ووسائل التعلم المناسبة', content, metaHtml));
    }

    // Item 8: تهيئة البيئة التعليمية
    if (showEnv) {
        const envStr = portfolioSettings.classroomEnv || 'تهيئة الصف بتوزيع مجموعات عمل وتثبيت شاشات تفاعلية، مع تقسيم الطلاب وفقاً أنماط التعلم لتوفير بيئة تعليمية محفزة لجميع القدرات.';
        const activeStudents = getActiveStudents();
        const total = activeStudents.length;
        const visualCount = Math.ceil(total * 0.4);
        const auditoryCount = Math.ceil(total * 0.35);
        const kinestheticCount = Math.max(0, total - visualCount - auditoryCount);
        
        let imageHtml = '';
        if (portfolioSettings.classroomEnvImage) {
            const isPdf = portfolioSettings.classroomEnvImage.startsWith('data:application/pdf');
            if (isPdf) {
                imageHtml = `
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                    <strong style="display: block; text-align: right; margin-bottom: 5px;">مستند الشاهد المرفق (PDF):</strong>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; text-align: right; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-file-pdf" style="font-size: 1.8rem; color: #ef4444;"></i>
                            <div>
                                <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a;">${portfolioSettings.classroomEnvImageName || 'document.pdf'}</span><br>
                                <span style="font-size: 0.7rem; color: #64748b;">مستند مرفق</span>
                            </div>
                        </div>
                        <a href="${portfolioSettings.classroomEnvImage}" target="_blank" style="padding: 4px 8px; background: #0f172a; color: white; border-radius: 4px; font-size: 0.7rem; text-decoration: none; font-weight: bold;">عرض المستند</a>
                    </div>
                    <object data="${portfolioSettings.classroomEnvImage}" type="application/pdf" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <p>يمكنك <a href="${portfolioSettings.classroomEnvImage}" target="_blank">النقر هنا لعرض ملف الـ PDF المرفق</a>.</p>
                    </object>
                </div>`;
            } else {
                imageHtml = `
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                    <strong style="display: block; text-align: right; margin-bottom: 5px;">شاهد مصور للبيئة التعليمية المادية الصفية:</strong>
                    <img src="${portfolioSettings.classroomEnvImage}" style="max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 5px;">
                </div>`;
            }
        }

        const content = `
            <div style="margin-top: 0.5rem;">
                <p style="font-size: 0.85rem; line-height: 1.5; color: #334155; margin-bottom: 1rem; text-align: justify;">
                    ${envStr}
                </p>
                <div style="background:#f1f5f9; padding:1rem; border-radius:8px; font-size:0.85rem; border: 1px solid #cbd5e1;">
                    <strong>إحصائيات تصنيف أنماط تعلم الفصل الحالي (إجمالي الطلاب: ${total} طالب):</strong>
                    <div style="display:flex; justify-content:space-around; margin-top:0.5rem; font-weight: 700; color: #1e1b4b;">
                        <span>👀 نمط بصري: <strong style="color:var(--accent-teal);">${visualCount} طلاب (40%)</strong></span>
                        <span>📢 نمط سمعي: <strong style="color:var(--accent-teal);">${auditoryCount} طلاب (35%)</strong></span>
                        <span>🏃‍♂️ نمط حركي: <strong style="color:var(--accent-teal);">${kinestheticCount} طلاب (25%)</strong></span>
                    </div>
                </div>
                ${imageHtml}
            </div>`;
        
        const metaHtml = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المادة: ${activeSubjName}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                الصف / الفصل: ${activeClass.name}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المؤشر: تصنيف الطلاب وأنماط التعلم
            </div>
        </div>`;

        container.appendChild(createOfficialFormPage('البند 8: تهيئة البيئة التعليمية', content, metaHtml));
    }

    // Item 9: الإدارة الصفية
    if (showClassroom) {
        const content = `
            <div style="margin-top: 0.5rem;">
                <p style="font-size: 0.85rem; line-height: 1.5; color: #334155; margin-bottom: 1rem; text-align: justify;">
                    يتم استخدام سجل المتابعة التفاعلي داخل الحصة لرصد السلوك الإيجابي وتعزيزه فوراً بالنقاط الخضراء، وحصر المخالفات السلوكية وتسجيلها بالنقاط الحمراء لدعم المعلم في الحفاظ على انضباط الصف وتعديل السلوك بكفاءة عالية.
                </p>
                <div style="background:rgba(99, 102, 241, 0.05); border:1px solid rgba(99, 102, 241, 0.15); padding:1rem; border-radius:8px; font-size:0.85rem; line-height:1.5; color:#312e81;">
                    <strong>مؤشرات الإدارة الصفية الفعالة المطبقة:</strong><br>
                    • رصد مشاركة الطلاب اللحظية ومكافأة المتميزين فورياً في كشف الرصد الصفي.<br>
                    • التسجيل السريع لعدم إحضار الكتاب أو كلام جانبي وتدوين أسباب الرصد لتصديرها للموجه والمنزل.<br>
                    • خلق جو تنافسي شريف بين مجموعات الطلاب برصد نقاط المشاركة التفاعلية للفصل.
                </div>
            </div>`;
        
        const metaHtml = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المقرر: ${activeSubjName}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                الصف / الفصل: ${activeClass.name}
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                المؤشر: ضبط الصف وإدارة السلوك التفاعلي
            </div>
        </div>`;

        container.appendChild(createOfficialFormPage('البند 9: الإدارة الصفية', content, metaHtml));
    }

    // Item 10: تحليل نتائج المتعلمين
    if (showAnalysis) {
        targetClasses.forEach((currentClass, classIdx) => {
            const students = currentClass.students || [];
            const grades = students.map(s => getStudentTotal(s, activeSubjectId, currentClass));
            
            const count = grades.length;
            let avg = 0;
            let max = 0;
            let min = 0;
            let passPercent = 0;

            if (count > 0) {
                const sum = grades.reduce((a, b) => a + b, 0);
                avg = (sum / count).toFixed(1);
                max = Math.max(...grades);
                min = Math.min(...grades);
                const passed = grades.filter(g => g >= 50).length;
                passPercent = ((passed / count) * 100).toFixed(0);
            }

            const canvasId = `portChartCanvas_${currentClass.id || classIdx}`;

            const content = `
                <div style="margin-top: 0.25rem;">
                    <p style="font-size:0.82rem; margin-bottom:0.75rem; color:#334155; line-height:1.4;">
                        تم إجراء تحليل رقمي شامل لدرجات فصل <strong>${currentClass.name}</strong> للوقوف على التوزيع التحصيلي وتوزيع الفئات كالتالي:
                    </p>
                    
                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; text-align:center;">
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:0.6rem; border-radius:6px;">
                            <div style="font-size:0.68rem; color:#64748b; margin-bottom:0.25rem;">متوسط الدرجات</div>
                            <div style="font-size:1.15rem; font-weight:800; color:#4f46e5;">${avg}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:0.6rem; border-radius:6px;">
                            <div style="font-size:0.68rem; color:#64748b; margin-bottom:0.25rem;">نسبة النجاح الكلية</div>
                            <div style="font-size:1.15rem; font-weight:800; color:#10b981;">${passPercent}%</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:0.6rem; border-radius:6px;">
                            <div style="font-size:0.68rem; color:#64748b; margin-bottom:0.25rem;">أعلى درجة بالفصل</div>
                            <div style="font-size:1.15rem; font-weight:800; color:#14b8a6;">${max}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:0.6rem; border-radius:6px;">
                            <div style="font-size:0.68rem; color:#64748b; margin-bottom:0.25rem;">أدنى درجة بالفصل</div>
                            <div style="font-size:1.15rem; font-weight:800; color:#ef4444;">${min}</div>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; border: 1px solid #cbd5e1; padding: 0.75rem; border-radius: 8px; background: #f8fafc;">
                        <div style="font-weight:700; font-size:0.8rem; margin-bottom:0.4rem; color:#1e1b4b;">المخطط البياني لتوزيع درجات الطلاب (${currentClass.name})</div>
                        <canvas id="${canvasId}" width="400" height="150" style="background:#ffffff;"></canvas>
                    </div>
                </div>`;
            
            const metaHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${currentClass.name}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المؤشر: تحليل النتائج وتشخيص المستويات
                </div>
            </div>`;

            container.appendChild(createOfficialFormPage('البند 10: تحليل نتائج المتعلمين وتشخيص مستوياتهم', content, metaHtml));

            setTimeout(() => {
                const canvasEl = document.getElementById(canvasId);
                if (canvasEl) {
                    const ctx = canvasEl.getContext('2d');
                    const excelCount = grades.filter(g => g >= 90).length;
                    const passCount = grades.filter(g => g >= 50 && g < 90).length;
                    const failCount = grades.filter(g => g < 50).length;

                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ['ممتاز (90+)', 'ناجح (50-89)', 'متعثر (<50)'],
                            datasets: [{
                                data: [excelCount, passCount, failCount],
                                backgroundColor: ['#10b981', '#6366f1', '#ef4444'],
                                borderRadius: 4
                            }]
                        },
                        options: {
                            responsive: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: { stepSize: 1, color: '#475569', font: { size: 9 } },
                                    grid: { color: '#e2e8f0' }
                                },
                                x: {
                                    ticks: { color: '#475569', font: { size: 9 } },
                                    grid: { display: false }
                                }
                            }
                        }
                    });
                }
            }, 100);
        });
    }

    // Item 11: تنويع أساليب التقويم ورصد الدرجات
    if (showEvaluation) {
        const evalCategories = getActiveSubjectGradingCategories(activeSubjectId).filter(cat => cat.max > 0);
        targetClasses.forEach(currentClass => {
            const students = currentClass.students || [];

            let tableRowsHtml = '';
            students.forEach((student, idx) => {
                const catScores = evalCategories.map(cat => getCategoryEarnedScore(student, cat, activeSubjectId, currentClass));
                const total = getStudentTotal(student, activeSubjectId, currentClass);
                const status = getStudentStatus(total);
                const statusText = status === 'excellent' ? 'ممتاز' : (status === 'pass' ? 'ناجح' : 'متعثر');

                tableRowsHtml += `
                    <tr style="border: 1px solid #e2e8f0;">
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
                        <td style="padding: 4px; text-align: right; font-weight: 700; border: 1px solid #cbd5e1;">${student.name}</td>
                        ${catScores.map(score => `<td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${score}</td>`).join('')}
                        <td style="padding: 4px; text-align: center; font-weight: 800; color: ${total >= 50 ? '#0d9488' : '#ef4444'}; border: 1px solid #cbd5e1;">${total}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${statusText}</td>
                    </tr>
                `;
            });

            const colCount = evalCategories.length + 4;
            const headerCols = evalCategories.map(cat => `<th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${cat.name} (${cat.max})</th>`).join('');

            const content = `
                <div style="margin-top: 0.25rem; overflow-x:auto;">
                    <p style="font-size:0.85rem; margin-bottom:0.4rem; font-weight:600; color:#475569;">الشاهد المعتمد: كشوفات متابعة الطلاب الشاملة لجميع أنواع التقييمات للمقرر (${currentClass.name})</p>
                    <table class="port-table" style="font-size:0.7rem; width:100%; border-collapse:collapse; border: 1px solid #cbd5e1;">
                        <thead>
                            <tr style="background:#f1f5f9;">
                                <th style="width:5%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">م</th>
                                <th style="width:25%; border: 1px solid #cbd5e1; padding: 4px; text-align: right;">اسم الطالب</th>
                                ${headerCols}
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">المجموع</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">التقدير</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml || `<tr><td colspan="${colCount}" style="padding: 10px; text-align: center;">لا يوجد طلاب مضافين في هذا الفصل الدراسي بعد.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
            
            const metaHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المقرر: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${currentClass.name}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المؤشر: كشف رصد درجات الطلاب التفصيلي
                </div>
            </div>`;

            container.appendChild(createOfficialFormPage('البند 11: تنويع أساليب التقويم', content, metaHtml));
        });
    }

    // Render Custom Forms (صانع النماذج)
    portfolioSettings.customForms = portfolioSettings.customForms || [];
    portfolioSettings.customForms.forEach(cf => {
        targetClasses.forEach(currentClass => {
            let contentHtml = '<div style="margin-top: 0.5rem; font-size: 0.85rem; color: #334155; line-height: 1.6;">';
            
            cf.fields.forEach(field => {
                if (field.type === 'text') {
                    contentHtml += `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px;">
                        <strong>${field.label}:</strong><br>
                        ${field.value || '...................................'}
                    </div>`;
                } else if (field.type === 'textarea') {
                    contentHtml += `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px;">
                        <strong>${field.label}:</strong><br>
                        ${(field.value || '').replace(/\n/g, '<br>') || '...................................'}
                    </div>`;
                } else if (field.type === 'table') {
                    const headers = (field.headersCsv || '').split(',').map(h => h.trim()).filter(h => h);
                    
                    let tableHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px;">
                        <strong>${field.label}:</strong><br>
                        <table class="port-table" style="font-size:0.8rem; width:100%; border-collapse:collapse; border: 1px solid #cbd5e1; margin-top: 5px;">
                            <thead>
                                <tr style="background:#f1f5f9;">`;
                    
                    headers.forEach(h => {
                        tableHtml += `<th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${h}</th>`;
                    });
                    
                    tableHtml += `
                                </tr>
                            </thead>
                            <tbody>`;
                    
                    // Add a blank row with dot placeholders
                    tableHtml += `<tr>`;
                    headers.forEach(() => {
                        tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">...................</td>`;
                    });
                    tableHtml += `</tr>`;
                    
                    tableHtml += `
                            </tbody>
                        </table>
                    </div>`;
                    
                    contentHtml += tableHtml;
                } else if (field.type === 'image') {
                    let imgHtml = '';
                    if (field.value) {
                        const isPdf = field.value.startsWith('data:application/pdf');
                        if (isPdf) {
                            imgHtml = `
                            <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; text-align: right; margin-bottom: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fa-solid fa-file-pdf" style="font-size: 1.8rem; color: #ef4444;"></i>
                                    <div>
                                        <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a;">${field.fileName || 'document.pdf'}</span><br>
                                        <span style="font-size: 0.7rem; color: #64748b;">مستند مرفق</span>
                                    </div>
                                </div>
                                <a href="${field.value}" target="_blank" style="padding: 4px 8px; background: #0f172a; color: white; border-radius: 4px; font-size: 0.7rem; text-decoration: none; font-weight: bold;">عرض المستند</a>
                            </div>
                            <object data="${field.value}" type="application/pdf" style="width: 100%; height: 350px; border: 1px solid #cbd5e1; border-radius: 4px;">
                                <p>يمكنك <a href="${field.value}" target="_blank">النقر هنا لعرض ملف الـ PDF المرفق</a>.</p>
                            </object>`;
                        } else {
                            imgHtml = `<img src="${field.value}" style="max-width: 100%; max-height: 380px; object-fit: contain; margin-top: 5px; border-radius: 4px; border: 1px solid #cbd5e1;">`;
                        }
                    } else {
                        imgHtml = `<div style="padding: 20px; text-align: center; border: 1px dashed #cbd5e1; color: #64748b; background: #f8fafc; border-radius: 4px; font-size: 0.8rem; margin-top: 5px;">(لم يتم إرفاق صورة أو مستند الشاهد)</div>`;
                    }
                    contentHtml += `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-bottom: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">${field.label}:</strong>
                        ${imgHtml}
                    </div>`;
                }
            });
            
            contentHtml += '</div>';

            const metaHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${currentClass.name}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الفئة المستهدفة: ${cf.targetGroup || 'غير محددة'}
                </div>
            </div>`;

            const fullTitle = `${cf.itemNumber ? cf.itemNumber + ': ' : ''}${cf.title}`;
            container.appendChild(createOfficialFormPage(fullTitle, contentHtml, metaHtml));
        });
    });
}

window.generateAndDownloadPdf = async function(elementOrHtml, filename, landscape = false) {
    let htmlContent = '';
    if (typeof elementOrHtml === 'string') {
        htmlContent = elementOrHtml;
    } else if (elementOrHtml && elementOrHtml.innerHTML) {
        htmlContent = elementOrHtml.innerHTML;
    } else {
        return;
    }

    showNotification('جاري إنشاء ملف الـ PDF عالي الدقة عبر المحرك الاحترافي...', 'info');

    try {
        const response = await fetch(getApiUrl('/api/generate-pdf'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: htmlContent,
                filename: filename,
                landscape: landscape
            })
        });

        if (!response.ok) {
            throw new Error(`Server status: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

        showNotification('تم تصدير ملف الـ PDF بنجاح بجودة متجهات فائقة! 📄✨', 'success');
    } catch (err) {
        console.warn('[PDF Engine] Server PDF error, using fallback:', err);
        if (typeof html2pdf !== 'undefined' && typeof elementOrHtml !== 'string') {
            const opt = {
                margin:       landscape ? [8, 8, 8, 8] : 10,
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2.2, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' }
            };
            html2pdf().set(opt).from(elementOrHtml).save();
            showNotification('تم تصدير الـ PDF عبر المعالج الاحتياطي بنجاح.', 'success');
        } else {
            showNotification('حدث خطأ أثناء تصدير الـ PDF، يرجى المحاولة لاحقاً.', 'error');
        }
    }
};

window.exportPortfolioPdf = exportPortfolioPdf;
function exportPortfolioPdf() {
    const teacherName = portfolioSettings.teacherName || 'المعلم';
    const element = document.getElementById('portfolioPagesContainer');
    if (!element) return;
    
    window.generateAndDownloadPdf(element, `ملف_شواهد_الأداء_${teacherName.replace(/\s+/g, '_')}.pdf`, false);
}

// Automatic Weekly Report Trigger
window.checkAndAutoSendWeeklyReport = function() {
    if (!lastReportDate) return;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - lastReportDate;
    if (diff >= oneWeekMs) {
        // Prevent double triggers during the session
        lastReportDate = Date.now(); 
        saveData();
        
        console.log('[WhatsApp Auto-Sender] Weekly interval elapsed. Triggering auto-send...');
        sendWeeklyReport();
    }
};

document.addEventListener('click', () => {
    window.checkAndAutoSendWeeklyReport();
});

// ============================================================
// INDIVIDUAL STUDENT REPORT LOGIC
// ============================================================
let currentReportStudent = null;
let currentReportStudentName = '';

window.printStudentReport = function(studentId) {
    const activeClass = getActiveClass();
    if (!activeClass) return;
    
    const student = activeClass.students.find(s => s.id === studentId);
    if (!student) return;
    
    currentReportStudent = student;
    currentReportStudentName = student.name;
    
    const gradesObj = getStudentSubjectGrades(student);
    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'لم يحدد';
    const total = getStudentTotal(student);
    const status = getStudentStatus(total);
    
    const categories = getActiveSubjectGradingCategories(activeSubjectId);

    let categoriesRowsHtml = '';
    const specificRecommendations = [];

    categories.forEach(cat => {
        if (cat.max > 0) {
            const val = gradesObj[cat.id] !== undefined ? gradesObj[cat.id] : (gradesObj[cat.key] || 0);
            let earned = 0;
            let statusText = '';
            let statusColor = '#10b981';

            const isAssign = (cat.id === 'cat_assignments' || cat.key === 'assignments' || cat.name === 'الواجبات');
            if (isAssign) {
                earned = getStudentAssignmentScore(student, activeSubjectId, cat.max);
                const totalGiven = getActiveAssignmentsCount(activeClass, activeSubjectId);
                const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : [];
                let missedCount = 0;
                if (totalGiven === 0) {
                    statusText = 'لم تسند واجبات بعد';
                    statusColor = 'var(--text-muted)';
                } else {
                    for (let i = 0; i < totalGiven; i++) {
                        if (!assignArr || assignArr[i] !== true) missedCount++;
                    }
                    if (missedCount === 0) {
                        statusText = 'مكتمل ومتميز';
                        statusColor = '#10b981';
                    } else {
                        statusText = `فاته (${missedCount} من ${totalGiven} واجب)`;
                        statusColor = '#ef4444';
                        specificRecommendations.push(`نوصي بمتابعة الطالب في حل وتسليم الواجبات المقصر فيها أولاً بأول.`);
                    }
                }
            } else if (cat.type === 'dots') {
                earned = getCheckboxSum(val, cat.pointValue, cat.max);
                if (earned === cat.max) {
                    statusText = 'مكتمل بالكامل';
                    statusColor = '#10b981';
                } else if (earned > 0) {
                    statusText = 'مكتمل جزئياً';
                    statusColor = '#f59e0b';
                    specificRecommendations.push(`نوصي بالحرص والالتزام بإستكمال مهام (${cat.name}) أولاً بأول.`);
                } else {
                    statusText = 'لم ينجز';
                    statusColor = '#ef4444';
                    specificRecommendations.push(`نوصي بالحرص والالتزام بأداء وتأدية مهام (${cat.name}).`);
                }
            } else if (cat.type === 'participation') {
                earned = getParticipationScore(val, cat.max, cat.pointValue);
                if (earned >= cat.max * 0.8) {
                    statusText = 'تفاعل ممتاز';
                    statusColor = '#10b981';
                } else if (earned >= cat.max * 0.5) {
                    statusText = 'تفاعل متوسط';
                    statusColor = '#f59e0b';
                } else {
                    statusText = 'يتطلب متابعة';
                    statusColor = '#ef4444';
                    specificRecommendations.push(`نوصي برفع مستوى التفاعل والمشاركة الصفية لبند (${cat.name}).`);
                }
            } else if (cat.type === 'numeric') {
                earned = parseFloat(val) || 0;
                if (earned >= cat.max * 0.8) {
                    statusText = 'ممتاز';
                    statusColor = '#10b981';
                } else if (earned >= cat.max * 0.5) {
                    statusText = 'متوسط';
                    statusColor = '#f59e0b';
                    specificRecommendations.push(`نوصي بالتركيز والمذاكرة الجيدة لرفع الدرجة في (${cat.name}).`);
                } else {
                    statusText = 'ضعيف';
                    statusColor = '#ef4444';
                    specificRecommendations.push(`نوصي بمراجعة وتكثيف المذاكرة لمادة (${cat.name}).`);
                }
            }

            categoriesRowsHtml += `
                <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${cat.name}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${earned}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${cat.max}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; color: ${statusColor}; font-weight: bold;">
                        ${statusText}
                    </td>
                </tr>
            `;
        }
    });

    const partVal = gradesObj.participation || gradesObj['cat_participation'];
    const violations = Array.isArray(partVal) ? partVal.filter(p => typeof p === 'string' && p.trim() !== '') : [];
    
    let behaviorSection = '';
    if (violations.length > 0) {
        behaviorSection = `
        <div style="font-size: 0.85rem; font-weight: 800; color: #1e1b4b; border-right: 3px solid #1e1b4b; padding-right: 8px; margin-bottom: 8px; text-align: right;">
            السلوك والانضباط الصفي:
        </div>
        <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; background: #ffffff; margin-bottom: 20px; font-size: 0.8rem; line-height: 1.5; text-align: right;">
            <span style="color:#ef4444; font-weight: bold;">⚠️ تنبيه بخصوص الملاحظات المرصودة:</span><br>
            تم رصد ${violations.length} مخالفات سلوكية ونقاط حمراء هذا الفصل للأسباب التالية:<br>
            ${violations.map(v => `• ${v}`).join('<br>')}
        </div>`;
        specificRecommendations.push('نوصي بالالتزام بالتعليمات الصفية وتحسين الانضباط السلوكي لضمان تركيز أعلى أثناء الشرح.');
    }

    const printArea = document.getElementById('studentPrintableArea');
    if (printArea) {
        printArea.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 2px solid #0f172a; padding-bottom: 8px;">
                <div style="text-align: right; font-size: 0.8rem; line-height: 1.4; color: #1e1b4b; font-weight: bold; flex: 1;">
                    وزارة التعليم<br>
                    الإدارة العامة للتعليم بالقصيم<br>
                    مدرسة: ${portfolioSettings.schoolName || '..........'}
                </div>
                <div style="text-align: center; flex: 1;">
                    <img src="moe_official_logo.png?v=2" alt="وزارة التعليم" style="height: 70px; max-width: 140px; object-fit: contain;">
                </div>
                <div style="text-align: left; flex: 1;">
                    <span style="font-size: 1.05rem; font-weight: 800; color: #1e1b4b; background: #f8fafc; padding: 4px 12px; border: 1.5px solid #0f172a; border-radius: 20px; display: inline-block;">
                        تقرير مستوى الطالب
                    </span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; background: #f8fafc; font-weight: bold; text-align: right;">
                    اسم الطالب: <span style="color:#1e1b4b;">${student.name}</span>
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; background: #f8fafc; font-weight: bold; text-align: right;">
                    الصف / الفصل: <span style="color:#1e1b4b;">${activeClass.name}</span>
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; background: #f8fafc; font-weight: bold; text-align: right;">
                    المادة الدراسية: <span style="color:#1e1b4b;">${activeSubjName}</span>
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; background: #f8fafc; font-weight: bold; text-align: right;">
                    تاريخ التقرير: <span style="color:#1e1b4b;">${new Date().toLocaleDateString('ar-SA')}</span>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85rem; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 800;">الجانب التقييمي</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 800; width: 20%;">النتيجة / الدرجة</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 800; width: 20%;">الدرجة العظمى</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 800; width: 30%;">مستوى الإنجاز</th>
                    </tr>
                </thead>
                <tbody>
                    ${categoriesRowsHtml}
                    <tr style="border-top: 2px solid #0f172a; background: #f8fafc; font-weight: bold;">
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 1rem;">المجموع الكلي النهائي</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 1rem; color: ${total >= 50 ? 'var(--accent-teal)' : '#ef4444'}; font-weight: 800;">${total}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 1rem;">100</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 1rem; color: ${total >= 50 ? 'var(--accent-teal)' : '#ef4444'}; font-weight: 800;">
                            ${total >= 90 ? 'ممتاز' : (total >= 50 ? 'ناجح' : 'مكمل')}
                        </td>
                    </tr>
                </tbody>
            </table>
            
            ${behaviorSection}
            
            <div style="display: flex; justify-content: flex-start; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 0.85rem; color: #1e293b;">
                <div style="text-align: right; line-height: 1.6;">
                    <span style="font-weight: 700;">معلم المادة / أ. ${portfolioSettings.teacherName || '....................'}</span>
                </div>
            </div>
        `;
    }
    
    document.getElementById('studentReportModal').classList.add('active');
};

window.closeStudentReportModal = function() {
    document.getElementById('studentReportModal').classList.remove('active');
    currentReportStudent = null;
    currentReportStudentName = '';
};

window.downloadStudentReportPdf = function() {
    const area = document.getElementById('studentPrintableArea');
    if (!area) return;
    
    const filename = `تقرير_مستوى_${(currentReportStudentName || 'طالب').replace(/\s+/g, '_')}.pdf`;
    window.generateAndDownloadPdf(area, filename, false);
};

window.sendStudentReportToWhatsapp = function() {
    if (!currentReportStudent) return;
    const gradesObj = getStudentSubjectGrades(currentReportStudent);
    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'لم يحدد';
    const total = getStudentTotal(currentReportStudent);
    const status = getStudentStatus(total);
    
    const activeClass = getActiveClass();
    const totalGivenAssignments = getActiveAssignmentsCount(activeClass, activeSubjectId);
    if (totalGivenAssignments > 0) {
        const assignArr = gradesObj.assignments || gradesObj['cat_assignments'] || [];
        const missedAssignments = [];
        let solvedCount = 0;
        for (let i = 0; i < totalGivenAssignments; i++) {
            if (assignArr[i] === true) {
                solvedCount++;
            } else {
                missedAssignments.push(`واجب ${i + 1}`);
            }
        }
        if (missedAssignments.length > 0) {
            message += `• *تسليم الواجبات:* تم تسليم ${solvedCount} من أصل ${totalGivenAssignments} واجبات مطلوبة حتى الآن (فات الطالب: ${missedAssignments.join('، ')}).\n`;
        } else {
            message += `• *تسليم الواجبات:* متميز وملتزم بتسليم كافة الواجبات المطلوبة (${totalGivenAssignments} من ${totalGivenAssignments}). 👍\n`;
        }
    } else {
        message += `• *تسليم الواجبات:* لم يتم إسناد واجبات في هذه الفترة بعد.\n`;
    }
    
    const violations = Array.isArray(gradesObj.participation) ? gradesObj.participation.filter(p => typeof p === 'string' && p.trim() !== '') : [];
    if (violations.length > 0) {
        message += `• *الملاحظات السلوكية (النقاط الحمراء):* تم رصد ${violations.length} ملاحظات (${violations.join('، ')}).\n`;
    } else {
        message += `• *السلوك والانضباط:* متميز وملتزم بالأنظمة الصفية. الحمد لله. 👍\n`;
    }
    
    message += `\nنرجو منكم دوام التعاون والتوجيه لمزيد من التقدم والتحصيل العلمي.\n`;
    message += `شاكرين لكم اهتمامهم. 🌹`;
    
    sendWhatsAppDirectOrWeb(whatsappNumber, message);
};

// ============================================================
// STUDENT REFERRAL FORM (نموذج إحالة طالب)
// ============================================================
let currentReferralStudent = null;

window.openStudentReferralModal = function(studentId, defaultReason = null) {
    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('يرجى اختيار فصل أولاً!', 'error');
        return;
    }

    let student = null;
    if (studentId) {
        student = activeClass.students.find(s => s.id === studentId);
    } else if (currentReportStudent) {
        student = currentReportStudent;
    } else if (activeClass.students && activeClass.students.length > 0) {
        student = activeClass.students[0];
    }

    if (!student) {
        showNotification('لم يتم العثور على بيانات الطالب!', 'error');
        return;
    }

    currentReferralStudent = student;

    // Header Data
    const schoolName = portfolioSettings.schoolName || '..........';
    const teacherName = portfolioSettings.teacherName || '....................';
    const eduDept = portfolioSettings.eduDept || 'الإدارة العامة للتعليم بالقصيم';
    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'المهارات الرقمية';

    const schoolEl = document.getElementById('referralSchoolNameText');
    if (schoolEl) schoolEl.innerText = schoolName;

    const eduDeptEl = document.getElementById('referralEduDept');
    if (eduDeptEl) eduDeptEl.innerText = eduDept;

    const teacherEl = document.getElementById('referralTeacherNameDisplay');
    if (teacherEl) teacherEl.innerText = teacherName;

    const sigImg = document.getElementById('referralTeacherSignatureImg');
    if (sigImg) {
        if (portfolioSettings.signature) {
            sigImg.src = portfolioSettings.signature;
            sigImg.style.display = 'inline-block';
        } else {
            sigImg.src = 'teacher_signature.png?v=1';
            sigImg.style.display = 'inline-block';
        }
    }

    // Student Info
    const studentNameEl = document.getElementById('referralStudentName');
    if (studentNameEl) studentNameEl.innerText = student.name;

    const classEl = document.getElementById('referralClassName');
    if (classEl) classEl.innerText = activeClass.name;

    const subjEl = document.getElementById('referralSubjectName');
    if (subjEl) subjEl.innerText = activeSubjName;

    // Date (Hijri / Saudi format)
    const dateEl = document.getElementById('referralDateDisplay');
    if (dateEl) {
        const today = new Date();
        const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
        try {
            dateEl.innerText = today.toLocaleDateString('ar-SA', options);
        } catch (e) {
            dateEl.innerText = today.toLocaleDateString();
        }
    }

    // Determine reasons & defaults
    const gradesObj = getStudentSubjectGrades(student);
    const total = getStudentTotal(student);
    const totalGiven = getActiveAssignmentsCount(activeClass, activeSubjectId);
    const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : [];
    
    const missedAssignments = [];
    if (totalGiven > 0) {
        for (let i = 0; i < totalGiven; i++) {
            if (!assignArr || assignArr[i] !== true) {
                missedAssignments.push(`واجب ${i + 1}`);
            }
        }
    }

    const partVal = gradesObj ? (gradesObj.participation || gradesObj['cat_participation']) : [];
    const violations = Array.isArray(partVal) ? partVal.filter(p => typeof p === 'string' && p.trim() !== '') : [];

    // Reset Checkboxes
    const chkHw = document.getElementById('reasonHomework');
    const chkWeak = document.getElementById('reasonWeakness');
    const chkDisrupt = document.getElementById('reasonDisruption');
    const chkTools = document.getElementById('reasonTools');
    const chkCheat = document.getElementById('reasonCheating');
    const chkOther = document.getElementById('reasonOther');

    if (chkHw) chkHw.checked = false;
    if (chkWeak) chkWeak.checked = false;
    if (chkDisrupt) chkDisrupt.checked = false;
    if (chkTools) chkTools.checked = false;
    if (chkCheat) chkCheat.checked = false;
    if (chkOther) chkOther.checked = false;

    // Dynamic Problem Description
    let problemDetails = [];

    if (defaultReason === 'homework' || missedAssignments.length > 0) {
        if (chkHw) chkHw.checked = true;
        if (missedAssignments.length > 0) {
            problemDetails.push(`يعاني الطالب من إهمال متكرر في حل وتسليم الواجبات المطلوبة (${missedAssignments.length} واجبات: ${missedAssignments.join('، ')}).`);
        } else {
            problemDetails.push(`يعاني الطالب من عدم أداء الواجبات والمهام الموكلة إليه.`);
        }
    }

    if (defaultReason === 'disruption' || violations.length > 0) {
        if (chkDisrupt) chkDisrupt.checked = true;
        problemDetails.push(`تم رصد ملاحظات على السلوك والانضباط الصفي: (${violations.join('، ')}).`);
    }

    if (defaultReason === 'weakness' || total < 50) {
        if (chkWeak) chkWeak.checked = true;
        problemDetails.push(`يعاني الطالب من ضعف في المستوى والتحصيل الدراسي العام.`);
    }

    if (problemDetails.length === 0) {
        if (chkHw) chkHw.checked = true;
        problemDetails.push(`يعاني الطالب من إهمال متكرر في أداء الواجبات المنزلية والمهام الصفية.`);
    }

    const probTextEl = document.getElementById('referralProblemText');
    if (probTextEl) {
        probTextEl.value = problemDetails.join('\n');
    }

    const effortsTextEl = document.getElementById('referralEffortsText');
    if (effortsTextEl) {
        effortsTextEl.value = 'تم تنبيه الطالب شفهياً عدة مرات والجلوس معه لمعرفة الأسباب، وذلك في إطار تحسين مستوى الطالب وتوجيهه دراسياً وسلوكياً.';
    }

    const modal = document.getElementById('studentReferralModal');
    if (modal) modal.classList.add('active');
};

window.closeStudentReferralModal = function() {
    const modal = document.getElementById('studentReferralModal');
    if (modal) modal.classList.remove('active');
    currentReferralStudent = null;
};

window.exportReferralPdf = function() {
    const area = document.getElementById('referralPrintableArea');
    if (!area) return;

    const studentName = currentReferralStudent ? currentReferralStudent.name : 'طالب';
    const filename = `نموذج_إحالة_طالب_${studentName.replace(/\s+/g, '_')}.pdf`;

    window.generateAndDownloadPdf(area, filename, false);
};

// ============================================================
// WHATS-WEB.JS AUTOMATED ENGINE CONTROLLER
// ============================================================
window.sendWhatsAppDirectOrWeb = async function(phone, message, mediaBase64 = null, filename = null) {
    const cleanNum = phone ? phone.toString().replace(/[^0-9]/g, '') : '';
    if (!cleanNum) {
        showNotification('رقم الهاتف غير متوفر أو غير صحيح!', 'error');
        return false;
    }

    // Format phone for WhatsApp Web direct URL
    let internationalNum = cleanNum;
    if (internationalNum.startsWith('05')) {
        internationalNum = '966' + internationalNum.substring(1);
    } else if (internationalNum.startsWith('5')) {
        internationalNum = '966' + internationalNum;
    }

    try {
        // 1. Attempt sending via local backend WhatsApp engine on port 8000
        const statusRes = await fetch(getApiUrl('/api/whatsapp/status')).catch(() => null);
        if (statusRes && statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === 'READY') {
                const sendRes = await fetch(getApiUrl('/api/whatsapp/send'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: internationalNum,
                        message: message,
                        mediaBase64: mediaBase64,
                        filename: filename
                    })
                }).catch(() => null);

                if (sendRes && sendRes.ok) {
                    const sendData = await sendRes.json();
                    if (sendData.success) {
                        showNotification('✅ تم إرسال الرسالة عبر محرك واتساب بنجاح!', 'success');
                        return true;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[WhatsApp] Backend engine check failed, falling back to direct web:', e);
    }

    // 2. Smart Seamless Fallback: Direct WhatsApp Web / App URL
    showNotification('جاري فتح واتساب ويب للإرسال المباشر...', 'info');
    const encodedMsg = encodeURIComponent(message || '');
    const waWebUrl = `https://web.whatsapp.com/send?phone=${internationalNum}&text=${encodedMsg}`;
    
    // Open in a new window/tab
    window.open(waWebUrl, '_blank');
    return true;
};

window.openWhatsWebModal = function() {
    const modal = document.getElementById('whatsWebModal');
    if (modal) {
        modal.classList.add('active');
        fetchWhatsWebEngineStatus();
    }
};

window.closeWhatsWebModal = function() {
    const modal = document.getElementById('whatsWebModal');
    if (modal) modal.classList.remove('active');
};

window.fetchWhatsWebEngineStatus = async function() {
    const statusTextEl = document.getElementById('whatsWebStatusText');
    const qrContainer = document.getElementById('whatsWebQrContainer');
    const userDetailsEl = document.getElementById('whatsWebUserDetails');

    if (!statusTextEl || !qrContainer) return;

    statusTextEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> جاري فحص اتصال محرك whats-web.js...';
    qrContainer.innerHTML = '';
    if (userDetailsEl) userDetailsEl.style.display = 'none';

    try {
        const res = await fetch('http://localhost:8000/api/whatsapp/status').catch(() => null);
        if (!res || !res.ok) {
            statusTextEl.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 10px; border-radius: 8px; font-weight: bold; margin-top: 10px;">
                    ⚠️ خادم المحرك غير متصل على البورت 3001! يرجى تشغيل الملف برمجياً:<br>
                    <code style="background:#000; padding:2px 8px; border-radius:4px; margin-top:5px; display:inline-block; color:#fff;">node whats-web.js</code>
                </div>`;
            return;
        }

        const data = await res.json();
        if (data.status === 'READY') {
            statusTextEl.innerHTML = `<span style="color:#10b981; font-weight:800;">✅ المحرك متصل وجاهز للإرسال التلقائي!</span>`;
            if (userDetailsEl && data.user) {
                userDetailsEl.style.display = 'block';
                userDetailsEl.innerHTML = `الحساب المرتبط: <strong>${data.user.name || ''}</strong> (${data.user.phone || ''})`;
            }
        } else if (data.status === 'QR_READY' && data.qr) {
            statusTextEl.innerHTML = `<span style="color:#f59e0b; font-weight:800;">📲 امسح رمز الـ QR أدناه عبر تطبيق الواتساب:</span>`;
            qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr)}" alt="WhatsApp QR Code" style="border: 4px solid white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); margin-top: 10px;">`;
        } else if (data.status === 'INITIALIZING') {
            statusTextEl.innerHTML = `<span style="color:#6366f1; font-weight:700;"><i class="fa-solid fa-circle-notch fa-spin"></i> جاري فتح متصفح Chrome وتوليد الـ QR... (سيظهر كود الـ QR هنا تلقائياً خلال ثوانٍ)</span>`;
            const modal = document.getElementById('whatsWebModal');
            if (modal && modal.classList.contains('active')) {
                setTimeout(window.fetchWhatsWebEngineStatus, 2500);
            }
        } else {
            statusTextEl.innerHTML = `<span style="color:#6366f1; font-weight:700;">حالة المحرك: ${data.status}</span>`;
        }
    } catch (err) {
        statusTextEl.innerHTML = `<span style="color:#ef4444; font-weight:bold;">حدث خطأ في قراءة حالة المحرك: ${err.message}</span>`;
    }
};

window.logoutWhatsWebEngine = async function() {
    if (!confirm('هل أنت متأكد من تسجيل الخروج وتصفير جلسة محرك الواتساب؟')) return;
    try {
        const res = await fetch('http://localhost:8000/api/whatsapp/logout', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showNotification('تم تسجيل الخروج بنجاح.');
            fetchWhatsWebEngineStatus();
        }
    } catch (err) {
        showNotification('فشل تسجيل الخروج: ' + err.message, 'error');
    }
};

// ==========================================
// Random Student Picker Feature (الاختيار العشوائي للطلاب)
// ==========================================
let currentlyPickedStudent = null;
let pickerSpinInterval = null;
let pickerIsSpinning = false;

window.openRandomPickerModal = function() {
    const activeClass = getActiveClass();
    const students = getActiveStudents();

    if (!activeClass || !students || students.length === 0) {
        showNotification('يرجى اختيار فصل يحتوي على طلاب أولاً لإجراء القرعة!', 'warning');
        return;
    }

    const modal = document.getElementById('randomPickerModal');
    if (!modal) return;

    // Reset UI State
    currentlyPickedStudent = null;
    pickerIsSpinning = false;
    if (pickerSpinInterval) clearTimeout(pickerSpinInterval);

    const stageCard = document.getElementById('pickerStageCard');
    const avatar = document.getElementById('pickerAvatarCircle');
    const nameEl = document.getElementById('pickerStudentName');
    const subText = document.getElementById('pickerSubText');
    const startBtn = document.getElementById('startPickerBtn');
    const actionsRow = document.getElementById('pickerActionsRow');

    if (stageCard) {
        stageCard.className = 'picker-stage-card';
    }
    if (avatar) avatar.innerHTML = '🎲';
    if (nameEl) nameEl.textContent = 'اضغط على الزر أدناه لبدء القرعة';
    if (subText) subText.textContent = `فصل: ${activeClass.name} (عدد الطلاب: ${students.length})`;
    if (startBtn) {
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> ابدأ السحب العشوائي 🎲';
        startBtn.disabled = false;
    }
    if (actionsRow) actionsRow.style.display = 'none';

    modal.classList.add('active');
};

window.closeRandomPickerModal = function() {
    if (pickerSpinInterval) clearTimeout(pickerSpinInterval);
    pickerIsSpinning = false;
    const modal = document.getElementById('randomPickerModal');
    if (modal) modal.classList.remove('active');
};

window.startRandomPickerSelection = function() {
    if (pickerIsSpinning) return;

    const students = getActiveStudents();
    if (!students || students.length === 0) return;

    pickerIsSpinning = true;
    const stageCard = document.getElementById('pickerStageCard');
    const avatar = document.getElementById('pickerAvatarCircle');
    const nameEl = document.getElementById('pickerStudentName');
    const subText = document.getElementById('pickerSubText');
    const startBtn = document.getElementById('startPickerBtn');
    const actionsRow = document.getElementById('pickerActionsRow');

    if (actionsRow) actionsRow.style.display = 'none';
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> جاري السحب العشوائي...';
    }
    if (stageCard) {
        stageCard.classList.remove('winner');
        stageCard.classList.add('spinning');
    }
    if (subText) subText.textContent = 'جاري السحب العادل بين جميع طلاب الفصل...';

    let counter = 0;
    const totalSteps = 26 + Math.floor(Math.random() * 8);
    let speed = 45;

    function spinStep() {
        const randomIdx = Math.floor(Math.random() * students.length);
        const tempStudent = students[randomIdx];

        if (nameEl) nameEl.textContent = tempStudent.name;
        if (avatar) avatar.textContent = tempStudent.name.charAt(0);

        counter++;
        if (counter < totalSteps) {
            if (counter > totalSteps - 10) speed += 25;
            else if (counter > totalSteps - 5) speed += 45;
            pickerSpinInterval = setTimeout(spinStep, speed);
        } else {
            const winnerIdx = Math.floor(Math.random() * students.length);
            currentlyPickedStudent = students[winnerIdx];

            pickerIsSpinning = false;
            if (stageCard) {
                stageCard.classList.remove('spinning');
                stageCard.classList.add('winner');
            }
            if (avatar) avatar.textContent = currentlyPickedStudent.name.charAt(0);
            if (nameEl) nameEl.innerHTML = `<span style="color: #10b981; font-weight: 800; font-size: 1.4rem;">${currentlyPickedStudent.name}</span>`;
            if (subText) subText.textContent = '';

            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> سحب طالب آخر 🔄';
            }
            if (actionsRow) actionsRow.style.display = 'flex';
        }
    }

    spinStep();
};

window.quickGradePickedStudent = function(type) {
    if (!currentlyPickedStudent) {
        showNotification('لم يتم تحديد طالب بعد!', 'warning');
        return;
    }

    const student = currentlyPickedStudent;
    const gradesObj = getStudentSubjectGrades(student);
    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const partCat = categories.find(c => c.id === 'participation' || c.id === 'cat_participation' || c.type === 'participation') || { id: 'participation', max: 10 };
    const catKey = partCat.id || 'participation';
    const maxVal = partCat.max || 10;

    if (!Array.isArray(gradesObj[catKey])) {
        const n = parseInt(gradesObj[catKey]) || 0;
        gradesObj[catKey] = Array(maxVal).fill(false).map((_, i) => i < n);
    }
    if (!Array.isArray(gradesObj.participation)) {
        gradesObj.participation = gradesObj[catKey];
    } else {
        gradesObj[catKey] = gradesObj.participation;
    }

    if (type === 'positive') {
        const emptyIdx = gradesObj[catKey].findIndex(v => !v || v === false);
        if (emptyIdx !== -1) {
            gradesObj[catKey][emptyIdx] = true;
            gradesObj.participation[emptyIdx] = true;
            saveData();
            updateDashboard();
            showNotification(`✅ تم رصد نقطة مشاركة إيجابية للطالب "${student.name}" بنجاح!`, 'success');
        } else {
            showNotification(`الطالب "${student.name}" مكتمل نقاط المشاركة بالفعل (10/10)! 👏`, 'info');
        }
    } else if (type === 'negative') {
        const targetIdx = gradesObj[catKey].findIndex(v => !v || v === false || v === true);
        const idxToUse = targetIdx !== -1 ? targetIdx : 0;
        gradesObj[catKey][idxToUse] = 'ملاحظة صفية';
        gradesObj.participation[idxToUse] = 'ملاحظة صفية';
        saveData();
        updateDashboard();
        showNotification(`⚠️ تم تسجيل ملاحظة صفية للطالب "${student.name}".`, 'warning');
    }
};

// ============================================================
// TEACHER & SCHOOL SETTINGS MODAL (إعدادات المعلم والمدرسة)
// ============================================================
let pendingSignatureBase64 = null;

window.openTeacherSettingsModal = function() {
    const modal = document.getElementById('teacherSettingsModal');
    if (!modal) return;

    const tInput = document.getElementById('settingsTeacherName');
    const sInput = document.getElementById('settingsSchoolName');
    const eInput = document.getElementById('settingsEduDept');

    if (tInput) tInput.value = portfolioSettings.teacherName || '';
    if (sInput) sInput.value = portfolioSettings.schoolName || '';
    if (eInput) eInput.value = portfolioSettings.eduDept || 'الإدارة العامة للتعليم بالقصيم';

    pendingSignatureBase64 = portfolioSettings.signature || null;
    updateSignatureUIState();

    modal.classList.add('active');
};

window.closeTeacherSettingsModal = function() {
    const modal = document.getElementById('teacherSettingsModal');
    if (modal) modal.classList.remove('active');
};

window.handleSignatureUpload = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showNotification('يرجى اختيار ملف صورة صالح (PNG / JPG)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
        pendingSignatureBase64 = evt.target.result;
        updateSignatureUIState();
        showNotification('تم تحميل صورة التوقيع، اضغط حفظ لاعتمادها.', 'info');
    };
    reader.readAsDataURL(file);
};

window.removeTeacherSignature = function() {
    pendingSignatureBase64 = '';
    updateSignatureUIState();
    showNotification('تمت إزالة التوقيع.', 'info');
};

function updateSignatureUIState() {
    const statusText = document.getElementById('signatureStatusText');
    const previewBox = document.getElementById('signaturePreviewBox');
    const previewImg = document.getElementById('signaturePreviewImg');

    if (pendingSignatureBase64) {
        if (previewImg) previewImg.src = pendingSignatureBase64;
        if (previewBox) previewBox.style.display = 'flex';
        if (statusText) statusText.textContent = 'تم إرفاق صورة التوقيع ✅';
    } else {
        if (previewBox) previewBox.style.display = 'none';
        if (statusText) statusText.textContent = 'لم يتم رفع توقيع مخصص بعد';
    }
}

window.saveTeacherSettings = function(e) {
    if (e) e.preventDefault();

    const tName = document.getElementById('settingsTeacherName')?.value.trim();
    const sName = document.getElementById('settingsSchoolName')?.value.trim();
    const eDept = document.getElementById('settingsEduDept')?.value.trim() || 'الإدارة العامة للتعليم بالقصيم';

    if (!tName || !sName) {
        showNotification('يرجى إدخال اسم المعلم واسم المدرسة!', 'warning');
        return;
    }

    portfolioSettings.teacherName = tName;
    portfolioSettings.schoolName = sName;
    portfolioSettings.eduDept = eDept;
    if (pendingSignatureBase64 !== null) {
        portfolioSettings.signature = pendingSignatureBase64;
    }

    // Sync with sidebar profile
    const sideTeacher = document.getElementById('sidebarTeacherName');
    if (sideTeacher) sideTeacher.textContent = tName;
    const sideSchool = document.getElementById('sidebarSchoolName');
    if (sideSchool) sideSchool.textContent = sName;

    // Sync with portfolio inputs if present
    const portTeacher = document.getElementById('portTeacherName');
    if (portTeacher) portTeacher.value = tName;
    const portSchool = document.getElementById('portSchool');
    if (portSchool) portSchool.value = sName;

    saveData();
    closeTeacherSettingsModal();
    showNotification('✅ تم حفظ بيانات المعلم والمدرسة بنجاح!', 'success');
};












// ============================================================
// UNIFIED ADD STUDENTS DIALOG (SINGLE & BULK)
// ============================================================
window.openAddStudentsChoiceModal = function() {
    const activeCls = getActiveClass();
    if (!activeCls) {
        if (classes && classes.length > 0) {
            activeClassId = classes[0].id;
        } else {
            showNotification('يرجى إنشاء فصل أولاً قبل إضافة الطلاب!', 'warning');
            openClassModal();
            return;
        }
    }

    const modal = document.getElementById('addStudentsChoiceModal');
    if (!modal) return;

    // Reset fields
    const singleName = document.getElementById('singleStudentNameInput');
    const singlePhone = document.getElementById('singleStudentPhoneInput');
    const bulkText = document.getElementById('bulkStudentsTextarea');
    if (singleName) singleName.value = '';
    if (singlePhone) singlePhone.value = '';
    if (bulkText) bulkText.value = '';
    
    switchAddStudentTab('single');
    updateBulkCountPreview();
    modal.classList.add('active');

    setTimeout(() => {
        if (singleName) singleName.focus();
    }, 150);
};

window.closeAddStudentsChoiceModal = function() {
    const modal = document.getElementById('addStudentsChoiceModal');
    if (modal) modal.classList.remove('active');
};

window.switchAddStudentTab = function(tab) {
    const singleTabBtn = document.getElementById('tabSingleStudentBtn');
    const bulkTabBtn = document.getElementById('tabBulkStudentsBtn');
    const singleContent = document.getElementById('addSingleStudentTabContent');
    const bulkContent = document.getElementById('addBulkStudentsTabContent');

    if (tab === 'single') {
        if (singleTabBtn) {
            singleTabBtn.style.background = 'var(--accent-teal)';
            singleTabBtn.style.color = '#ffffff';
        }
        if (bulkTabBtn) {
            bulkTabBtn.style.background = 'transparent';
            bulkTabBtn.style.color = 'var(--text-muted)';
        }
        if (singleContent) singleContent.style.display = 'block';
        if (bulkContent) bulkContent.style.display = 'none';
        const singleName = document.getElementById('singleStudentNameInput');
        if (singleName) singleName.focus();
    } else {
        if (bulkTabBtn) {
            bulkTabBtn.style.background = 'var(--accent-teal)';
            bulkTabBtn.style.color = '#ffffff';
        }
        if (singleTabBtn) {
            singleTabBtn.style.background = 'transparent';
            singleTabBtn.style.color = 'var(--text-muted)';
        }
        if (singleContent) singleContent.style.display = 'none';
        if (bulkContent) bulkContent.style.display = 'block';
        const bulkText = document.getElementById('bulkStudentsTextarea');
        if (bulkText) bulkText.focus();
    }
};

window.updateBulkCountPreview = function() {
    const bulkText = document.getElementById('bulkStudentsTextarea');
    const badge = document.getElementById('bulkNamesCountBadge');
    if (!bulkText || !badge) return;

    const lines = bulkText.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    badge.textContent = `تم اكتشاف: ${lines.length} طالب`;
};

window.handleSingleStudentAddSubmit = function(e) {
    if (e) e.preventDefault();
    const activeCls = getActiveClass();
    if (!activeCls) {
        showNotification('لم يتم تحديد فصل حالي!', 'error');
        return;
    }

    const nameInput = document.getElementById('singleStudentNameInput');
    const phoneInput = document.getElementById('singleStudentPhoneInput');
    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!name) {
        showNotification('يرجى إدخال اسم الطالب!', 'warning');
        return;
    }

    if (!activeCls.students) activeCls.students = [];

    const newStudent = {
        id: 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: name,
        phone: phone || '',
        grades: {},
        behaviorPoints: []
    };

    activeCls.students.push(newStudent);
    saveData();
    updateDashboard();
    renderClassesLandingCards();
    closeAddStudentsChoiceModal();
    showNotification(`✅ تمت إضافة الطالب "${name}" بنجاح!`, 'success');
};

window.handleBulkStudentsAddSubmit = function(e) {
    if (e) e.preventDefault();
    const activeCls = getActiveClass();
    if (!activeCls) {
        showNotification('لم يتم تحديد فصل حالي!', 'error');
        return;
    }

    const bulkText = document.getElementById('bulkStudentsTextarea');
    if (!bulkText) return;

    const lines = bulkText.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
        showNotification('يرجى كتابة أو لصق اسم طالب واحد على الأقل!', 'warning');
        return;
    }

    if (!activeCls.students) activeCls.students = [];

    let addedCount = 0;
    lines.forEach(name => {
        const student = {
            id: 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5) + '-' + addedCount,
            name: name,
            phone: '',
            grades: {},
            behaviorPoints: []
        };
        activeCls.students.push(student);
        addedCount++;
    });

    saveData();
    updateDashboard();
    renderClassesLandingCards();
    closeAddStudentsChoiceModal();
    showNotification(`🎉 تم إضافة ${addedCount} طالب إلى فصل "${activeCls.name}" بنجاح!`, 'success');
};


// ============================================================
// COLLABORATIVE STUDENT GROUPS DIVISION FEATURE
// ============================================================
let currentGroupsData = [];

window.openStudentGroupsModal = function() {
    const activeCls = getActiveClass();
    if (!activeCls || !activeCls.students || activeCls.students.length === 0) {
        showNotification('لا يوجد طلاب في هذا الفصل لتقسيمهم إلى مجموعات!', 'warning');
        return;
    }

    const modal = document.getElementById('studentGroupsModal');
    if (!modal) return;

    modal.classList.add('active');
    onGroupSettingsChange();
    generateStudentGroups();
};

window.closeStudentGroupsModal = function() {
    const modal = document.getElementById('studentGroupsModal');
    if (modal) modal.classList.remove('active');
};

window.onGroupSettingsChange = function() {
    const mode = document.getElementById('groupDivideMode')?.value || 'byGroupCount';
    const label = document.getElementById('groupCountLabel');
    const input = document.getElementById('groupCountInput');
    const activeCls = getActiveClass();
    const totalStudents = activeCls?.students?.length || 0;

    if (mode === 'byGroupCount') {
        if (label) label.textContent = 'عدد المجموعات:';
        if (input) {
            input.min = 2;
            input.max = Math.max(2, totalStudents);
            if (parseInt(input.value) > totalStudents && totalStudents > 0) input.value = Math.min(4, totalStudents);
        }
    } else {
        if (label) label.textContent = 'عدد الطلاب/مجموعة:';
        if (input) {
            input.min = 2;
            input.max = Math.max(2, totalStudents);
            if (parseInt(input.value) > totalStudents && totalStudents > 0) input.value = Math.min(4, totalStudents);
        }
    }
    generateStudentGroups();
};

window.generateStudentGroups = function() {
    const activeCls = getActiveClass();
    if (!activeCls || !activeCls.students || activeCls.students.length === 0) return;

    const mode = document.getElementById('groupDivideMode')?.value || 'byGroupCount';
    const numVal = parseInt(document.getElementById('groupCountInput')?.value) || 4;
    const strategy = document.getElementById('groupDistributionStrategy')?.value || 'random';

    const studentsCopy = activeCls.students.map(s => {
        const total = getStudentTotal(s);
        return { id: s.id, name: s.name, total: total, isLeader: false };
    });

    let numGroups = 4;
    if (mode === 'byGroupCount') {
        numGroups = Math.max(1, Math.min(numVal, studentsCopy.length));
    } else {
        const perGroup = Math.max(1, numVal);
        numGroups = Math.max(1, Math.ceil(studentsCopy.length / perGroup));
    }

    // Initialize Groups
    const groupNames = [
        'مجموعة الرواد 🚀',
        'مجموعة النخبة 🌟',
        'مجموعة المبدعين 💡',
        'مجموعة الفرسان 🛡️',
        'مجموعة الأمل 🌈',
        'مجموعة التميز 🏆',
        'مجموعة الصقور 🦅',
        'مجموعة الأذكياء 🧠',
        'مجموعة النجوم ⭐',
        'مجموعة العلماء 🔬'
    ];

    const groupColors = ['#a855f7', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

    currentGroupsData = [];
    for (let i = 0; i < numGroups; i++) {
        currentGroupsData.push({
            id: 'grp-' + (i + 1),
            name: groupNames[i % groupNames.length] || `المجموعة (${i + 1})`,
            color: groupColors[i % groupColors.length],
            members: []
        });
    }

    if (strategy === 'balanced') {
        // Sort students by total grade descending
        studentsCopy.sort((a, b) => b.total - a.total);
        
        // Distribute snake-wise (round-robin zig-zag)
        let groupIdx = 0;
        let direction = 1;
        studentsCopy.forEach(st => {
            currentGroupsData[groupIdx].members.push(st);
            groupIdx += direction;
            if (groupIdx >= numGroups) {
                groupIdx = numGroups - 1;
                direction = -1;
            } else if (groupIdx < 0) {
                groupIdx = 0;
                direction = 1;
            }
        });
    } else {
        // Random Shuffle (Fisher-Yates)
        for (let i = studentsCopy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [studentsCopy[i], studentsCopy[j]] = [studentsCopy[j], studentsCopy[i]];
        }
        studentsCopy.forEach((st, idx) => {
            currentGroupsData[idx % numGroups].members.push(st);
        });
    }

    // Assign first member as default leader
    currentGroupsData.forEach(grp => {
        if (grp.members.length > 0) {
            grp.members[0].isLeader = true;
        }
    });

    renderStudentGroups();
};

window.renderStudentGroups = function() {
    const grid = document.getElementById('groupsCardsGrid');
    const summary = document.getElementById('groupsSummaryInfo');
    const activeCls = getActiveClass();
    if (!grid) return;

    grid.innerHTML = '';
    const totalStudents = activeCls?.students?.length || 0;

    if (summary) {
        summary.innerHTML = `
            <span>إجمالي الطلاب: <strong style="color:var(--text-main);">${totalStudents} طالب</strong> | عدد المجموعات: <strong style="color:#c084fc;">${currentGroupsData.length} مجموعات</strong></span>
            <span>💡 انقر على اسم المجموعة لتعديله، أو اضغط النجمة 👑 لتعيين قائد المجموعة.</span>
        `;
    }

    currentGroupsData.forEach((grp, gIdx) => {
        const card = document.createElement('div');
        card.className = 'group-card';
        card.style.borderColor = grp.color + '40';

        let membersHtml = '';
        grp.members.forEach((m, mIdx) => {
            membersHtml += `
                <div class="group-member-item">
                    <span style="font-weight: 600; display: flex; align-items: center; gap: 0.4rem;">
                        <span style="color: var(--text-muted); font-size: 0.75rem; width: 16px;">${mIdx + 1}.</span>
                        ${m.name}
                        ${m.isLeader ? '<span class="group-leader-badge"><i class="fa-solid fa-crown"></i> قائد</span>' : ''}
                    </span>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <button type="button" onclick="toggleGroupLeader(${gIdx}, ${mIdx})" title="تعيين كقائد للمجموعة" style="background: transparent; border: none; color: ${m.isLeader ? '#fbbf24' : 'var(--text-muted)'}; cursor: pointer; font-size: 0.85rem; padding: 2px 4px;">
                            <i class="fa-${m.isLeader ? 'solid' : 'regular'} fa-star"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="group-card-header">
                <input type="text" class="group-title-input" value="${grp.name}" onchange="currentGroupsData[${gIdx}].name = this.value" style="color: ${grp.color}; font-weight: 800;">
                <span class="group-badge-count" style="background: ${grp.color}20; color: ${grp.color};">${grp.members.length} طلاب</span>
            </div>
            <div class="group-members-list">
                ${membersHtml}
            </div>
            <button type="button" class="group-reward-btn" onclick="rewardGroup(${gIdx})">
                <i class="fa-solid fa-wand-magic-sparkles"></i> منح نقطة مشاركة للمجموعة ⭐
            </button>
        `;
        grid.appendChild(card);
    });
};

window.toggleGroupLeader = function(groupIdx, memberIdx) {
    if (!currentGroupsData[groupIdx]) return;
    currentGroupsData[groupIdx].members.forEach((m, idx) => {
        m.isLeader = (idx === memberIdx);
    });
    renderStudentGroups();
};

window.rewardGroup = function(groupIdx) {
    const grp = currentGroupsData[groupIdx];
    const activeCls = getActiveClass();
    if (!grp || !activeCls) return;

    let count = 0;
    grp.members.forEach(m => {
        const student = activeCls.students.find(s => s.id === m.id);
        if (student) {
            const gradesObj = getStudentSubjectGrades(student, activeSubjectId, activePeriodId);
            if (!Array.isArray(gradesObj.participation)) {
                gradesObj.participation = [];
            }
            // Add positive participation dot
            for (let i = 0; i < 10; i++) {
                if (!gradesObj.participation[i]) {
                    gradesObj.participation[i] = true;
                    count++;
                    break;
                }
            }
        }
    });

    saveData();
    updateDashboard();
    showNotification(`✨ تم منح نقطة تفاعل لجميع أعضاء (${grp.name}) بنجاح!`, 'success');
};

window.printStudentGroups = function() {
    const activeCls = getActiveClass();
    if (!activeCls || currentGroupsData.length === 0) return;

    const teacherName = portfolioSettings?.teacherName || 'معلم المادة';
    const schoolName = portfolioSettings?.schoolName || 'المدرسة';
    const className = activeCls.name;

    let groupsHtml = '';
    currentGroupsData.forEach(grp => {
        let membersList = grp.members.map((m, idx) => 
            `<li style="padding: 4px 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.9rem;">
                <strong>${idx + 1}.</strong> ${m.name} ${m.isLeader ? '<span style="color:#d97706; font-weight:bold;">(القائد 👑)</span>' : ''}
            </li>`
        ).join('');

        groupsHtml += `
            <div style="border: 2px solid #cbd5e1; border-radius: 10px; padding: 12px; page-break-inside: avoid; background: #fafafa;">
                <h4 style="margin: 0 0 8px 0; color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; font-size: 1rem; display: flex; justify-content: space-between;">
                    <span>${grp.name}</span>
                    <span style="font-size: 0.8rem; color: #64748b;">${grp.members.length} طلاب</span>
                </h4>
                <ol style="margin: 0; padding-right: 18px; list-style-type: none;">
                    ${membersList}
                </ol>
            </div>
        `;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="utf-8">
            <title>كشف مجموعات التعلم التعاوني - ${className}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800&display=swap');
                body { font-family: 'Tajawal', Arial, sans-serif; padding: 25px; color: #0f172a; direction: rtl; }
                .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
                .header h2 { margin: 0 0 5px 0; color: #1e1b4b; font-size: 1.4rem; }
                .meta { display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: bold; color: #475569; margin-top: 8px; }
                .groups-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                @media print {
                    button { display: none !important; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>📋 كشف توزيع مجموعات التعلم التعاوني</h2>
                <div class="meta">
                    <span>المدرسة: ${schoolName}</span>
                    <span>الفصل: ${className}</span>
                    <span>المعلم: ${teacherName}</span>
                    <span>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</span>
                </div>
            </div>
            <div class="groups-grid">
                ${groupsHtml}
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="background: #4338ca; color: white; border: none; padding: 10px 25px; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer;">
                    🖨️ طباعة الكشف
                </button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};


window.clearBulkTextarea = function() {
    const textarea = document.getElementById('bulkStudentsTextarea');
    const fileLabel = document.getElementById('excelUploadFileName');
    const fileInput = document.getElementById('bulkExcelFileInput');
    if (textarea) textarea.value = '';
    if (fileLabel) fileLabel.style.display = 'none';
    if (fileInput) fileInput.value = '';
    updateBulkCountPreview();
};

window.handleBulkExcelUpload = function(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    const fileLabel = document.getElementById('excelUploadFileName');
    if (fileLabel) {
        fileLabel.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> تم اختيار: ${file.name}`;
        fileLabel.style.display = 'block';
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            if (typeof XLSX === 'undefined') {
                showNotification('مكتبة قراءة الإكسل غير محملة!', 'error');
                return;
            }

            const workbook = XLSX.read(data, { type: 'array' });
            const extractedNames = [];
            const arabicWordPattern = /[\u0621-\u064A]+/g;
            const excludeKeywords = ['وزارة', 'التعليم', 'جدول', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'اسم', 'الطالب', 'رصد', 'درجات', 'الدرجة', 'رقم', 'الفصل', 'مادة', 'الكلية', 'السجل', 'المدني', 'حالة', 'الهوية', 'ملاحظات', 'المجموع', 'الصف'];

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                // Find candidate column index for student names
                let nameColIdx = -1;
                for (let r = 0; r < Math.min(10, rows.length); r++) {
                    const row = rows[r];
                    if (Array.isArray(row)) {
                        for (let c = 0; c < row.length; c++) {
                            const val = String(row[c]).trim();
                            if (val.includes('اسم الطالب') || val.includes('اسم الدارس') || val === 'الاسم' || val === 'اسم الطالب رباعي') {
                                nameColIdx = c;
                                break;
                            }
                        }
                    }
                    if (nameColIdx !== -1) break;
                }

                rows.forEach(row => {
                    if (!Array.isArray(row)) return;

                    if (nameColIdx !== -1 && row[nameColIdx]) {
                        const cellVal = String(row[nameColIdx]).trim();
                        const words = cellVal.match(arabicWordPattern) || [];
                        const hasExclude = words.some(w => excludeKeywords.includes(w));
                        if (!hasExclude && words.length >= 2 && words.length <= 6) {
                            extractedNames.push(words.join(' '));
                        }
                    } else {
                        // Scan entire row for name-like cell
                        row.forEach(cell => {
                            const str = String(cell).trim();
                            const words = str.match(arabicWordPattern) || [];
                            const hasExclude = words.some(w => excludeKeywords.includes(w));
                            if (!hasExclude && words.length >= 3 && words.length <= 6) {
                                extractedNames.push(words.join(' '));
                            }
                        });
                    }
                });
            });

            // Deduplicate names while preserving order
            const uniqueNames = [];
            const seen = new Set();
            extractedNames.forEach(name => {
                if (!seen.has(name)) {
                    seen.add(name);
                    uniqueNames.push(name);
                }
            });

            if (uniqueNames.length === 0) {
                showNotification('لم يتم العثور على أسماء طلاب واضحة في ملف الإكسل. يمكنك لصق الأسماء يدوياً.', 'warning');
                return;
            }

            const textarea = document.getElementById('bulkStudentsTextarea');
            if (textarea) {
                textarea.value = uniqueNames.join('\n');
                updateBulkCountPreview();
            }

            showNotification(`✅ تم سحب ${uniqueNames.length} اسم طالب بنجاح من ملف الإكسل!`, 'success');

        } catch (err) {
            console.error('Error reading Excel file:', err);
            showNotification('حدث خطأ أثناء قراءة ملف الإكسل: ' + err.message, 'error');
        }
    };

    reader.readAsArrayBuffer(file);
};


// ============================================================
// TRANSFER STUDENT TO ANOTHER CLASS (نقل الطالب إلى فصل آخر)
// ============================================================
let currentTransferStudentId = null;

window.openTransferStudentModal = function(studentId) {
    const activeClass = getActiveClass();
    if (!activeClass) return;

    const student = activeClass.students.find(s => s.id === studentId);
    if (!student) {
        showNotification('لم يتم العثور على بيانات الطالب!', 'error');
        return;
    }

    currentTransferStudentId = studentId;

    const nameEl = document.getElementById('transferStudentNameDisplay');
    if (nameEl) nameEl.textContent = student.name;

    const curClassEl = document.getElementById('transferCurrentClassDisplay');
    if (curClassEl) curClassEl.textContent = activeClass.name;

    const selectEl = document.getElementById('transferTargetClassSelect');
    if (selectEl) {
        selectEl.innerHTML = '';
        const otherClasses = classes.filter(c => c.id !== activeClass.id);
        
        if (otherClasses.length === 0) {
            showNotification('لا يوجد فصول أخرى لنقل الطالب إليها. أضف فصلاً جديداً أولاً!', 'warning');
            return;
        }

        otherClasses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.students ? c.students.length : 0} طالب)`;
            selectEl.appendChild(opt);
        });
    }

    const modal = document.getElementById('transferStudentModal');
    if (modal) modal.classList.add('active');
};

window.closeTransferStudentModal = function() {
    const modal = document.getElementById('transferStudentModal');
    if (modal) modal.classList.remove('active');
    currentTransferStudentId = null;
};

window.confirmTransferStudent = function(e) {
    if (e) e.preventDefault();

    const activeClass = getActiveClass();
    if (!activeClass || !currentTransferStudentId) return;

    const studentIndex = activeClass.students.findIndex(s => s.id === currentTransferStudentId);
    if (studentIndex === -1) {
        showNotification('لم يتم العثور على الطالب في الفصل الحالي!', 'error');
        closeTransferStudentModal();
        return;
    }

    const targetClassId = document.getElementById('transferTargetClassSelect')?.value;
    const targetClass = classes.find(c => c.id === targetClassId);

    if (!targetClass) {
        showNotification('يرجى اختيار فصل صالح لنقل الطالب إليه!', 'warning');
        return;
    }

    const preserveGrades = document.getElementById('transferPreserveGrades')?.checked !== false;

    // Extract student from current class
    const [studentToMove] = activeClass.students.splice(studentIndex, 1);

    if (!preserveGrades) {
        // Reset grades if unchecked
        studentToMove.grades = {};
        studentToMove.behaviorPoints = [];
    }

    // Ensure target class has students array
    if (!targetClass.students) targetClass.students = [];
    targetClass.students.push(studentToMove);

    // Save and refresh UI
    saveData();
    closeTransferStudentModal();
    updateDashboard();
    renderClassesLandingCards();

    showNotification(`✅ تم نقل الطالب "${studentToMove.name}" بنجاح إلى "${targetClass.name}"`, 'success');
};
