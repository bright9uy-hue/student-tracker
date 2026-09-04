// v2/js/components/TeacherSettingsModal.js — teacher/school profile used on
// portfolio pages and printed forms (referral, reports); also the signature
// image used on those documents.
window.TeacherSettingsModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 500px;">
                <div class="modal-header" style="border-bottom: 1px solid var(--surface-border); padding-bottom: 0.85rem;">
                    <h3 style="font-weight: 700; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-color);">
                        <i class="fa-solid fa-user-gear"></i> إعدادات المعلم والمدرسة
                    </h3>
                    <button class="modal-close" @click="close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.25rem 1rem;">
                    <form @submit.prevent="save">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: 700; font-size: 0.88rem;">اسم المعلم</label>
                            <input type="text" class="form-control" v-model="teacherName" placeholder="أدخل اسمك الكريم..." required autocomplete="off">
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: 700; font-size: 0.88rem;">اسم المدرسة</label>
                            <input type="text" class="form-control" v-model="schoolName" placeholder="مثال: متوسطة المستقبل" required autocomplete="off">
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: 700; font-size: 0.88rem;">الإدارة التعليمية</label>
                            <input type="text" class="form-control" v-model="eduDept" placeholder="مثال: الإدارة العامة للتعليم بالقصيم" autocomplete="off">
                        </div>
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <label style="font-weight: 700; font-size: 0.88rem; display: block; margin-bottom: 0.35rem;">
                                صورة التوقيع الرقمي (اختياري - لنموذج الإحالة)
                            </label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="file" ref="fileInput" accept="image/*" style="display: none;" @change="handleUpload">
                                <button type="button" class="btn btn-secondary" @click="$refs.fileInput.click()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                                    <i class="fa-solid fa-upload"></i> رفع صورة التوقيع
                                </button>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">{{ signature ? 'تم إرفاق صورة التوقيع ✅' : 'لم يتم رفع توقيع مخصص بعد' }}</span>
                            </div>
                            <div v-if="signature" style="margin-top: 0.6rem; display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--surface-border);">
                                <img :src="signature" alt="معاينة التوقيع" style="height: 35px; max-width: 120px; object-fit: contain; background: white; padding: 2px 6px; border-radius: 4px;">
                                <button type="button" @click="removeSignature" style="background: transparent; border: none; color: #ef4444; font-size: 0.8rem; cursor: pointer; font-weight: 700;">
                                    <i class="fa-solid fa-trash"></i> حذف التوقيع
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="border-top: 1px solid var(--surface-border); padding-top: 0.85rem; display: flex; justify-content: space-between;">
                    <button type="button" class="btn btn-secondary" @click="close" style="min-width: 100px;">إلغاء</button>
                    <button type="button" class="btn" style="min-width: 140px; background: var(--accent-teal); color: white;" @click="save">
                        <i class="fa-solid fa-check"></i> حفظ الإعدادات
                    </button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const teacherName = Vue.ref('');
        const schoolName = Vue.ref('');
        const eduDept = Vue.ref('');
        const signature = Vue.ref(null);

        Vue.watch(() => props.modelValue, (open) => {
            if (!open) return;
            const s = store.portfolioSettings || {};
            teacherName.value = s.teacherName || '';
            schoolName.value = s.schoolName || '';
            eduDept.value = s.eduDept || 'الإدارة العامة للتعليم بالقصيم';
            signature.value = s.signature || null;
        });

        function close() { emit('update:modelValue', false); }

        function handleUpload(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showNotification('يرجى اختيار ملف صورة صالح (PNG / JPG)', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                signature.value = evt.target.result;
                showNotification('تم تحميل صورة التوقيع، اضغط حفظ لاعتمادها.', 'info');
            };
            reader.readAsDataURL(file);
        }

        function removeSignature() {
            signature.value = '';
            showNotification('تمت إزالة التوقيع.', 'info');
        }

        function save() {
            const tName = teacherName.value.trim();
            const sName = schoolName.value.trim();
            if (!tName || !sName) {
                showNotification('يرجى إدخال اسم المعلم واسم المدرسة!', 'warning');
                return;
            }
            store.portfolioSettings.teacherName = tName;
            store.portfolioSettings.schoolName = sName;
            store.portfolioSettings.eduDept = eduDept.value.trim() || 'الإدارة العامة للتعليم بالقصيم';
            if (signature.value !== null) store.portfolioSettings.signature = signature.value;

            saveData();
            showNotification('✅ تم حفظ بيانات المعلم والمدرسة بنجاح!', 'success');
            close();
        }

        return { teacherName, schoolName, eduDept, signature, close, handleUpload, removeSignature, save };
    }
};
