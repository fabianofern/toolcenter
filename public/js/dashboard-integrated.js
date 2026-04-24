/**
 * Dashboard Integrated SPA Logic
 * Handles both "Tools Grid" and "Audit Logs"
 */

const DashboardSPA = {
    user: null,
    tools: [],

    init: async function() {
        this.updateDate();
        await this.fetchUserContext();
        this.renderTools();
    },

    updateDate: function() {
        const el = document.getElementById('current-date');
        if (!el) return;
        const options = { day: 'numeric', month: 'long' };
        el.textContent = new Intl.DateTimeFormat('pt-BR', options).format(new Date());
    },

    fetchUserContext: async function() {
        try {
            const res = await api.get('/api/me');
            this.user = res.data.user;
            this.tools = res.data.dashboard.tools;

            // UI
            document.getElementById('user-name').textContent = this.user.name;
            document.getElementById('user-role').textContent = this.user.portal_role;
            document.getElementById('user-initials').textContent = this.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            if (res.data.dashboard.isPortalAdmin) {
                document.getElementById('admin-menu').classList.remove('hidden');
            }
        } catch (e) {
            console.error('Context load fail');
        }
    },

    renderTools: function(filter = '') {
        const container = document.getElementById('tools-container');
        if (!container) return;
        container.innerHTML = '';

        const filtered = this.tools.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));

        if (filtered.length === 0) {
            container.innerHTML = '<p class="no-tools">Nenhuma ferramenta encontrada para sua busca ou perfil.</p>';
            return;
        }

        filtered.forEach(tool => {
            const card = document.createElement('div');
            card.className = 'tool-card';
            card.onclick = () => window.open(tool.url, '_blank');
            
            card.innerHTML = `
                <div class="tool-icon">
                    <i class="fa-solid ${tool.icon || 'fa-gear'}"></i>
                </div>
                <div class="tool-info">
                    <h3>${tool.name}</h3>
                    <span class="category">${tool.category || 'Utilitário'}</span>
                    <span class="role-badge">${tool.tool_role}</span>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square open-icon"></i>
            `;
            container.appendChild(card);
        });
    },

    showSection: function(section) {
        document.getElementById('section-tools').classList.add('hidden');
        document.getElementById('section-audit').classList.add('hidden');
        
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

        if (section === 'tools') {
            document.getElementById('section-tools').classList.remove('hidden');
            document.querySelector('[onclick="showSection(\'tools\')"]').classList.add('active');
        } else {
            document.getElementById('section-audit').classList.remove('hidden');
            document.querySelector('[onclick="showSection(\'audit\')"]').classList.add('active');
            this.loadAudit();
        }
    },

    loadAudit: async function() {
        try {
            const res = await api.get('/api/audit/logs');
            const tbody = document.getElementById('audit-tbody');
            tbody.innerHTML = '';

            res.data.data.forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.user?.name || 'Sistema'}</td>
                    <td><span class="event-type">${log.event_type}</span></td>
                    <td>${log.tool?.name || '-'}</td>
                    <td>${log.ip_address || ''}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('Audit load fail');
        }
    }
};

// Global Exposure
window.showSection = DashboardSPA.showSection.bind(DashboardSPA);
window.handleLogout = async () => {
    try {
        await api.post('/api/auth/logout');
        window.location.href = '/';
    } catch(e) {
        window.location.href = '/';
    }
};

window.filterTools = () => {
    const val = document.getElementById('tool-search').value;
    DashboardSPA.renderTools(val);
};

document.addEventListener('DOMContentLoaded', () => DashboardSPA.init());
