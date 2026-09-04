// ui.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 953-1030: CLASSES TABS UI
//   lines 1438-1529: EVALUATION PERIODS MANAGEMENT
//   lines 1530-1816: EVENT LISTENERS
//   lines 1874-1950: REASON MODAL
//   lines 1951-1967: NOTIFICATIONS
//   lines 2500-2726: DASHBOARD
//   lines 6199-6361: RANDOM STUDENT PICKER FEATURE
//   lines 6362-6475: TEACHER & SCHOOL SETTINGS MODAL
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.

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

    const exportNoor = document.getElementById('exportNoorBtn');
    if (exportNoor) exportNoor.addEventListener('click', exportNoorGrades);

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












