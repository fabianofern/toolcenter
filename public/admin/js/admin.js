// public/admin/js/admin.js
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sessão primeiro
    try {
        const response = await api.get('/api/me');
        const user = response.data.user;
        const isPortalAdmin = response.data.dashboard.isPortalAdmin;

        if (!isPortalAdmin) {
            window.location.href = '/dashboard';
            return;
        }

        document.getElementById('user-name-display').textContent = user.name;
    } catch (error) {
        window.location.href = '/';
        return;
    }

    // Navegação de Abas
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabNameDisplay = document.getElementById('current-tab-name');

    function switchTab(tabId) {
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.tab === tabId) {
                link.classList.add('active');
                tabNameDisplay.textContent = `> ${link.textContent.trim()}`;
            }
        });

        tabContents.forEach(tab => {
            tab.style.display = 'none';
        });

        const activeTab = document.getElementById(`tab-${tabId}`);
        if (activeTab) {
            activeTab.style.display = 'block';
        }

        // Load data based on tab
        if (tabId === 'users' && window.usersModule) window.usersModule.loadUsers();
        if (tabId === 'tools' && window.toolsModule) window.toolsModule.loadTools();
        if (tabId === 'audit' && window.auditModule) window.auditModule.loadLogs();
    }

    // Handle hash change
    window.addEventListener('hashchange', () => {
        let hash = window.location.hash.substring(1) || 'users';
        switchTab(hash);
    });

    // Iniciar aba baseada na hash atual
    let initialHash = window.location.hash.substring(1) || 'users';
    switchTab(initialHash);

    // Mobile Sidebar
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    if (openBtn) openBtn.onclick = () => sidebar.classList.add('open');
    if (closeBtn) closeBtn.onclick = () => sidebar.classList.remove('open');

    // Fechar modais ao clicar no X ou Cancelar
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await api.post('/api/auth/logout');
            window.location.href = '/';
        } catch (err) {
            console.error(err);
            window.location.href = '/';
        }
    });
});

window.showLoader = function() {
    document.getElementById('global-loader').classList.add('active');
};
window.hideLoader = function() {
    document.getElementById('global-loader').classList.remove('active');
};
window.showToast = function(message, type = 'success') {
    alert(message); // MVP wrapper. Could be replaced with proper toast component
};
