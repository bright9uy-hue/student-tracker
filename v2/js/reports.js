// v2/js/reports.js — pure report-building logic (CSV/Noor export data,
// weekly-report class summaries, PDF generation) shared by the report
// components. No DOM-heavy rendering beyond the printable HTML strings
// these functions return — the components own opening/closing modals and
// wiring buttons.

window.exportCurrentClassToCSV = function() {
    const students = getActiveStudents();
    if (students.length === 0) { showNotification('لا توجد بيانات طلاب في هذا الفصل!', 'error'); return; }
    const cls = getActiveClass();
    const activeSubjName = store.subjects.find(s => s.id === store.activeSubjectId)?.name || 'مادة عامة';
    const categories = getActiveSubjectGradingCategories(store.activeSubjectId).filter(cat => cat.max > 0);
    let csv = `فصل: ${cls.name}\nالمادة: ${activeSubjName}\n`;
    csv += `اسم الطالب,${categories.map(cat => `${cat.name} (${cat.max})`).join(',')},المجموع,التقدير\n`;
    students.forEach(s => {
        const total = getStudentTotal(s, store.activeSubjectId, cls);
        const status = total >= 90 ? 'ممتاز' : total >= 50 ? 'ناجح' : 'متعثر';
        const catScores = categories.map(cat => getCategoryEarnedScore(s, cat, store.activeSubjectId, cls));
        csv += `"${s.name}",${catScores.join(',')},${total},"${status}"\n`;
    });
    downloadCsv(csv, `${cls.name}_${activeSubjName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    showNotification(`تم تصدير كشف فصل "${cls.name}" بنجاح.`, 'success');
};

window.exportNoorGrades = function() {
    const activeClass = getActiveClass();
    if (!activeClass || !activeClass.students || activeClass.students.length === 0) {
        showNotification('لا يوجد فصل نشط أو طلاب لتصدير درجاتهم!', 'error');
        return;
    }
    const categories = getActiveSubjectGradingCategories(store.activeSubjectId);
    const unmapped = categories.filter(cat => cat.max > 0 && cat.noorBucket !== '40' && cat.noorBucket !== '60' && cat.noorBucket !== 'none');
    if (unmapped.length > 0) {
        showNotification(`يجب تحديد خانة نور (40 أو 60) لكل بند تقييم قبل التصدير. افتح "إعداد بنود التقييم" وحدد الخانة للبنود التالية: ${unmapped.map(c => c.name).join('، ')}`, 'error');
        return;
    }
    const bucket40Cats = categories.filter(cat => cat.noorBucket === '40');
    const bucket60Cats = categories.filter(cat => cat.noorBucket === '60');
    if (bucket40Cats.length === 0 && bucket60Cats.length === 0) {
        showNotification('لا توجد بنود تقييم مرتبطة بخانتي نور (40/60) لهذه المادة!', 'error');
        return;
    }
    const activeSubjName = store.subjects.find(s => s.id === store.activeSubjectId)?.name || 'مادة عامة';
    let csv = `فصل: ${activeClass.name}\nالمادة: ${activeSubjName}\nتصدير متوافق مع نظام نور\n`;
    csv += `اسم الطالب,الدرجة من 40,الدرجة من 60,المجموع\n`;
    activeClass.students.forEach(s => {
        const score40 = bucket40Cats.reduce((sum, cat) => sum + getCategoryEarnedScore(s, cat, store.activeSubjectId, activeClass), 0);
        const score60 = bucket60Cats.reduce((sum, cat) => sum + getCategoryEarnedScore(s, cat, store.activeSubjectId, activeClass), 0);
        const r40 = Math.round(score40 * 100) / 100;
        const r60 = Math.round(score60 * 100) / 100;
        csv += `"${s.name}",${r40},${r60},${Math.round((r40 + r60) * 100) / 100}\n`;
    });
    downloadCsv(csv, `درجات_نور_${activeClass.name}_${activeSubjName}`.replace(/\s+/g, '_') + `_${new Date().toISOString().slice(0, 10)}.csv`);
    showNotification(`تم تصدير درجات نور لفصل "${activeClass.name}" بنجاح.`, 'success');
};

window.exportAllClassesToCSV = function() {
    if (!store.classes || store.classes.length === 0) { showNotification('لا توجد فصول دراسية لتصديرها!', 'error'); return; }
    let csv = `متابعة أداء الطلاب - تقرير كافة الفصول والدرجات\nتاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}\n\n`;
    store.classes.forEach(cls => {
        csv += `==================================================\n`;
        csv += `فصل: ${cls.name} (إجمالي الطلاب: ${cls.students ? cls.students.length : 0})\n`;
        csv += `==================================================\n`;
        store.subjects.forEach(subj => {
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
    downloadCsv(csv, `كافة_الفصول_والدرجات_${new Date().toISOString().slice(0, 10)}.csv`);
    showNotification('تم تصدير سجلات جميع الفصول بنجاح.', 'success');
};

function downloadCsv(csv, filename) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Server-side PDF generation (Puppeteer, via server.js's existing
// /api/generate-pdf, unchanged) with an html2pdf.js client-side fallback.
window.generateAndDownloadPdf = async function(elementOrHtml, filename, landscape = false) {
    let htmlContent = '';
    if (typeof elementOrHtml === 'string') htmlContent = elementOrHtml;
    else if (elementOrHtml && elementOrHtml.innerHTML) htmlContent = elementOrHtml.innerHTML;
    else return;

    showNotification('جاري إنشاء ملف الـ PDF عالي الدقة عبر المحرك الاحترافي...', 'info');
    try {
        const response = await fetch(getApiUrl('/api/generate-pdf'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: htmlContent, filename, landscape })
        });
        if (!response.ok) throw new Error(`Server status: ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        showNotification('تم تصدير ملف الـ PDF بنجاح بجودة متجهات فائقة! 📄✨', 'success');
    } catch (err) {
        console.warn('[PDF Engine] Server PDF error, using fallback:', err);
        if (typeof html2pdf !== 'undefined' && typeof elementOrHtml !== 'string') {
            const opt = {
                margin: landscape ? [8, 8, 8, 8] : 10,
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2.2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' }
            };
            html2pdf().set(opt).from(elementOrHtml).save();
            showNotification('تم تصدير الـ PDF عبر المعالج الاحتياطي بنجاح.', 'success');
        } else {
            showNotification('حدث خطأ أثناء تصدير الـ PDF، يرجى المحاولة لاحقاً.', 'error');
        }
    }
};

// Per-class violating/deficient-student summary for the weekly report.
// Classes with neither are left out entirely.
window.buildWeeklyClassReports = function() {
    return store.classes.map(cls => {
        const violatingStudents = (cls.students || []).filter(student => {
            const g = getStudentSubjectGrades(student);
            return Array.isArray(g.participation) && g.participation.some(p => typeof p === 'string' && p.trim() !== '');
        });
        const totalGivenAssignments = getActiveAssignmentsCount(cls, store.activeSubjectId);
        let deficientStudents = [];
        if (totalGivenAssignments > 0) {
            deficientStudents = (cls.students || []).filter(student => {
                const g = getStudentSubjectGrades(student);
                const assignArr = g ? (g.assignments || g['cat_assignments']) : [];
                if (!Array.isArray(assignArr)) return true;
                for (let i = 0; i < totalGivenAssignments; i++) if (assignArr[i] !== true) return true;
                return false;
            });
        }
        return { cls, violatingStudents, deficientStudents, totalGivenAssignments };
    }).filter(r => r.violatingStudents.length > 0 || r.deficientStudents.length > 0);
};

function dispatchWeeklyReportDone(detail) {
    window.dispatchEvent(new CustomEvent('weeklyReportSendComplete', { detail }));
}

// Builds the weekly report's printable HTML for one run of buildWeeklyClassReports().
window.buildWeeklyReportHtml = function(classReports, activeSubjName, reportDateStr) {
    let classSectionsHtml = '';
    classReports.forEach(({ cls, violatingStudents, deficientStudents, totalGivenAssignments }) => {
        let tableRowsHtml = '';
        violatingStudents.forEach((student, index) => {
            const g = getStudentSubjectGrades(student);
            const violations = Array.isArray(g.participation) ? g.participation.filter(p => typeof p === 'string' && p.trim() !== '') : [];
            tableRowsHtml += `<tr style="border:1px solid #cbd5e1;"><td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${index + 1}</td><td style="border:1px solid #cbd5e1;padding:6px;text-align:right;font-weight:700;">${student.name}</td><td style="border:1px solid #cbd5e1;padding:6px;text-align:center;color:#ef4444;font-weight:800;">${violations.length}</td><td style="border:1px solid #cbd5e1;padding:6px;text-align:right;font-size:0.75rem;color:#475569;">${violations.join('، ')}</td></tr>`;
        });
        if (violatingStudents.length === 0) {
            tableRowsHtml = `<tr><td colspan="4" style="border:1px solid #cbd5e1;padding:12px;text-align:center;color:#10b981;font-weight:bold;background:#f0fdf4;">الحمد لله، لا توجد أي مخالفات سلوكية مرصودة هذا الأسبوع.</td></tr>`;
        }
        let hwRowsHtml = '';
        deficientStudents.forEach((student, index) => {
            const g = getStudentSubjectGrades(student);
            const assignArr = g ? (g.assignments || g['cat_assignments']) : [];
            const missedIndices = [];
            for (let i = 0; i < totalGivenAssignments; i++) if (!assignArr || assignArr[i] !== true) missedIndices.push(`واجب ${i + 1}`);
            hwRowsHtml += `<tr style="border:1px solid #cbd5e1;"><td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${index + 1}</td><td style="border:1px solid #cbd5e1;padding:6px;text-align:right;font-weight:700;">${student.name}</td><td style="border:1px solid #cbd5e1;padding:6px;text-align:center;color:#ef4444;font-weight:800;">${missedIndices.length}</td><td style="border:1px solid #cbd5e1;padding:6px;text-align:right;font-size:0.75rem;color:#475569;">${missedIndices.join('، ')}</td></tr>`;
        });
        if (deficientStudents.length === 0) {
            hwRowsHtml = `<tr><td colspan="4" style="border:1px solid #cbd5e1;padding:12px;text-align:center;color:#10b981;font-weight:bold;background:#f0fdf4;">الحمد لله، جميع طلاب الفصل ملتزمون بحل كافة الواجبات المطلوبة.</td></tr>`;
        }
        classSectionsHtml += `
        <div style="text-align:center;margin:22px 0 12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:6px;"><span style="font-size:1rem;font-weight:800;color:#312e81;">الفصل: ${cls.name}</span></div>
        <div style="font-size:0.85rem;font-weight:800;color:#ef4444;border-right:3px solid #ef4444;padding-right:8px;margin-bottom:8px;text-align:right;">أولاً: كشف رصد الطلاب المخالفين سلوكياً (النقاط الحمراء):</div>
        <table class="port-table" style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:0.8rem;border:1px solid #cbd5e1;"><thead><tr style="background:#f1f5f9;"><th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:8%;">م</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:right;width:42%;">اسم الطالب</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:15%;">النقاط الحمراء</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:right;width:35%;">أسباب الخصم والمخالفات</th></tr></thead><tbody>${tableRowsHtml}</tbody></table>
        <div style="font-size:0.85rem;font-weight:800;color:#ef4444;border-right:3px solid #ef4444;padding-right:8px;margin-bottom:8px;text-align:right;">ثانياً: كشف رصد الطلاب المقصرين في حل الواجبات (لم يحلوا الواجب):</div>
        <table class="port-table" style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:0.8rem;border:1px solid #cbd5e1;"><thead><tr style="background:#fdf2f2;"><th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:8%;">م</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:right;width:42%;">اسم الطالب</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:15%;">الواجبات الفائتة</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:right;width:35%;">تفاصيل أرقام الواجبات</th></tr></thead><tbody>${hwRowsHtml}</tbody></table>`;
    });

    return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:1.25rem;border:none;line-height:1.2;"><tr><td style="text-align:right;font-size:0.75rem;line-height:1.4;color:#334155;border:none;padding:0;font-weight:bold;">المملكة العربية السعودية<br>وزارة التعليم<br>الإدارة العامة للتعليم بالقصيم<br>مدرسة: ${store.portfolioSettings.schoolName || '..........'}</td></tr></table>
    <div style="text-align:center;margin-bottom:1.25rem;border-bottom:2px solid #0f172a;padding-bottom:5px;"><span style="font-size:1.15rem;font-weight:800;color:#1e1b4b;background:#f8fafc;padding:4px 15px;border:1.5px solid #0f172a;border-radius:20px;">نموذج تقرير المتابعة الأسبوعي الموحد لجميع الفصول (المخالفات والواجبات)</span></div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;"><div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;font-size:0.8rem;background:#f8fafc;font-weight:bold;text-align:center;">المادة: ${activeSubjName}</div><div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;font-size:0.8rem;background:#f8fafc;font-weight:bold;text-align:center;">التاريخ: ${reportDateStr}</div></div>
    ${classSectionsHtml}
    <div style="border:1px solid #cbd5e1;padding:10px;border-radius:6px;background:#ffffff;margin-top:15px;font-size:0.8rem;line-height:1.5;text-align:right;"><strong>توصيات المعلم للتسوية الأكاديمية والسلوكية:</strong><br>• المتابعة الأسبوعية من أولياء الأمور لتعديل سلوك الطلاب وحثهم على تسليم الواجبات.<br>• تنسيق التدخل التربوي السلوكي والتعليمي مع إدارة المدرسة والتوجه الطلابي.</div>
    <div style="display:flex;justify-content:flex-start;margin-top:25px;border-top:1px dashed #cbd5e1;padding-top:15px;font-size:0.85rem;color:#1e293b;"><div style="text-align:right;line-height:1.6;"><span style="font-weight:700;">معد التقرير / أ. ${store.portfolioSettings.teacherName || '....................'}</span></div></div>`;
};

// Reactive status the WeeklyReportModal displays — a shared object rather
// than a callback, since window.sendWeeklyReport() must stay callable with
// zero arguments (server.js's headless scheduler calls it directly), so it
// can't take a "report area element" or "status callback" parameter the
// way an internal Vue helper naturally would.
uiState.weeklyReportStatus = { text: '', isError: false };

// A hidden DOM node reused across runs (created once) so html2canvas' PDF
// fallback has a real element to rasterize, independent of whether the
// WeeklyReportModal is currently open.
function getWeeklyReportArea() {
    let el = document.getElementById('printableReportArea');
    if (!el) {
        el = document.createElement('div');
        el.id = 'printableReportArea';
        el.style.cssText = 'position:fixed; left:-9999px; top:0; width:650px; background:#fff; color:#0f172a; padding:20px; direction:rtl; text-align:right;';
        document.body.appendChild(el);
    }
    return el;
}

// Drives the whole "build -> PDF -> WhatsApp send" pipeline. Callable with
// no arguments — this exact signature is depended on by server.js's
// headless weekly-report scheduler (page.evaluate(() => window.sendWeeklyReport())).
// Dispatches weeklyReportSendComplete at every terminal point, which the
// scheduler awaits.
window.sendWeeklyReport = function() {
    const reportArea = getWeeklyReportArea();

    if (!store.classes || store.classes.length === 0) {
        showNotification('لا توجد أي فصول لإرسال التقرير عنها!', 'error');
        dispatchWeeklyReportDone({ sent: false, reason: 'no-classes' });
        return;
    }

    const classReports = buildWeeklyClassReports();
    if (classReports.length === 0) {
        showNotification('الحمد لله، لا توجد مخالفات سلوكية أو واجبات مقصر فيها في أي فصل!', 'success');
        store.lastReportDate = Date.now();
        saveData();
        dispatchWeeklyReportDone({ sent: false, reason: 'no-issues' });
        return;
    }

    const activeSubjName = store.subjects.find(s => s.id === store.activeSubjectId)?.name || 'مادة عامة';
    const reportDateStr = new Date().toLocaleDateString('ar-SA');
    const messageText = `التقرير الأسبوعي لجميع الفصول \nالمادة : ${activeSubjName} \nالتاريخ : ${reportDateStr}`;

    uiState.weeklyReportStatus = { text: 'جاري رسم وإعداد كشف التقرير على النموذج الرسمي...', isError: false };
    reportArea.innerHTML = buildWeeklyReportHtml(classReports, activeSubjName, reportDateStr);

    setTimeout(async () => {
        const fileName = `التقرير_الأسبوعي_جميع_الفصول.pdf`;
        try {
            uiState.weeklyReportStatus = { text: 'جاري إنشاء ملف الـ PDF عبر المحرك الاحترافي وإرساله للواتساب...', isError: false };
            const res = await fetch(getApiUrl('/api/generate-pdf'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: reportArea.innerHTML, filename: fileName, landscape: false })
            });
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const pdfBlob = await res.blob();
            const reader = new FileReader();
            reader.readAsDataURL(pdfBlob);
            reader.onloadend = async () => {
                uiState.weeklyReportStatus = { text: 'تم إنشاء ملف الـ PDF بنجاح وجاري الإرسال عبر الواتساب...', isError: false };
                const sent = await sendWhatsAppDirectOrWeb(store.whatsappNumber, messageText, reader.result, fileName);
                if (sent) { store.lastReportDate = Date.now(); saveData(); }
                dispatchWeeklyReportDone({ sent: !!sent, reason: 'pdf' });
            };
        } catch (err) {
            console.warn('[WhatsApp PDF Sender] Server PDF failed, falling back to image:', err);
            html2canvas(reportArea, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: 800 }).then(async (canvas) => {
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgFileName = `التقرير_الأسبوعي_جميع_الفصول.jpg`;
                const sent = await sendWhatsAppDirectOrWeb(store.whatsappNumber, messageText, imgData, imgFileName);
                if (sent) { store.lastReportDate = Date.now(); saveData(); }
                dispatchWeeklyReportDone({ sent: !!sent, reason: 'image-fallback' });
            }).catch(e => {
                uiState.weeklyReportStatus = { text: 'فشل توليد التقرير: ' + e.message, isError: true };
                dispatchWeeklyReportDone({ sent: false, reason: 'error', message: e.message });
            });
        }
    }, 100);
};

window.checkAndAutoSendWeeklyReport = function() {
    if (!store.lastReportDate) return;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - store.lastReportDate >= oneWeekMs) {
        store.lastReportDate = Date.now();
        saveData();
        sendWeeklyReport();
    }
};

// ------------------------------------------------------------
// Individual student report + referral form: pure data-builders. Each
// returns plain data a component turns into a template — the printable
// HTML string itself is generated by one function (buildIndividualReportHtml
// / buildReferralDefaults's caller) since these are fixed-layout print
// documents, not interactive forms; that's a deliberate exception to
// "no HTML strings," matching how a real print/PDF layout is naturally
// authored even in idiomatic Vue apps.
window.buildIndividualReportHtml = function(student, activeClass) {
    const gradesObj = getStudentSubjectGrades(student);
    const activeSubjName = store.subjects.find(s => s.id === store.activeSubjectId)?.name || 'لم يحدد';
    const total = getStudentTotal(student);
    const categories = getActiveSubjectGradingCategories(store.activeSubjectId);

    let categoriesRowsHtml = '';
    categories.forEach(cat => {
        if (cat.max <= 0) return;
        const val = gradesObj[cat.id] !== undefined ? gradesObj[cat.id] : (gradesObj[cat.key] || 0);
        let earned = 0, statusText = '', statusColor = '#10b981';
        if (isAssignmentsCategory(cat)) {
            earned = getStudentAssignmentScore(student, store.activeSubjectId, cat.max);
            const totalGiven = getActiveAssignmentsCount(activeClass, store.activeSubjectId);
            const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : [];
            if (totalGiven === 0) { statusText = 'لم تسند واجبات بعد'; statusColor = '#64748b'; }
            else {
                let missedCount = 0;
                for (let i = 0; i < totalGiven; i++) if (!assignArr || assignArr[i] !== true) missedCount++;
                if (missedCount === 0) { statusText = 'مكتمل ومتميز'; statusColor = '#10b981'; }
                else { statusText = `فاته (${missedCount} من ${totalGiven} واجب)`; statusColor = '#ef4444'; }
            }
        } else if (cat.type === 'dots') {
            earned = getCheckboxSum(val, cat.pointValue, cat.max);
            if (earned === cat.max) { statusText = 'مكتمل بالكامل'; statusColor = '#10b981'; }
            else if (earned > 0) { statusText = 'مكتمل جزئياً'; statusColor = '#f59e0b'; }
            else { statusText = 'لم ينجز'; statusColor = '#ef4444'; }
        } else if (cat.type === 'participation') {
            earned = getParticipationScore(val, cat.max, cat.pointValue);
            if (earned >= cat.max * 0.8) { statusText = 'تفاعل ممتاز'; statusColor = '#10b981'; }
            else if (earned >= cat.max * 0.5) { statusText = 'تفاعل متوسط'; statusColor = '#f59e0b'; }
            else { statusText = 'يتطلب متابعة'; statusColor = '#ef4444'; }
        } else if (cat.type === 'numeric') {
            earned = parseFloat(val) || 0;
            if (earned >= cat.max * 0.8) { statusText = 'ممتاز'; statusColor = '#10b981'; }
            else if (earned >= cat.max * 0.5) { statusText = 'متوسط'; statusColor = '#f59e0b'; }
            else { statusText = 'ضعيف'; statusColor = '#ef4444'; }
        }
        categoriesRowsHtml += `<tr style="border-bottom:1px solid #cbd5e1;"><td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;">${cat.name}</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-weight:bold;">${earned}</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${cat.max}</td><td style="border:1px solid #cbd5e1;padding:8px;color:${statusColor};font-weight:bold;">${statusText}</td></tr>`;
    });

    const partVal = gradesObj.participation || gradesObj['cat_participation'];
    const violations = Array.isArray(partVal) ? partVal.filter(p => typeof p === 'string' && p.trim() !== '') : [];
    let behaviorSection = '';
    if (violations.length > 0) {
        behaviorSection = `<div style="font-size:0.85rem;font-weight:800;color:#1e1b4b;border-right:3px solid #1e1b4b;padding-right:8px;margin-bottom:8px;text-align:right;">السلوك والانضباط الصفي:</div><div style="border:1px solid #cbd5e1;padding:12px;border-radius:6px;background:#ffffff;margin-bottom:20px;font-size:0.8rem;line-height:1.5;text-align:right;"><span style="color:#ef4444;font-weight:bold;">⚠️ تنبيه بخصوص الملاحظات المرصودة:</span><br>تم رصد ${violations.length} مخالفات سلوكية ونقاط حمراء هذا الفصل للأسباب التالية:<br>${violations.map(v => `• ${v}`).join('<br>')}</div>`;
    }

    let comparisonSection = '';
    if (activeClass.students && activeClass.students.length > 1) {
        const classTotals = activeClass.students.map(s => getStudentTotal(s));
        const classAvg = classTotals.reduce((a, b) => a + b, 0) / classTotals.length;
        const diff = total - classAvg;
        let diffText, diffColor;
        if (diff > 0.5) { diffText = `فوق متوسط الفصل بـ ${Math.abs(diff).toFixed(1)} نقطة 📈`; diffColor = '#10b981'; }
        else if (diff < -0.5) { diffText = `تحت متوسط الفصل بـ ${Math.abs(diff).toFixed(1)} نقطة 📉`; diffColor = '#ef4444'; }
        else { diffText = 'مطابق تقريباً لمتوسط الفصل'; diffColor = '#64748b'; }
        comparisonSection = `<div style="font-size:0.85rem;font-weight:800;color:#1e1b4b;border-right:3px solid #1e1b4b;padding-right:8px;margin-bottom:8px;text-align:right;">مقارنة الأداء بمتوسط الفصل:</div><div style="border:1px solid #cbd5e1;padding:10px 12px;border-radius:6px;background:#ffffff;margin-bottom:20px;font-size:0.8rem;text-align:right;">متوسط درجات الفصل: <strong>${classAvg.toFixed(1)}</strong> من 100 — درجة الطالب: <strong>${total}</strong> — <span style="color:${diffColor};font-weight:800;">${diffText}</span></div>`;
    }

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;border-bottom:2px solid #0f172a;padding-bottom:8px;">
        <div style="text-align:right;font-size:0.8rem;line-height:1.4;color:#1e1b4b;font-weight:bold;flex:1;">وزارة التعليم<br>الإدارة العامة للتعليم بالقصيم<br>مدرسة: ${store.portfolioSettings.schoolName || '..........'}</div>
        <div style="text-align:center;flex:1;"><img src="/moe_official_logo.png?v=2" alt="وزارة التعليم" style="height:70px;max-width:140px;object-fit:contain;"></div>
        <div style="text-align:left;flex:1;"><span style="font-size:1.05rem;font-weight:800;color:#1e1b4b;background:#f8fafc;padding:4px 12px;border:1.5px solid #0f172a;border-radius:20px;display:inline-block;">تقرير مستوى الطالب</span></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;">
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;font-size:0.85rem;background:#f8fafc;font-weight:bold;text-align:right;">اسم الطالب: <span style="color:#1e1b4b;">${student.name}</span></div>
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;font-size:0.85rem;background:#f8fafc;font-weight:bold;text-align:right;">الصف / الفصل: <span style="color:#1e1b4b;">${activeClass.name}</span></div>
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;font-size:0.85rem;background:#f8fafc;font-weight:bold;text-align:right;">المادة الدراسية: <span style="color:#1e1b4b;">${activeSubjName}</span></div>
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;font-size:0.85rem;background:#f8fafc;font-weight:bold;text-align:right;">تاريخ التقرير: <span style="color:#1e1b4b;">${new Date().toLocaleDateString('ar-SA')}</span></div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:0.85rem;border:1px solid #cbd5e1;"><thead><tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;"><th style="border:1px solid #cbd5e1;padding:8px;text-align:right;font-weight:800;">الجانب التقييمي</th><th style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-weight:800;width:20%;">النتيجة / الدرجة</th><th style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-weight:800;width:20%;">الدرجة العظمى</th><th style="border:1px solid #cbd5e1;padding:8px;text-align:right;font-weight:800;width:30%;">مستوى الإنجاز</th></tr></thead><tbody>
        ${categoriesRowsHtml}
        <tr style="border-top:2px solid #0f172a;background:#f8fafc;font-weight:bold;"><td style="border:1px solid #cbd5e1;padding:8px;font-size:1rem;">المجموع الكلي النهائي</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-size:1rem;color:${total >= 50 ? '#14b8a6' : '#ef4444'};font-weight:800;">${total}</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-size:1rem;">100</td><td style="border:1px solid #cbd5e1;padding:8px;font-size:1rem;color:${total >= 50 ? '#14b8a6' : '#ef4444'};font-weight:800;">${total >= 90 ? 'ممتاز' : (total >= 50 ? 'ناجح' : 'مكمل')}</td></tr>
    </tbody></table>
    ${behaviorSection}
    ${comparisonSection}
    <div style="display:flex;justify-content:flex-start;margin-top:25px;border-top:1px dashed #cbd5e1;padding-top:15px;font-size:0.85rem;color:#1e293b;"><div style="text-align:right;line-height:1.6;"><span style="font-weight:700;">معلم المادة / أ. ${store.portfolioSettings.teacherName || '....................'}</span></div></div>`;
};

window.buildStudentWhatsappMessage = function(student) {
    const gradesObj = getStudentSubjectGrades(student);
    const activeSubjName = store.subjects.find(s => s.id === store.activeSubjectId)?.name || 'لم يحدد';
    const total = getStudentTotal(student);
    const status = getStudentStatus(total);

    let message = `*تقرير متابعة مستوى الطالب*\nالطالب: ${student.name}\nالمادة: ${activeSubjName}\nالمجموع الكلي: ${total} من 100 (${status})\n\n`;

    const activeClass = getActiveClass();
    const totalGivenAssignments = getActiveAssignmentsCount(activeClass, store.activeSubjectId);
    if (totalGivenAssignments > 0) {
        const assignArr = gradesObj.assignments || gradesObj['cat_assignments'] || [];
        const missedAssignments = [];
        let solvedCount = 0;
        for (let i = 0; i < totalGivenAssignments; i++) {
            if (assignArr[i] === true) solvedCount++; else missedAssignments.push(`واجب ${i + 1}`);
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
    message += `\nنرجو منكم دوام التعاون والتوجيه لمزيد من التقدم والتحصيل العلمي.\nشاكرين لكم اهتمامهم. 🌹`;
    return message;
};

// Auto-detected checkbox defaults + problem description for the referral
// form, based on the student's actual missed-assignment/violation/total
// data — same detection rules as the old openStudentReferralModal.
window.buildReferralDefaults = function(student, activeClass, defaultReason = null) {
    const gradesObj = getStudentSubjectGrades(student);
    const total = getStudentTotal(student);
    const totalGiven = getActiveAssignmentsCount(activeClass, store.activeSubjectId);
    const assignArr = gradesObj ? (gradesObj.assignments || gradesObj['cat_assignments']) : [];
    const missedAssignments = [];
    if (totalGiven > 0) {
        for (let i = 0; i < totalGiven; i++) if (!assignArr || assignArr[i] !== true) missedAssignments.push(`واجب ${i + 1}`);
    }
    const partVal = gradesObj ? (gradesObj.participation || gradesObj['cat_participation']) : [];
    const violations = Array.isArray(partVal) ? partVal.filter(p => typeof p === 'string' && p.trim() !== '') : [];

    const reasons = { homework: false, weakness: false, disruption: false, tools: false, cheating: false, other: false };
    const problemDetails = [];

    if (defaultReason === 'homework' || missedAssignments.length > 0) {
        reasons.homework = true;
        problemDetails.push(missedAssignments.length > 0
            ? `يعاني الطالب من إهمال متكرر في حل وتسليم الواجبات المطلوبة (${missedAssignments.length} واجبات: ${missedAssignments.join('، ')}).`
            : `يعاني الطالب من عدم أداء الواجبات والمهام الموكلة إليه.`);
    }
    if (defaultReason === 'disruption' || violations.length > 0) {
        reasons.disruption = true;
        problemDetails.push(`تم رصد ملاحظات على السلوك والانضباط الصفي: (${violations.join('، ')}).`);
    }
    if (defaultReason === 'weakness' || total < 50) {
        reasons.weakness = true;
        problemDetails.push(`يعاني الطالب من ضعف في المستوى والتحصيل الدراسي العام.`);
    }
    if (problemDetails.length === 0) {
        reasons.homework = true;
        problemDetails.push(`يعاني الطالب من إهمال متكرر في أداء الواجبات المنزلية والمهام الصفية.`);
    }

    return {
        reasons,
        problemText: problemDetails.join('\n'),
        effortsText: 'تم تنبيه الطالب شفهياً عدة مرات والجلوس معه لمعرفة الأسباب، وذلك في إطار تحسين مستوى الطالب وتوجيهه دراسياً وسلوكياً.'
    };
};
