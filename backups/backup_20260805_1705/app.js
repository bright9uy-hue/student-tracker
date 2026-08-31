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
let gradingDistribution = null; // Custom grading distribution wizard configuration
let performanceChartInstance = null;
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
    setupEventListeners();
    
    if (!gradingDistribution) {
        // First run: automatically set default distribution and save
        gradingDistribution = { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };
        saveData();
    }
    
    // Always enter directly to the dashboard
    buildAllCheckboxes();
    renderClassesTabs();
    renderSubjectsTabs();
    renderPeriodSelector();
    updateDashboard();
    checkWeeklyReportStatus();
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
    container.innerHTML = '';
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
    container.innerHTML = '';
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
    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10 };
    buildCheckboxes('assignmentsCheckboxes', 'assignmentsSum', 'assign', dist.assignments);
    buildCheckboxes('activitiesCheckboxes',  'activitiesSum',  'activity', dist.activities);
    buildCheckboxes('researchCheckboxes',    'researchSum',    'research', dist.research);
    buildParticipationDots(dist.participation);
    
    // Resize participation form state array to match custom limit
    formParticipationState = Array(dist.participation).fill(false);
}

window.calculateSetupTotal = function() {
    const sum = (parseInt(document.getElementById('setupAssignments').value) || 0) +
                (parseInt(document.getElementById('setupActivities').value) || 0) +
                (parseInt(document.getElementById('setupResearch').value) || 0) +
                (parseInt(document.getElementById('setupParticipation').value) || 0) +
                (parseInt(document.getElementById('setupPractical').value) || 0) +
                (parseInt(document.getElementById('setupExam').value) || 0);
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

    return sum;
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
    
    // Save to localStorage fallback
    safeStorage.setItem('student_tracker_classes_v2', JSON.stringify(dataObj));
    
    // Save to local server if running
    try {
        await fetch(getApiUrl('/api/data'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataObj)
        });
    } catch (e) {
        console.error('Failed to save to local server:', e);
    }
}

function getActiveClass()    { return classes.find(c => c.id === activeClassId); }
function getActiveStudents() { return getActiveClass()?.students || []; }

// ============================================================
// CLASSES TABS UI
// ============================================================
function renderClassesTabs() {
    const nav = document.getElementById('classesNav');
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
};

window.deleteClass = function(classId) {
    if (classes.length === 1) {
        showNotification('لا يمكن حذف الفصل الوحيد!', 'error');
        return;
    }
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    if (!confirm(`هل أنت متأكد من حذف فصل "${cls.name}" وجميع بياناته؟`)) return;
    classes = classes.filter(c => c.id !== classId);
    if (activeClassId === classId) activeClassId = classes[0].id;
    saveData();
    renderClassesTabs();
    updateDashboard();
    showNotification(`تم حذف فصل "${cls.name}".`, 'warning');
};

window.renameClass = function(classId) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    const name = prompt('أدخل الاسم الجديد للفصل:', cls.name);
    if (name && name.trim()) {
        cls.name = name.trim();
        saveData();
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
        const tab = document.createElement('div');
        tab.className = 'class-tab subject-tab' + (subj.id === activeSubjectId ? ' active' : '');
        tab.title = 'انقر مرتين لتغيير الاسم';
        tab.ondblclick = () => renameSubject(subj.id);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = subj.name;
        nameSpan.onclick = () => switchSubject(subj.id);
        tab.appendChild(nameSpan);

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
}

window.switchSubject = function(subjectId) {
    activeSubjectId = subjectId;
    saveData();
    renderSubjectsTabs();
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
    
    // Remove grades for this subject from all students
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

// ============================================================
// SUBJECTS MODAL
// ============================================================
const subjectModal = document.getElementById('subjectModal');
const subjectForm = document.getElementById('subjectForm');
const newSubjectNameInput = document.getElementById('newSubjectName');
const closeSubjectModalBtn = document.getElementById('closeSubjectModalBtn');
const cancelSubjectModalBtn = document.getElementById('cancelSubjectModalBtn');

function openSubjectModal() {
    subjectForm.reset();
    subjectModal.classList.add('active');
    setTimeout(() => newSubjectNameInput.focus(), 100);
}

function closeSubjectModal() {
    subjectModal.classList.remove('active');
}

window.setSubjectNameSuggestion = function(name) {
    newSubjectNameInput.value = name;
    newSubjectNameInput.focus();
};

// ============================================================
// CLASS MODAL
// ============================================================
const classModal = document.getElementById('classModal');
const classForm = document.getElementById('classForm');
const newClassNameInput = document.getElementById('newClassName');
const closeClassModalBtn = document.getElementById('closeClassModalBtn');
const cancelClassModalBtn = document.getElementById('cancelClassModalBtn');

function openClassModal() {
    classForm.reset();
    classModal.classList.add('active');
    setTimeout(() => newClassNameInput.focus(), 100);
}

function closeClassModal() {
    classModal.classList.remove('active');
}

window.setClassNameSuggestion = function(name) {
    newClassNameInput.value = name;
    newClassNameInput.focus();
};

function handleClassFormSubmit(e) {
    e.preventDefault();
    const name = newClassNameInput.value.trim();
    if (!name) return;
    const newClass = { id: 'class-' + Date.now(), name: name, students: [] };
    classes.push(newClass);
    activeClassId = newClass.id;
    saveData();
    renderClassesTabs();
    updateDashboard();
    closeClassModal();
    showNotification(`تمت إضافة فصل "${newClass.name}".`);
}

function handleSubjectFormSubmit(e) {
    e.preventDefault();
    const name = newSubjectNameInput.value.trim();
    if (!name) return;
    const newSubject = { id: 'subject-' + Date.now(), name: name };
    subjects.push(newSubject);
    activeSubjectId = newSubject.id;
    
    // Initialize grades object for this new subject for all existing students
    classes.forEach(cls => {
        cls.students.forEach(student => {
            if (!student.grades) student.grades = {};
            if (!student.grades[newSubject.id]) {
                student.grades[newSubject.id] = {
                    assignments: Array(gradingDistribution.assignments).fill(false),
                    activities: Array(gradingDistribution.activities).fill(false),
                    research: Array(gradingDistribution.research).fill(false),
                    participation: Array(gradingDistribution.participation).fill(false),
                    practical: 0,
                    exam: 0
                };
            }
        });
    });
    
    saveData();
    renderSubjectsTabs();
    updateDashboard();
    closeSubjectModal();
    showNotification(`تمت إضافة مادة "${newSubject.name}".`);
}

function handleGradingSetupFormSubmit(e) {
    e.preventDefault();
    
    gradingDistribution = {
        assignments: parseInt(document.getElementById('setupAssignments').value) || 0,
        activities: parseInt(document.getElementById('setupActivities').value) || 0,
        research: parseInt(document.getElementById('setupResearch').value) || 0,
        participation: parseInt(document.getElementById('setupParticipation').value) || 0,
        practical: parseInt(document.getElementById('setupPractical').value) || 0,
        exam: parseInt(document.getElementById('setupExam').value) || 0
    };
    
    // If no subjects exist yet, initialize default subject
    if (!subjects || subjects.length === 0) {
        subjects = [{ id: 'subject-1', name: 'رقمية 2' }];
        activeSubjectId = 'subject-1';
    }
    
    // Helper to resize boolean checkbox arrays while preserving true count (earned marks)
    const resizeBoolArray = (existingArr, targetLength) => {
        if (!Array.isArray(existingArr)) return Array(targetLength).fill(false);
        const solvedCount = existingArr.filter(v => v === true).length;
        const countToKeep = Math.min(solvedCount, targetLength);
        const result = Array(targetLength).fill(false);
        for (let i = 0; i < countToKeep; i++) {
            result[i] = true;
        }
        return result;
    };

    // Helper to resize participation array while preserving violations/notes
    const resizePartArray = (existingArr, targetLength) => {
        if (!Array.isArray(existingArr)) return Array(targetLength).fill(false);
        const stringViolations = existingArr.filter(v => typeof v === 'string' && v.trim() !== '');
        const solvedCount = existingArr.filter(v => v === true).length;
        const countToKeep = Math.min(solvedCount, targetLength);
        
        const result = Array(targetLength).fill(false);
        for (let i = 0; i < countToKeep; i++) {
            result[i] = true;
        }
        stringViolations.forEach((violation, idx) => {
            const pos = targetLength - 1 - idx;
            if (pos >= 0) {
                result[pos] = violation;
            }
        });
        return result;
    };

    // Helper to get grade object for student, supporting legacy top-level grade fields
    const getGradeObj = (student, subjId) => {
        if (student.grades && student.grades[subjId]) {
            return student.grades[subjId];
        }
        return {
            assignments: student.assignments || [],
            activities: student.activities || [],
            research: student.research || [],
            participation: student.participation || [],
            practical: student.practical || 0,
            exam: student.exam || 0
        };
    };

    // If classes exist, migrate and adjust existing grades safely without wiping classes/students
    if (classes && classes.length > 0) {
        classes.forEach(cls => {
            if (cls.students && Array.isArray(cls.students)) {
                cls.students.forEach(student => {
                    if (!student.grades) student.grades = {};
                    subjects.forEach(subj => {
                        const existingGrade = getGradeObj(student, subj.id);
                        student.grades[subj.id] = {
                            assignments: resizeBoolArray(existingGrade.assignments, gradingDistribution.assignments),
                            activities: resizeBoolArray(existingGrade.activities, gradingDistribution.activities),
                            research: resizeBoolArray(existingGrade.research, gradingDistribution.research),
                            participation: resizePartArray(existingGrade.participation, gradingDistribution.participation),
                            practical: Math.min(existingGrade.practical || 0, gradingDistribution.practical),
                            exam: Math.min(existingGrade.exam || 0, gradingDistribution.exam)
                        };
                    });
                });
            }
        });
    } else {
        classes = [{
            id: 'class-1',
            name: 'الفصل الأول أ',
            students: defaultClass.students.map(s => ({
                id: s.id,
                name: s.name,
                grades: {
                    'subject-1': {
                        assignments: Array(gradingDistribution.assignments).fill(false),
                        activities: Array(gradingDistribution.activities).fill(false),
                        research: Array(gradingDistribution.research).fill(false),
                        participation: Array(gradingDistribution.participation).fill(false),
                        practical: 0,
                        exam: 0
                    }
                }
            }))
        }];
        activeClassId = 'class-1';
    }

    if (!activeClassId && classes.length > 0) {
        activeClassId = classes[0].id;
    }
    
    saveData();
    buildAllCheckboxes();
    
    // Hide Setup Wizard Modal
    document.getElementById('gradingSetupModal').classList.remove('active');
    
    renderClassesTabs();
    renderSubjectsTabs();
    filterAndRenderTable();
    updateDashboard();
    checkWeeklyReportStatus();
    
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

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    addStudentBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    studentForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', filterAndRenderTable);
    statusFilter.addEventListener('change', filterAndRenderTable);
    exportCsvBtn.addEventListener('click', exportToCSV);
    studentModal.addEventListener('click', e => { if (e.target === studentModal) closeModal(); });

    // Class Modal
    document.getElementById('addClassBtn').addEventListener('click', openClassModal);
    closeClassModalBtn.addEventListener('click', closeClassModal);
    cancelClassModalBtn.addEventListener('click', closeClassModal);
    classForm.addEventListener('submit', handleClassFormSubmit);
    classModal.addEventListener('click', e => { if (e.target === classModal) closeClassModal(); });

    // Subject Modal
    document.getElementById('addSubjectBtn').addEventListener('click', openSubjectModal);
    closeSubjectModalBtn.addEventListener('click', closeSubjectModal);
    cancelSubjectModalBtn.addEventListener('click', closeSubjectModal);
    subjectForm.addEventListener('submit', handleSubjectFormSubmit);
    subjectModal.addEventListener('click', e => { if (e.target === subjectModal) closeSubjectModal(); });

    // Wizard Form
    document.getElementById('gradingSetupForm').addEventListener('submit', handleGradingSetupFormSubmit);

    // Bulk Grade Modal
    document.getElementById('bulkGradeBtn').addEventListener('click', openBulkGradeModal);
    document.getElementById('closeBulkGradeModalBtn').addEventListener('click', closeBulkGradeModal);
    document.getElementById('cancelBulkGradeModalBtn').addEventListener('click', closeBulkGradeModal);
    bulkGradeModal.addEventListener('click', e => { if (e.target === bulkGradeModal) closeBulkGradeModal(); });

    // Import Noor Modal
    document.getElementById('importNoorBtn').addEventListener('click', openImportNoorModal);
    document.getElementById('closeImportNoorModalBtn').addEventListener('click', closeImportNoorModal);
    document.getElementById('cancelImportNoorModalBtn').addEventListener('click', closeImportNoorModal);
    importNoorModal.addEventListener('click', e => { if (e.target === importNoorModal) closeImportNoorModal(); });

    // Import Madrasati Modal
    document.getElementById('importMadrasatiBtn').addEventListener('click', openMadrasatiImportModal);
    document.getElementById('closeMadrasatiImportModalBtn').addEventListener('click', closeMadrasatiImportModal);
    document.getElementById('cancelMadrasatiImportModalBtn').addEventListener('click', closeMadrasatiImportModal);
    madrasatiImportModal.addEventListener('click', e => { if (e.target === madrasatiImportModal) closeMadrasatiImportModal(); });

    // Reason Modal
    document.getElementById('closeReasonModalBtn').addEventListener('click', cancelReasonModal);
    document.getElementById('cancelReasonBtn').addEventListener('click', cancelReasonModal);
    document.getElementById('reasonModal').addEventListener('click', e => {
        if (e.target === document.getElementById('reasonModal')) cancelReasonModal();
    });

    // New Period Modal
    const addNewPeriodBtn = document.getElementById('addNewPeriodBtn');
    if (addNewPeriodBtn) addNewPeriodBtn.addEventListener('click', openNewPeriodModal);
    const closeNewPeriodModalBtn = document.getElementById('closeNewPeriodModalBtn');
    if (closeNewPeriodModalBtn) closeNewPeriodModalBtn.addEventListener('click', closeNewPeriodModal);
    const cancelNewPeriodModalBtn = document.getElementById('cancelNewPeriodModalBtn');
    if (cancelNewPeriodModalBtn) cancelNewPeriodModalBtn.addEventListener('click', closeNewPeriodModal);
    const newPeriodForm = document.getElementById('newPeriodForm');
    if (newPeriodForm) newPeriodForm.addEventListener('submit', handleNewPeriodFormSubmit);
    const newPeriodModal = document.getElementById('newPeriodModal');
    if (newPeriodModal) newPeriodModal.addEventListener('click', e => { if (e.target === newPeriodModal) closeNewPeriodModal(); });

    // Grading Setup Modal manual opening/closing
    const gradingSetupModal = document.getElementById('gradingSetupModal');
    document.getElementById('gradingDistributionBtn').addEventListener('click', () => {
        if (gradingDistribution) {
            document.getElementById('setupAssignments').value = gradingDistribution.assignments;
            document.getElementById('setupActivities').value = gradingDistribution.activities;
            document.getElementById('setupResearch').value = gradingDistribution.research;
            document.getElementById('setupParticipation').value = gradingDistribution.participation;
            document.getElementById('setupPractical').value = gradingDistribution.practical || 0;
            document.getElementById('setupExam').value = gradingDistribution.exam || 0;
        }
        gradingSetupModal.classList.add('active');
        calculateSetupTotal();
    });
    document.getElementById('closeGradingSetupModalBtn').addEventListener('click', () => {
        gradingSetupModal.classList.remove('active');
    });
    document.getElementById('cancelGradingSetupModalBtn').addEventListener('click', () => {
        gradingSetupModal.classList.remove('active');
    });
    gradingSetupModal.addEventListener('click', e => {
        if (e.target === gradingSetupModal) gradingSetupModal.classList.remove('active');
    });

    // WhatsApp Settings Modal
    document.getElementById('whatsappSettingsBtn').addEventListener('click', openWhatsappSettingsModal);
    document.getElementById('closeWhatsappSettingsModalBtn').addEventListener('click', closeWhatsappSettingsModal);
    document.getElementById('cancelWhatsappSettingsModalBtn').addEventListener('click', closeWhatsappSettingsModal);
    document.getElementById('whatsappSettingsForm').addEventListener('submit', handleWhatsappSettingsSubmit);
    document.getElementById('whatsappSettingsModal').addEventListener('click', e => {
        if (e.target === document.getElementById('whatsappSettingsModal')) closeWhatsappSettingsModal();
    });

    // PDF Report Preview Modal Overlay click
    const pdfReportModal = document.getElementById('pdfReportModal');
    pdfReportModal.addEventListener('click', e => {
        if (e.target === pdfReportModal) closePdfReportModal();
    });
}

function getStudentSubjectGrades(student, subjectId = activeSubjectId, periodId = activePeriodId) {
    if (!student.grades) student.grades = {};
    if (!student.grades[periodId]) student.grades[periodId] = {};

    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };

    // Migration: if periodId is period-1 and legacy top-level subject grades exist
    if (periodId === 'period-1' && !student.grades[periodId][subjectId] && student.grades[subjectId]) {
        student.grades[periodId][subjectId] = student.grades[subjectId];
    }

    if (!student.grades[periodId][subjectId]) {
        student.grades[periodId][subjectId] = {
            assignments: Array(dist.assignments).fill(false),
            activities: Array(dist.activities).fill(false),
            research: Array(dist.research).fill(false),
            participation: Array(dist.participation).fill(false),
            practical: 0,
            exam: 0
        };
    } else {
        const g = student.grades[periodId][subjectId];
        if (!Array.isArray(g.assignments) || g.assignments.length < dist.assignments) {
            const missing = dist.assignments - (Array.isArray(g.assignments) ? g.assignments.length : 0);
            g.assignments = [...(Array.isArray(g.assignments) ? g.assignments : []), ...Array(missing).fill(false)];
        }
        if (!Array.isArray(g.activities) || g.activities.length < dist.activities) {
            const missing = dist.activities - (Array.isArray(g.activities) ? g.activities.length : 0);
            g.activities = [...(Array.isArray(g.activities) ? g.activities : []), ...Array(missing).fill(false)];
        }
        if (!Array.isArray(g.research) || g.research.length < dist.research) {
            const missing = dist.research - (Array.isArray(g.research) ? g.research.length : 0);
            g.research = [...(Array.isArray(g.research) ? g.research : []), ...Array(missing).fill(false)];
        }
        if (!Array.isArray(g.participation) || g.participation.length < dist.participation) {
            const missing = dist.participation - (Array.isArray(g.participation) ? g.participation.length : 0);
            g.participation = [...(Array.isArray(g.participation) ? g.participation : []), ...Array(missing).fill(false)];
        }
    }
    return student.grades[periodId][subjectId];
}

// ============================================================
// STUDENT MODAL
// ============================================================
function openModal(student = null) {
    studentForm.reset();
    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10 };
    formParticipationState = Array(dist.participation).fill(false);

    // Set max inputs dynamically based on grading distribution
    const maxPrac = gradingDistribution ? gradingDistribution.practical : 40;
    const maxEx = gradingDistribution ? gradingDistribution.exam : 20;
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

    if (student) {
        modalTitle.innerHTML = `<i class="fa-solid fa-user-pen" style="color:var(--accent-teal);"></i> تعديل درجات الطالب`;
        studentIdInput.value = student.id;
        studentNameInput.value = student.name;
        
        const gradesObj = getStudentSubjectGrades(student);
        setCheckboxesState('assignmentsCheckboxes', 'assignmentsSum', gradesObj.assignments);
        setCheckboxesState('activitiesCheckboxes',  'activitiesSum',  gradesObj.activities);
        setCheckboxesState('researchCheckboxes',    'researchSum',    gradesObj.research);
        formParticipationState = Array(dist.participation).fill(false).map((_, i) =>
            Array.isArray(gradesObj.participation) ? (gradesObj.participation[i] || false) : false
        );
        gradePracticalInput.value = gradesObj.practical;
        gradeExamInput.value      = gradesObj.exam;
    } else {
        modalTitle.innerHTML = `<i class="fa-solid fa-user-plus" style="color:var(--primary-color);"></i> إضافة طالب جديد ورصد درجاته`;
        studentIdInput.value = '';
        gradePracticalInput.value = 0;
        gradeExamInput.value = 0;
        setCheckboxesState('assignmentsCheckboxes', 'assignmentsSum', []);
        setCheckboxesState('activitiesCheckboxes',  'activitiesSum',  []);
        setCheckboxesState('researchCheckboxes',    'researchSum',    []);
    }
    syncFormParticipationUI();
    studentModal.classList.add('active');
    studentNameInput.focus();
}

function setCheckboxesState(containerId, sumId, states) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
        cb.checked = Array.isArray(states) ? !!states[idx] : idx < (parseInt(states) || 0);
    });
    document.getElementById(sumId).textContent =
        container.querySelectorAll('input[type="checkbox"]:checked').length;
}

function closeModal() { studentModal.classList.remove('active'); }

// ============================================================
// REASON MODAL
// ============================================================
function openReasonModal()  { document.getElementById('reasonModal').classList.add('active'); }
function closeReasonModal() { document.getElementById('reasonModal').classList.remove('active'); }

function cancelReasonModal() {
    closeReasonModal();
    pendingReason = { studentId: null, index: null, context: null };
}

window.selectReason = function(reason) {
    const { studentId, index, context } = pendingReason;
    if (context === 'table') {
        const student = getActiveStudents().find(s => s.id === studentId);
        if (student && index !== null) {
            ensureParticipationArray(student);
            const gradesObj = getStudentSubjectGrades(student);
            gradesObj.participation[index] = reason;
            saveData();
            updateDashboard();
        }
    } else if (context === 'form' && index !== null) {
        formParticipationState[index] = reason;
        syncFormParticipationUI();
    } else if (context === 'bulk' && index !== null) {
        bulkParticipationState[index] = reason;
        syncBulkParticipationUI();
    }
    closeReasonModal();
    pendingReason = { studentId: null, index: null, context: null };
};

function ensureParticipationArray(student, subjectId = activeSubjectId) {
    const gradesObj = getStudentSubjectGrades(student, subjectId);
    if (!Array.isArray(gradesObj.participation)) {
        const dist = gradingDistribution || { participation: 10 };
        const n = parseInt(gradesObj.participation) || 0;
        gradesObj.participation = Array(dist.participation).fill(false).map((_, i) => i < n);
    }
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
    const id            = studentIdInput.value;
    const name          = studentNameInput.value.trim();
    const assignments   = getCheckboxesArrayState('assignmentsCheckboxes');
    const activities    = getCheckboxesArrayState('activitiesCheckboxes');
    const research      = getCheckboxesArrayState('researchCheckboxes');
    const participation = [...formParticipationState];
    const practical     = parseFloat(gradePracticalInput.value) || 0;
    const exam          = parseFloat(gradeExamInput.value) || 0;

    const maxPrac = gradingDistribution ? gradingDistribution.practical : 40;
    const maxEx = gradingDistribution ? gradingDistribution.exam : 20;

    if (practical > maxPrac || exam > maxEx) {
        showNotification(`تجاوزت بعض الدرجات الحد الأقصى! (العملي: ${maxPrac}، النهائي: ${maxEx})`, 'error');
        return;
    }

    const activeClass = getActiveClass();
    if (!activeClass) return;

    const gradesData = {
        assignments,
        activities,
        research,
        participation,
        practical,
        exam
    };

    if (id) {
        const student = activeClass.students.find(s => s.id === id);
        if (student) {
            student.name = name;
            const gradesObj = getStudentSubjectGrades(student);
            Object.assign(gradesObj, gradesData);
            showNotification(`تم تحديث درجات "${name}".`);
        }
    } else {
        const newStudent = {
            id: Date.now().toString(),
            name: name,
            grades: {}
        };
        const gradesObj = getStudentSubjectGrades(newStudent);
        Object.assign(gradesObj, gradesData);
        activeClass.students.push(newStudent);
        showNotification(`تمت إضافة الطالب "${name}".`);
    }
    saveData();
    closeModal();
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
function getCheckboxSum(arr) {
    if (!Array.isArray(arr)) return parseFloat(arr) || 0;
    return arr.filter(v => v === true).length;
}

function getParticipationScore(arr) {
    if (!Array.isArray(arr)) return parseFloat(arr) || 0;
    let score = 0;
    arr.forEach(v => {
        if (v === true) score++;
        else if (typeof v === 'string' && v) score--; // deduction
    });
    const maxVal = gradingDistribution ? gradingDistribution.participation : 10;
    return Math.max(0, Math.min(maxVal, score));
}

function getStudentTotal(student, subjectId = activeSubjectId) {
    const gradesObj = getStudentSubjectGrades(student, subjectId);
    return getCheckboxSum(gradesObj.assignments)
         + getCheckboxSum(gradesObj.activities)
         + getCheckboxSum(gradesObj.research)
         + getParticipationScore(gradesObj.participation)
         + (gradesObj.practical || 0)
         + (gradesObj.exam || 0);
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
    emptyState.style.display = data.length === 0 ? 'flex' : 'none';
    if (data.length === 0) return;

    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };
    const maxPrac = gradingDistribution ? gradingDistribution.practical : 40;
    const maxEx = gradingDistribution ? gradingDistribution.exam : 20;

    // Dynamically update main table header titles with current gradingDistribution max values
    const theadRow = document.querySelector('.students-table thead tr');
    if (theadRow && theadRow.children.length >= 7) {
        theadRow.children[1].textContent = `الواجبات (${dist.assignments})`;
        theadRow.children[2].textContent = `الأنشطة (${dist.activities})`;
        theadRow.children[3].textContent = `البحث والمشاريع (${dist.research})`;
        theadRow.children[4].textContent = `المشاركة (${dist.participation})`;
        theadRow.children[5].textContent = `العملي (${maxPrac})`;
        theadRow.children[6].textContent = `الاختبار (${maxEx})`;
    }

    data.forEach(student => {
        const total  = getStudentTotal(student);
        const status = getStudentStatus(total);
        const gradesObj = getStudentSubjectGrades(student);

        const tr = document.createElement('tr');
        tr.className = 'student-row';
        tr.innerHTML = `
            <td>
                <strong>${student.name}</strong>
            </td>
            <td>
                <div style="font-weight:700;margin-bottom:4px;">${getCheckboxSum(gradesObj.assignments)}</div>
                ${renderTableDots(student.id, 'assignments', gradesObj.assignments, dist.assignments)}
            </td>
            <td>
                <div style="font-weight:700;margin-bottom:4px;">${getCheckboxSum(gradesObj.activities)}</div>
                ${renderTableDots(student.id, 'activities', gradesObj.activities, dist.activities)}
            </td>
            <td>
                <div style="font-weight:700;margin-bottom:4px;">${getCheckboxSum(gradesObj.research)}</div>
                ${renderTableDots(student.id, 'research', gradesObj.research, dist.research)}
            </td>
            <td>
                <div style="font-weight:700;margin-bottom:4px;">${getParticipationScore(gradesObj.participation)}</div>
                ${renderTableDots(student.id, 'participation', gradesObj.participation, dist.participation)}
            </td>
            <td>
                <input type="number" class="table-input" value="${gradesObj.practical || 0}"
                    min="0" max="${maxPrac}" step="0.5" title="العملي (من ${maxPrac})"
                    onchange="updateTableGrade('${student.id}','practical',this,${maxPrac})"
                    onkeydown="if(event.key==='Enter')this.blur()">
            </td>
            <td>
                <input type="number" class="table-input" value="${gradesObj.exam || 0}"
                    min="0" max="${maxEx}" step="0.5" title="الاختبار (من ${maxEx})"
                    onchange="updateTableGrade('${student.id}','exam',this,${maxEx})"
                    onkeydown="if(event.key==='Enter')this.blur()">
            </td>
            <td id="total-${student.id}" style="font-weight:800;font-size:1.1rem;color:${total>=50?'var(--accent-teal)':'var(--danger-color)'}">${total}</td>
            <td id="badge-${student.id}">${buildStatusBadge(status)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon edit"   onclick="editStudent('${student.id}')"   title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-icon report" onclick="printStudentReport('${student.id}')" title="تقرير مستوى الطالب" style="color: var(--accent-teal); background: rgba(20, 184, 166, 0.1); border: 1px solid rgba(20, 184, 166, 0.2);"><i class="fa-solid fa-file-invoice"></i></button>
                    <button class="btn-icon delete" onclick="deleteStudent('${student.id}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        studentsTableBody.appendChild(tr);
    });
}

// Render dynamic number of dots for a table cell (participation supports 3 states, others are true/false)
function renderTableDots(studentId, category, states, maxVal) {
    let html = '<div class="table-checkbox-group">';
    for (let i = 0; i < maxVal; i++) {
        const val = Array.isArray(states) ? states[i] : (i < (parseInt(states) || 0));
        let cls = 'table-checkbox';
        let tip = `الدرجة ${i+1}`;
        if (val === true)                          { cls += ' checked';    tip = `إيجابية ${i+1}`; }
        else if (typeof val === 'string' && val)   { cls += ' deduction';  tip = `خصم: ${val}`; }
        html += `<span class="${cls}" onclick="toggleDot('${studentId}','${category}',${i})" title="${tip}"></span>`;
    }
    html += '</div>';
    return html;
}

window.toggleDot = function(studentId, category, index) {
    const student = getActiveStudents().find(s => s.id === studentId);
    if (!student) return;

    const gradesObj = getStudentSubjectGrades(student);
    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10 };

    if (category !== 'participation') {
        const maxVal = dist[category] || 10;
        if (!Array.isArray(gradesObj[category])) {
            const n = parseInt(gradesObj[category]) || 0;
            gradesObj[category] = Array(maxVal).fill(false).map((_, i) => i < n);
        }
        gradesObj[category][index] = !gradesObj[category][index];
        saveData();
        updateDashboard();
        return;
    }

    // Participation: 3-state cycle  empty→positive→reason→empty
    ensureParticipationArray(student);
    const val = gradesObj.participation[index];
    if (!val || val === false) {
        // Empty → Positive
        gradesObj.participation[index] = true;
        saveData();
        updateDashboard();
    } else if (val === true) {
        // Positive → open reason modal
        pendingReason = { studentId, index, context: 'table' };
        openReasonModal();
    } else {
        // Deduction (reason string) → Empty
        gradesObj.participation[index] = false;
        saveData();
        updateDashboard();
    }
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

    const newTotal  = getStudentTotal(student);
    const newStatus = getStudentStatus(newTotal);

    const totalCell = document.getElementById(`total-${studentId}`);
    if (totalCell) {
        totalCell.textContent  = newTotal;
        totalCell.style.color  = newTotal >= 50 ? 'var(--accent-teal)' : 'var(--danger-color)';
    }
    const badgeCell = document.getElementById(`badge-${studentId}`);
    if (badgeCell) badgeCell.innerHTML = buildStatusBadge(newStatus);

    updateDashboard();
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

// ============================================================
// DASHBOARD
// ============================================================
function updateDashboard() {
    filterAndRenderTable();
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

    const totalDistSum = gradingDistribution
        ? (gradingDistribution.assignments + gradingDistribution.activities + gradingDistribution.research + gradingDistribution.participation + gradingDistribution.practical + gradingDistribution.exam)
        : 100;
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

function updateChart(excellent, pass, fail) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    if (performanceChartInstance) performanceChartInstance.destroy();
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
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc', font: { family: 'Tajawal', size: 12, weight: 'bold' }, padding: 15 } },
                tooltip: { titleFont: { family: 'Tajawal' }, bodyFont: { family: 'Tajawal' } }
            },
            cutout: '65%'
        }
    });
}

// ============================================================
// CSV EXPORT
// ============================================================
function exportToCSV() {
    const students = getActiveStudents();
    if (students.length === 0) { showNotification('لا توجد بيانات!', 'error'); return; }
    const cls = getActiveClass();
    const activeSubjName = subjects.find(s=>s.id===activeSubjectId)?.name || 'مادة عامة';
    let csv = `فصل: ${cls.name}\nالمادة: ${activeSubjName}\n`;
    csv += 'اسم الطالب,الواجبات,الأنشطة,البحث والمشاريع,المشاركة,العملي,الاختبار,المجموع,التقدير\n';
    students.forEach(s => {
        const total  = getStudentTotal(s);
        const status = total >= 90 ? 'ممتاز' : total >= 50 ? 'ناجح' : 'متعثر';
        const gradesObj = getStudentSubjectGrades(s);
        csv += `"${s.name}",${getCheckboxSum(gradesObj.assignments)},${getCheckboxSum(gradesObj.activities)},${getCheckboxSum(gradesObj.research)},${getParticipationScore(gradesObj.participation)},${gradesObj.practical || 0},${gradesObj.exam || 0},${total},"${status}"\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${cls.name}_${activeSubjName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showNotification('تم تصدير التقرير بنجاح.');
}

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

function openBulkGradeModal() {
    if (getActiveStudents().length === 0) {
        showNotification('لا يوجد طلاب في هذا الفصل لرصدهم جماعياً!', 'error');
        return;
    }
    bulkGradeCategory.value = 'assignments';
    bulkGradeModal.classList.add('active');
    onBulkCategoryChange();
}

function closeBulkGradeModal() {
    bulkGradeModal.classList.remove('active');
}

window.onBulkCategoryChange = function() {
    const cat = bulkGradeCategory.value;
    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10 };
    
    // Hide all
    bulkCheckboxSection.style.display = 'none';
    bulkParticipationSection.style.display = 'none';
    bulkNumberSection.style.display = 'none';

    if (cat === 'assignments' || cat === 'activities' || cat === 'research') {
        bulkCheckboxSection.style.display = 'block';
        bulkCheckboxesContainer.innerHTML = '';
        const limit = dist[cat] || 10;
        for (let i = 1; i <= limit; i++) {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="bulk_cb_${i}" value="${i}">
                <label for="bulk_cb_${i}">${i}</label>
            `;
            bulkCheckboxesContainer.appendChild(div);
        }
    } else if (cat === 'participation') {
        bulkParticipationSection.style.display = 'block';
        bulkParticipationState = Array(dist.participation).fill(false);
        renderBulkParticipationDots();
    } else if (cat === 'practical') {
        bulkNumberSection.style.display = 'block';
        const maxPrac = gradingDistribution ? gradingDistribution.practical : 40;
        bulkNumberLabel.textContent = `الدرجة المُراد رصدها للعملي (من ${maxPrac}):`;
        bulkNumberValue.max = maxPrac;
        bulkNumberValue.value = 0;
        bulkNumberInfo.textContent = `الحد الأقصى: ${maxPrac} درجة للعملي.`;
    } else if (cat === 'exam') {
        bulkNumberSection.style.display = 'block';
        const maxEx = gradingDistribution ? gradingDistribution.exam : 20;
        bulkNumberLabel.textContent = `الدرجة المُراد رصدها للاختبار (من ${maxEx}):`;
        bulkNumberValue.max = maxEx;
        bulkNumberValue.value = 0;
        bulkNumberInfo.textContent = `الحد الأقصى: ${maxEx} درجة للاختبار النهائي.`;
    }
};

function renderBulkParticipationDots() {
    bulkParticipationContainer.innerHTML = '';
    const limit = gradingDistribution ? gradingDistribution.participation : 10;
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
    const limit = gradingDistribution ? gradingDistribution.participation : 10;
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
    const cat = bulkGradeCategory.value;
    const studentsList = getActiveStudents();

    if (studentsList.length === 0) return;

    if (!confirm('هل أنت متأكد من تطبيق الرصد الجماعي على جميع طلاب هذا الفصل؟ سيؤدي ذلك لمسح الدرجات القديمة في هذه الخانة.')) {
        return;
    }

    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10 };

    if (cat === 'assignments' || cat === 'activities' || cat === 'research') {
        const states = [];
        const limit = dist[cat] || 10;
        for (let i = 1; i <= limit; i++) {
            const cb = document.getElementById(`bulk_cb_${i}`);
            states.push(cb ? cb.checked : false);
        }
        studentsList.forEach(s => {
            const gradesObj = getStudentSubjectGrades(s);
            gradesObj[cat] = [...states];
        });
    } else if (cat === 'participation') {
        studentsList.forEach(s => {
            const gradesObj = getStudentSubjectGrades(s);
            gradesObj.participation = [...bulkParticipationState];
        });
    } else if (cat === 'practical' || cat === 'exam') {
        let val = parseFloat(bulkNumberValue.value) || 0;
        const max = cat === 'practical' ? (gradingDistribution ? gradingDistribution.practical : 40) : (gradingDistribution ? gradingDistribution.exam : 20);
        if (val < 0) val = 0;
        if (val > max) val = max;
        studentsList.forEach(s => {
            const gradesObj = getStudentSubjectGrades(s);
            gradesObj[cat] = val;
        });
    }

    saveData();
    updateDashboard();
    closeBulkGradeModal();
    showNotification('تم تطبيق الرصد الجماعي بنجاح لجميع طلاب الفصل.', 'success');
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
            showNotification('الرجاء اختيار ملف CSV أولاً!', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            extractNamesFromCSV(content);
        };
        reader.readAsText(file, 'utf-8');
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
            const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10 };
            newStudent.grades[activeSubjectId] = {
                assignments: Array(dist.assignments).fill(false),
                activities: Array(dist.activities).fill(false),
                research: Array(dist.research).fill(false),
                participation: Array(dist.participation).fill(false),
                practical: 0,
                exam: 0
            };
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

function openMadrasatiImportModal() {
    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('لا يوجد فصل نشط للاستيراد!', 'error');
        return;
    }
    
    // Fill assignments select options dynamically based on setup values
    madrasatiAssignIndex.innerHTML = '';
    const dist = gradingDistribution || { assignments: 10 };
    const maxAssignmentsCount = dist.assignments || 10;
    
    for (let i = 0; i < maxAssignmentsCount; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `الواجب رقم ${i + 1}`;
        madrasatiAssignIndex.appendChild(opt);
    }
    
    madrasatiPasteArea.value = '';
    madrasatiImportModal.classList.add('active');
}

function closeMadrasatiImportModal() {
    madrasatiImportModal.classList.remove('active');
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
        // Fallback: if it's not valid JSON, try to parse line-by-line text
        // E.g.:
        // أحمد المطيري تم الحل
        // محمد الحربي لم يتم الحل
        const lines = pasteVal.split('\n');
        lines.forEach(line => {
            if (!line.trim()) return;
            // Search for names and solved keywords
            let solved = false;
            if (line.includes('تم الحل') || line.includes('محلول') || line.includes('تمت الإجابة')) {
                solved = true;
            }
            
            // Extract name by removing keywords
            let cleanLine = line.replace(/تم الحل|لم يتم الحل|محلول|غير محلول|تمت الإجابة/g, '').trim();
            if (cleanLine.length > 5) {
                importedData.push({ name: cleanLine, solved: solved });
            }
        });
    }
    
    if (!Array.isArray(importedData) || importedData.length === 0) {
        showNotification('لم يتم العثور على بيانات طلاب صالحة للاستيراد!', 'error');
        return;
    }
    
    const assignIdx = parseInt(madrasatiAssignIndex.value);
    let matchedCount = 0;
    
    importedData.forEach(item => {
        if (!item.name) return;
        const student = matchStudentArabicName(item.name, activeClass.students);
        if (student) {
            const gradesObj = getStudentSubjectGrades(student);
            if (gradesObj && Array.isArray(gradesObj.assignments)) {
                gradesObj.assignments[assignIdx] = !!item.solved;
                matchedCount++;
            }
        }
    });
    
    saveData();
    updateDashboard();
    closeMadrasatiImportModal();
    showNotification(`تم بنجاح مطابقة ورصد واجبات (${matchedCount}) من أصل (${importedData.length}) طالباً مستورداً!`, 'success');
});

// AUTOMATED PULL FROM MADRASATI
window.triggerAutoMadrasatiSync = function() {
    showNotification('جاري الاتصال التلقائي بمنصة مدرستي... سيتم الدخول، وسحب الواجب الأخير، ورصده، وتسجيل المتأخرين، وإغلاق الصفحة تلقائياً بالكامل في ثوانٍ!', 'info');
    window.open("https://schools.madrasati.sa/Teacher/Assignments/Index?autosync=true", "_blank");
};

window.importMadrasatiGradesList = function(importedData) {
    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('لا يوجد فصل نشط لاستيراد الواجبات إليه!', 'error');
        return;
    }

    if (!Array.isArray(importedData) || importedData.length === 0) return;

    // Find the first empty assignment column index
    const dist = gradingDistribution || { assignments: 10 };
    const maxAssignmentsCount = dist.assignments || 10;
    let assignIdx = 0;
    for (let i = 0; i < maxAssignmentsCount; i++) {
        const hasAnyGrade = activeClass.students.some(s => {
            const grades = getStudentSubjectGrades(s);
            return grades && grades.assignments && grades.assignments[i] !== undefined && grades.assignments[i] !== null;
        });
        if (!hasAnyGrade) {
            assignIdx = i;
            break;
        }
    }

    let matchedCount = 0;
    let infractionCount = 0;

    importedData.forEach(item => {
        if (!item.name) return;
        const student = matchStudentArabicName(item.name, activeClass.students);
        if (student) {
            const gradesObj = getStudentSubjectGrades(student);
            if (gradesObj) {
                // Record assignment grade
                if (Array.isArray(gradesObj.assignments)) {
                    gradesObj.assignments[assignIdx] = !!item.solved;
                }

                // If not solved, log as behavior infraction (red dot) in first empty participation slot!
                if (!item.solved) {
                    if (Array.isArray(gradesObj.participation)) {
                        const emptyIdx = gradesObj.participation.findIndex(p => p === null || p === undefined || p === '');
                        if (emptyIdx !== -1) {
                            gradesObj.participation[emptyIdx] = `لم يحل الواجب ${assignIdx + 1}`;
                            infractionCount++;
                        }
                    }
                }
                matchedCount++;
            }
        }
    });

    saveData();
    updateDashboard();
    showNotification(`تلقائي: تم استيراد "الواجب ${assignIdx + 1}" ورصد درجات (${matchedCount}) طالباً. وتم تسجيل (${infractionCount}) نقاط حمراء للمتخلفين عن الحل.`, 'success');
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
    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('لا يوجد فصل نشط لإرسال التقرير عنه!', 'error');
        return;
    }
    
    // Filter students with red dots (string values in participation)
    const violatingStudents = activeClass.students.filter(student => {
        const gradesObj = getStudentSubjectGrades(student);
        if (!Array.isArray(gradesObj.participation)) return false;
        return gradesObj.participation.some(p => typeof p === 'string' && p.trim() !== '');
    });
    
    // Filter students with missed homeworks
    const dist = gradingDistribution || { assignments: 10 };
    const totalAssignments = dist.assignments || 10;
    const deficientStudents = activeClass.students.filter(student => {
        const gradesObj = getStudentSubjectGrades(student);
        return getCheckboxSum(gradesObj.assignments) < totalAssignments;
    });
    
    if (violatingStudents.length === 0 && deficientStudents.length === 0) {
        showNotification('الحمد لله، لا توجد مخالفات سلوكية أو واجبات غير منجزة في هذا الفصل!', 'success');
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
    
    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'رقمية 2';
    const reportDateStr = new Date().toLocaleDateString('ar-SA');

    // Build backup WhatsApp message text
    let messageText = `*تقرير السلوك والواجبات الأسبوعي* 📊\n`;
    messageText += `*المادة:* ${activeSubjName}\n`;
    messageText += `*الفصل:* ${activeClass.name}\n`;
    messageText += `*التاريخ:* ${reportDateStr}\n\n`;
    
    messageText += `*1. المخالفات السلوكية (النقاط الحمراء):*\n`;
    if (violatingStudents.length > 0) {
        violatingStudents.forEach((student, index) => {
            const gradesObj = getStudentSubjectGrades(student);
            const violations = gradesObj.participation.filter(p => typeof p === 'string' && p.trim() !== '');
            const count = violations.length;
            const details = violations.join('، ');
            messageText += `${index + 1}. *${student.name}* (${count} نقاط حمراء) - المخالفات: ${details}\n`;
        });
    } else {
        messageText += `- لا توجد مخالفات سلوكية. الحمد لله.\n`;
    }
    
    messageText += `\n*2. الطلاب غير المسلمين للواجبات:*\n`;
    if (deficientStudents.length > 0) {
        deficientStudents.forEach((student, index) => {
            const gradesObj = getStudentSubjectGrades(student);
            const missedIndices = [];
            for (let i = 0; i < totalAssignments; i++) {
                if (!gradesObj.assignments[i]) {
                    missedIndices.push(i + 1);
                }
            }
            messageText += `${index + 1}. *${student.name}* (لم يحل ${missedIndices.length} واجبات: واجب رقم ${missedIndices.join('، ')})\n`;
        });
    } else {
        messageText += `- جميع الطلاب أنجزوا واجباتهم. الحمد لله.\n`;
    }
    
    messageText += `\n*ملاحظات المعلم:* نوصي بالمتابعة المستمرة من أولياء الأمور لتعديل سلوك الطلاب وحثهم على أداء الواجبات.\n`;
    messageText += `شاكرين لكم تعاونكم. 🌹`;

    const drawAndSend = () => {
        const reportArea = document.getElementById('printableReportArea');
        if (!reportArea) return;
        
        let tableRowsHtml = '';
        violatingStudents.forEach((student, index) => {
            const gradesObj = getStudentSubjectGrades(student);
            const violations = gradesObj.participation.filter(p => typeof p === 'string' && p.trim() !== '');
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
            const missedIndices = [];
            for (let i = 0; i < totalAssignments; i++) {
                if (!gradesObj.assignments[i]) {
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
                    الحمد لله، جميع طلاب الفصل ملتزمون بحل كافة الواجبات.
                </td>
            </tr>`;
        }
        
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
                    نموذج تقرير المتابعة الأسبوعي (المخالفات والواجبات)
                </span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    المادة: ${activeSubjName}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    الصف / الفصل: ${activeClass.name}
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; background: #f8fafc; font-weight: bold; text-align: center;">
                    التاريخ: ${reportDateStr}
                </div>
            </div>
            
            <div style="font-size: 0.85rem; font-weight: 800; color: var(--accent-teal); border-right: 3px solid var(--accent-teal); padding-right: 8px; margin-bottom: 8px; text-align: right;">
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
            </table>
            
            <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 15px; font-size: 0.8rem; line-height: 1.5; text-align: right;">
                <strong>توصيات المعلم للتسوية الأكاديمية والسلوكية:</strong><br>
                • المتابعة الأسبوعية من أولياء الأمور لتعديل سلوك الطلاب وحثهم على تسليم الواجبات.<br>
                • تنسيق التدخل التربوي السلوكي والتعليمي مع إدارة المدرسة والتوجه الطلابي.
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 0.8rem; color: #1e293b;">
                <div style="width: 45%; text-align: center; line-height: 1.6;">
                    <span style="font-weight: 700; display: block; margin-bottom: 25px;">معد التقرير / أ. ${portfolioSettings.teacherName || '....................'}</span>
                    <div style="border-top: 1px solid #cbd5e1; width: 80%; margin: 0 auto; color: #64748b; font-size: 0.7rem; padding-top: 2px;">التوقيع</div>
                </div>
                <div style="width: 45%; text-align: center; line-height: 1.6;">
                    <span style="font-weight: 700; display: block; margin-bottom: 25px;">قائد المدرسة / ....................................</span>
                    <div style="border-top: 1px solid #cbd5e1; width: 80%; margin: 0 auto; color: #64748b; font-size: 0.7rem; padding-top: 2px;">الختم والتوقيع</div>
                </div>
            </div>
            
            <div style="background: #0f172a; color: #ffffff; padding: 8px 15px; display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; margin-top: 30px; border-radius: 4px;">
                <span>نظام متابعة أداء الطلاب - تقرير أسبوعي تلقائي للمتابعة</span>
                <span>تاريخ التصدير: ${reportDateStr}</span>
            </div>
        `;
        
        setTimeout(() => {
            html2canvas(reportArea, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            }).then(canvas => {
                generatedCanvasDataUrl = canvas.toDataURL('image/png');
                
                pdfReportPreviewImage.src = generatedCanvasDataUrl;
                pdfReportPreviewImage.style.display = 'block';
                
                pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#25d366;"></i> تم رسم التقرير بنجاح!`;
                
                setTimeout(() => {
                    window.triggerPdfDownload();
                }, 800);
                
                try {
                    const blob = dataURLtoBlob(generatedCanvasDataUrl);
                    const item = new ClipboardItem({ "image/png": blob });
                    navigator.clipboard.write([item]).then(() => {
                        console.log('[WhatsApp Auto-Sender] Image copied to clipboard successfully.');
                        const cleanNum = whatsappNumber.replace(/[\s\+\-]/g, '');
                        const url = `https://web.whatsapp.com/send?phone=${cleanNum}&autopaste=true&autoclick=true`;
                        window.open(url, '_blank');
                    }).catch(err => {
                        console.error('[WhatsApp Auto-Sender] Clipboard write failed:', err);
                        const cleanNum = whatsappNumber.replace(/[\s\+\-]/g, '');
                        const url = `https://web.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(messageText)}&autoclick=true`;
                        window.open(url, '_blank');
                    });
                } catch (e) {
                    console.error('[WhatsApp Auto-Sender] Clipboard write exception:', e);
                    const cleanNum = whatsappNumber.replace(/[\s\+\-]/g, '');
                    const url = `https://web.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(messageText)}&autoclick=true`;
                    window.open(url, '_blank');
                }
            }).catch(err => {
                console.error('[WhatsApp Auto-Sender] html2canvas error:', err);
                pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> فشل رسم التقرير برمجياً.`;
            });
        }, 100);
    };

    drawAndSend();
};

window.triggerPdfDownload = triggerPdfDownload;
function triggerPdfDownload() {
    const activeClass = getActiveClass();
    if (!activeClass || !generatedCanvasDataUrl) {
        showNotification('لا توجد بيانات تقرير صالحة للتحميل!', 'error');
        return;
    }
    
    const pdfGenerationStatus = document.getElementById('pdfGenerationStatus');
    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> جاري تنزيل الصورة...`;
    
    const link = document.createElement('a');
    link.download = `تقرير_مخالفات_${activeClass.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = generatedCanvasDataUrl;
    link.click();
    
    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#25d366;"></i> تم تحميل الصورة بنجاح!`;
    
    // Update last report timer
    lastReportDate = Date.now();
    saveData();
    checkWeeklyReportStatus();
    
    setTimeout(() => {
        closePdfReportModal();
        showNotification('تم تحميل تقرير الصورة بنجاح!', 'success');
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
const portfolioModal = document.getElementById('portfolioModal');

// Event Listeners for Portfolio
document.getElementById('portfolioBtn').addEventListener('click', openPortfolioModal);
document.getElementById('closePortfolioModalBtn').addEventListener('click', closePortfolioModal);
document.getElementById('cancelPortfolioModalBtn').addEventListener('click', closePortfolioModal);
document.getElementById('exportPortfolioPdfBtn').addEventListener('click', exportPortfolioPdf);
portfolioModal.addEventListener('click', e => {
    if (e.target === portfolioModal) closePortfolioModal();
});

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
            const failingStudentsList = students.filter(s => getStudentTotal(s) < 60);
            const outstandingStudentsList = students.filter(s => getStudentTotal(s) >= 90);

            let failingRows = '';
            if (failingStudentsList.length > 0) {
                failingRows = failingStudentsList.map(s => {
                    const total = getStudentTotal(s);
                    const gradesObj = getStudentSubjectGrades(s);
                    
                    const solvedAssignments = getCheckboxSum(gradesObj.assignments);
                    const totalAssignments  = (gradesObj.assignments || []).length || 10;
                    const solvedActivities   = getCheckboxSum(gradesObj.activities);
                    const totalActivities   = (gradesObj.activities || []).length || 10;
                    const solvedResearch     = getCheckboxSum(gradesObj.research);
                    const totalResearch     = (gradesObj.research || []).length || 10;
                    const maxPrac = gradingDistribution ? gradingDistribution.practical : 40;
                    const maxEx   = gradingDistribution ? gradingDistribution.exam : 20;
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
                    const total = getStudentTotal(s);
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
        const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };
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
                        <tr><td style="border: 1px solid #cbd5e1; padding:6px; font-weight:700;">الواجبات المنزلية</td><td style="border: 1px solid #cbd5e1; padding:6px; text-align:center; font-weight:700;">${dist.assignments} درجات</td><td style="border: 1px solid #cbd5e1; padding:6px;">متابعة أسبوعية عبر نظام الرصد التلقائي ومدرستي</td></tr>
                        <tr><td style="border: 1px solid #cbd5e1; padding:6px; font-weight:700;">الأنشطة والبحوث</td><td style="border: 1px solid #cbd5e1; padding:6px; text-align:center; font-weight:700;">${dist.activities + dist.research} درجات</td><td style="border: 1px solid #cbd5e1; padding:6px;">تقديم مشاريع جماعية ومهام تطبيقية مهارية</td></tr>
                        <tr><td style="border: 1px solid #cbd5e1; padding:6px; font-weight:700;">المشاركة والمهام الصفية</td><td style="border: 1px solid #cbd5e1; padding:6px; text-align:center; font-weight:700;">${dist.participation} درجات</td><td style="border: 1px solid #cbd5e1; padding:6px;">سجل رصد سلوكي وحضوري تفاعلي مستمر للحصة</td></tr>
                        <tr><td style="border: 1px solid #cbd5e1; padding:6px; font-weight:700;">الاختبارات العملية</td><td style="border: 1px solid #cbd5e1; padding:6px; text-align:center; font-weight:700;">${dist.practical} درجة</td><td style="border: 1px solid #cbd5e1; padding:6px;">رصد درجات أداء الطلاب في الجوانب التطبيقية</td></tr>
                        <tr><td style="border: 1px solid #cbd5e1; padding:6px; font-weight:700;">الاختبار النهائي</td><td style="border: 1px solid #cbd5e1; padding:6px; text-align:center; font-weight:700;">${dist.exam} درجة</td><td style="border: 1px solid #cbd5e1; padding:6px;">اختبار نهاية الفصل الدراسي الموحد إدارياً</td></tr>
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
                    <strong>أداة الرصد والتحليل المعتمدة:</strong> نظام متابعة أداء الطلاب المحترف (Student Performance Tracker)<br>
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
            const grades = students.map(s => getStudentTotal(s));
            
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
        targetClasses.forEach(currentClass => {
            const students = currentClass.students || [];
            const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };
            
            let tableRowsHtml = '';
            students.forEach((student, idx) => {
                const gradesObj = getStudentSubjectGrades(student);
                const assSum = getCheckboxSum(gradesObj.assignments);
                const actSum = getCheckboxSum(gradesObj.activities);
                const resSum = getCheckboxSum(gradesObj.research);
                const partSum = getParticipationScore(gradesObj.participation);
                const prac = gradesObj.practical || 0;
                const ex = gradesObj.exam || 0;
                const total = assSum + actSum + resSum + partSum + prac + ex;
                const status = getStudentStatus(total);
                const statusText = status === 'excellent' ? 'ممتاز' : (status === 'pass' ? 'ناجح' : 'متعثر');

                tableRowsHtml += `
                    <tr style="border: 1px solid #e2e8f0;">
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
                        <td style="padding: 4px; text-align: right; font-weight: 700; border: 1px solid #cbd5e1;">${student.name}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${assSum}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${actSum}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${resSum}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${partSum}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${prac}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${ex}</td>
                        <td style="padding: 4px; text-align: center; font-weight: 800; color: ${total >= 50 ? '#0d9488' : '#ef4444'}; border: 1px solid #cbd5e1;">${total}</td>
                        <td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">${statusText}</td>
                    </tr>
                `;
            });

            const content = `
                <div style="margin-top: 0.25rem; overflow-x:auto;">
                    <p style="font-size:0.85rem; margin-bottom:0.4rem; font-weight:600; color:#475569;">الشاهد المعتمد: كشوفات متابعة الطلاب الشاملة لجميع أنواع التقييمات للمقرر (${currentClass.name})</p>
                    <table class="port-table" style="font-size:0.7rem; width:100%; border-collapse:collapse; border: 1px solid #cbd5e1;">
                        <thead>
                            <tr style="background:#f1f5f9;">
                                <th style="width:5%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">م</th>
                                <th style="width:25%; border: 1px solid #cbd5e1; padding: 4px; text-align: right;">اسم الطالب</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">واجبات (${dist.assignments})</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">أنشطة (${dist.activities})</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">بحوث (${dist.research})</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">مشاركة (${dist.participation})</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">عملي (${dist.practical})</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">نهائي (${dist.exam})</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">المجموع</th>
                                <th style="width:10%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">التقدير</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml || '<tr><td colspan="10" style="padding: 10px; text-align: center;">لا يوجد طلاب مضافين في هذا الفصل الدراسي بعد.</td></tr>'}
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

window.exportPortfolioPdf = exportPortfolioPdf;
function exportPortfolioPdf() {
    const teacherName = portfolioSettings.teacherName || 'المعلم';
    const element = document.getElementById('portfolioPagesContainer');
    
    const opt = {
        margin:       0,
        filename:     `ملف_شواهد_الأداء_${teacherName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
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
    
    const dist = gradingDistribution || { assignments: 10, activities: 10, research: 10, participation: 10, practical: 40, exam: 20 };
    const maxPrac = dist.practical || 40;
    const maxEx = dist.exam || 20;
    
    const solvedAssignments = getCheckboxSum(gradesObj.assignments);
    const totalAssignments = gradesObj.assignments.length;
    
    const solvedActivities = getCheckboxSum(gradesObj.activities);
    const totalActivities = gradesObj.activities.length;
    
    const solvedResearch = getCheckboxSum(gradesObj.research);
    const totalResearch = gradesObj.research.length;
    
    const violations = gradesObj.participation.filter(p => typeof p === 'string' && p.trim() !== '');
    
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
    }

    // Build specific diagnostic recommendations based on areas of weakness (مواضع التعثر)
    const specificRecommendations = [];
    
    if (solvedAssignments < totalAssignments) {
        specificRecommendations.push('نوصي بالحرص والالتزام بحل وتسليم الواجبات المنزلية المتبقية أولاً بأول.');
    }
    if (gradesObj.exam < maxEx * 0.6) {
        specificRecommendations.push('نوصي بالمذاكرة النظرية المركزة وإعادة مراجعة المفاهيم الأساسية للاستعداد الجيد للاختبارات التحريرية.');
    }
    if (gradesObj.practical < maxPrac * 0.6) {
        specificRecommendations.push('نوصي بالتدريب المستمر وتكثيف التطبيق العملي والمهاري للمادة داخل وخارج الفصل.');
    }
    if (solvedActivities < totalActivities || solvedResearch < totalResearch) {
        specificRecommendations.push('نوصي بالمشاركة الفعالة في الأنشطة الصفية والمبادرة بإنجاز وتسليم البحث والمشاريع المطلوب.');
    }
    if (violations.length > 0) {
        specificRecommendations.push('نوصي بالالتزام بالتعليمات الصفية وتحسين الانضباط السلوكي لضمان تركيز أعلى أثناء الشرح.');
    }
    
    let feedbackSection = '';
    const isExcellent = status === 'excellent' || total >= 90;
    
    if (isExcellent) {
        feedbackSection = `
        <div style="border: 2px solid #10b981; padding: 14px 16px; border-radius: 10px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); font-size: 0.85rem; line-height: 1.6; text-align: right; margin-bottom: 20px; color: #065f46; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);">
            <strong style="font-size: 0.98rem; color: #047857; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-weight: 800;">
                🌟 إشادة وثناء بالتميز العلمي:
            </strong>
            نبارك للطالب هذا المستوى المتميز والرائع، ونشيد باجتهاده وتفوقه المستمر وأدائه المتقن لجميع التقييمات والمهام. نسأل الله له دوام التوفيق والنجاح الباهر والتألق الدائم! 🎓✨
        </div>`;
    } else if (specificRecommendations.length > 0) {
        const recommendationHtml = specificRecommendations.map(r => `• ${r}`).join('<br>') + 
            '<br>• ضرورة متابعة ولي الأمر لمواضع القصور والتعثر المحددة أعلاه بشكل مستمر.';
        feedbackSection = `
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; font-size: 0.8rem; line-height: 1.5; text-align: right; margin-bottom: 20px;">
            <strong>توصيات المعلم للتطوير الأكاديمي والمهاري:</strong><br>
            ${recommendationHtml}
        </div>`;
    } else {
        const recommendationHtml = '• نوصي بالاستمرار في أداء الواجبات والأنشطة أولاً بأول.<br>• تشجيع الطالب على المشاركة والتفاعل المستمر.';
        feedbackSection = `
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; font-size: 0.8rem; line-height: 1.5; text-align: right; margin-bottom: 20px;">
            <strong>توصيات المعلم للتطوير الأكاديمي والمهاري:</strong><br>
            ${recommendationHtml}
        </div>`;
    }
    
    const printArea = document.getElementById('studentPrintableArea');
    if (printArea) {
        printArea.innerHTML = `
            <table style="width:100%; border-collapse:collapse; margin-bottom:1.5rem; border:none; line-height: 1.2;">
                <tr>
                    <td style="text-align:right; font-size:0.75rem; line-height:1.4; color:#334155; border:none; padding:0; font-weight:bold;">
                        المملكة العربية السعودية<br>
                        وزارة التعليم<br>
                        الإدارة العامة للتعليم بالقصيم<br>
                        مدرسة: ${portfolioSettings.schoolName || '..........'}
                    </td>
                </tr>
            </table>
            
            <div style="text-align: center; margin-bottom: 1.5rem; border-bottom: 2px solid #0f172a; padding-bottom: 5px;">
                <span style="font-size: 1.2rem; font-weight: 800; color: #1e1b4b; background: #f8fafc; padding: 4px 15px; border: 1.5px solid #0f172a; border-radius: 20px;">
                    تقرير متابعة مستوى الطالب الدراسي والسلوكي
                </span>
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
                    <tr style="border-bottom: 1px solid #cbd5e1;">
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">تسليم الواجبات المنزلية</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${solvedAssignments}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${totalAssignments}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; color: ${solvedAssignments === totalAssignments ? '#10b981' : '#f59e0b'}; font-weight: bold;">
                            ${solvedAssignments === totalAssignments ? 'مكتمل بالكامل' : 'يوجد واجبات فائتة'}
                        </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #cbd5e1;">
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">المشاركة والأنشطة الصفية</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${solvedActivities}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${totalActivities}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; color: ${solvedActivities === totalActivities ? '#10b981' : '#f59e0b'}; font-weight: bold;">
                            ${solvedActivities === totalActivities ? 'مكتمل بالكامل' : 'مشاركة متوسطة'}
                        </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #cbd5e1;">
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">البحث والمشاريع</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${solvedResearch}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${totalResearch}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; color: ${solvedResearch === totalResearch ? '#10b981' : '#f59e0b'}; font-weight: bold;">
                            ${solvedResearch === totalResearch ? 'منجز ومكتمل' : 'غير منجز'}
                        </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #cbd5e1;">
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">درجات الاختبارات العملية والمهام</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${gradesObj.practical}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${maxPrac}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; color: ${gradesObj.practical >= (maxPrac * 0.8) ? '#10b981' : '#f59e0b'}; font-weight: bold;">
                            ${gradesObj.practical >= (maxPrac * 0.8) ? 'ممتاز' : 'متوسط'}
                        </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #cbd5e1;">
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">درجة الاختبار التحريري النهائي</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${gradesObj.exam}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${maxEx}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; color: ${gradesObj.exam >= (maxEx * 0.8) ? '#10b981' : '#f59e0b'}; font-weight: bold;">
                            ${gradesObj.exam >= (maxEx * 0.8) ? 'ممتاز' : 'متوسط'}
                        </td>
                    </tr>
                    <tr style="border-top: 2px solid #0f172a; background: #f8fafc; font-weight: bold;">
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 1rem;">المجموع الكلي النهائي</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 1rem; color: ${total >= 50 ? 'var(--accent-teal)' : '#ef4444'}; font-weight: 800;">${total}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 1rem;">100</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 1rem; color: ${total >= 50 ? 'var(--accent-teal)' : '#ef4444'}; font-weight: 800;">
                            ${status} (${total >= 50 ? 'ناجح' : 'مكمل'})
                        </td>
                    </tr>
                </tbody>
            </table>
            
            ${behaviorSection}
            
            ${feedbackSection}
            
            <div style="display: flex; justify-content: space-between; margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 0.8rem; color: #1e293b;">
                <div style="width: 30%; text-align: center; line-height: 1.6;">
                    <span style="font-weight: 700; display: block; margin-bottom: 20px;">معلم المادة / أ. ${portfolioSettings.teacherName || '....................'}</span>
                    <div style="border-top: 1px solid #cbd5e1; width: 85%; margin: 0 auto; color: #64748b; font-size: 0.7rem; padding-top: 2px;">التوقيع</div>
                </div>
                <div style="width: 30%; text-align: center; line-height: 1.6;">
                    <span style="font-weight: 700; display: block; margin-bottom: 20px;">توقيع ولي الأمر</span>
                    <div style="border-top: 1px solid #cbd5e1; width: 85%; margin: 0 auto; color: #64748b; font-size: 0.7rem; padding-top: 2px;">التوقيع</div>
                </div>
                <div style="width: 30%; text-align: center; line-height: 1.6;">
                    <span style="font-weight: 700; display: block; margin-bottom: 20px;">قائد المدرسة / ....................................</span>
                    <div style="border-top: 1px solid #cbd5e1; width: 85%; margin: 0 auto; color: #64748b; font-size: 0.7rem; padding-top: 2px;">الختم والتوقيع</div>
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
    
    const opt = {
        margin:       10,
        filename:     `تقرير_مستوى_${currentReportStudentName.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2.5, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(area).save();
};

window.sendStudentReportToWhatsapp = function() {
    if (!currentReportStudent) return;
    const gradesObj = getStudentSubjectGrades(currentReportStudent);
    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'لم يحدد';
    const total = getStudentTotal(currentReportStudent);
    const status = getStudentStatus(total);
    
    const dist = gradingDistribution || { assignments: 10 };
    const totalAssignments = dist.assignments || 10;
    
    let message = `*تقرير مستوى الطالب الدراسي* 📝\n\n`;
    message += `*اسم الطالب:* ${currentReportStudent.name}\n`;
    message += `*المادة:* ${activeSubjName}\n`;
    message += `*الفصل:* ${getActiveClass()?.name || 'لم يحدد'}\n`;
    message += `*الدرجة الكلية:* ${total} / 100\n`;
    message += `*التقدير العام:* ${status}\n\n`;
    
    const solvedAssignments = getCheckboxSum(gradesObj.assignments);
    message += `• *تسليم الواجبات:* تم تسليم ${solvedAssignments} من أصل ${totalAssignments} واجبات.\n`;
    
    const violations = gradesObj.participation.filter(p => typeof p === 'string' && p.trim() !== '');
    if (violations.length > 0) {
        message += `• *الملاحظات السلوكية (النقاط الحمراء):* تم رصد ${violations.length} ملاحظات (${violations.join('، ')}).\n`;
    } else {
        message += `• *السلوك والانضباط:* متميز وملتزم بالأنظمة الصفية. الحمد لله. 👍\n`;
    }
    
    message += `\nنرجو منكم دوام التعاون والتوجيه لمزيد من التقدم والتحصيل العلمي.\n`;
    message += `شاكرين لكم اهتمامهم. 🌹`;
    
    const cleanNum = whatsappNumber.replace(/[\s\+\-]/g, '');
    const url = `https://web.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(message)}&autoclick=true`;
    window.open(url, '_blank');
};









