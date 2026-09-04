// madrasati-noor.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 3045-3317: IMPORT FROM NOOR LOGIC
//   lines 3318-3563: IMPORT FROM MADRASATI LOGIC
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.

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
    const { list, assignmentTitle } = e.detail || {};
    console.log('[Student Tracker App] Automated grades received from extension:', list, 'title:', assignmentTitle);

    if (!Array.isArray(list) || list.length === 0) {
        showNotification('لم يتم العثور على بيانات طلاب صالحة في الاستيراد التلقائي!', 'error');
        return;
    }

    const activeClass = getActiveClass();
    if (!activeClass) {
        showNotification('لا يوجد فصل نشط لاستيراد الواجبات إليه!', 'error');
        return;
    }

    // The extension can only detect the assignment's TITLE on Madrasati's
    // page — it has no way to know which local "slot" that corresponds to,
    // since the two are separate browser contexts. Show both to the teacher
    // for a quick sanity check before writing anything, instead of saving
    // silently.
    const nextSlot = getNextUnassignedAssignmentIndex(activeClass, activeSubjectId);
    const titleLine = assignmentTitle ? `الواجب المكتشف على مدرستي: "${assignmentTitle}"\n` : '';
    const confirmed = confirm(
        `${titleLine}تم العثور على بيانات ${list.length} طالب.\n` +
        `سيتم رصدها في خانة "واجب ${nextSlot + 1}" بالفصل "${activeClass.name}".\n\n` +
        `هل تريد المتابعة والحفظ؟`
    );

    if (!confirmed) {
        showNotification('تم إلغاء الرصد التلقائي.', 'info');
        return;
    }

    window.importMadrasatiGradesList(list);
});

