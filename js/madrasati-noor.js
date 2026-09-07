// v2/js/madrasati-noor.js — pure logic for both import pipelines. No DOM
// beyond what's unavoidable (FileReader/XLSX parsing). Ported from
// js/madrasati-noor.js.

// ------------------------------------------------------------
// Noor roster import: extract Arabic student names from pasted text or an
// uploaded Excel/CSV file.
// ------------------------------------------------------------
window.extractNamesFromText = function(text) {
    const lines = text.split('\n');
    const namesSet = new Set();
    const arabicWordPattern = /[ء-ي]+/g;
    const headerWords1 = ['وزارة', 'التعليم', 'جدول', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'اسم', 'الطالب', 'رصد', 'درجات', 'الدرجة', 'رقم', 'الفصل', 'مادة', 'الكلية', 'السجل', 'المدني', 'حالة'];
    const headerWords2 = ['وزارة', 'التعليم', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'الطالب', 'الفصل', 'اسم'];

    lines.forEach(line => {
        const cleanLine = line.replace(/[0-9a-zA-Z]/g, ' ');
        const parts = cleanLine.split(/\t/);
        parts.forEach(part => {
            const cleanPart = part.trim();
            const partWords = cleanPart.match(arabicWordPattern) || [];
            if (partWords.length >= 3 && partWords.length <= 6) {
                if (!partWords.some(w => headerWords1.includes(w))) {
                    namesSet.add(partWords.join(' '));
                }
            }
        });
        if (parts.length <= 1) {
            const lineWords = line.trim().match(arabicWordPattern) || [];
            if (!lineWords.some(w => headerWords2.includes(w)) && lineWords.length >= 3 && lineWords.length <= 6) {
                namesSet.add(lineWords.join(' '));
            }
        }
    });

    return Array.from(namesSet);
};

// Extracts student names from a parsed SheetJS workbook (an uploaded
// .xlsx/.xls/.csv file). Deliberately keeps each cell separate via
// sheet_to_json({header:1}) instead of flattening the sheet to
// comma-joined CSV text first - a real multi-column export (name +
// national ID + status, etc.) would otherwise have an adjacent Arabic
// column (e.g. "منتظم") glued onto the name, since nothing after that
// point can tell where one column ends and the next begins. Tries to find
// an actual "اسم الطالب"-style header first so only that column is read;
// falls back to scanning every cell (a 3-6 word guard, same as
// extractNamesFromText) only if no such header is found.
window.extractNamesFromWorkbook = function(workbook) {
    const extractedNames = [];
    const arabicWordPattern = /[ء-ي]+/g;
    const excludeKeywords = ['وزارة', 'التعليم', 'جدول', 'تقرير', 'مدرسة', 'كشف', 'أسماء', 'اسم', 'الطالب', 'رصد', 'درجات', 'الدرجة', 'رقم', 'الفصل', 'مادة', 'الكلية', 'السجل', 'المدني', 'حالة', 'الهوية', 'ملاحظات', 'المجموع', 'الصف'];

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

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
                if (!hasExclude && words.length >= 2 && words.length <= 6) extractedNames.push(words.join(' '));
            } else {
                row.forEach(cell => {
                    const str = String(cell).trim();
                    const words = str.match(arabicWordPattern) || [];
                    const hasExclude = words.some(w => excludeKeywords.includes(w));
                    if (!hasExclude && words.length >= 3 && words.length <= 6) extractedNames.push(words.join(' '));
                });
            }
        });
    });

    const uniqueNames = [];
    const seen = new Set();
    extractedNames.forEach(name => { if (!seen.has(name)) { seen.add(name); uniqueNames.push(name); } });
    return uniqueNames;
};

// ------------------------------------------------------------
// Madrasati assignment import: smart "next unassigned slot" + Arabic name
// fuzzy matching + writing solved/unsolved dots.
// ------------------------------------------------------------
window.getNextUnassignedAssignmentIndex = function(activeClass, subjectId = store.activeSubjectId) {
    if (!activeClass || !Array.isArray(activeClass.students) || activeClass.students.length === 0) return 0;
    const categories = getActiveSubjectGradingCategories(subjectId);
    const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
    const maxAssignmentsCount = cat ? cat.max : 10;

    for (let i = 0; i < maxAssignmentsCount; i++) {
        const isOccupied = activeClass.students.some(s => {
            const grades = getStudentSubjectGrades(s, subjectId);
            const assignArr = grades ? (grades.assignments || grades['cat_assignments']) : null;
            if (!Array.isArray(assignArr)) return false;
            const val = assignArr[i];
            return val === true || (typeof val === 'string' && val.trim() !== '');
        });
        if (!isOccupied) return i;
    }
    return Math.max(0, maxAssignmentsCount - 1);
};

window.matchStudentArabicName = function(importName, students) {
    const cleanName = (n) => n.trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
    const importClean = cleanName(importName);

    let match = students.find(s => cleanName(s.name) === importClean);
    if (match) return match;

    match = students.find(s => {
        const sClean = cleanName(s.name);
        return sClean.includes(importClean) || importClean.includes(sClean);
    });
    if (match) return match;

    const importParts = importClean.split(' ').filter(p => p.length > 2);
    if (importParts.length >= 3) {
        match = students.find(s => {
            const sClean = cleanName(s.name);
            let matchesCount = 0;
            importParts.forEach(part => { if (sClean.includes(part)) matchesCount++; });
            return matchesCount >= 3;
        });
    }
    return match;
};

window.triggerAutoMadrasatiSync = function() {
    showNotification('جاري الاتصال التلقائي بمنصة مدرستي... سيتم فتح صفحة الواجبات، وسحب الواجب، ورصده تلقائياً بالكامل في ثوانٍ!', 'info');
    window.open('https://schools.madrasati.sa/Teacher/Assignments/Index?autosync=true', '_blank');
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

    const categories = getActiveSubjectGradingCategories(store.activeSubjectId);
    const cat = categories.find(c => c.id === 'cat_assignments' || c.key === 'assignments' || c.name === 'الواجبات');
    const maxVal = cat ? cat.max : 10;
    const assignIdx = (explicitAssignIdx !== null && explicitAssignIdx !== undefined && !isNaN(explicitAssignIdx))
        ? explicitAssignIdx
        : getNextUnassignedAssignmentIndex(activeClass, store.activeSubjectId);

    let solvedCount = 0, unsolvedCount = 0;

    importedData.forEach(item => {
        if (!item.name) return;
        const student = matchStudentArabicName(item.name, activeClass.students);
        if (student) {
            const gradesObj = getStudentSubjectGrades(student);
            if (!Array.isArray(gradesObj.assignments)) gradesObj.assignments = Array(maxVal).fill(false);
            if (!Array.isArray(gradesObj['cat_assignments'])) gradesObj['cat_assignments'] = gradesObj.assignments;

            if (item.solved === true) {
                gradesObj.assignments[assignIdx] = true;
                gradesObj['cat_assignments'][assignIdx] = true;
                solvedCount++;
            } else {
                gradesObj.assignments[assignIdx] = 'لم يحل الواجب';
                gradesObj['cat_assignments'][assignIdx] = 'لم يحل الواجب';
                unsolvedCount++;
            }
        }
    });

    saveData();
    showNotification(`✅ تم رصد (واجب ${assignIdx + 1}) تلقائياً من منصة مدرستي: ${solvedCount} تم الحل، و ${unsolvedCount} مقصرين.`, 'success');
};

// Listener for the browser extension's automated pull. This exact event
// name/shape (`MadrasatiGradesImported`, detail: {list, assignmentTitle})
// is depended on by extension/content.js, which is NOT touched by this
// rewrite — the confirm-before-save step stays, since the extension can
// only detect the assignment's title on Madrasati's page, not which local
// slot it maps to (two separate browser contexts).
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

    const nextSlot = getNextUnassignedAssignmentIndex(activeClass, store.activeSubjectId);
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
