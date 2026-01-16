import { request } from '../api.js';
import { getCurrentUser } from '../auth.js';

let currentQueue = [];
let currentBulkItems = [];

// --------------------------------------------------------------------------
// 1. RENDERIZAÇÃO DO DASHBOARD
// --------------------------------------------------------------------------
export async function dashboard() {
    const user = getCurrentUser();
    
    try {
        const data = await(await request('/dashboard')).json();
        const kpi = data.kpi;
        currentQueue = data.queue;

        document.getElementById('content').innerHTML = `
        <h2 class="mb-4">Dashboard Operacional</h2>
        
        <!-- KPI Cards -->
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card text-white bg-warning mb-3 shadow-sm h-100">
                    <div class="card-header">Pendentes</div>
                    <div class="card-body"><h1 class="card-title">${kpi.pending}</h1><p class="card-text">Itens aguardando atendimento</p></div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-white bg-success mb-3 shadow-sm h-100">
                    <div class="card-header">Prontos / Aguardando Retirada</div>
                    <div class="card-body"><h1 class="card-title">${kpi.ready}</h1><p class="card-text">Separados no estoque</p></div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-white bg-secondary mb-3 shadow-sm h-100">
                    <div class="card-header">Concluídos</div>
                    <div class="card-body"><h1 class="card-title">${kpi.completed}</h1><p class="card-text">Entregues ao usuário</p></div>
                </div>
            </div>
        </div>

        <!-- Fila Agrupada -->
        <h4 class="mb-3">Fila de Chamados</h4>
        <div class="table-responsive bg-white shadow-sm p-3 rounded">
            <table class="table table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Chamado</th>
                        <th>Solicitante</th>
                        <th>Destinatário</th>
                        <th>Itens Solicitados</th>
                        <th>Qtd Total</th>
                        <th>Setor</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${renderQueueRows(currentQueue)}
                </tbody>
            </table>
        </div>

        <!-- MODAL DE LOTE (Atualizado para ser mais largo) -->
        <div class="modal fade" id="bulkModal" tabindex="-1">
            <div class="modal-dialog modal-xl" style="max-width: 95%;"> 
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">Atendimento do Chamado</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i> Preencha <strong>pelo menos um</strong> dos campos (Serial, Tag ou Tombamento) e clique na Lupa <i class="fas fa-search"></i> para validar.
                        </div>
                        <div id="bulk-list-container"></div>
                        <div class="form-check mt-3">
                            <input class="form-check-input" type="checkbox" id="dashCheckEmail" checked>
                            <label class="form-check-label">Enviar e-mail de notificação</label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="window.appFn.processBulkFulfill()">
                            <i class="fas fa-check-double"></i> Confirmar Tudo
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    } catch (e) {
        console.error(e);
        document.getElementById('content').innerHTML = `<div class="alert alert-danger">Erro: ${e.message}</div>`;
    }
}

function renderQueueRows(queue) {
    if (!queue || queue.length === 0) return '<tr><td colspan="7" class="text-center text-muted">Nenhum chamado pendente.</td></tr>';

    return queue.map((row, index) => {
        let btn = '';
        
        if (row.status === 'Pending') {
            // Botão ATENDER LOTE
            btn = `<button class="btn btn-primary btn-sm" onclick="window.appFn.openBulkFulfillScreen(${index})">
                     <i class="fas fa-box-open"></i> Atender
                   </button>`;
                   
        } else if (row.status === 'Ready') {
            // Botão CONCLUIR (Entregar)
            btn = `<button class="btn btn-success btn-sm" onclick="window.appFn.deliverGroup(${index})" title="Marcar como Entregue">
                     <i class="fas fa-clipboard-check"></i> Concluir
                   </button>`;
        }

        return `
            <tr>
                <td class="fw-bold">${row.CHAMADO_number}</td>
                <td>${row.solicitante || '-'}</td>
                <td>${row.destinatario}</td>
                <td><small>${row.requested_model}</small></td>
                <td><span class="badge bg-info text-dark">${row.qtd}</span></td>
                <td>${row.setor_destino || '-'}</td>
                <td>${btn}</td>
            </tr>`;
    }).join('');
}

// --------------------------------------------------------------------------
// 2. LÓGICA DE ENTREGA EM GRUPO (BOTÃO CONCLUIR)
// --------------------------------------------------------------------------

export async function deliverGroup(rowIndex) {
    const group = currentQueue[rowIndex];
    if (!group) return;

    if (!confirm(`Confirma a entrega de TODOS os itens do chamado ${group.CHAMADO_number}?`)) return;

    try {
        // 1. Busca lista atualizada de itens
        const allRequests = await(await request('/requests/pending')).json();
        
        // 2. Filtra os itens desse chamado que estão com status 'Ready'
        const itemsToDeliver = allRequests.filter(r => 
            r.CHAMADO_number === group.CHAMADO_number && 
            r.status === 'Ready'
        );

        if (itemsToDeliver.length === 0) {
            alert("Erro: Nenhum item pronto encontrado para este chamado.");
            return;
        }

        // 3. Processa a entrega
        let count = 0;
        for (const item of itemsToDeliver) {
            await request('/requests/deliver', 'POST', { request_id: item.id });
            count++;
        }

        alert(`Sucesso! ${count} itens entregues e fluxo finalizado.`);
        dashboard(); // Recarrega a tela

    } catch (e) {
        console.error(e);
        alert("Erro ao processar entrega.");
    }
}

// --------------------------------------------------------------------------
// 3. LÓGICA DO MODAL DE ATENDIMENTO (3 CAMPOS)
// --------------------------------------------------------------------------

export async function openBulkFulfillScreen(rowIndex) {
    const group = currentQueue[rowIndex];
    if (!group) return;

    try {
        const allRequests = await(await request('/requests/pending')).json();
        
        currentBulkItems = allRequests.filter(r => 
            r.CHAMADO_number === group.CHAMADO_number && 
            r.status === 'Pending'
        );

        if (currentBulkItems.length === 0) {
            alert("Erro: Itens não encontrados.");
            return;
        }

        // Tabela com inputs triplos
        let html = `
            <h6><strong>Chamado:</strong> ${group.CHAMADO_number} | <strong>Total:</strong> ${currentBulkItems.length} itens</h6>
            <table class="table table-bordered mt-3 align-middle">
                <thead class="table-light">
                    <tr>
                        <th width="3%">#</th>
                        <th width="15%">Modelo Solicitado</th>
                        <th width="15%">Usuário</th>
                        <th>Identificação do Equipamento (Preencha qualquer um)</th>
                        <th width="5%" class="text-center">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        currentBulkItems.forEach((item, idx) => {
            html += `
                <tr id="row-${item.id}">
                    <td>${idx + 1}</td>
                    <td class="fw-bold text-primary">${item.requested_model}</td>
                    <td>${item.end_user_name}</td>
                    <td>
                        <div class="input-group">
                            <input type="text" class="form-control field-serial" id="serial-${item.id}" placeholder="Serial" onkeydown="if(event.key==='Enter') window.appFn.validateRow(${item.id})">
                            <input type="text" class="form-control field-tag" id="tag-${item.id}" placeholder="Tag" onkeydown="if(event.key==='Enter') window.appFn.validateRow(${item.id})">
                            <input type="text" class="form-control field-tomb" id="tomb-${item.id}" placeholder="Tombamento" onkeydown="if(event.key==='Enter') window.appFn.validateRow(${item.id})">
                            <button class="btn btn-outline-primary" type="button" onclick="window.appFn.validateRow(${item.id})" title="Buscar e Validar">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                        <input type="hidden" id="real-serial-${item.id}" value=""> <!-- Armazena o serial real validado -->
                        <small id="msg-${item.id}" class="text-muted ms-1"></small>
                    </td>
                    <td class="text-center" id="icon-${item.id}"><i class="fas fa-clock text-secondary"></i></td>
                </tr>`;
        });

        html += `</tbody></table>`;
        document.getElementById('bulk-list-container').innerHTML = html;
        
        new bootstrap.Modal(document.getElementById('bulkModal')).show();
        
        // Foca no primeiro campo da primeira linha
        setTimeout(() => {
            const first = document.querySelector('.field-serial'); 
            if(first) first.focus();
        }, 500);

    } catch (e) { console.error(e); alert("Erro ao preparar lote."); }
}

// VALIDAÇÃO FLEXÍVEL (Tag OU Serial OU Tombamento)
export async function validateRow(reqId) {
    const inputSerial = document.getElementById(`serial-${reqId}`);
    const inputTag = document.getElementById(`tag-${reqId}`);
    const inputTomb = document.getElementById(`tomb-${reqId}`);
    const hiddenReal = document.getElementById(`real-serial-${reqId}`);
    
    const msg = document.getElementById(`msg-${reqId}`);
    const icon = document.getElementById(`icon-${reqId}`);

    // Pega o valor de qualquer campo que esteja preenchido
    const query = inputSerial.value.trim() || inputTag.value.trim() || inputTomb.value.trim();

    if (!query) {
        msg.innerText = "Preencha um campo.";
        msg.className = "text-warning ms-1";
        return;
    }

    // Feedback visual de carregamento
    icon.innerHTML = '<i class="fas fa-spinner fa-spin text-primary"></i>';

    try {
        const res = await request(`/inventory/search-available?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.found) {
            const item = data.item;
            
            // PREENCHE TUDO AUTOMATICAMENTE
            inputSerial.value = item.serial_number;
            inputTag.value = item.tag || '';
            inputTomb.value = item.tombamento || '';
            
            // Armazena o serial verdadeiro para envio (crucial se buscou por tag)
            hiddenReal.value = item.serial_number;

            // Trava os campos para evitar edição acidental após validar
            inputSerial.classList.add('is-valid');
            inputTag.classList.add('is-valid');
            inputTomb.classList.add('is-valid');

            msg.innerHTML = `<span class="text-success fw-bold">OK: ${item.model}</span>`;
            icon.innerHTML = '<i class="fas fa-check-circle text-success fa-lg"></i>';
        } else {
            hiddenReal.value = ""; // Limpa se falhou
            
            inputSerial.classList.remove('is-valid');
            inputTag.classList.remove('is-valid');
            inputTomb.classList.remove('is-valid');
            
            inputSerial.classList.add('is-invalid'); // Marca vermelho só para feedback momentaneo
            
            msg.innerHTML = `<span class="text-danger">${data.message || "Não encontrado/Indisponível"}</span>`;
            icon.innerHTML = '<i class="fas fa-times-circle text-danger fa-lg"></i>';
        }
    } catch (e) { 
        console.error(e);
        icon.innerHTML = '<i class="fas fa-exclamation-triangle text-warning"></i>';
    }
}

export async function processBulkFulfill() {
    const hiddenInputs = document.querySelectorAll('[id^="real-serial-"]');
    const allocations = [];
    let missingCount = 0;

    hiddenInputs.forEach(input => {
        const reqId = input.id.replace('real-serial-', '');
        const serial = input.value;

        if (serial) {
            allocations.push({ request_id: parseInt(reqId), serial_number: serial });
        } else {
            missingCount++;
        }
    });

    if (allocations.length === 0) return alert("Nenhum item validado. Use a lupa para validar antes de confirmar.");
    
    if (missingCount > 0) {
        if(!confirm(`Existem ${missingCount} itens NÃO validados nesta lista. Deseja atender apenas os ${allocations.length} validados?`)) return;
    }

    const btn = document.querySelector('#bulkModal .btn-success');
    const txt = btn.innerHTML;
    btn.innerHTML = 'Processando...'; btn.disabled = true;

    try {
        const res = await request('/requests/fulfill-batch', 'POST', {
            allocations: allocations,
            send_email: document.getElementById('dashCheckEmail').checked
        });
        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            bootstrap.Modal.getInstance(document.getElementById('bulkModal')).hide();
            dashboard();
        } else {
            alert("Erro: " + data.message);
        }
    } catch (e) { alert("Erro de conexão."); } 
    finally { btn.innerHTML = txt; btn.disabled = false; }
}