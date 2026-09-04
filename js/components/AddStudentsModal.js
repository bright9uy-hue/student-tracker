// v2/js/components/AddStudentsModal.js — unified "add students" dialog:
// single student (name + optional parent phone) or bulk (pasted names, one
// per line, or extracted from an uploaded Excel/CSV roster). Distinct from
// StudentModal, which is edit-only in this rewrite (see GradingTable's
// add-student vs edit-student emits).
window.AddStudentsModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 580px;">
                <div class="modal-header" style="border-bottom: 1px solid var(--surface-border); padding-bottom: 0.75rem;">
                    <h3 style="font-weight: 800; display: flex; align-items: center; gap: 0.5rem; font-size: 1.15rem;">
                        <i class="fa-solid fa-user-plus" style="color: var(--accent-teal);"></i> إضافة طلاب للفصل
                    </h3>
                    <button class="modal-close" @click="close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.25rem 1rem;">
                    <div style="display: flex; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 10px; margin-bottom: 1.25rem; border: 1px solid var(--surface-border);">
                        <button type="button" @click="tab = 'single'" :style="tabStyle('single')" style="flex: 1; padding: 0.6rem 1rem; border: none; border-radius: 7px; font-weight: 700; font-family: inherit; font-size: 0.9rem; cursor: pointer;">
                            <i class="fa-solid fa-user"></i> إضافة طالب فردي
                        </button>
                        <button type="button" @click="tab = 'bulk'" :style="tabStyle('bulk')" style="flex: 1; padding: 0.6rem 1rem; border: none; border-radius: 7px; font-weight: 700; font-family: inherit; font-size: 0.9rem; cursor: pointer;">
                            <i class="fa-solid fa-users"></i> إضافة مجموعة طلاب (لصق أسماء)
                        </button>
                    </div>

                    <form v-if="tab === 'single'" @submit.prevent="addSingle">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.35rem; display: block;">اسم الطالب رباعي <span style="color:#ef4444;">*</span></label>
                            <input type="text" class="form-control" v-model="singleName" ref="singleNameInput" placeholder="أدخل اسم الطالب الكامل..." autocomplete="off">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.35rem; display: block;">رقم جوال ولي الأمر (اختياري)</label>
                            <input type="tel" class="form-control" v-model="singlePhone" placeholder="9665xxxxxxxx" autocomplete="off" dir="ltr" style="text-align: right;">
                            <span class="input-info" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.3rem; display: block;">الصيغة: 9665xxxxxxxx</span>
                        </div>
                        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
                            <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                            <button type="submit" class="btn" style="background: var(--accent-teal); color: white; min-width: 130px; font-weight: 700;">
                                <i class="fa-solid fa-plus"></i> إضافة الطالب
                            </button>
                        </div>
                    </form>

                    <form v-else @submit.prevent="addBulk">
                        <div style="margin-bottom: 1rem; background: rgba(16, 185, 129, 0.08); border: 2px dashed rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 1rem; text-align: center;">
                            <i class="fa-solid fa-file-excel" style="font-size: 1.8rem; color: #10b981; margin-bottom: 0.4rem;"></i>
                            <div style="font-weight: 700; font-size: 0.92rem; margin-bottom: 0.25rem;">رفع ملف إكسل لاستخراج الأسماء تلقائياً</div>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">يدعم ملفات نظام نور وملفات Excel (.xlsx, .xls, .csv)</p>
                            <input type="file" ref="excelInput" accept=".xlsx, .xls, .csv" style="display: none;" @change="handleExcelUpload">
                            <button type="button" class="btn btn-sm" @click="$refs.excelInput.click()" style="background: #10b981; color: white; padding: 0.45rem 1.25rem; font-size: 0.88rem; font-weight: 700;">
                                <i class="fa-solid fa-upload"></i> اختر ملف إكسل من جهازك
                            </button>
                            <div v-if="excelFileName" style="font-size: 0.8rem; font-weight: bold; color: #10b981; margin-top: 0.5rem;">
                                <i class="fa-solid fa-file-circle-check"></i> تم اختيار: {{ excelFileName }}
                            </div>
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                <label style="font-weight: 700; font-size: 0.88rem; margin: 0;">قائمة أسماء الطلاب (المستخرجة أو المكتوبة):</label>
                                <button type="button" @click="clearBulk" style="background: none; border: none; color: #ef4444; font-size: 0.78rem; font-weight: 700; cursor: pointer;">
                                    <i class="fa-solid fa-trash-can"></i> مسح القائمة
                                </button>
                            </div>
                            <textarea class="form-control" rows="6" v-model="bulkText"
                                placeholder="أحمد محمد علي&#10;خالد إبراهيم القحطاني&#10;سعود عبدالله الشمري&#10;محمد فهد السبيعي"
                                style="font-family: inherit; font-size: 0.9rem; line-height: 1.6; resize: vertical;"></textarea>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                            <span style="font-size: 0.85rem; font-weight: 700; color: var(--accent-teal);">تم اكتشاف: {{ bulkLines.length }} طالب</span>
                            <div style="display: flex; gap: 0.75rem;">
                                <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                                <button type="submit" class="btn" style="background: var(--accent-teal); color: white; min-width: 140px; font-weight: 700;">
                                    <i class="fa-solid fa-users-viewfinder"></i> إضافة الكل للفصل
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const tab = Vue.ref('single');
        const singleName = Vue.ref('');
        const singlePhone = Vue.ref('');
        const bulkText = Vue.ref('');
        const excelFileName = Vue.ref('');
        const singleNameInput = Vue.ref(null);

        const bulkLines = Vue.computed(() => bulkText.value.split('\n').map(l => l.trim()).filter(l => l.length > 0));

        Vue.watch(() => props.modelValue, (open) => {
            if (!open) return;
            tab.value = 'single';
            singleName.value = '';
            singlePhone.value = '';
            bulkText.value = '';
            excelFileName.value = '';
            Vue.nextTick(() => singleNameInput.value && singleNameInput.value.focus());
        });

        function close() { emit('update:modelValue', false); }

        function tabStyle(t) {
            const active = tab.value === t;
            return `background:${active ? 'var(--accent-teal)' : 'transparent'}; color:${active ? '#fff' : 'var(--text-muted)'};`;
        }

        function addSingle() {
            const activeCls = getActiveClass();
            if (!activeCls) { showNotification('لم يتم تحديد فصل حالي!', 'error'); return; }
            const name = singleName.value.trim();
            if (!name) { showNotification('يرجى إدخال اسم الطالب!', 'warning'); return; }

            if (!activeCls.students) activeCls.students = [];
            activeCls.students.push({
                id: 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                name, phone: singlePhone.value.trim() || '', grades: {}, behaviorPoints: []
            });
            saveData();
            close();
            showNotification(`✅ تمت إضافة الطالب "${name}" بنجاح!`, 'success');
        }

        function addBulk() {
            const activeCls = getActiveClass();
            if (!activeCls) { showNotification('لم يتم تحديد فصل حالي!', 'error'); return; }
            const lines = bulkLines.value;
            if (lines.length === 0) { showNotification('يرجى كتابة أو لصق اسم طالب واحد على الأقل!', 'warning'); return; }

            if (!activeCls.students) activeCls.students = [];
            let addedCount = 0;
            lines.forEach(name => {
                activeCls.students.push({
                    id: 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5) + '-' + addedCount,
                    name, phone: '', grades: {}, behaviorPoints: []
                });
                addedCount++;
            });
            saveData();
            close();
            showNotification(`🎉 تم إضافة ${addedCount} طالب إلى فصل "${activeCls.name}" بنجاح!`, 'success');
        }

        function clearBulk() {
            bulkText.value = '';
            excelFileName.value = '';
        }

        function handleExcelUpload(event) {
            const file = event.target.files ? event.target.files[0] : null;
            if (!file) return;
            excelFileName.value = file.name;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    if (typeof XLSX === 'undefined') { showNotification('مكتبة قراءة الإكسل غير محملة!', 'error'); return; }

                    const workbook = XLSX.read(data, { type: 'array' });
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

                    if (uniqueNames.length === 0) {
                        showNotification('لم يتم العثور على أسماء طلاب واضحة في ملف الإكسل. يمكنك لصق الأسماء يدوياً.', 'warning');
                        return;
                    }

                    bulkText.value = uniqueNames.join('\n');
                    showNotification(`✅ تم سحب ${uniqueNames.length} اسم طالب بنجاح من ملف الإكسل!`, 'success');
                } catch (err) {
                    console.error('Error reading Excel file:', err);
                    showNotification('حدث خطأ أثناء قراءة ملف الإكسل: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        return {
            tab, singleName, singlePhone, bulkText, excelFileName, singleNameInput, bulkLines,
            close, tabStyle, addSingle, addBulk, clearBulk, handleExcelUpload
        };
    }
};
