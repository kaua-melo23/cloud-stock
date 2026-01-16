import { request } from '../api.js';

export async function flow() {
    document.getElementById('content').innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h2>Fluxo de Movimentação</h2>
        <button class="btn btn-outline-primary" onclick="window.appFn.flow()"><i class="fas fa-sync"></i> Atualizar</button>
    </div>
    <div id="flow-loading">Carregando...</div>
    <div class="table-responsive">
        <table class="table table-striped table-hover align-middle" id="flow-table">
            <thead class="table-dark">
                <tr>
                    <th>Data</th>
                    <th>Tipo</th> <!-- NOVA COLUNA -->
                    <th>Chamado</th>
                    <th>Modelo</th>
                    <th>Serial</th>
                    <th>Solicitante / Devolveu</th>
                    <th>Atendido Por</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>`;

    await loadFlowData();
}

export async function loadFlowData() {
    try {
        const response = await request('/flow');
        const data = await response.json();
        const tbody = document.querySelector('#flow-table tbody');
        document.getElementById('flow-loading').style.display = 'none';
        
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-3">Nenhum registro encontrado.</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            
            // Define cor do badge de tipo
            let typeBadge = 'bg-secondary';
            if (item.flow_type === 'Saída') typeBadge = 'bg-success';
            if (item.flow_type === 'Devolução') typeBadge = 'bg-warning text-dark';

            tr.innerHTML = `
                <td>${item.completion_date}</td>
                <td><span class="badge ${typeBadge}">${item.flow_type || 'Saída'}</span></td>
                <td class="fw-bold">${item.CHAMADO_number}</td>
                <td>${item.model}</td>
                <td class="font-monospace">${item.serial_number}</td>
                <td>${item.requester_name}</td>
                <td><span class="badge bg-light text-dark border">${item.fulfilled_by}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        document.getElementById('flow-loading').innerHTML = `<div class="alert alert-danger">Erro: ${e.message}</div>`;
    }
}