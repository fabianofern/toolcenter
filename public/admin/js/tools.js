// public/admin/js/tools.js
window.toolsModule = {
    loadTools: async function() {
        window.showLoader();
        try {
            const response = await api.get('/api/tools?limit=100');
            const tools = response.data.data;
            const tbody = document.getElementById('tools-table-body');
            tbody.innerHTML = '';

            tools.forEach(tool => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${tool.name}</td>
                    <td><code>${tool.slug}</code></td>
                    <td>${tool.category || '-'}</td>
                    <td><span class="badge ${tool.status.toLowerCase()}">${tool.status}</span></td>
                    <td class="action-btns">
                        <button class="btn-icon" title="Editar" onclick='window.toolsModule.editTool(${JSON.stringify(tool).replace(/'/g, "&#39;")})'><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon" title="Ativar/Desativar" onclick='window.toolsModule.toggleStatus("${tool.id}", "${tool.status}")'><i class="fa-solid fa-power-off"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            if(window.usersModule) window.usersModule.fetchToolsList();
        } catch (error) {
            window.showToast('Erro ao listar ferramentas', 'error');
        } finally {
            window.hideLoader();
        }
    },

    openCreateModal: function() {
        document.getElementById('form-tool').reset();
        document.getElementById('tool-id').value = '';
        document.getElementById('modal-tool-title').textContent = 'Nova Ferramenta';
        document.getElementById('tool-slug').disabled = false;
        document.getElementById('tool-slug-warning').style.display = 'none';
        document.getElementById('modal-tool').classList.add('active');
    },

    editTool: function(tool) {
        document.getElementById('form-tool').reset();
        document.getElementById('tool-id').value = tool.id;
        document.getElementById('tool-name').value = tool.name;
        document.getElementById('tool-slug').value = tool.slug;
        document.getElementById('tool-url').value = tool.url;
        document.getElementById('tool-category').value = tool.category;
        
        document.getElementById('tool-slug').disabled = false;
        document.getElementById('tool-slug-warning').style.display = 'block';
        
        document.getElementById('modal-tool-title').textContent = 'Editar Ferramenta';
        document.getElementById('modal-tool').classList.add('active');
    },

    saveTool: async function() {
        const id = document.getElementById('tool-id').value;
        const iconFile = document.getElementById('tool-icon-file').files[0];

        const data = {
            name: document.getElementById('tool-name').value,
            slug: document.getElementById('tool-slug').value,
            url: document.getElementById('tool-url').value,
            category: document.getElementById('tool-category').value,
            status: 'ACTIVE'
        };

        if (!data.name || !data.slug || !data.url) {
            window.showToast('Preencha os campos obrigatórios', 'error');
            return;
        }

        window.showLoader();
        try {
            let createdOrUpdatedId = id;
            if (id) {
                delete data.status; // Keep existing status, just patch the rest
                await api.put(`/api/tools/${id}`, data);
                window.showToast('Ferramenta atualizada com sucesso');
            } else {
                const res = await api.post('/api/tools', data);
                createdOrUpdatedId = res.data.id;
                window.showToast('Ferramenta criada com sucesso');
            }

            // Se tem arquivo de ícone
            if (iconFile) {
                const formData = new FormData();
                formData.append('icon', iconFile);
                
                await axios.post(`/api/tools/${createdOrUpdatedId}/icon`, formData, {
                    withCredentials: true,
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                window.showToast('Ícone enviado com sucesso');
            }

            document.getElementById('modal-tool').classList.remove('active');
            this.loadTools();
        } catch (error) {
            window.showToast(error.response?.data?.error || 'Erro ao salvar ferramenta', 'error');
        } finally {
            window.hideLoader();
        }
    },

    toggleStatus: async function(id, currentStatus) {
        const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        if (!confirm(`Deseja alterar o status para ${newStatus}?`)) return;

        window.showLoader();
        try {
            await api.patch(`/api/tools/${id}/status`, { status: newStatus });
            window.showToast('Status atualizado com sucesso');
            this.loadTools();
        } catch (error) {
            window.showToast(error.response?.data?.error || 'Erro ao alterar status', 'error');
        } finally {
            window.hideLoader();
        }
    }
};
