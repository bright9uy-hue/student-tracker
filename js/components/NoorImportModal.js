// v2/js/components/NoorImportModal.js — roster import from Noor (paste
// text or upload an Excel/CSV export), with a checkbox preview list before
// committing new students to the active class.
window.NoorImportModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 650px;">
                <div class="modal-header">
                    <h3 style="font-weight:700;"><i class="fa-solid fa-file-import" style="color:var(--accent-teal);"></i> استيراد طلاب من نظام نور</h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                        <button type="button" class="tab-btn" :class="{ active: method === 'paste' }" @click="method = 'paste'" style="flex:1;">لصق نص</button>
                        <button type="button" class="tab-btn" :class="{ active: method === 'file' }" @click="method = 'file'" style="flex:1;">رفع ملف</button>
                    </div>

                    <div v-if="method === 'paste'" class="form-group full-width">
                        <label>الصق كشف أسماء الطلاب من نظام نور</label>
                        <textarea class="form-control" rows="8" v-model="pasteText" placeholder="الصق كشف الأسماء هنا..."></textarea>
                    </div>
                    <div v-else class="form-group full-width">
                        <label>اختر ملف Excel أو CSV مُصدَّر من نور</label>
                        <input type="file" accept=".xlsx,.xls,.csv,.txt" @change="onFileSelect">
                        <span v-if="fileName" style="display:block; margin-top:0.4rem; font-size:0.85rem; color:var(--text-muted);">الملف المختار: {{ fileName }}</span>
                    </div>

                    <div v-if="previewNames.length" style="margin-top:1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                            <span style="font-weight:700;">الأسماء المكتشفة ({{ previewNames.length }})</span>
                            <div>
                                <button type="button" class="btn btn-sm btn-secondary" @click="selectAll(true)">تحديد الكل</button>
                                <button type="button" class="btn btn-sm btn-secondary" @click="selectAll(false)">إلغاء التحديد</button>
                            </div>
                        </div>
                        <div style="max-height:250px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; border:1px solid var(--surface-border); border-radius:8px; padding:0.5rem;">
                            <label v-for="(name, i) in previewNames" :key="i" class="preview-item" style="display:flex; align-items:center; gap:0.5rem;">
                                <input type="checkbox" v-model="selected[i]"> <span>{{ name }}</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button v-if="!previewNames.length" type="button" class="btn" @click="parse">معاينة الأسماء</button>
                    <button v-else type="button" class="btn" style="background:var(--accent-teal); color:white;" @click="save">استيراد الطلاب المحددين</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const method = Vue.ref('paste');
        const pasteText = Vue.ref('');
        const fileName = Vue.ref('');
        const selectedFile = Vue.ref(null);
        const previewNames = Vue.ref([]);
        const selected = Vue.ref([]);

        Vue.watch(() => props.modelValue, (open) => {
            if (open) {
                method.value = 'paste';
                pasteText.value = '';
                fileName.value = '';
                selectedFile.value = null;
                previewNames.value = [];
                selected.value = [];
            }
        });

        function onFileSelect(evt) {
            const file = evt.target.files[0];
            if (file) { selectedFile.value = file; fileName.value = file.name; }
        }

        function selectAll(val) { selected.value = selected.value.map(() => val); }

        function applyNames(names) {
            if (names.length === 0) {
                showNotification('لم يتم العثور على أي أسماء طلاب صالحة. تأكد من صحة النص/الملف.', 'error');
                return;
            }
            previewNames.value = names;
            selected.value = names.map(() => true);
        }

        function parse() {
            if (method.value === 'paste') {
                if (!pasteText.value.trim()) { showNotification('الرجاء لصق بعض البيانات أولاً!', 'error'); return; }
                applyNames(extractNamesFromText(pasteText.value));
                return;
            }
            if (!selectedFile.value) { showNotification('الرجاء اختيار ملف Excel أو CSV أولاً!', 'error'); return; }
            const file = selectedFile.value;
            const fname = file.name.toLowerCase();
            if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        let fullText = '';
                        workbook.SheetNames.forEach(sheetName => {
                            fullText += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]) + '\n';
                        });
                        applyNames(extractNamesFromText(fullText));
                    } catch (err) {
                        showNotification('حدث خطأ في قراءة ملف Excel، يرجى حفظ الملف وتجربة صيغة CSV.', 'error');
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => applyNames(extractNamesFromText(e.target.result));
                reader.readAsText(file, 'utf-8');
            }
        }

        function close() { emit('update:modelValue', false); }

        function save() {
            const chosen = previewNames.value.filter((_, i) => selected.value[i]);
            if (chosen.length === 0) { showNotification('الرجاء اختيار طالب واحد على الأقل للاستيراد!', 'error'); return; }
            const activeClass = getActiveClass();
            if (!activeClass) { showNotification('الرجاء اختيار فصل نشط أولاً!', 'error'); return; }

            let addedCount = 0;
            chosen.forEach(name => {
                const exists = activeClass.students.some(s => s.name === name);
                if (!exists) {
                    activeClass.students.push({ id: 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), name, grades: {} });
                    addedCount++;
                }
            });
            saveData();
            showNotification(`تم استيراد ${addedCount} طالب بنجاح إلى "${activeClass.name}".`, 'success');
            close();
        }

        return { method, pasteText, fileName, previewNames, selected, onFileSelect, selectAll, parse, close, save };
    }
};
