// v2/js/components/StudentGroupsModal.js — collaborative-learning group
// divider: random or balanced-by-grade distribution, per-group leader
// toggle, one-click "reward the whole group" participation point, and a
// printable roster. The groups list is local (not persisted) component
// state, matching the old app's currentGroupsData (regenerated each time
// the modal opens).
window.StudentGroupsModal = {
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <div class="modal-overlay" :class="{ active: modelValue }">
            <div class="modal-container" style="max-width: 980px; width: 95%; max-height: 90vh;">
                <div class="modal-header" style="border-bottom: 1px solid var(--surface-border); padding-bottom: 0.85rem;">
                    <h3 style="font-weight: 700; display: flex; align-items: center; gap: 0.5rem; color: #c084fc;">
                        <i class="fa-solid fa-people-group"></i> تقسيم وتوزيع المجموعات الصفية (التعلم التعاوني)
                    </h3>
                    <button class="modal-close" @click="close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.25rem 1rem; overflow-y: auto;">
                    <div style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label style="font-size: 0.88rem; font-weight: 700;">طريقة التقسيم:</label>
                                <select class="form-control" v-model="divideMode" @change="onSettingsChange" style="width: 170px; padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                                    <option value="byGroupCount">حسب عدد المجموعات</option>
                                    <option value="byMemberCount">حسب عدد الطلاب/مجموعة</option>
                                </select>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label style="font-size: 0.88rem; font-weight: 700;">{{ divideMode === 'byGroupCount' ? 'عدد المجموعات:' : 'عدد الطلاب/مجموعة:' }}</label>
                                <input type="number" class="form-control" v-model.number="countVal" min="2" :max="Math.max(2, totalStudents)" @input="onSettingsChange" style="width: 75px; text-align: center; font-weight: bold; font-size: 0.9rem;">
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label style="font-size: 0.88rem; font-weight: 700;">نوع التوزيع:</label>
                                <select class="form-control" v-model="strategy" @change="generate" style="width: 175px; padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                                    <option value="random">🎲 توزيع عشوائي فوري</option>
                                    <option value="balanced">⚖️ متوازن حسب المستوى</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button type="button" class="btn" @click="generate" style="background: #a855f7; color: white; padding: 0.45rem 1rem; font-size: 0.85rem;">
                                <i class="fa-solid fa-shuffle"></i> إعادة الخلط 🎲
                            </button>
                            <button type="button" class="btn btn-secondary" @click="printGroups" style="padding: 0.45rem 1rem; font-size: 0.85rem;">
                                <i class="fa-solid fa-print"></i> طباعة / عرض
                            </button>
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem; font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <span>إجمالي الطلاب: <strong style="color:var(--text-main);">{{ totalStudents }} طالب</strong> | عدد المجموعات: <strong style="color:#c084fc;">{{ groups.length }} مجموعات</strong></span>
                        <span>💡 انقر على اسم المجموعة لتعديله، أو اضغط النجمة 👑 لتعيين قائد المجموعة.</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                        <div v-for="(grp, gIdx) in groups" :key="grp.id" class="group-card" :style="{ borderColor: grp.color + '40' }">
                            <div class="group-card-header">
                                <input type="text" class="group-title-input" v-model="grp.name" :style="{ color: grp.color, fontWeight: 800 }">
                                <span class="group-badge-count" :style="{ background: grp.color + '20', color: grp.color }">{{ grp.members.length }} طلاب</span>
                            </div>
                            <div class="group-members-list">
                                <div v-for="(m, mIdx) in grp.members" :key="m.id" class="group-member-item">
                                    <span style="font-weight: 600; display: flex; align-items: center; gap: 0.4rem;">
                                        <span style="color: var(--text-muted); font-size: 0.75rem; width: 16px;">{{ mIdx + 1 }}.</span>
                                        {{ m.name }}
                                        <span v-if="m.isLeader" class="group-leader-badge"><i class="fa-solid fa-crown"></i> قائد</span>
                                    </span>
                                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                                        <button type="button" @click="toggleLeader(gIdx, mIdx)" title="تعيين كقائد للمجموعة" :style="{ background: 'transparent', border: 'none', color: m.isLeader ? '#fbbf24' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '2px 4px' }">
                                            <i :class="'fa-' + (m.isLeader ? 'solid' : 'regular') + ' fa-star'"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button type="button" class="group-reward-btn" @click="rewardGroup(gIdx)">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> منح نقطة مشاركة للمجموعة ⭐
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="border-top: 1px solid var(--surface-border); padding-top: 0.85rem; display: flex; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" @click="close" style="min-width: 120px;">إغلاق</button>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const divideMode = Vue.ref('byGroupCount');
        const countVal = Vue.ref(4);
        const strategy = Vue.ref('random');
        const groups = Vue.reactive([]);

        const totalStudents = Vue.computed(() => getActiveStudents().length);

        const groupNames = ['مجموعة الرواد 🚀', 'مجموعة النخبة 🌟', 'مجموعة المبدعين 💡', 'مجموعة الفرسان 🛡️', 'مجموعة الأمل 🌈', 'مجموعة التميز 🏆', 'مجموعة الصقور 🦅', 'مجموعة الأذكياء 🧠', 'مجموعة النجوم ⭐', 'مجموعة العلماء 🔬'];
        const groupColors = ['#a855f7', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

        function close() { emit('update:modelValue', false); }

        function onSettingsChange() {
            if (countVal.value > totalStudents.value && totalStudents.value > 0) countVal.value = Math.min(4, totalStudents.value);
            generate();
        }

        function generate() {
            const students = getActiveStudents();
            if (!students || students.length === 0) { groups.length = 0; return; }

            const studentsCopy = students.map(s => ({ id: s.id, name: s.name, total: getStudentTotal(s), isLeader: false }));

            let numGroups;
            if (divideMode.value === 'byGroupCount') {
                numGroups = Math.max(1, Math.min(countVal.value || 4, studentsCopy.length));
            } else {
                const perGroup = Math.max(1, countVal.value || 4);
                numGroups = Math.max(1, Math.ceil(studentsCopy.length / perGroup));
            }

            const newGroups = [];
            for (let i = 0; i < numGroups; i++) {
                newGroups.push({
                    id: 'grp-' + (i + 1),
                    name: groupNames[i % groupNames.length] || `المجموعة (${i + 1})`,
                    color: groupColors[i % groupColors.length],
                    members: []
                });
            }

            if (strategy.value === 'balanced') {
                studentsCopy.sort((a, b) => b.total - a.total);
                let groupIdx = 0, direction = 1;
                studentsCopy.forEach(st => {
                    newGroups[groupIdx].members.push(st);
                    groupIdx += direction;
                    if (groupIdx >= numGroups) { groupIdx = numGroups - 1; direction = -1; }
                    else if (groupIdx < 0) { groupIdx = 0; direction = 1; }
                });
            } else {
                for (let i = studentsCopy.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [studentsCopy[i], studentsCopy[j]] = [studentsCopy[j], studentsCopy[i]];
                }
                studentsCopy.forEach((st, idx) => { newGroups[idx % numGroups].members.push(st); });
            }

            newGroups.forEach(grp => { if (grp.members.length > 0) grp.members[0].isLeader = true; });

            groups.splice(0, groups.length, ...newGroups);
        }

        function toggleLeader(groupIdx, memberIdx) {
            groups[groupIdx].members.forEach((m, idx) => { m.isLeader = (idx === memberIdx); });
        }

        function rewardGroup(groupIdx) {
            const grp = groups[groupIdx];
            const activeCls = getActiveClass();
            if (!grp || !activeCls) return;

            grp.members.forEach(m => {
                const student = activeCls.students.find(s => s.id === m.id);
                if (!student) return;
                const gradesObj = getStudentSubjectGrades(student);
                if (!Array.isArray(gradesObj.participation)) gradesObj.participation = [];
                for (let i = 0; i < 10; i++) {
                    if (!gradesObj.participation[i]) { gradesObj.participation[i] = true; break; }
                }
            });

            saveData();
            showNotification(`✨ تم منح نقطة تفاعل لجميع أعضاء (${grp.name}) بنجاح!`, 'success');
        }

        function printGroups() {
            const activeCls = getActiveClass();
            if (!activeCls || groups.length === 0) return;

            const teacherName = store.portfolioSettings?.teacherName || 'معلم المادة';
            const schoolName = store.portfolioSettings?.schoolName || 'المدرسة';
            const className = activeCls.name;

            let groupsHtml = '';
            groups.forEach(grp => {
                const membersList = grp.members.map((m, idx) =>
                    `<li style="padding: 4px 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.9rem;">
                        <strong>${idx + 1}.</strong> ${m.name} ${m.isLeader ? '<span style="color:#d97706; font-weight:bold;">(القائد 👑)</span>' : ''}
                    </li>`
                ).join('');
                groupsHtml += `
                    <div style="border: 2px solid #cbd5e1; border-radius: 10px; padding: 12px; page-break-inside: avoid; background: #fafafa;">
                        <h4 style="margin: 0 0 8px 0; color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; font-size: 1rem; display: flex; justify-content: space-between;">
                            <span>${grp.name}</span>
                            <span style="font-size: 0.8rem; color: #64748b;">${grp.members.length} طلاب</span>
                        </h4>
                        <ol style="margin: 0; padding-right: 18px; list-style-type: none;">${membersList}</ol>
                    </div>`;
            });

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="utf-8">
                    <title>كشف مجموعات التعلم التعاوني - ${className}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800&display=swap');
                        body { font-family: 'Tajawal', Arial, sans-serif; padding: 25px; color: #0f172a; direction: rtl; }
                        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
                        .header h2 { margin: 0 0 5px 0; color: #1e1b4b; font-size: 1.4rem; }
                        .meta { display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: bold; color: #475569; margin-top: 8px; }
                        .groups-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                        @media print { button { display: none !important; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>📋 كشف توزيع مجموعات التعلم التعاوني</h2>
                        <div class="meta">
                            <span>المدرسة: ${schoolName}</span>
                            <span>الفصل: ${className}</span>
                            <span>المعلم: ${teacherName}</span>
                            <span>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</span>
                        </div>
                    </div>
                    <div class="groups-grid">${groupsHtml}</div>
                    <div style="text-align: center; margin-top: 30px;">
                        <button onclick="window.print()" style="background: #4338ca; color: white; border: none; padding: 10px 25px; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer;">
                            🖨️ طباعة الكشف
                        </button>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
        }

        Vue.watch(() => props.modelValue, (open) => {
            if (!open) return;
            if (getActiveStudents().length === 0) {
                showNotification('لا يوجد طلاب في هذا الفصل لتقسيمهم إلى مجموعات!', 'warning');
                close();
                return;
            }
            divideMode.value = 'byGroupCount';
            countVal.value = Math.min(4, totalStudents.value) || 2;
            strategy.value = 'random';
            generate();
        });

        return {
            divideMode, countVal, strategy, groups, totalStudents,
            close, onSettingsChange, generate, toggleLeader, rewardGroup, printGroups
        };
    }
};
