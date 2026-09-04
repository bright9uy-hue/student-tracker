// reports.js — split out of the original monolithic app.js.
// Sections included (original app.js line ranges, for reference):
//   lines 2727-2843: CSV EXPORT (incl. Noor export)
//   lines 3564-4019: WEEKLY WHATSAPP REPORT LOGIC & SETTINGS
//   lines 5540-5901: INDIVIDUAL STUDENT REPORT LOGIC
//   lines 5902-6067: STUDENT REFERRAL FORM
// Loaded as a plain classic <script> (no bundler/module system) alongside
// the other js/*.js files below — all still share the same global scope
// exactly as when this was one file; see index.html for load order.

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

// Export the two Noor-format score buckets (40 + 60) for the active class
// and subject. Each grading category carries a noorBucket tag ('40', '60',
// or 'none') set from the category setup wizard — normalizeGradingCategory()
// auto-fills it for the recognized legacy names (assignments/activities/
// research/participation -> 40, practical/exam -> 60), but a genuinely new
// custom category is left unset until the teacher chooses explicitly. This
// export refuses to guess: any scored category still unset blocks the
// export with a clear message, since a wrong number here goes straight into
// an official government system.
window.exportNoorGrades = function() {
    const activeClass = getActiveClass();
    if (!activeClass || !activeClass.students || activeClass.students.length === 0) {
        showNotification('لا يوجد فصل نشط أو طلاب لتصدير درجاتهم!', 'error');
        return;
    }

    const categories = getActiveSubjectGradingCategories(activeSubjectId);
    const unmapped = categories.filter(cat => cat.max > 0 && cat.noorBucket !== '40' && cat.noorBucket !== '60' && cat.noorBucket !== 'none');
    if (unmapped.length > 0) {
        showNotification(
            `يجب تحديد خانة نور (40 أو 60) لكل بند تقييم قبل التصدير. افتح "إعداد بنود التقييم" وحدد الخانة للبنود التالية: ${unmapped.map(c => c.name).join('، ')}`,
            'error'
        );
        return;
    }

    const bucket40Cats = categories.filter(cat => cat.noorBucket === '40');
    const bucket60Cats = categories.filter(cat => cat.noorBucket === '60');
    if (bucket40Cats.length === 0 && bucket60Cats.length === 0) {
        showNotification('لا توجد بنود تقييم مرتبطة بخانتي نور (40/60) لهذه المادة!', 'error');
        return;
    }

    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'مادة عامة';
    let csv = `فصل: ${activeClass.name}\nالمادة: ${activeSubjName}\nتصدير متوافق مع نظام نور\n`;
    csv += `اسم الطالب,الدرجة من 40,الدرجة من 60,المجموع\n`;

    activeClass.students.forEach(s => {
        const score40 = bucket40Cats.reduce((sum, cat) => sum + getCategoryEarnedScore(s, cat, activeSubjectId, activeClass), 0);
        const score60 = bucket60Cats.reduce((sum, cat) => sum + getCategoryEarnedScore(s, cat, activeSubjectId, activeClass), 0);
        const r40 = Math.round(score40 * 100) / 100;
        const r60 = Math.round(score60 * 100) / 100;
        csv += `"${s.name}",${r40},${r60},${Math.round((r40 + r60) * 100) / 100}\n`;
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `درجات_نور_${activeClass.name}_${activeSubjName}`.replace(/\s+/g, '_') + `_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showNotification(`تم تصدير درجات نور لفصل "${activeClass.name}" بنجاح.`, 'success');
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

// Fired when sendWeeklyReport's full pipeline (build report -> generate
// PDF/image -> send via WhatsApp) finishes, however it finishes. The
// server-side automated scheduler (see server.js) drives a headless page
// through sendWeeklyReport() and waits on this event, since the function
// itself doesn't return a promise and its completion happens several
// callbacks deep (PDF generation, FileReader, the WhatsApp send call).
function dispatchWeeklyReportDone(detail) {
    window.dispatchEvent(new CustomEvent('weeklyReportSendComplete', { detail }));
}

window.sendWeeklyReport = function() {
    if (!classes || classes.length === 0) {
        showNotification('لا توجد أي فصول لإرسال التقرير عنها!', 'error');
        dispatchWeeklyReportDone({ sent: false, reason: 'no-classes' });
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
        dispatchWeeklyReportDone({ sent: false, reason: 'no-issues' });
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
                        lastReportDate = Date.now();
                        saveData();
                        checkWeeklyReportStatus();
                        setTimeout(() => {
                            closePdfReportModal();
                        }, 1500);
                    }
                    dispatchWeeklyReportDone({ sent: !!sent, reason: 'pdf' });
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
                        lastReportDate = Date.now();
                        saveData();
                        checkWeeklyReportStatus();
                        setTimeout(() => {
                            closePdfReportModal();
                        }, 1500);
                    }
                    dispatchWeeklyReportDone({ sent: !!sent, reason: 'image-fallback' });
                }).catch(e => {
                    pdfGenerationStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> فشل توليد التقرير: ${e.message}`;
                    dispatchWeeklyReportDone({ sent: false, reason: 'error', message: e.message });
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

    const enabledEl = document.getElementById('weeklyScheduleEnabled');
    const dayEl = document.getElementById('weeklyScheduleDay');
    const timeEl = document.getElementById('weeklyScheduleTime');
    if (enabledEl && dayEl && timeEl) {
        const sched = weeklyReportSchedule || { enabled: false, dayOfWeek: 4, hour: 15, minute: 0 };
        enabledEl.checked = !!sched.enabled;
        dayEl.value = String(sched.dayOfWeek != null ? sched.dayOfWeek : 4);
        const hh = String(sched.hour != null ? sched.hour : 15).padStart(2, '0');
        const mm = String(sched.minute != null ? sched.minute : 0).padStart(2, '0');
        timeEl.value = `${hh}:${mm}`;
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

        const enabledEl = document.getElementById('weeklyScheduleEnabled');
        const dayEl = document.getElementById('weeklyScheduleDay');
        const timeEl = document.getElementById('weeklyScheduleTime');
        if (enabledEl && dayEl && timeEl) {
            const [hh, mm] = (timeEl.value || '15:00').split(':').map(n => parseInt(n, 10) || 0);
            // Saving always "arms" the schedule from this moment forward —
            // otherwise enabling it after this week's target day/time has
            // already passed would fire an unexpected send immediately.
            weeklyReportSchedule = {
                enabled: !!enabledEl.checked,
                dayOfWeek: parseInt(dayEl.value, 10),
                hour: hh,
                minute: mm,
                lastAutoSentAt: enabledEl.checked ? Date.now() : (weeklyReportSchedule ? weeklyReportSchedule.lastAutoSentAt : null)
            };
        }

        saveData();
        closeWhatsappSettingsModal();
        showNotification('تم حفظ رقم الواتساب وإعدادات الجدولة بنجاح.');
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

    // Compare against the class average so the report says more than just
    // "50/100" — a parent has no way to judge that number on its own.
    let comparisonSection = '';
    if (activeClass.students && activeClass.students.length > 1) {
        const classTotals = activeClass.students.map(s => getStudentTotal(s));
        const classAvg = classTotals.reduce((a, b) => a + b, 0) / classTotals.length;
        const diff = total - classAvg;
        let diffText, diffColor;
        if (diff > 0.5) {
            diffText = `فوق متوسط الفصل بـ ${Math.abs(diff).toFixed(1)} نقطة 📈`;
            diffColor = '#10b981';
        } else if (diff < -0.5) {
            diffText = `تحت متوسط الفصل بـ ${Math.abs(diff).toFixed(1)} نقطة 📉`;
            diffColor = '#ef4444';
        } else {
            diffText = 'مطابق تقريباً لمتوسط الفصل';
            diffColor = '#64748b';
        }
        comparisonSection = `
        <div style="font-size: 0.85rem; font-weight: 800; color: #1e1b4b; border-right: 3px solid #1e1b4b; padding-right: 8px; margin-bottom: 8px; text-align: right;">
            مقارنة الأداء بمتوسط الفصل:
        </div>
        <div style="border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px; background: #ffffff; margin-bottom: 20px; font-size: 0.8rem; text-align: right;">
            متوسط درجات الفصل: <strong>${classAvg.toFixed(1)}</strong> من 100 — درجة الطالب: <strong>${total}</strong> — <span style="color:${diffColor}; font-weight:800;">${diffText}</span>
        </div>`;
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
            ${comparisonSection}

            <div style="display: flex; justify-content: flex-start; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 0.85rem; color: #1e293b;">
                <div style="text-align: right; line-height: 1.6;">
                    <span style="font-weight: 700;">معلم المادة / أ. ${portfolioSettings.teacherName || '....................'}</span>
                </div>
            </div>
        `;
    }

    renderStudentFollowupPanel(student);
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

window.sendStudentReportToWhatsapp = async function() {
    if (!currentReportStudent) return;
    const gradesObj = getStudentSubjectGrades(currentReportStudent);
    const activeSubjName = subjects.find(s => s.id === activeSubjectId)?.name || 'لم يحدد';
    const total = getStudentTotal(currentReportStudent);
    const status = getStudentStatus(total);

    let message = `*تقرير متابعة مستوى الطالب*\n`;
    message += `الطالب: ${currentReportStudent.name}\n`;
    message += `المادة: ${activeSubjName}\n`;
    message += `المجموع الكلي: ${total} من 100 (${status})\n\n`;

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

    const sent = await sendWhatsAppDirectOrWeb(whatsappNumber, message);
    if (sent) {
        if (!Array.isArray(currentReportStudent.commLog)) currentReportStudent.commLog = [];
        currentReportStudent.commLog.push({
            date: Date.now(),
            summary: `إرسال تقرير المستوى الفردي (المجموع: ${total} من 100)`
        });
        saveData();
        renderStudentFollowupPanel(currentReportStudent);
    }
};

// Minimal HTML-escaping for freeform teacher-entered text (notes) before
// it's dropped into innerHTML — student names elsewhere in this file are
// never escaped either, but notes are much more likely to contain raw
// "<" or "&" that would otherwise break the panel's markup.
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function renderStudentFollowupPanel(student) {
    const notesList = document.getElementById('studentNotesList');
    const commLogList = document.getElementById('studentCommLogList');

    if (notesList) {
        const notes = Array.isArray(student.notes) ? student.notes : [];
        notesList.innerHTML = notes.length === 0
            ? `<div style="color: var(--text-muted); text-align:center; padding:8px;">لا توجد ملاحظات مسجلة بعد.</div>`
            : notes.slice().reverse().map(n => `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; background:rgba(255,255,255,0.05); border-radius:6px; padding:8px;">
                    <div style="flex:1;">
                        <div>${escapeHtml(n.text)}</div>
                        <div style="font-size:0.7rem; color: var(--text-muted); margin-top:2px;">${new Date(n.date).toLocaleString('ar-SA')}</div>
                    </div>
                    <button type="button" onclick="deleteStudentFollowupNote('${n.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem;" title="حذف الملاحظة"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('');
    }

    if (commLogList) {
        const log = Array.isArray(student.commLog) ? student.commLog : [];
        commLogList.innerHTML = log.length === 0
            ? `<div style="color: var(--text-muted); text-align:center; padding:8px;">لا يوجد تواصل مسجل سابقاً.</div>`
            : log.slice().reverse().map(l => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(37,211,102,0.08); border-radius:6px; padding:6px 8px;">
                    <span><i class="fa-brands fa-whatsapp" style="color:#25d366;"></i> ${escapeHtml(l.summary || 'إرسال تقرير')}</span>
                    <span style="color: var(--text-muted); font-size:0.7rem; white-space:nowrap;">${new Date(l.date).toLocaleString('ar-SA')}</span>
                </div>
            `).join('');
    }
}

window.addStudentFollowupNote = function() {
    if (!currentReportStudent) return;
    const input = document.getElementById('studentNoteInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    if (!Array.isArray(currentReportStudent.notes)) currentReportStudent.notes = [];
    currentReportStudent.notes.push({
        id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        text: text,
        date: Date.now()
    });
    saveData();
    input.value = '';
    renderStudentFollowupPanel(currentReportStudent);
};

window.deleteStudentFollowupNote = function(noteId) {
    if (!currentReportStudent || !Array.isArray(currentReportStudent.notes)) return;
    currentReportStudent.notes = currentReportStudent.notes.filter(n => n.id !== noteId);
    saveData();
    renderStudentFollowupPanel(currentReportStudent);
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

