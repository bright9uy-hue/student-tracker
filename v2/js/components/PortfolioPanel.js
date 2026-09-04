// v2/js/components/PortfolioPanel.js — the teacher-portfolio modal: a
// settings editor (basic info / standard evidence uploads / custom form
// builder) on the right, live preview (buildPortfolioPages, v2/js/portfolio.js)
// on the left, matching the old two-pane layout.
window.PortfolioPanel = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }" style="z-index:9999;">
            <div class="modal-container" style="max-width:1200px; width:95%; height:90vh;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem; color:var(--accent-teal);">
                        <i class="fa-solid fa-folder-open"></i> ملف إنجاز المعلم المساعد
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body" style="padding:0; display:flex; flex:1; overflow:hidden; height:100%;">
                    <div style="display:flex; width:100%; height:100%; overflow:hidden;">
                        <div style="width:380px; min-width:380px; border-left:1px solid var(--surface-border); padding:1.5rem; overflow-y:auto; background:rgba(0,0,0,0.15);">
                            <div style="display:flex; gap:0.25rem; margin-bottom:1.25rem; border-bottom:1px solid var(--surface-border); padding-bottom:0.5rem;">
                                <button type="button" class="tab-btn" :class="{ active: tab === 'basic' }" @click="tab = 'basic'" style="flex:1;">البيانات الأساسية</button>
                                <button type="button" class="tab-btn" :class="{ active: tab === 'standard' }" @click="tab = 'standard'" style="flex:1;">الشواهد الافتراضية</button>
                                <button type="button" class="tab-btn" :class="{ active: tab === 'builder' }" @click="tab = 'builder'" style="flex:1;">صانع النماذج</button>
                            </div>

                            <div v-show="tab === 'basic'">
                                <h4><i class="fa-solid fa-pen-clip"></i> بيانات ملف الإنجاز</h4>
                                <div class="form-group"><label>اسم المعلم</label><input type="text" class="form-control" v-model="ps.teacherName" @input="refresh"></div>
                                <div class="form-group"><label>المسمى الوظيفي والدرجة</label><input type="text" class="form-control" v-model="ps.jobTitle" @input="refresh"></div>
                                <div class="form-group"><label>الرقم الوظيفي</label><input type="text" class="form-control" v-model="ps.jobNum" @input="refresh"></div>
                                <div class="form-group"><label>التخصص الدراسي</label><input type="text" class="form-control" v-model="ps.specialization" @input="refresh"></div>
                                <div class="form-group"><label>اسم المدرسة</label><input type="text" class="form-control" v-model="ps.schoolName" @input="refresh"></div>
                                <div class="form-group"><label>العام الدراسي</label><input type="text" class="form-control" v-model="ps.schoolYear" @input="refresh"></div>
                                <h4 style="margin-top:1.5rem;"><i class="fa-solid fa-quote-right"></i> الرؤية والرسالة والفلسفة</h4>
                                <div class="form-group"><label>رؤية المعلم</label><textarea class="form-control" rows="2" v-model="ps.vision" @input="refresh"></textarea></div>
                                <div class="form-group"><label>رسالة المعلم</label><textarea class="form-control" rows="2" v-model="ps.mission" @input="refresh"></textarea></div>
                                <div class="form-group"><label>الفلسفة التربوية</label><textarea class="form-control" rows="2" v-model="ps.philosophy" @input="refresh"></textarea></div>
                            </div>

                            <div v-show="tab === 'standard'">
                                <h4><i class="fa-solid fa-clipboard-list"></i> مدخلات الشواهد المخصصة</h4>
                                <div class="form-group">
                                    <label>2. سجل تبادل الزيارات</label>
                                    <textarea class="form-control" rows="2" v-model="ps.visitsRecord" @input="refresh"></textarea>
                                    <evidence-file-input :field="'visitsImage'" :ps="ps" @change="refresh"></evidence-file-input>
                                </div>
                                <div class="form-group">
                                    <label>4. تقرير تطبيق استراتيجية التدريس</label>
                                    <textarea class="form-control" rows="2" v-model="ps.strategyReport" @input="refresh"></textarea>
                                    <evidence-file-input :field="'strategyImage'" :ps="ps" @change="refresh"></evidence-file-input>
                                </div>
                                <div class="form-group">
                                    <label>8. تقرير البيئة الصفية المادية</label>
                                    <textarea class="form-control" rows="2" v-model="ps.classroomEnv" @input="refresh"></textarea>
                                    <evidence-file-input :field="'classroomEnvImage'" :ps="ps" @change="refresh"></evidence-file-input>
                                </div>

                                <h4 style="margin-top:1.5rem;"><i class="fa-solid fa-list-check"></i> شواهد الأداء المطلوب تصديرها</h4>
                                <div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1.5rem; font-size:0.88rem;">
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.cover" @change="refresh"> صفحة الغلاف الرسمية</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.cv" @change="refresh"> السيرة الذاتية والرسالة والتعليم</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.duties" @change="refresh"> 1. أداء الواجبات (توزيع المنهج)</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.community" @change="refresh"> 2. المجتمع المهني (تبادل الزيارات)</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.parents" @change="refresh"> 3. أولياء الأمور (الخطة الأسبوعية)</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.strategies" @change="refresh"> 4. استراتيجيات التدريس</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.improvement" @change="refresh"> 5. تحسين النتائج</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.plan" @change="refresh"> 6. خطة التعلم</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.tech" @change="refresh"> 7. توظيف التقنيات</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.env" @change="refresh"> 8. البيئة التعليمية</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.classroom" @change="refresh"> 9. الإدارة الصفية</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.analysis" @change="refresh"> 10. تحليل النتائج</label>
                                    <label style="display:flex; align-items:center; gap:0.5rem;"><input type="checkbox" v-model="toggles.evaluation" @change="refresh"> 11. تنويع التقويم</label>
                                </div>
                            </div>

                            <div v-show="tab === 'builder'">
                                <h4><i class="fa-solid fa-screwdriver-wrench"></i> تصميم نموذج مخصص جديد</h4>
                                <div class="form-group"><label>عنوان النموذج</label><input type="text" class="form-control" v-model="builderTitle"></div>
                                <div class="form-group"><label>رقم البند (اختياري)</label><input type="text" class="form-control" v-model="builderItemNum"></div>
                                <div class="form-group"><label>الفئة المستهدفة</label><input type="text" class="form-control" v-model="builderTargetGroup"></div>

                                <h5 style="margin-top:1.25rem;">حقول الاستمارة</h5>
                                <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1rem;">
                                    <div v-for="(field, idx) in builderFields" :key="idx" class="builder-field-item">
                                        <button type="button" class="btn-remove-field" @click="builderFields.splice(idx, 1)">&times;</button>
                                        <div style="font-size:0.75rem; color:var(--accent-teal); font-weight:bold;">{{ fieldTypeLabel(field.type) }}</div>
                                        <input type="text" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.5rem;" placeholder="عنوان الحقل..." v-model="field.label">
                                        <input v-if="field.type === 'text' || field.type === 'textarea'" type="text" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.5rem; margin-top:0.25rem;" placeholder="القيمة الافتراضية أو النص..." v-model="field.value">
                                        <input v-else-if="field.type === 'table'" type="text" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.5rem; margin-top:0.25rem;" placeholder="عناوين الأعمدة (مفصولة بفاصلة)..." v-model="field.headersCsv">
                                        <template v-else-if="field.type === 'image'">
                                            <div v-if="field.value" style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem; background:rgba(0,0,0,0.2); padding:4px; border-radius:4px;">
                                                <span style="font-size:0.7rem; flex:1;">{{ field.fileName || 'ملف الشاهد' }}</span>
                                                <button type="button" class="btn btn-secondary" @click="field.value = ''; field.fileName = '';" style="padding:2px 6px; font-size:0.65rem;">حذف</button>
                                            </div>
                                            <div v-else style="margin-top:0.25rem;">
                                                <input type="file" :id="'builder_file_' + idx" accept="image/*,application/pdf" style="display:none;" @change="e => handleBuilderFile(idx, e)">
                                                <button type="button" class="btn btn-secondary" @click="document.getElementById('builder_file_' + idx).click()" style="width:100%; font-size:0.75rem; padding:0.4rem;">
                                                    <i class="fa-solid fa-paperclip"></i> إرفاق صورة أو مستند PDF
                                                </button>
                                            </div>
                                        </template>
                                    </div>
                                </div>

                                <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:0.5rem; margin-bottom:1.25rem;">
                                    <button type="button" class="btn btn-secondary" style="font-size:0.75rem; padding:0.45rem;" @click="addField('text')">+ نص قصير</button>
                                    <button type="button" class="btn btn-secondary" style="font-size:0.75rem; padding:0.45rem;" @click="addField('textarea')">+ نص طويل</button>
                                    <button type="button" class="btn btn-secondary" style="font-size:0.75rem; padding:0.45rem;" @click="addField('table')">+ جدول مخصص</button>
                                    <button type="button" class="btn btn-secondary" style="font-size:0.75rem; padding:0.45rem;" @click="addField('image')">+ إرفاق شاهد</button>
                                </div>

                                <button type="button" class="btn" style="width:100%; background:var(--accent-teal); color:white; margin-bottom:1.75rem; font-weight:bold;" @click="saveCustomForm">
                                    <i class="fa-solid fa-floppy-disk"></i> حفظ وإضافة النموذج للملف
                                </button>

                                <h5 style="border-top:1px solid var(--surface-border); padding-top:1rem;"><i class="fa-solid fa-folder-closed" style="color:var(--accent-teal);"></i> النماذج المضافة حالياً</h5>
                                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                    <div v-if="!ps.customForms.length" style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">لا توجد نماذج مخصصة مضافة بعد.</div>
                                    <div v-for="(form, idx) in ps.customForms" :key="idx" class="builder-custom-form-item">
                                        <span style="font-size:0.8rem; font-weight:700;">{{ form.itemNumber ? form.itemNumber + ': ' : '' }}{{ form.title }}</span>
                                        <button type="button" class="btn btn-secondary" @click="deleteCustomForm(idx)" style="padding:0.2rem 0.4rem; font-size:0.75rem; background:var(--accent-red); color:white;">حذف</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="flex:1; background:#0f172a; padding:2rem; overflow-y:auto; display:flex; flex-direction:column; align-items:center;">
                            <div ref="pagesContainer" style="display:flex; flex-direction:column; align-items:center; width:100%;"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.85rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> سيقوم النظام بسحب بيانات الفصول ونواتج التعلم وتوزيع الدرجات المسجلة لديه تلقائياً.</div>
                    <div style="display:flex; gap:1rem;">
                        <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                        <button type="button" class="btn" style="background:var(--accent-teal); color:white;" @click="exportPdf"><i class="fa-solid fa-file-pdf"></i> تصدير ملف الإنجاز (PDF)</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const tab = Vue.ref('basic');
        const pagesContainer = Vue.ref(null);
        const ps = store.portfolioSettings;
        ps.customForms = ps.customForms || [];

        const toggles = Vue.reactive({
            cover: true, cv: true, duties: true, community: true, parents: true, strategies: true,
            improvement: true, plan: true, tech: true, env: true, classroom: true, analysis: true, evaluation: true
        });

        const builderFields = Vue.ref([]);
        const builderTitle = Vue.ref('');
        const builderItemNum = Vue.ref('');
        const builderTargetGroup = Vue.ref('');

        function fieldTypeLabel(type) {
            return type === 'text' ? 'نص قصير' : (type === 'textarea' ? 'نص طويل' : (type === 'image' ? 'شاهد مصور' : 'جدول مخصص'));
        }
        function addField(type) {
            builderFields.value.push({ type, label: type === 'table' ? 'جدول المتابعة' : (type === 'image' ? 'شاهد مصور' : 'عنوان الحقل'), value: '', fileName: '', headersCsv: type === 'table' ? 'البيان, التفاصيل, الأثر والنتيجة' : '' });
        }
        function handleBuilderFile(idx, evt) {
            const file = evt.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { alert('يرجى اختيار صورة أو ملف PDF فقط.'); return; }
            const reader = new FileReader();
            reader.onload = (e) => { builderFields.value[idx].value = e.target.result; builderFields.value[idx].fileName = file.name; };
            reader.readAsDataURL(file);
        }
        function saveCustomForm() {
            if (!builderTitle.value.trim()) { alert('يرجى كتابة عنوان للنموذج أولاً.'); return; }
            ps.customForms.push({ title: builderTitle.value.trim(), itemNumber: builderItemNum.value.trim(), targetGroup: builderTargetGroup.value.trim(), fields: [...builderFields.value] });
            saveData();
            builderTitle.value = ''; builderItemNum.value = ''; builderTargetGroup.value = ''; builderFields.value = [];
            refresh();
        }
        function deleteCustomForm(idx) {
            if (!confirm('هل أنت متأكد من حذف هذا النموذج المخصص؟')) return;
            ps.customForms.splice(idx, 1);
            saveData();
            refresh();
        }

        function refresh() {
            saveData();
            Vue.nextTick(() => { if (pagesContainer.value) buildPortfolioPages(pagesContainer.value, toggles); });
        }

        Vue.watch(() => props.modelValue, (open) => { if (open) { tab.value = 'basic'; refresh(); } });

        function close() { saveData(); emit('update:modelValue', false); }
        function exportPdf() {
            if (!pagesContainer.value) return;
            const teacherName = ps.teacherName || 'المعلم';
            generateAndDownloadPdf(pagesContainer.value, `ملف_شواهد_الأداء_${teacherName.replace(/\s+/g, '_')}.pdf`, false);
        }

        return {
            tab, pagesContainer, ps, toggles, builderFields, builderTitle, builderItemNum, builderTargetGroup,
            fieldTypeLabel, addField, handleBuilderFile, saveCustomForm, deleteCustomForm, refresh, close, exportPdf,
            document
        };
    }
};

// Small helper component for the 3 "standard evidence" file upload slots
// (visitsImage/strategyImage/classroomEnvImage) — identical upload/clear
// behavior, just a different portfolioSettings key each time.
window.EvidenceFileInput = {
    props: { field: String, ps: Object },
    emits: ['change'],
    template: `
        <div style="margin-top:0.25rem;">
            <div v-if="ps[field]" style="display:flex; align-items:center; gap:0.5rem; background:rgba(0,0,0,0.2); padding:4px; border-radius:4px;">
                <span style="font-size:0.7rem; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ ps[field + 'Name'] || 'صورة الشاهد' }}</span>
                <button type="button" class="btn btn-secondary" @click="clear" style="padding:2px 6px; font-size:0.65rem;">حذف</button>
            </div>
            <div v-else>
                <input type="file" :id="'standard_file_' + field" accept="image/*,application/pdf" style="display:none;" @change="onSelect">
                <button type="button" class="btn btn-secondary" @click="document.getElementById('standard_file_' + field).click()" style="width:100%; font-size:0.75rem; padding:0.4rem;">
                    <i class="fa-solid fa-paperclip"></i> إرفاق صورة أو مستند PDF
                </button>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        function onSelect(evt) {
            const file = evt.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { alert('يرجى اختيار صورة أو ملف PDF فقط.'); return; }
            const reader = new FileReader();
            reader.onload = (e) => { props.ps[props.field] = e.target.result; props.ps[props.field + 'Name'] = file.name; emit('change'); };
            reader.readAsDataURL(file);
        }
        function clear() { props.ps[props.field] = ''; props.ps[props.field + 'Name'] = ''; emit('change'); }
        return { onSelect, clear, document };
    }
};
