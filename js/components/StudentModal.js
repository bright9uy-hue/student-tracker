window.StudentModal = {
    props: { modelValue: Boolean, editingStudent: Object },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 420px;">
                <div class="modal-header">
                    <h3 style="font-weight:700;">{{ editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد' }}</h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group full-width">
                        <label>اسم الطالب</label>
                        <input type="text" class="form-control" v-model="name" placeholder="أدخل اسم الطالب الكامل" @keydown.enter="submit" ref="nameInput">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button type="button" class="btn" @click="submit">حفظ</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const name = Vue.ref('');
        const nameInput = Vue.ref(null);

        Vue.watch(() => props.modelValue, (open) => {
            if (open) {
                name.value = props.editingStudent ? props.editingStudent.name : '';
                Vue.nextTick(() => nameInput.value && nameInput.value.focus());
            }
        });

        function close() { emit('update:modelValue', false); }

        function submit() {
            const trimmed = name.value.trim();
            if (!trimmed) return;
            const activeClass = getActiveClass();
            if (!activeClass) return;

            if (props.editingStudent) {
                props.editingStudent.name = trimmed;
                showNotification(`تم تعديل اسم الطالب إلى "${trimmed}".`);
            } else {
                activeClass.students.push({ id: Date.now().toString(), name: trimmed, grades: {} });
                showNotification(`تمت إضافة الطالب "${trimmed}".`);
            }
            saveData();
            close();
        }

        return { name, nameInput, close, submit };
    }
};
