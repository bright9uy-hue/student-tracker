// v2/js/components/Dashboard.js — per-class dashboard. Stage 1: student
// count + a "back to classes" affordance, proving store reactivity and
// screen navigation. The stat cards (average/pass rate/top score) and the
// actual grading table are added in Stage 2 once grading.js exists.
window.Dashboard = {
    template: `
        <section>
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.25rem;">
                <button class="btn btn-secondary btn-sm" @click="store.currentScreen = 'classes'">
                    <i class="fa-solid fa-arrow-right"></i> رجوع للفصول
                </button>
                <h2 style="font-size:1.1rem; font-weight:800;" v-if="cls">{{ cls.name }}</h2>
            </div>

            <div v-if="cls" class="dashboard-stats" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem;">
                <div class="content-card" style="text-align:center;">
                    <div style="font-size:1.6rem; font-weight:800; color: var(--accent-teal);">{{ (cls.students || []).length }}</div>
                    <div style="color: var(--text-muted); font-size:0.85rem; margin-top:0.35rem;">إجمالي الطلاب</div>
                </div>
            </div>

            <p v-else style="color: var(--text-muted);">لا يوجد فصل نشط.</p>
        </section>
    `,
    setup() {
        const cls = Vue.computed(() => getActiveClass());
        return { store, cls };
    }
};
