// js/components/SmartAlertsPanel.js — renders getClassSmartAlerts() as a
// list of cards at the top of the Dashboard, each with a suggested next
// step. Actions that map to an existing feature (referral form, random
// picker) are emitted up to Dashboard, which already owns those modals.
window.SmartAlertsPanel = {
    props: { activeClass: Object },
    emits: ['view-referral', 'open-random-picker'],
    template: `
        <div v-if="activeClass" class="content-card" style="margin-bottom: 1.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <i class="fa-solid fa-lightbulb" style="color:#f59e0b;"></i>
                <h3 style="font-size:1rem; font-weight:800; margin:0;">ملاحظات وتوصيات ذكية</h3>
                <span v-if="alerts.length" style="background:rgba(239,68,68,0.15); color:#ef4444; font-size:0.75rem; font-weight:800; padding:0.15rem 0.55rem; border-radius:10px;">{{ alerts.length }}</span>
            </div>

            <div v-if="alerts.length === 0" style="color: var(--text-muted); font-size:0.88rem; margin-top:0.85rem;">
                <i class="fa-solid fa-circle-check" style="color:#10b981;"></i> لا توجد ملاحظات حالياً — لا أحد يحتاج متابعة عاجلة في هذه المادة والفترة.
            </div>

            <div v-else style="display:flex; flex-direction:column; gap:0.6rem; margin-top:0.85rem; max-height:280px; overflow-y:auto;">
                <div v-for="(alert, i) in alerts" :key="i"
                     style="display:flex; align-items:flex-start; gap:0.65rem; padding:0.65rem 0.75rem; border-radius:10px;"
                     :style="{ background: severityBg(alert.severity), border: '1px solid ' + severityColor(alert.severity) + '40' }">
                    <i class="fa-solid" :class="alert.icon" :style="{ color: severityColor(alert.severity), marginTop: '3px' }"></i>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:800; font-size:0.88rem;">{{ alert.student.name }} — {{ alert.title }}</div>
                        <div style="font-size:0.8rem; color: var(--text-muted); margin-top:0.15rem;">{{ alert.message }}</div>
                        <div style="font-size:0.8rem; margin-top:0.3rem;"><i class="fa-solid fa-arrow-left" style="font-size:0.7rem;"></i> {{ alert.suggestion }}</div>
                    </div>
                    <button v-if="alert.actionType === 'referral'" class="btn btn-sm btn-secondary" style="white-space:nowrap;" @click="$emit('view-referral', alert.student)">
                        {{ alert.actionLabel }}
                    </button>
                    <button v-else-if="alert.actionType === 'random_picker'" class="btn btn-sm btn-secondary" style="white-space:nowrap;" @click="$emit('open-random-picker')">
                        {{ alert.actionLabel }}
                    </button>
                </div>
            </div>
        </div>
    `,
    setup(props) {
        const alerts = Vue.computed(() => getClassSmartAlerts(props.activeClass, store.activeSubjectId, store.activePeriodId));

        function severityColor(severity) {
            if (severity === 'high') return '#ef4444';
            if (severity === 'medium') return '#f59e0b';
            return '#6366f1';
        }
        function severityBg(severity) {
            if (severity === 'high') return 'rgba(239,68,68,0.08)';
            if (severity === 'medium') return 'rgba(245,158,11,0.08)';
            return 'rgba(99,102,241,0.08)';
        }

        return { alerts, severityColor, severityBg };
    }
};
