// groups.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 6636-7048: COLLABORATIVE STUDENT GROUPS DIVISION FEATURE
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.

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


