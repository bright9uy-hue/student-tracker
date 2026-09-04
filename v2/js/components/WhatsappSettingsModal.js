window.WhatsappSettingsModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 450px;">
                <div class="modal-header">
                    <h3 style="font-weight:700; display:flex; align-items:center; gap:0.5rem; color: var(--success-color);">
                        <i class="fa-brands fa-whatsapp" style="color:#25d366;"></i> إعدادات التقرير الأسبوعي
                    </h3>
                    <button class="modal-close" @click="close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group full-width">
                        <label>رقم الواتساب المستلم (مع رمز الدولة)</label>
                        <input type="text" class="form-control" v-model="number" placeholder="9665xxxxxxxx" style="direction:ltr; text-align:right;">
                        <span class="input-info">اكتب الرقم بالصيغة الدولية: 9665xxxxxxxx (بدون علامة + أو أصفار في البداية).</span>
                    </div>

                    <div style="margin-top:1.25rem; border-top:1px solid var(--surface-border); padding-top:1rem;">
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; margin-bottom:0.75rem;">
                            <input type="checkbox" v-model="scheduleEnabled" style="width:auto;">
                            <span>تفعيل الإرسال التلقائي المجدول للتقرير الأسبوعي</span>
                        </label>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                            <div class="form-group">
                                <label>يوم الإرسال</label>
                                <select class="form-control" v-model.number="scheduleDay">
                                    <option :value="0">الأحد</option>
                                    <option :value="1">الاثنين</option>
                                    <option :value="2">الثلاثاء</option>
                                    <option :value="3">الأربعاء</option>
                                    <option :value="4">الخميس</option>
                                    <option :value="5">الجمعة</option>
                                    <option :value="6">السبت</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>الوقت</label>
                                <input type="time" class="form-control" v-model="scheduleTime">
                            </div>
                        </div>
                        <span class="input-info">يتطلب هذا بقاء الحاسوب والبرنامج (server.js) يعملان وقت الإرسال المجدول.</span>
                    </div>

                    <div style="margin-top:1.25rem; border-top:1px solid var(--surface-border); padding-top:1rem;">
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">
                            آخر تاريخ تم فيه إرسال التقرير: <strong style="color:var(--accent-teal);">{{ lastReportDateText }}</strong>
                        </p>
                        <button type="button" class="btn btn-secondary" @click="resetTimer" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
                            <i class="fa-solid fa-clock-rotate-left"></i> إعادة تعيين موعد التنبيه (اليوم)
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">إلغاء</button>
                    <button type="button" class="btn" style="background:#25d366; color:white;" @click="save">حفظ الإعدادات</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const number = Vue.ref('');
        const scheduleEnabled = Vue.ref(false);
        const scheduleDay = Vue.ref(4);
        const scheduleTime = Vue.ref('15:00');

        function loadFromStore() {
            number.value = store.whatsappNumber;
            const s = store.weeklyReportSchedule || { enabled: false, dayOfWeek: 4, hour: 15, minute: 0 };
            scheduleEnabled.value = !!s.enabled;
            scheduleDay.value = s.dayOfWeek != null ? s.dayOfWeek : 4;
            const hh = String(s.hour != null ? s.hour : 15).padStart(2, '0');
            const mm = String(s.minute != null ? s.minute : 0).padStart(2, '0');
            scheduleTime.value = `${hh}:${mm}`;
        }
        Vue.watch(() => props.modelValue, (open) => { if (open) loadFromStore(); });

        const lastReportDateText = Vue.computed(() => store.lastReportDate ? new Date(store.lastReportDate).toLocaleString('ar-SA') : 'لم يتم الإرسال بعد');

        function close() { emit('update:modelValue', false); }

        function save() {
            const num = number.value.trim().replace(/[\s+-]/g, '');
            if (!/^\d+$/.test(num)) {
                showNotification('الرجاء إدخال رقم هاتف صحيح (أرقام فقط)!', 'error');
                return;
            }
            store.whatsappNumber = num;
            const [hh, mm] = (scheduleTime.value || '15:00').split(':').map(n => parseInt(n, 10) || 0);
            store.weeklyReportSchedule = {
                enabled: scheduleEnabled.value,
                dayOfWeek: scheduleDay.value,
                hour: hh,
                minute: mm,
                lastAutoSentAt: scheduleEnabled.value ? Date.now() : (store.weeklyReportSchedule ? store.weeklyReportSchedule.lastAutoSentAt : null)
            };
            saveData();
            showNotification('تم حفظ رقم الواتساب وإعدادات الجدولة بنجاح.');
            close();
        }

        function resetTimer() {
            store.lastReportDate = Date.now() - (8 * 24 * 60 * 60 * 1000);
            saveData();
            showNotification('تم تصفير وقت التنبيه، سيظهر شريط التنبيه الآن.');
        }

        return { number, scheduleEnabled, scheduleDay, scheduleTime, lastReportDateText, close, save, resetTimer };
    }
};
