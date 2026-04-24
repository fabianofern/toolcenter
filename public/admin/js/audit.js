// public/admin/js/audit.js
window.auditModule = {
    currentAuditData: [],

    init: function() {
        const filter = document.getElementById('audit-event-filter');
        if (filter) {
            filter.addEventListener('change', () => this.loadLogs());
        }
    },

    loadLogs: async function() {
        window.showLoader();
        const eventType = document.getElementById('audit-event-filter').value;

        let query = '?page=1&limit=200'; // fetching up to 200 for easier review on MVP
        if (eventType) query += `&event_type=${encodeURIComponent(eventType)}`;

        try {
            const response = await api.get(`/api/audit${query}`);
            const logs = response.data.data;
            this.currentAuditData = logs;

            const tbody = document.getElementById('audit-table-body');
            tbody.innerHTML = '';

            if(logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum registro encontrado</td></tr>';
                return;
            }

            logs.forEach(log => {
                const tr = document.createElement('tr');
                const dateRaw = new Date(log.created_at);
                const dateStr = dateRaw.toLocaleDateString() + ' ' + dateRaw.toLocaleTimeString();

                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td title="${log.user_id}">${log.user?.name || log.user_id?.substring(0,8) + '...'}</td>
                    <td><span class="badge" style="background:#e5e7eb; color:#374151;">${log.event_type}</span></td>
                    <td title="${log.tool_id}">${log.tool?.name || '-'}</td>
                    <td>${log.ip_address || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            window.showToast('Erro ao carregar logs de auditoria', 'error');
        } finally {
            window.hideLoader();
        }
    },

    exportCsv: function() {
        if (this.currentAuditData.length === 0) {
            window.showToast('Nenhum dado para exportar', 'error');
            return;
        }

        const headers = ['Data/Hora', 'Usuário', 'Ação', 'Ferramenta', 'IP', 'User-Agent'];
        const csvRows = [];
        csvRows.push(headers.join(','));

        this.currentAuditData.forEach(log => {
            const dateStr = new Date(log.created_at).toISOString();
            const userName = log.user?.name || log.user_id || '';
            const action = log.event_type || '';
            const toolName = log.tool?.name || log.tool_id || '';
            const ip = log.ip_address || '';
            const ua = log.user_agent ? log.user_agent.replace(/,/g, ';') : '';

            const row = [
                `"${dateStr}"`,
                `"${userName}"`,
                `"${action}"`,
                `"${toolName}"`,
                `"${ip}"`,
                `"${ua}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `auditoria_export_${Date.now()}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

setTimeout(() => { if (window.auditModule && window.auditModule.init) window.auditModule.init(); }, 100);
