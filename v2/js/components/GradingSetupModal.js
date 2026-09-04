// v2/js/components/GradingSetupModal.js — the category setup wizard.
// The old app built/removed real DOM rows by hand (addCustomCategoryRow,
// moveCategoryRowUp/Down, removeCustomCategoryRow...) to fake a dynamic
// form. Here it's just a reactive array (`rows`) rendered with v-for —
// add/remove/reorder are plain array operations, and the 100-point total
// is a computed property instead of a function that walks the DOM and
// recolors elements by hand.
window.GradingSetupModal = {
    props: { modelValue: Boolean, forSubjectId: String, isGlobalDefault: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 820px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fa-solid fa-sliders" style="color: var(--warning-color);"></i>
                        <template v-if="isGlobalDefault">القالب الافتراضي لتوزيع درجات المواد الجديدة</template>
                        <template v-else>بنود درجات مادة: <span style="color: var(--accent-teal);">{{ subjectName }}</span></template>
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <p style="color: var(--text-muted); font-size:0.88rem; margin-bottom:1rem;">
                        <template v-if="isGlobalDefault">حدد بنود التقييم والدرجات الافتراضية التي سيتم تطبيقها تلقائياً عند إضافة أي مادة جديدة مستقبلاً (المجموع 100 درجة).</template>
                        <template v-else>يمكنك إضافة وتسمية وحذف بنود التقييم المخصصة لهذه المادة، وتحديد درجة كل بند وطريقة رصده. مجموع الدرجات يجب أن يعادل (100 درجة).</template>
                    </p>

                    <div id="customCategoriesList">
                        <div v-for="(row, idx) in rows" :key="row.uid" class="category-row-item"
                             style="display:flex; gap:0.4rem; align-items:center; margin-bottom:0.5rem; background:rgba(255,255,255,0.03); padding:0.6rem; border-radius:8px; border:1px solid var(--surface-border); flex-wrap:wrap;">
                            <div style="display:flex; flex-direction:column; gap:2px;">
                                <button type="button" class="btn-icon" @click="moveUp(idx)" title="تقديم البند للأعلى" style="padding:1px 5px; font-size:0.75rem; color:var(--accent-teal);"><i class="fa-solid fa-chevron-up"></i></button>
                                <button type="button" class="btn-icon" @click="moveDown(idx)" title="تأخير البند للأسفل" style="padding:1px 5px; font-size:0.75rem; color:var(--accent-teal);"><i class="fa-solid fa-chevron-down"></i></button>
                            </div>
                            <input type="text" class="form-control" v-model="row.name" placeholder="اسم البند (مثال: واجبات)" required style="flex:2.2; font-weight:600;" :disabled="row.isAssignments">

                            <input v-if="!usesDots(row)" type="number" class="form-control" v-model.number="row.max" min="1" max="100" required
                                   style="flex:1; font-weight:700; color:var(--accent-teal);">
                            <template v-else>
                                <input type="number" class="form-control" v-model.number="row.dotsCount" min="1" max="100" title="عدد النقاط" style="flex:0.85;">
                                <input type="number" class="form-control" v-model.number="row.pointValue" min="0.1" step="0.1" title="قيمة النقطة الواحدة بالدرجة" style="flex:0.85; color:var(--accent-teal);">
                                <span style="flex:0.9; font-size:0.78rem; color:var(--text-muted);">= {{ computedMax(row) }} درجة</span>
                            </template>

                            <select class="form-control" v-model="row.type" style="flex:1.6; font-size:0.85rem;" :disabled="row.isAssignments">
                                <option value="dots">نقاط سريعة</option>
                                <option value="participation">مشاركة ملونة (إيجابي/خصم)</option>
                                <option value="numeric">درجة رقمية (عملي/اختبار)</option>
                            </select>

                            <select class="form-control" v-model="row.noorBucket" title="أي خانة يذهب لها هذا البند عند التصدير لنظام نور" style="flex:1.3; font-size:0.78rem;">
                                <option value="">نور: غير محدد</option>
                                <option value="40">نور: خانة 40</option>
                                <option value="60">نور: خانة 60</option>
                                <option value="none">نور: غير مشمول</option>
                            </select>

                            <button type="button" class="btn-icon delete" @click="removeRow(idx)" title="حذف البند" style="color:#ef4444; padding:0.4rem;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>

                    <button type="button" class="btn btn-secondary btn-sm" @click="addRow" style="margin-top:0.5rem;">
                        <i class="fa-solid fa-plus"></i> إضافة بند جديد
                    </button>

                    <div style="margin-top:1rem; padding:0.75rem 1rem; border-radius:10px; border:1px solid" :style="{ background: alertBg, borderColor: alertColor }">
                        <span :style="{ color: alertColor }">{{ totalMsg }}</span>
                        المجموع: <strong id="setupTotalSum">{{ total }}</strong> / 100
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button type="button" class="btn" :disabled="total !== 100" :style="{ opacity: total !== 100 ? 0.5 : 1, cursor: total !== 100 ? 'not-allowed' : 'pointer' }" @click="save">حفظ البنود</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const rows = Vue.ref([]);
        let uidCounter = 0;

        function rowFromCategory(cat) {
            return {
                uid: ++uidCounter,
                catId: cat.id || null,
                name: cat.name,
                type: cat.type,
                max: cat.max,
                dotsCount: cat.dotsCount || cat.max || 10,
                pointValue: cat.pointValue || 1,
                noorBucket: cat.noorBucket || '',
                isAssignments: cat.id === 'cat_assignments' || cat.name === 'الواجبات'
            };
        }

        function loadRows() {
            let categories;
            if (props.isGlobalDefault) {
                store.defaultGradingCategories.forEach(normalizeGradingCategory);
                categories = store.defaultGradingCategories;
            } else {
                categories = getActiveSubjectGradingCategories(props.forSubjectId);
            }
            rows.value = categories.map(rowFromCategory);
        }

        Vue.watch(() => props.modelValue, (open) => { if (open) loadRows(); });

        const subjectName = Vue.computed(() => {
            const s = store.subjects.find(s => s.id === props.forSubjectId);
            return s ? s.name : '';
        });

        function usesDots(row) { return row.type !== 'numeric' && !row.isAssignments; }
        function computedMax(row) { return Math.round((row.dotsCount || 0) * (row.pointValue || 0) * 100) / 100; }

        const total = Vue.computed(() => {
            let sum = 0;
            rows.value.forEach(r => { sum += usesDots(r) ? computedMax(r) : (r.max || 0); });
            return Math.round(sum * 100) / 100;
        });
        const totalMsg = Vue.computed(() => {
            if (total.value > 100) return `⚠️ الإجمالي (${total.value}) يتجاوز 100 درجة. `;
            if (total.value < 100) return `⚠️ الإجمالي الحالي (${total.value}/100)، أكمله ليصل 100. `;
            return `✅ المجموع مكتمل ومطابق لـ 100 درجة. `;
        });
        const alertColor = Vue.computed(() => total.value === 100 ? '#10b981' : (total.value > 100 ? '#ef4444' : '#f59e0b'));
        const alertBg = Vue.computed(() => total.value === 100 ? 'rgba(16,185,129,0.12)' : (total.value > 100 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'));

        function addRow() {
            rows.value.push({ uid: ++uidCounter, catId: null, name: '', type: 'dots', max: 10, dotsCount: 10, pointValue: 1, noorBucket: '', isAssignments: false });
        }
        function removeRow(idx) { rows.value.splice(idx, 1); }
        function moveUp(idx) { if (idx > 0) { const r = rows.value.splice(idx, 1)[0]; rows.value.splice(idx - 1, 0, r); } }
        function moveDown(idx) { if (idx < rows.value.length - 1) { const r = rows.value.splice(idx, 1)[0]; rows.value.splice(idx + 1, 0, r); } }

        function close() { emit('update:modelValue', false); }

        function save() {
            if (total.value !== 100) return;
            const newCategories = rows.value
                .filter(r => (usesDots(r) ? computedMax(r) : (r.max || 0)) > 0)
                .map((r, idx) => {
                    const cat = {
                        id: r.catId || `cat_${Date.now()}_${idx}`,
                        name: r.name.trim() || `البند ${idx + 1}`,
                        max: usesDots(r) ? computedMax(r) : (r.max || 0),
                        type: r.type
                    };
                    if (usesDots(r)) { cat.dotsCount = r.dotsCount > 0 ? r.dotsCount : 10; cat.pointValue = r.pointValue > 0 ? r.pointValue : 1; }
                    if (r.noorBucket) cat.noorBucket = r.noorBucket;
                    return cat;
                });

            if (newCategories.length === 0) {
                showNotification('يجب إضافة بند تقييم واحد على الأقل!', 'error');
                return;
            }

            if (props.isGlobalDefault) {
                store.defaultGradingCategories = newCategories;
                saveData();
                showNotification('تم حفظ التوزيع والبنود الافتراضية للمواد الجديدة بنجاح.', 'success');
                close();
                return;
            }

            const subj = store.subjects.find(s => s.id === props.forSubjectId);
            if (subj) {
                subj.gradingCategories = newCategories;
                saveData();
                showNotification(`تم حفظ بنود ودرجات مادة "${subj.name}" وتطبيقها فوراً.`, 'success');
            }
            close();
        }

        return { rows, subjectName, usesDots, computedMax, total, totalMsg, alertColor, alertBg, addRow, removeRow, moveUp, moveDown, close, save };
    }
};
