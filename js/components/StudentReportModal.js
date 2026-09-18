// v2/js/components/StudentReportModal.js — individual student report:
// the printed document (buildIndividualReportHtml) plus an internal
// teacher follow-up panel (dated notes + WhatsApp comm log) that is
// never part of the printed/exported area.
window.StudentReportModal = {
    props: { modelValue: Boolean, student: Object },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 800px; padding: 25px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fa-solid fa-file-invoice" style="color: var(--accent-teal);"></i> تقرير متابعة مستوى الطالب الفردي
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body" style="max-height:65vh; overflow-y:auto; padding:15px; background:rgba(0,0,0,0.3); border-radius:12px; display:flex; flex-direction:column; align-items:center;">
                    <div id="studentPrintableArea" ref="printableArea" style="width:100%; max-width:650px; font-family:'Tajawal',sans-serif; padding:35px; background:#ffffff; color:#0f172a; box-sizing:border-box; border:12px double #0f172a; direction:rtl; border-radius:4px;" v-html="reportHtml"></div>

                    <div style="width:100%; max-width:650px; margin-top:15px; background:rgba(0,0,0,0.25); border-radius:10px; padding:15px; text-align:right; direction:rtl;">
                        <h4 style="margin:0 0 10px; font-size:0.95rem;"><i class="fa-solid fa-note-sticky" style="color:var(--accent-teal);"></i> ملاحظات المتابعة</h4>
                        <div style="display:flex; gap:8px; margin-bottom:10px;">
                            <input type="text" class="form-control" v-model="noteText" placeholder="أضف ملاحظة متابعة عن الطالب..." style="flex:1;" @keydown.enter="addNote">
                            <button type="button" class="btn btn-secondary" @click="addNote"><i class="fa-solid fa-plus"></i> إضافة</button>
                        </div>
                        <div style="max-height:150px; overflow-y:auto; font-size:0.85rem; display:flex; flex-direction:column; gap:6px;">
                            <div v-if="!(student && student.notes && student.notes.length)" style="color:var(--text-muted); text-align:center; padding:8px;">لا توجد ملاحظات مسجلة بعد.</div>
                            <div v-for="n in notesReversed" :key="n.id" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; background:rgba(255,255,255,0.05); border-radius:6px; padding:8px;">
                                <div style="flex:1;"><div>{{ n.text }}</div><div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">{{ new Date(n.date).toLocaleString('ar-SA') }}</div></div>
                                <button type="button" @click="deleteNote(n.id)" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="حذف الملاحظة"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>

                        <h4 style="margin:15px 0 10px; font-size:0.95rem;"><i class="fa-brands fa-whatsapp" style="color:#25d366;"></i> سجل التواصل مع ولي الأمر</h4>
                        <div style="max-height:120px; overflow-y:auto; font-size:0.85rem; display:flex; flex-direction:column; gap:4px;">
                            <div v-if="!(student && student.commLog && student.commLog.length)" style="color:var(--text-muted); text-align:center; padding:8px;">لا يوجد تواصل مسجل سابقاً.</div>
                            <div v-for="l in commLogReversed" :key="l.date" style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(37,211,102,0.08); border-radius:6px; padding:6px 8px;">
                                <span><i class="fa-brands fa-whatsapp" style="color:#25d366;"></i> {{ l.summary }}</span>
                                <span style="color:var(--text-muted); font-size:0.7rem; white-space:nowrap;">{{ new Date(l.date).toLocaleString('ar-SA') }}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <div style="display:flex; gap:0.5rem;">
                        <button type="button" class="btn" style="background:#f59e0b; color:white;" @click="$emit('open-referral', student)"><i class="fa-solid fa-file-signature"></i> إصدار نموذج إحالة 📄</button>
                        <button type="button" class="btn" style="background:#25d366; color:white;" @click="sendWhatsapp"><i class="fa-brands fa-whatsapp"></i> إرسال عبر الواتساب</button>
                        <button type="button" class="btn" style="background:var(--accent-teal); color:white;" @click="downloadPdf"><i class="fa-solid fa-file-pdf"></i> تحميل PDF</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    emits: ['update:modelValue', 'open-referral'],
    setup(props, { emit }) {
        const printableArea = Vue.ref(null);
        const noteText = Vue.ref('');

        const reportHtml = Vue.computed(() => {
            if (!props.student) return '';
            const activeClass = getActiveClass();
            if (!activeClass) return '';
            return buildIndividualReportHtml(props.student, activeClass);
        });

        const notesReversed = Vue.computed(() => (props.student && Array.isArray(props.student.notes)) ? [...props.student.notes].reverse() : []);
        const commLogReversed = Vue.computed(() => (props.student && Array.isArray(props.student.commLog)) ? [...props.student.commLog].reverse() : []);

        function close() { emit('update:modelValue', false); }

        function addNote() {
            const text = noteText.value.trim();
            if (!text || !props.student) return;
            if (!Array.isArray(props.student.notes)) props.student.notes = [];
            props.student.notes.push({ id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), text, date: Date.now() });
            saveData();
            noteText.value = '';
        }
        function deleteNote(id) {
            if (!props.student || !Array.isArray(props.student.notes)) return;
            props.student.notes = props.student.notes.filter(n => n.id !== id);
            saveData();
        }

        async function sendWhatsapp() {
            if (!props.student) return;
            const message = buildStudentWhatsappMessage(props.student);
            const sent = await sendWhatsAppDirectOrWeb(store.whatsappNumber, message);
            if (sent) {
                if (!Array.isArray(props.student.commLog)) props.student.commLog = [];
                props.student.commLog.push({ date: Date.now(), summary: `إرسال تقرير المستوى الفردي (المجموع: ${getStudentTotal(props.student)} من 100)` });
                saveData();
            }
        }

        function downloadPdf() {
            if (!printableArea.value || !props.student) return;
            generateAndDownloadPdf(printableArea.value, `تقرير_مستوى_${props.student.name.replace(/\s+/g, '_')}.pdf`, false);
        }

        return { printableArea, noteText, reportHtml, notesReversed, commLogReversed, close, addNote, deleteNote, sendWhatsapp, downloadPdf };
    }
};
