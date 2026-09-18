window.NotificationToasts = {
    template: `
        <div class="notification-container">
            <div v-for="n in uiState.notifications" :key="n.id" class="notification" :class="[n.type, { active: n.active }]">
                <i class="fa-solid" :class="iconFor(n.type)" :style="{ color: colorFor(n.type) }"></i>
                <span>{{ n.message }}</span>
            </div>
        </div>
    `,
    setup() {
        function iconFor(type) {
            if (type === 'error') return 'fa-circle-exclamation';
            if (type === 'warning') return 'fa-triangle-exclamation';
            return 'fa-circle-check';
        }
        function colorFor(type) {
            if (type === 'error') return 'var(--danger-color)';
            if (type === 'warning') return 'var(--warning-color)';
            return 'var(--success-color)';
        }
        return { uiState, iconFor, colorFor };
    }
};
