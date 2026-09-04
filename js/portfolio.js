// v2/js/portfolio.js — the teacher portfolio (ملف الشواهد المهنية)
// generator. Ported near-verbatim from js/portfolio.js's renderPortfolioPreview
// (1100+ lines of mostly static official-form templates with data
// interpolation) — kept as one function that appends real page <div>s into
// a container element (rather than a pure string-returning function),
// since a few sections (the results-distribution chart) need the page
// actually in the DOM before they can size a <canvas> and hand it to
// Chart.js. PortfolioPanel owns the container ref and the show/hide
// checkbox state (passed in as `toggles`) instead of this function reading
// them from document.getElementById() itself, as the old version did.
window.buildPortfolioPages = function(container, toggles) {
    const showCover = toggles.cover;
    const showCV = toggles.cv;
    const showDuties = toggles.duties;
    const showCommunity = toggles.community;
    const showParents = toggles.parents;
    const showStrategies = toggles.strategies;
    const showImprovement = toggles.improvement;
    const showPlan = toggles.plan;
    const showTech = toggles.tech;
    const showEnv = toggles.env;
    const showClassroom = toggles.classroom;
    const showAnalysis = toggles.analysis;
    const showEvaluation = toggles.evaluation;

    container.innerHTML = '';

    let pageNum = 1;
    const activeClass = getActiveClass() || { name: 'لم يحدد', students: [] };
    const activeSubjName = store.subjects.find(s => s.id === store.activeSubjectId)?.name || 'لم يحدد';

    const createOfficialFormPage = (formTitle, contentHtml, metadataHtml) => {
        const headerTable = `
        <table class="port-header-table" style="width:100%; border-collapse:collapse; margin-bottom:1rem; border:none; line-height: 1.2;">
            <tr>
                <td style="text-align:right; font-size:0.75rem; line-height:1.4; color:#334155; border:none; padding:0; font-weight:bold;">
                    المملكة العربية السعودية<br>
                    وزارة التعليم<br>
                    الإدارة العامة للتعليم بالقصيم<br>
                    مدرسة: ${store.portfolioSettings.schoolName || '..........'}
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
                <span style="font-weight: 700; display: block; margin-bottom: 20px;">معد النموذج / ${store.portfolioSettings.teacherName || '....................'}</span>
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
                    مدرسة: ${store.portfolioSettings.schoolName || '..........'}
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
                    <span class="port-info-value" style="font-weight:700; font-size:1.1rem;">${store.portfolioSettings.teacherName || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">التخصص الدراسي:</span>
                    <span class="port-info-value">${store.portfolioSettings.specialization || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">المسمى الوظيفي:</span>
                    <span class="port-info-value">${store.portfolioSettings.jobTitle || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">الرقم الوظيفي:</span>
                    <span class="port-info-value">${store.portfolioSettings.jobNum || '...................................'}</span>
                </div>
                <div class="port-info-row">
                    <span class="port-info-label">العام الدراسي:</span>
                    <span class="port-info-value">${store.portfolioSettings.schoolYear || '...................................'}</span>
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
                    مدرسة: ${store.portfolioSettings.schoolName || '..........'}
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
                        <td style="text-align:right; font-weight:700;">${store.portfolioSettings.teacherName || '...................................'}</td>
                    </tr>
                    <tr>
                        <th style="text-align:right;">المسمى والدرجة</th>
                        <td style="text-align:right;">${store.portfolioSettings.jobTitle || '...................................'}</td>
                    </tr>
                    <tr>
                        <th style="text-align:right;">الرقم الوظيفي</th>
                        <td style="text-align:right;">${store.portfolioSettings.jobNum || '...................................'}</td>
                    </tr>
                    <tr>
                        <th style="text-align:right;">المدرسة الحالية</th>
                        <td style="text-align:right;">${store.portfolioSettings.schoolName || '...................................'}</td>
                    </tr>
                </table>

                <h3 style="color:#1e1b4b; font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;"><i class="fa-solid fa-eye" style="color:var(--accent-teal);"></i> رؤية المعلم:</h3>
                <div style="background:#f8fafc; border-right:4px solid var(--accent-teal); padding:0.85rem; margin:0.25rem 0 1rem 0; font-style:italic; font-size:0.9rem; color:#334155;">
                    ${store.portfolioSettings.vision ? store.portfolioSettings.vision.replace(/\n/g, '<br>') : 'لتأسيس جيل مبدع ومتمكن علمياً وتقنياً قادر على المنافسة محلياً ودولياً.'}
                </div>
                
                <h3 style="color:#1e1b4b; font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;"><i class="fa-solid fa-bullseye" style="color:var(--accent-teal);"></i> رسالة المعلم:</h3>
                <div style="background:#f8fafc; border-right:4px solid var(--accent-teal); padding:0.85rem; margin:0.25rem 0 1rem 0; font-style:italic; font-size:0.9rem; color:#334155;">
                    ${store.portfolioSettings.mission ? store.portfolioSettings.mission.replace(/\n/g, '<br>') : 'تقديم تعليم متميز يحفز التفكير الإبداعي ويوظف التقنيات الحديثة.'}
                </div>
                
                <h3 style="color:#1e1b4b; font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;"><i class="fa-solid fa-lightbulb" style="color:var(--accent-teal);"></i> الفلسفة التربوية:</h3>
                <div style="background:#f8fafc; border-right:4px solid var(--accent-teal); padding:0.85rem; margin:0.25rem 0 0 0; text-align:justify; font-size:0.9rem; line-height:1.6; color:#334155;">
                    ${store.portfolioSettings.philosophy ? store.portfolioSettings.philosophy.replace(/\n/g, '<br>') : 'أؤمن بأن التعليم رسالة سامية محورها الطالب، والتدريس الفعال هو الذي يراعي الفروق الفردية ويسعى لتمكين كل متعلم.'}
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
                العام الدراسي: ${store.portfolioSettings.schoolYear || '1447هـ'}
            </div>
        </div>`;

        container.appendChild(createOfficialFormPage('البند 1: أداء الواجبات الوظيفية', content, metaHtml));
    }

    // Item 2: المجتمع المهني (تبادل الزيارات)
    if (showCommunity) {
        const visits = store.portfolioSettings.visitsRecord ? store.portfolioSettings.visitsRecord.split('\n') : [
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
            if (store.portfolioSettings.visitsImage) {
                const isPdf = store.portfolioSettings.visitsImage.startsWith('data:application/pdf');
                if (isPdf) {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">مستند الشاهد المرفق (PDF):</strong>
                        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; text-align: right; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-file-pdf" style="font-size: 1.8rem; color: #ef4444;"></i>
                                <div>
                                    <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a;">${store.portfolioSettings.visitsImageName || 'document.pdf'}</span><br>
                                    <span style="font-size: 0.7rem; color: #64748b;">مستند مرفق</span>
                                </div>
                            </div>
                            <a href="${store.portfolioSettings.visitsImage}" target="_blank" style="padding: 4px 8px; background: #0f172a; color: white; border-radius: 4px; font-size: 0.7rem; text-decoration: none; font-weight: bold;">عرض المستند</a>
                        </div>
                        <object data="${store.portfolioSettings.visitsImage}" type="application/pdf" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;">
                            <p>يمكنك <a href="${store.portfolioSettings.visitsImage}" target="_blank">النقر هنا لعرض ملف الـ PDF المرفق</a>.</p>
                        </object>
                    </div>`;
                } else {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">شاهد مصور للزيارة الصفية المهنية:</strong>
                        <img src="${store.portfolioSettings.visitsImage}" style="max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 5px;">
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

    const targetClasses = (store.classes && store.classes.length > 0) ? store.classes : [activeClass || { name: 'لم يحدد', students: [] }];

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
            const reportStr = store.portfolioSettings.strategyReport || 'تم تطبيق استراتيجية "التعلم التعاوني النشط" في مجموعات دراسية ثنائية وتكليفهم بحل مشكلات صفية تخصصية، مما رفع نسبة التفاعل والمشاركة النشطة داخل الصف بمتوسط 30%.';
            
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
            if (store.portfolioSettings.strategyImage) {
                const isPdf = store.portfolioSettings.strategyImage.startsWith('data:application/pdf');
                if (isPdf) {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">مستند الشاهد المرفق (PDF):</strong>
                        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; text-align: right; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-file-pdf" style="font-size: 1.8rem; color: #ef4444;"></i>
                                <div>
                                    <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a;">${store.portfolioSettings.strategyImageName || 'document.pdf'}</span><br>
                                    <span style="font-size: 0.7rem; color: #64748b;">مستند مرفق</span>
                                </div>
                            </div>
                            <a href="${store.portfolioSettings.strategyImage}" target="_blank" style="padding: 4px 8px; background: #0f172a; color: white; border-radius: 4px; font-size: 0.7rem; text-decoration: none; font-weight: bold;">عرض المستند</a>
                        </div>
                        <object data="${store.portfolioSettings.strategyImage}" type="application/pdf" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;">
                            <p>يمكنك <a href="${store.portfolioSettings.strategyImage}" target="_blank">النقر هنا لعرض ملف الـ PDF المرفق</a>.</p>
                        </object>
                    </div>`;
                } else {
                    imageHtml = `
                    <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                        <strong style="display: block; text-align: right; margin-bottom: 5px;">شاهد مصور لتطبيق الاستراتيجية:</strong>
                        <img src="${store.portfolioSettings.strategyImage}" style="max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 5px;">
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
            const failingStudentsList = students.filter(s => getStudentTotal(s, store.activeSubjectId, currentClass) < 60);
            const outstandingStudentsList = students.filter(s => getStudentTotal(s, store.activeSubjectId, currentClass) >= 90);

            let failingRows = '';
            if (failingStudentsList.length > 0) {
                failingRows = failingStudentsList.map(s => {
                    const total = getStudentTotal(s, store.activeSubjectId, currentClass);
                    const gradesObj = getStudentSubjectGrades(s);
                    const activeCats = getActiveSubjectGradingCategories(store.activeSubjectId);
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
                    const total = getStudentTotal(s, store.activeSubjectId, currentClass);
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
        const planCategories = getActiveSubjectGradingCategories(store.activeSubjectId).filter(cat => cat.max > 0);
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
        const envStr = store.portfolioSettings.classroomEnv || 'تهيئة الصف بتوزيع مجموعات عمل وتثبيت شاشات تفاعلية، مع تقسيم الطلاب وفقاً أنماط التعلم لتوفير بيئة تعليمية محفزة لجميع القدرات.';
        const activeStudents = getActiveStudents();
        const total = activeStudents.length;
        const visualCount = Math.ceil(total * 0.4);
        const auditoryCount = Math.ceil(total * 0.35);
        const kinestheticCount = Math.max(0, total - visualCount - auditoryCount);
        
        let imageHtml = '';
        if (store.portfolioSettings.classroomEnvImage) {
            const isPdf = store.portfolioSettings.classroomEnvImage.startsWith('data:application/pdf');
            if (isPdf) {
                imageHtml = `
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                    <strong style="display: block; text-align: right; margin-bottom: 5px;">مستند الشاهد المرفق (PDF):</strong>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; text-align: right; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-file-pdf" style="font-size: 1.8rem; color: #ef4444;"></i>
                            <div>
                                <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a;">${store.portfolioSettings.classroomEnvImageName || 'document.pdf'}</span><br>
                                <span style="font-size: 0.7rem; color: #64748b;">مستند مرفق</span>
                            </div>
                        </div>
                        <a href="${store.portfolioSettings.classroomEnvImage}" target="_blank" style="padding: 4px 8px; background: #0f172a; color: white; border-radius: 4px; font-size: 0.7rem; text-decoration: none; font-weight: bold;">عرض المستند</a>
                    </div>
                    <object data="${store.portfolioSettings.classroomEnvImage}" type="application/pdf" style="width: 100%; height: 300px; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <p>يمكنك <a href="${store.portfolioSettings.classroomEnvImage}" target="_blank">النقر هنا لعرض ملف الـ PDF المرفق</a>.</p>
                    </object>
                </div>`;
            } else {
                imageHtml = `
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #ffffff; margin-top: 10px; text-align: center;">
                    <strong style="display: block; text-align: right; margin-bottom: 5px;">شاهد مصور للبيئة التعليمية المادية الصفية:</strong>
                    <img src="${store.portfolioSettings.classroomEnvImage}" style="max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 5px;">
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
            const grades = students.map(s => getStudentTotal(s, store.activeSubjectId, currentClass));
            
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
        const evalCategories = getActiveSubjectGradingCategories(store.activeSubjectId).filter(cat => cat.max > 0);
        targetClasses.forEach(currentClass => {
            const students = currentClass.students || [];

            let tableRowsHtml = '';
            students.forEach((student, idx) => {
                const catScores = evalCategories.map(cat => getCategoryEarnedScore(student, cat, store.activeSubjectId, currentClass));
                const total = getStudentTotal(student, store.activeSubjectId, currentClass);
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
    store.portfolioSettings.customForms = store.portfolioSettings.customForms || [];
    store.portfolioSettings.customForms.forEach(cf => {
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
};
