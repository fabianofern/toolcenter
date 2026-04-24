// public/admin/js/users.js
window.usersModule = {
    portalRoles: [],
    toolRoles: [],
    allTools: [],

    init: async function() {
        await this.fetchRoles();
    },

    fetchRoles: async function() {
        try {
            const [pRoles, tRoles] = await Promise.all([
                api.get('/api/portal-roles'),
                api.get('/api/tool-roles')
            ]);
            this.portalRoles = pRoles.data;
            this.toolRoles = tRoles.data;

            // Fill selects
            const pSelect = document.getElementById('user-portal-role');
            pSelect.innerHTML = this.portalRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
            
            const trSelect = document.getElementById('grant-role-select');
            trSelect.innerHTML = this.toolRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        } catch (e) {}
    },

    fetchToolsList: async function() {
        try {
            const res = await api.get('/api/tools?limit=100');
            this.allTools = res.data.data;
            const tSelect = document.getElementById('grant-tool-select');
            tSelect.innerHTML = this.allTools.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        } catch (e) {}
    },

    loadUsers: async function() {
        window.showLoader();
        const search = document.getElementById('user-search-input').value;
        try {
            const res = await api.get(`/api/users?search=${encodeURIComponent(search)}&limit=50`);
            const tbody = document.getElementById('users-table-body');
            tbody.innerHTML = '';

            res.data.data.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td><span class="badge role-${user.portal_role?.name.toLowerCase()}">${user.portal_role?.name}</span></td>
                    <td><span class="badge ${user.status.toLowerCase()}">${user.status}</span></td>
                    <td class="action-btns">
                        <button class="btn-icon" title="Editar" onclick='window.usersModule.editUser(${JSON.stringify(user).replace(/'/g, "&#39;")})'><i class="fa-solid fa-user-pen"></i></button>
                        <button class="btn-icon" title="Gerenciar Acessos" onclick="window.usersModule.openAccessModal('${user.id}', '${user.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-key"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            window.showToast('Erro ao listar usuários', 'error');
        } finally {
            window.hideLoader();
        }
    },

    openCreateModal: function() {
        document.getElementById('form-user').reset();
        document.getElementById('user-id').value = '';
        document.getElementById('modal-user-title').textContent = 'Novo Usuário';
        document.getElementById('password-warning').style.display = 'block';
        document.getElementById('modal-user').classList.add('active');
    },

    editUser: function(user) {
        document.getElementById('form-user').reset();
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-email').value = user.email;
        document.getElementById('user-portal-role').value = user.portal_role_id;
        document.getElementById('modal-user-title').textContent = 'Editar Usuário';
        document.getElementById('password-warning').style.display = 'none';
        document.getElementById('modal-user').classList.add('active');
    },

    saveUser: async function() {
        const id = document.getElementById('user-id').value;
        const data = {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            portal_role_id: document.getElementById('user-portal-role').value
        };

        window.showLoader();
        try {
            if (id) {
                await api.put(`/api/users/${id}`, data);
                window.showToast('Usuário atualizado com sucesso');
            } else {
                await api.post('/api/users', data);
                window.showToast('Usuário criado (Senha padrão: 1234)');
            }
            document.getElementById('modal-user').classList.remove('active');
            this.loadUsers();
        } catch (error) {
            window.showToast(error.response?.data?.error || 'Erro ao salvar usuário', 'error');
        } finally {
            window.hideLoader();
        }
    },

    // Acessos
    currentUserId: null,
    openAccessModal: async function(userId, userName) {
        this.currentUserId = userId;
        document.getElementById('access-user-name').textContent = userName;
        await this.loadUserAccesses();
        document.getElementById('modal-access').classList.add('active');
    },

    loadUserAccesses: async function() {
        try {
            const res = await api.get(`/api/users/${this.currentUserId}/access`);
            const list = document.getElementById('user-access-list');
            list.innerHTML = '';

            res.data.forEach(access => {
                const card = document.createElement('div');
                card.className = 'access-card';
                card.innerHTML = `
                    <div class="access-info">
                        <strong>${access.tool.name}</strong>
                        <div class="badge">${access.toolRole.name}</div>
                    </div>
                    <button class="btn-icon delete" onclick="window.usersModule.revokeAccess('${access.tool_id}')"><i class="fa-solid fa-trash-can"></i></button>
                `;
                list.appendChild(card);
            });
        } catch (e) {}
    },

    grantAccess: async function() {
        const toolId = document.getElementById('grant-tool-select').value;
        const roleId = document.getElementById('grant-role-select').value;
        
        try {
            await api.post(`/api/users/${this.currentUserId}/access`, { toolId, toolRoleId: roleId });
            window.showToast('Acesso concedido');
            this.loadUserAccesses();
        } catch (e) {
            window.showToast('Erro ao conceder acesso', 'error');
        }
    },

    revokeAccess: async function(toolId) {
        if (!confirm('Deseja revogar este acesso?')) return;
        try {
            await api.delete(`/api/users/${this.currentUserId}/access/${toolId}`);
            window.showToast('Acesso revogado');
            this.loadUserAccesses();
        } catch (e) {
            window.showToast('Erro ao revogar acesso', 'error');
        }
    }
};

setTimeout(() => { if (window.usersModule.init) window.usersModule.init(); }, 100);
