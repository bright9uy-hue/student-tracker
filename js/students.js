// students.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 1817-1873: STUDENT MODAL
//   lines 6476-6635: UNIFIED ADD STUDENTS DIALOG (SINGLE & BULK)
//   lines 7049-7143: TRANSFER STUDENT TO ANOTHER CLASS
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.

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
