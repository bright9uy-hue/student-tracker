// v2/js/components/ReferralModal.js — official referral form. Checkboxes/
// textareas are auto-filled from the student's actual data
// (buildReferralDefaults) but stay live-editable, exactly like the old
// printable form did, since the teacher may want to adjust wording before
// exporting.
window.ReferralModal = {
    props: { modelValue: Boolean, student: Object },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 850px; padding: 20px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem; color:#1e1b4b;">
                        <i class="fa-solid fa-file-signature" style="color: var(--accent-teal);"></i> نموذج إحالة طالب رسمي
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body" style="max-height:72vh; overflow-y:auto; padding:15px; background:rgba(0,0,0,0.3); border-radius:12px; display:flex; flex-direction:column; align-items:center;">
                    <div ref="printableArea" style="width:100%; max-width:720px; font-family:'Tajawal',sans-serif; padding:30px; background:#ffffff; color:#0f172a; box-sizing:border-box; border:1px solid #cbd5e1; direction:rtl; border-radius:6px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:16px;">
                            <div style="text-align:right; line-height:1.5; font-size:0.85rem; font-weight:700; color:#1e1b4b; flex:1;">
                                <div>وزارة التعليم</div>
                                <div>{{ eduDept }}</div>
                                <div>مدرسة: <span style="font-weight:800;">{{ schoolName }}</span></div>
                            </div>
                            <div style="text-align:center; flex:1;"><img src="/moe_official_logo.png?v=2" style="height:80px; max-width:150px; object-fit:contain;"></div>
                            <div style="text-align:left; line-height:1.4; flex:1;">
                                <div style="font-size:1.15rem; font-weight:800; background:#f1f5f9; padding:4px 14px; border:1.5px solid #0f172a; border-radius:20px; display:inline-block;">نموذج إحالة طالب</div>
                                <div style="font-size:0.75rem; color:#475569; margin-top:5px;">رمز النموذج : (و.ط.ع.ن ٠٤-٣٠٠-٠٣)</div>
                            </div>
                        </div>

                        <div style="display:flex; align-items:center; gap:15px; margin-bottom:14px; font-size:0.88rem; font-weight:700;">
                            <span>تحويل الطالب إلى:</span>
                            <label style="display:flex; align-items:center; gap:5px;"><input type="radio" value="counselor" v-model="destination"> الموجه الطلابي</label>
                            <label style="display:flex; align-items:center; gap:5px;"><input type="radio" value="vice" v-model="destination"> الوكيل</label>
                            <label style="display:flex; align-items:center; gap:5px;"><input type="radio" value="principal" v-model="destination"> المدير</label>
                        </div>

                        <div style="font-size:0.85rem; font-weight:700; margin-bottom:8px;">السلام عليكم ورحمه الله وبركاته نحيل اليكم :</div>
                        <div style="display:grid; grid-template-columns:2fr 1.2fr 1.2fr; gap:8px; margin-bottom:14px;">
                            <div style="border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; font-size:0.82rem; background:#f8fafc; font-weight:700;">الطالب: {{ student ? student.name : '' }}</div>
                            <div style="border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; font-size:0.82rem; background:#f8fafc; font-weight:700;">الصف: {{ className }}</div>
                            <div style="border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; font-size:0.82rem; background:#f8fafc; font-weight:700;">المادة: {{ subjectName }}</div>
                        </div>

                        <div style="font-size:0.85rem; font-weight:700; margin-bottom:8px;">سبب التحويل:</div>
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; font-size:0.82rem; font-weight:700;">
                            <label style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; background:#fff;"><input type="checkbox" v-model="reasons.homework"> عدم أداء الواجب</label>
                            <label style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; background:#fff;"><input type="checkbox" v-model="reasons.weakness"> ضعف دراسي</label>
                            <label style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; background:#fff;"><input type="checkbox" v-model="reasons.disruption"> شغب في الفصل</label>
                            <label style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; background:#fff;"><input type="checkbox" v-model="reasons.tools"> عدم إحضار الأدوات</label>
                            <label style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; background:#fff;"><input type="checkbox" v-model="reasons.cheating"> محضر غش</label>
                            <label style="display:flex; align-items:center; gap:6px; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; background:#fff;"><input type="checkbox" v-model="reasons.other"> أخرى</label>
                        </div>

                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem; font-weight:700;">
                            <div style="width:49%;">المشكلة:</div><div style="width:49%;">الجهود المبذولة من المعلم:</div>
                        </div>
                        <div style="display:flex; gap:10px; margin-bottom:14px;">
                            <textarea v-model="problemText" style="width:50%; min-height:95px; border:1px solid #cbd5e1; border-radius:6px; padding:8px; font-family:inherit; font-size:0.8rem; background:#fff;"></textarea>
                            <textarea v-model="effortsText" style="width:50%; min-height:95px; border:1px solid #cbd5e1; border-radius:6px; padding:8px; font-family:inherit; font-size:0.8rem; background:#fff;"></textarea>
                        </div>

                        <div style="display:grid; grid-template-columns:1.3fr 1fr 1.2fr; gap:8px; align-items:center; border:1px solid #cbd5e1; border-radius:6px; padding:6px 12px; margin-bottom:16px; font-size:0.82rem; font-weight:700; background:#f8fafc;">
                            <div>الاستاذ: {{ teacherName }}</div>
                            <div>التاريخ: {{ dateText }}</div>
                            <div style="display:flex; align-items:center; gap:8px;"><span>التوقيع:</span><img :src="signatureSrc" style="height:38px; max-width:130px; object-fit:contain; mix-blend-mode:multiply;"></div>
                        </div>

                        <div style="font-size:0.85rem; font-weight:800; border-right:3px solid #1e1b4b; padding-right:8px; margin-bottom:8px;">ما تم حيال الطالب:</div>
                        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                            <div style="border:1px solid #cbd5e1; border-radius:6px; padding:8px 12px; background:#fff;">
                                <div style="font-size:0.78rem; font-weight:800; color:#475569; margin-bottom:30px;">خاص بوكيل شؤون الطلاب:</div>
                                <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:#64748b; font-weight:700; border-top:1px dashed #e2e8f0; padding-top:6px;"><span>الاستاذ: ....................</span><span>التاريخ: &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / 1448 هـ</span><span>التوقيع: ....................</span></div>
                            </div>
                            <div style="border:1px solid #cbd5e1; border-radius:6px; padding:8px 12px; background:#fff;">
                                <div style="font-size:0.78rem; font-weight:800; color:#475569; margin-bottom:30px;">خاص بالموجه الطلابي:</div>
                                <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:#64748b; font-weight:700; border-top:1px dashed #e2e8f0; padding-top:6px;"><span>الاستاذ: ....................</span><span>التاريخ: &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / 1448 هـ</span><span>التوقيع: ....................</span></div>
                            </div>
                        </div>
                        <div style="text-align:center; font-size:0.8rem; font-weight:700; border-top:1px solid #cbd5e1; padding-top:10px;">نرجو منكم متابعة الطالب ودراسة الحالة ووضع الحلول العلاجية المناسبة لذلك.</div>
                    </div>

                    <div style="width:100%; max-width:720px; margin-top:14px; background:rgba(0,0,0,0.25); border-radius:10px; padding:12px 15px; text-align:right; direction:rtl; display:flex; flex-direction:column; gap:8px;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer;">
                            <input type="checkbox" v-model="attachReport" style="width:auto;"> إرفاق تقرير مستوى الطالب الفردي مع نموذج الإحالة
                        </label>
                        <div v-if="destination === 'counselor'" style="display:flex; align-items:center; gap:8px; font-size:0.85rem;">
                            <span>المرشد المسؤول عن هذا الفصل:</span>
                            <select class="form-control" v-model="selectedCounselorId" style="flex:1; max-width:220px;">
                                <option :value="null">-- اختر المرشد --</option>
                                <option v-for="c in store.counselors" :key="c.id" :value="c.id">{{ c.name }}</option>
                            </select>
                            <span v-if="store.counselors.length === 0" style="color:var(--text-muted); font-size:0.78rem;">لم يتم تسجيل أي مرشد بعد (إعدادات المعلم والمدرسة)</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button v-if="destination !== 'principal'" type="button" class="btn" style="background:#25d366; color:white;" @click="sendWhatsapp" :disabled="sending">
                        <i :class="sending ? 'fa-solid fa-circle-notch fa-spin' : 'fa-brands fa-whatsapp'"></i> إرسال عبر واتساب
                    </button>
                    <button type="button" class="btn" style="background:var(--accent-teal); color:white;" @click="exportPdf"><i class="fa-solid fa-file-pdf"></i> طباعة / تصدير PDF رسمي</button>
                </div>
            </div>
        </div>
    `,
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        const printableArea = Vue.ref(null);
        const destination = Vue.ref('vice');
        const reasons = Vue.reactive({ homework: false, weakness: false, disruption: false, tools: false, cheating: false, other: false });
        const problemText = Vue.ref('');
        const effortsText = Vue.ref('');
        const attachReport = Vue.ref(false);
        const selectedCounselorId = Vue.ref(null);
        const sending = Vue.ref(false);

        const schoolName = Vue.computed(() => store.portfolioSettings.schoolName || '..........');
        const teacherName = Vue.computed(() => store.portfolioSettings.teacherName || '....................');
        const eduDept = Vue.computed(() => store.portfolioSettings.eduDept || 'الإدارة العامة للتعليم بالقصيم');
        const subjectName = Vue.computed(() => store.subjects.find(s => s.id === store.activeSubjectId)?.name || 'المهارات الرقمية');
        const className = Vue.computed(() => getActiveClass()?.name || '');
        const dateText = Vue.computed(() => { try { return new Date().toLocaleDateString('ar-SA'); } catch (e) { return new Date().toLocaleDateString(); } });
        const signatureSrc = Vue.computed(() => store.portfolioSettings.signature || '/teacher_signature.png?v=1');

        Vue.watch(() => props.modelValue, (open) => {
            if (open && props.student) {
                const activeClass = getActiveClass();
                const defaults = buildReferralDefaults(props.student, activeClass);
                Object.assign(reasons, defaults.reasons);
                problemText.value = defaults.problemText;
                effortsText.value = defaults.effortsText;
                destination.value = 'vice';
                attachReport.value = false;
                selectedCounselorId.value = (activeClass && activeClass.counselorId) || null;
            }
        });

        // Remembers this class's counselor for next time, so the teacher
        // only has to pick it once per class instead of every referral.
        Vue.watch(selectedCounselorId, (id) => {
            const activeClass = getActiveClass();
            if (!activeClass || activeClass.counselorId === id) return;
            activeClass.counselorId = id;
            saveData();
        });

        function close() { emit('update:modelValue', false); }

        // Combines the referral form with the individual student report
        // (when requested) into one HTML string, so both export to PDF and
        // WhatsApp-sending produce a single combined document instead of
        // two separate files the recipient has to match up themselves.
        function buildExportHtml() {
            let html = printableArea.value.innerHTML;
            if (attachReport.value) {
                const activeClass = getActiveClass();
                html += '<div style="page-break-before:always;"></div>' + buildIndividualReportHtml(props.student, activeClass);
            }
            return html;
        }

        function exportPdf() {
            if (!printableArea.value || !props.student) return;
            generateAndDownloadPdf(buildExportHtml(), `نموذج_إحالة_طالب_${props.student.name.replace(/\s+/g, '_')}.pdf`, false);
        }

        async function sendWhatsapp() {
            if (!printableArea.value || !props.student || sending.value) return;

            let phone = null;
            if (destination.value === 'vice') {
                phone = store.portfolioSettings.viceNumber;
                if (!phone) { showNotification('لم يتم تسجيل رقم جوال الوكيل بعد. أضفه من "إعدادات المعلم والمدرسة".', 'warning'); return; }
            } else if (destination.value === 'counselor') {
                const counselor = store.counselors.find(c => c.id === selectedCounselorId.value);
                if (!counselor) { showNotification('يرجى اختيار المرشد المسؤول عن هذا الفصل أولاً.', 'warning'); return; }
                phone = counselor.phone;
                if (!phone) { showNotification(`لم يتم تسجيل رقم جوال "${counselor.name}" بعد. أضفه من "إعدادات المعلم والمدرسة".`, 'warning'); return; }
            } else {
                return;
            }

            sending.value = true;
            try {
                const filename = `نموذج_إحالة_طالب_${props.student.name.replace(/\s+/g, '_')}.pdf`;
                const mediaBase64 = await generatePdfAsBase64(buildExportHtml(), filename, false);
                if (!mediaBase64) { showNotification('تعذر إنشاء ملف PDF لإرساله، حاول مرة أخرى.', 'error'); return; }
                const message = `نموذج إحالة طالب: ${props.student.name} - الفصل: ${className.value} - المادة: ${subjectName.value}.${attachReport.value ? ' (مرفق تقرير مستوى الطالب)' : ''}`;
                await sendWhatsAppDirectOrWeb(phone, message, mediaBase64, filename);
            } finally {
                sending.value = false;
            }
        }

        return { store, printableArea, destination, reasons, problemText, effortsText, attachReport, selectedCounselorId, sending, schoolName, teacherName, eduDept, subjectName, className, dateText, signatureSrc, close, exportPdf, sendWhatsapp };
    }
};
