// grading.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 451-675: BUILD FORM CHECKBOXES DYNAMICALLY
//   lines 676-713: FORM PARTICIPATION (3-STATE)
//   lines 1031-1437: SUBJECTS TABS UI (incl. grading category setup wizard)
//   lines 1968-2007: FORM SUBMISSION
//   lines 2008-2129: GRADE CALCULATIONS
//   lines 2130-2447: FILTER & RENDER TABLE
//   lines 2448-2466: INLINE TABLE GRADE EDITING (PRACTICAL & EXAM)
//   lines 2467-2499: EDIT / DELETE
//   lines 2844-3044: BULK GRADE MODAL LOGIC
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.

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

window.addCustomCategoryRow = function(catName = '', catMax = 10, catType = 'dots', catId = '', catDotsCount = null, catPointValue = null, catNoorBucket = '') {
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
        <select class="form-control cat-noor-bucket-select" title="أي خانة يذهب لها هذا البند عند التصدير لنظام نور" style="flex:1.3;font-size:0.78rem;">
            <option value="" ${!catNoorBucket ? 'selected' : ''}>نور: غير محدد</option>
            <option value="40" ${catNoorBucket === '40' ? 'selected' : ''}>نور: خانة 40</option>
            <option value="60" ${catNoorBucket === '60' ? 'selected' : ''}>نور: خانة 60</option>
            <option value="none" ${catNoorBucket === 'none' ? 'selected' : ''}>نور: غير مشمول</option>
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
            addCustomCategoryRow(cat.name, cat.max, cat.type, cat.id, cat.dotsCount, cat.pointValue, cat.noorBucket);
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
            normalizeGradingCategory(cat);
            addCustomCategoryRow(cat.name, cat.max, cat.type, cat.id, cat.dotsCount, cat.pointValue, cat.noorBucket);
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
        const noorBucketSelect = row.querySelector('.cat-noor-bucket-select');

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
            // Leave noorBucket unset (rather than '') when the teacher
            // hasn't chosen one — normalizeGradingCategory() will try to
            // auto-derive it from the category's legacy name on next read,
            // and the Noor export flow treats a still-unset bucket as
            // "needs configuration" rather than silently guessing.
            const noorBucketVal = noorBucketSelect ? noorBucketSelect.value : '';
            if (noorBucketVal) catObj.noorBucket = noorBucketVal;
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

