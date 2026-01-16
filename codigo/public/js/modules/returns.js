import { request } from '../api.js';

// Lista de itens na "Cesta de Devolução"
let returnCart = [];

export function renderReturns() {
    returnCart = []; // Reseta lista ao abrir a tela
    
    document.getElementById('content').innerHTML = `
    <h2><i class="fas fa-undo"></i> Registrar Devolução</h2>
    <p class="text-muted">Bipe os equipamentos e defina o estado de cada um.</p>
    
    <!-- 1. Área de Identificação do Lote -->
    <div class="card p-3 shadow-sm mb-4 bg-light border-0">
        <div class="row g-3 align-items-end">
            <div class="col-md-3">
                <label class="form-label fw-bold">Chamado da Devolução (Novo)</label>
                <input id="ret_chamado_new" class="form-control" placeholder="Ex: DEV-2024-001">
                <div class="form-text">Número que identificará este lote.</div>
            </div>
            <div class="col-md-6">
                <label class="form-label fw-bold">Adicionar Equipamento</label>
                <div class="input-group">
                    <input id="ret_search" class="form-control" placeholder="Serial, Tag ou Tombamento..." onkeydown="if(event.key==='Enter') window.appFn.checkReturnItem()">
                    <button class="btn btn-primary" onclick="window.appFn.checkReturnItem()">
                        <i class="fas fa-plus"></i> Adicionar
                    </button>
                </div>
            </div>
        </div>
        <div id="ret_msg" class="mt-2"></div>
    </div>

    <!-- 2. Tabela de Itens (Editável) -->
    <div class="card p-3 shadow-sm border-0">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="m-0">Itens na Lista</h5>
            <span class="badge bg-secondary" id="cart_count">0 itens</span>
        </div>

        <div class="table-responsive">
            <table class="table table-bordered align-middle" id="ret_table">
                <thead class="table-light">
                    <tr>
                        <th style="width: 20%">Equipamento</th>
                        <th style="width: 15%">Condição <span class="text-danger">*</span></th> <!-- MOVIDO PARA CÁ -->
                        <th style="width: 15%">Usuário Anterior</th>
                        <th style="width: 15%">Setor</th>
                        <th style="width: 15%">Chamado Origem</th>
                        <th style="width: 5%">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="6" class="text-center text-muted py-4">Nenhum item adicionado.</td></tr>
                </tbody>
            </table>
        </div>

        <!-- 3. Rodapé de Confirmação -->
        <div class="row g-3 mt-3 border-top pt-3 bg-light rounded p-2">
            <div class="col-md-10">
                <label class="form-label fw-bold">Observações Gerais do Lote</label>
                <input id="ret_notes" class="form-control" placeholder="Ex: Devolução massiva do setor financeiro...">
            </div>
            <div class="col-md-2 d-flex align-items-end">
                <button class="btn btn-success w-100 py-2" onclick="window.appFn.executeReturn()" id="btn_finish_ret" disabled>
                    <i class="fas fa-save"></i> Finalizar
                </button>
            </div>
        </div>
    </div>`;
    
    setTimeout(() => document.getElementById('ret_search').focus(), 300);
}

// --- BUSCA E ADICIONA AO CARRINHO ---
export async function checkReturnItem() {
    const q = document.getElementById('ret_search').value.trim();
    const msg = document.getElementById('ret_msg');
    
    if (!q) { 
        msg.innerHTML = '<div class="alert alert-warning py-1 px-2">Digite ou bipe algo.</div>'; 
        return; 
    }

    try {
        const res = await request(`/returns/check?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (res.ok && data.found) {
            const item = data.item;
            
            if (returnCart.find(x => x.id === item.id)) {
                msg.innerHTML = '<div class="alert alert-warning py-1 px-2">Este item já está na lista.</div>';
                document.getElementById('ret_search').select();
                return;
            }

            returnCart.push(item);
            updateReturnTable();
            
            msg.innerHTML = `<div class="alert alert-success py-1 px-2">Adicionado: <strong>${item.model}</strong> (${item.serial})</div>`;
            document.getElementById('ret_search').value = '';
            document.getElementById('ret_search').focus();
        } else {
            msg.innerHTML = `<div class="alert alert-danger py-1 px-2">${data.message || 'Não encontrado.'}</div>`;
            document.getElementById('ret_search').select();
        }
    } catch (e) {
        console.error(e);
        msg.innerHTML = `<div class="alert alert-danger py-1 px-2">Erro de conexão.</div>`;
    }
}

// --- RENDERIZA TABELA COM INPUTS ---
function updateReturnTable() {
    const tbody = document.querySelector('#ret_table tbody');
    tbody.innerHTML = '';
    document.getElementById('cart_count').innerText = `${returnCart.length} itens`;

    if (returnCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum item adicionado.</td></tr>';
        document.getElementById('btn_finish_ret').disabled = true;
        return;
    }

    returnCart.forEach((item, idx) => {
        const tr = document.createElement('tr');
        
        // HTML do Select de Status Individual
        const statusSelect = `
            <select class="form-select form-select-sm border-primary" id="status_${idx}">
                <option value="Available">Disponível</option>
                <option value="Inspection">Em Análise</option>
                <option value="Defective">Defeito/Sucata</option>
            </select>
        `;

        tr.innerHTML = `
            <td>
                <div class="fw-bold">${item.model}</div>
                <small class="text-muted">SN: ${item.serial}</small>
                ${item.tombamento ? `<small class="d-block text-muted">Tomb: ${item.tombamento}</small>` : ''}
            </td>
            <td>
                ${statusSelect}
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" 
                       id="user_${idx}" value="${item.current_user || ''}" placeholder="Nome">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" 
                       id="sector_${idx}" value="${item.sector || ''}" placeholder="Setor">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" 
                       id="origin_${idx}" value="${item.origin_chamado || ''}" placeholder="REQ-Origem">
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger" onclick="window.appFn.removeReturnItem(${idx})" tabindex="-1">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('btn_finish_ret').disabled = false;
}

export function removeReturnItem(idx) {
    returnCart.splice(idx, 1);
    updateReturnTable();
}

// --- EXECUTA A DEVOLUÇÃO EM LOTE ---
export async function executeReturn() {
    if (returnCart.length === 0) return;

    const chamadoDev = document.getElementById('ret_chamado_new').value.trim() || "SEM CHAMADO";
    const notes = document.getElementById('ret_notes').value;

    if (!confirm(`Confirmar devolução de ${returnCart.length} itens?`)) return;

    // Coleta os dados (incluindo o status individual)
    const itemsData = returnCart.map((item, idx) => {
        return {
            id: item.id,
            // AQUI PEGAMOS O STATUS INDIVIDUAL DE CADA ITEM
            status: document.getElementById(`status_${idx}`).value, 
            user: document.getElementById(`user_${idx}`).value.trim(),
            sector: document.getElementById(`sector_${idx}`).value.trim(),
            origin: document.getElementById(`origin_${idx}`).value.trim()
        };
    });

    const btn = document.getElementById('btn_finish_ret');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    try {
        const res = await request('/returns/execute-batch', 'POST', {
            items_data: itemsData,       // Lista detalhada com status
            chamado_devolucao: chamadoDev,
            notes: notes
        });
        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            renderReturns(); 
        } else {
            alert("Erro: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao processar devolução.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}