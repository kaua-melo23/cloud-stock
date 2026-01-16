import { request } from '../api.js';
import { getCurrentUser } from '../auth.js';

let currentBatch = [];
let currentRequestId = null;
let inventoryCache = [];

// Lista temporária para os itens da nova solicitação (Carrinho)
let requestItemsList = [];

// --------------------------------------------------------------------------
// 1. RENDERIZAÇÃO DA PÁGINA DE SOLICITAÇÃO
// --------------------------------------------------------------------------
export function requestPage() {
    // Reseta a lista ao abrir a tela
    requestItemsList = [];

    document.getElementById('content').innerHTML = `
    <h2>Solicitações de Equipamentos</h2>
    
    <div class="card p-4 shadow-sm mb-4 bg-light border-0">
        <h5 class="mb-3"><i class="fas fa-file-alt"></i> Nova Solicitação</h5>
        
        <!-- CABEÇALHO DO CHAMADO (Dados Comuns) -->
        <div class="row g-3 mb-3 border-bottom pb-3">
            <div class="col-md-3">
                <label class="form-label fw-bold">Chamado GLPI <span class="text-danger">*</span></label>
                <input id="rn" class="form-control" placeholder="REQ-0000" required>
            </div>
            <div class="col-md-5">
                <label class="form-label fw-bold">Usuário Final / Destinatário <span class="text-danger">*</span></label>
                <input id="reu" class="form-control" required placeholder="Nome de quem vai receber">
            </div>
            <div class="col-md-4">
                <label class="form-label fw-bold">Setor de Destino</label>
                <input id="rds" class="form-control" placeholder="Ex: Financeiro">
            </div>
            <div class="col-md-12">
                 <label class="form-label fw-bold">Observação Geral</label>
                 <input id="rob" class="form-control" placeholder="Detalhes adicionais...">
            </div>
        </div>

        <!-- ÁREA DE ADICIONAR ITENS -->
        <h6 class="text-muted">Adicionar Itens ao Chamado:</h6>
        <div class="row g-3 align-items-end bg-white p-3 border rounded mb-3">
            <div class="col-md-4">
                <label class="form-label fw-bold small">Tipo <span class="text-danger">*</span></label>
                <select id="rt_type" class="form-select" onchange="window.appFn.filterModelsByType()">
                    <option value="">Carregando...</option>
                </select>
            </div>
            <div class="col-md-4">
                <label class="form-label fw-bold small">Modelo <span class="text-danger">*</span></label>
                <select id="rm" class="form-select" disabled>
                    <option value="">Selecione o Tipo primeiro</option>
                </select>
            </div>
            <div class="col-md-2">
                 <label class="form-label fw-bold small">Qtd <span class="text-danger">*</span></label>
                 <input type="number" id="rq" class="form-control" value="1" min="1" max="50">
            </div>
            <div class="col-md-2">
                <button type="button" class="btn btn-success w-100" onclick="window.addRequestItem()">
                    <i class="fas fa-plus"></i> Adicionar
                </button>
            </div>
        </div>

        <!-- TABELA DE ITENS ADICIONADOS -->
        <div class="table-responsive mb-3">
            <table class="table table-sm table-bordered table-striped" id="reqItemsTable">
                <thead class="table-light">
                    <tr>
                        <th>Tipo</th>
                        <th>Modelo</th>
                        <th width="10%">Qtd</th>
                        <th width="10%">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="4" class="text-center text-muted">Nenhum item adicionado ainda.</td></tr>
                </tbody>
            </table>
        </div>
        
        <!-- BOTÃO FINAL DE ENVIO -->
        <div class="text-end">
            <button class="btn btn-primary px-4" onclick="window.appFn.sendReq(event)">
                <i class="fas fa-paper-plane"></i> Finalizar Solicitação
            </button>
        </div>
    </div>
    
    <h4 class="mt-4">Fila de Atendimento</h4>
    <div id="rt" class="mt-2">Carregando...</div>`;
    
    initRequestData();
}

// --------------------------------------------------------------------------
// 2. FUNÇÕES AUXILIARES DE LISTA (CARRINHO)
// --------------------------------------------------------------------------

// Adiciona item à lista temporária
window.addRequestItem = function() {
    const tipo = document.getElementById('rt_type').value;
    const modelo = document.getElementById('rm').value;
    const qtd = parseInt(document.getElementById('rq').value);

    if (!tipo || !modelo) {
        alert("Selecione o Tipo e o Modelo.");
        return;
    }
    if (!qtd || qtd < 1) {
        alert("Quantidade inválida.");
        return;
    }

    // Adiciona ao array
    requestItemsList.push({
        type: tipo,
        model: modelo,
        qty: qtd
    });

    renderItemsList();

    // Reseta campos de seleção de item (mas mantém cabeçalho)
    document.getElementById('rt_type').value = "";
    document.getElementById('rm').innerHTML = '<option value="">Selecione o Tipo primeiro</option>';
    document.getElementById('rm').disabled = true;
    document.getElementById('rq').value = 1;
};

// Remove item da lista
window.removeRequestItem = function(index) {
    requestItemsList.splice(index, 1);
    renderItemsList();
};

// Renderiza a tabelinha visual
function renderItemsList() {
    const tbody = document.querySelector('#reqItemsTable tbody');
    tbody.innerHTML = '';

    if (requestItemsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum item adicionado ainda.</td></tr>';
        return;
    }

    requestItemsList.forEach((item, idx) => {
        tbody.innerHTML += `
            <tr>
                <td>${item.type}</td>
                <td>${item.model}</td>
                <td class="text-center">${item.qty}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="window.removeRequestItem(${idx})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// --------------------------------------------------------------------------
// 3. LÓGICA DE DADOS E FILTRO CASCATA
// --------------------------------------------------------------------------

async function initRequestData() {
    try {
        const d = await(await request('/inventory')).json();
        inventoryCache = d; 
        
        const types = [...new Set(d.map(i => i.type).filter(t => t))].sort();
        
        const typeSelect = document.getElementById('rt_type');
        if(typeSelect) {
            typeSelect.innerHTML = '<option value="">Selecione o Tipo...</option>' + 
                                   types.map(t => `<option value="${t}">${t}</option>`).join('');
        }
    } catch (e) {
        console.error("Erro ao carregar tipos:", e);
    }
    loadRequestsTable();
}

export function filterModelsByType() {
    const selectedType = document.getElementById('rt_type').value;
    const modelSelect = document.getElementById('rm');
    
    modelSelect.innerHTML = '<option value="">Selecione o Modelo...</option>';
    modelSelect.disabled = true;

    if (!selectedType) return;

    const itemsOfType = inventoryCache.filter(i => i.type === selectedType);
    const uniqueModels = [...new Set(itemsOfType.map(i => i.model).filter(m => m))].sort();

    if (uniqueModels.length > 0) {
        modelSelect.innerHTML += uniqueModels.map(m => `<option value="${m}">${m}</option>`).join('');
        modelSelect.disabled = false;
    } else {
        modelSelect.innerHTML = '<option value="">Nenhum modelo cadastrado</option>';
    }
}

// --------------------------------------------------------------------------
// 4. ENVIO E LISTAGEM
// --------------------------------------------------------------------------

async function loadRequestsTable() {
    const d = await(await request('/requests/pending')).json();
    const user = getCurrentUser();
    const isAnalyst = user.role !== 'solicitante';
    
    let h = '<div class="table-responsive"><table class="table table-striped align-middle table-hover shadow-sm"><thead><tr class="table-dark"><th>Chamado</th><th>Usuário</th><th>Modelo</th><th>Setor</th><th>Status</th><th>Ação</th></tr></thead><tbody>';
    
    if (d.length === 0) h += '<tr><td colspan="6" class="text-center p-3">Nenhuma solicitação pendente.</td></tr>';

    d.forEach(r => {
        let btn = '';
        if(r.status === 'Pending' && isAnalyst) {
            btn = `<button class="btn btn-sm btn-primary" onclick="window.openFulfillModal(${r.id}, '${r.CHAMADO_number}', '${r.requested_model}')"><i class="fas fa-box-open"></i> Atender</button>`;
        } else if(r.status === 'Ready' && isAnalyst) {
            btn = `<button class="btn btn-sm btn-success" onclick="window.appFn.deliver(${r.id})"><i class="fas fa-check"></i> Entregar</button>`;
        } else if(r.status === 'Ready') {
            btn = `<span class="badge bg-success">Aguardando Retirada</span>`;
        } else {
            btn = `<span class="badge bg-secondary">Aguardando</span>`;
        }
        
        h += `<tr>
            <td class="fw-bold text-primary">${r.CHAMADO_number}</td>
            <td>${r.end_user_name}</td>
            <td>${r.requested_model}</td>
            <td>${r.destination_sector || '-'}</td>
            <td><span class="badge bg-${r.status==='Pending'?'warning':'success'}">${r.status}</span></td>
            <td>${btn}</td>
        </tr>`;
    });
    const el = document.getElementById('rt');
    if(el) el.innerHTML = h + '</tbody></table></div>';
}

export async function sendReq(e) {
    if(e) e.preventDefault();
    
    // Coleta dados do cabeçalho
    const chamado = document.getElementById('rn').value.trim();
    const usuario = document.getElementById('reu').value.trim();
    const setor = document.getElementById('rds').value.trim();
    const obs = document.getElementById('rob').value.trim();

    // Validações
    if (!chamado) { alert("O campo Chamado GLPI é OBRIGATÓRIO."); return; }
    if (!usuario) { alert("Informe o nome do usuário final."); return; }
    if (requestItemsList.length === 0) { alert("Adicione pelo menos um item à lista."); return; }

    try {
        // Envia uma requisição para cada item da lista (Loop)
        // Isso garante que cada modelo fique registrado individualmente no banco
        for (const item of requestItemsList) {
            await request('/requests', 'POST', {
                CHAMADO_number: chamado,
                end_user_name: usuario,
                requested_model: item.model,
                quantity: item.qty,
                destination_sector: setor,
                observation: obs
            });
        }

        alert('Solicitação Múltipla Enviada com Sucesso!');
        requestPage(); // Recarrega a página limpa

    } catch (err) {
        console.error(err);
        alert("Erro ao enviar solicitação.");
    }
}

export async function myRequests() {
    const d = await(await request('/requests/my')).json();
    document.getElementById('content').innerHTML = `
    <h2>Meus Pedidos</h2>
    <div class="table-responsive">
        <table class="table table-hover shadow-sm">
            <thead class="table-light"><tr><th>Chamado</th><th>Modelo</th><th>Status</th></tr></thead>
            <tbody>
            ${d.map(r=>`<tr><td>${r.CHAMADO_number}</td><td>${r.requested_model}</td><td><span class="badge bg-${r.status==='Pending'?'warning':(r.status==='Ready'?'success':'secondary')}">${r.status}</span></td></tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

// --------------------------------------------------------------------------
// 5. LÓGICA DO MODAL DE ATENDIMENTO (BATCH)
// --------------------------------------------------------------------------

export function openFulfillModal(reqId, chamado, model) {
    currentRequestId = reqId;
    currentBatch = [];
    
    const title = document.getElementById('modalTitle');
    const modelLabel = document.getElementById('modalModel');

    if (!title) {
        console.error("Modal não encontrado no HTML");
        alert("Erro de interface: Recarregue a página (F5)");
        return;
    }

    title.innerText = `Atendendo: ${chamado}`;
    modelLabel.innerText = `Modelo Solicitado: ${model}`;
    
    document.getElementById('itemSearchInput').value = '';
    document.getElementById('searchResultArea').innerHTML = '';
    
    const el = document.getElementById('fulfillModal');
    const modal = new bootstrap.Modal(el);
    modal.show();
    
    el.addEventListener('hidden.bs.modal', () => {
        currentBatch = [];
        updateBatchTable();
    }, {once:true});
    
    updateBatchTable();
}

export async function searchItem() {
    const q = document.getElementById('itemSearchInput').value.trim();
    const resDiv = document.getElementById('searchResultArea');
    const btnAdd = document.getElementById('btnAddItem');

    if (!q) { alert("Digite algo!"); return; }

    try {
        const res = await request(`/inventory/search-available?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (data.found) {
            const i = data.item;
            resDiv.innerHTML = `
                <div class="alert alert-success mt-2">
                    <strong>Encontrado:</strong> ${i.model} <br>
                    Serial: ${i.serial_number} | Tag: ${i.tag||'-'} | Tomb: ${i.tombamento||'-'}
                </div>`;
            btnAdd.disabled = false;
            btnAdd.onclick = () => window.addItemToBatch(i);
        } else {
            resDiv.innerHTML = `<div class="alert alert-danger mt-2">${data.message}</div>`;
            btnAdd.disabled = true;
        }
    } catch(e) { console.error(e); }
}

export function addItemToBatch(item) {
    if (currentBatch.find(i => i.serial_number === item.serial_number)) {
        alert("Já adicionado!"); return;
    }
    
    currentBatch.push({
        request_id: currentRequestId,
        serial_number: item.serial_number,
        model: item.model,
        tag: item.tag
    });
    
    document.getElementById('itemSearchInput').value = '';
    document.getElementById('searchResultArea').innerHTML = '';
    document.getElementById('btnAddItem').disabled = true;
    document.getElementById('itemSearchInput').focus();
    
    updateBatchTable();
}

export function updateBatchTable() {
    const tbody = document.querySelector('#batchTable tbody');
    tbody.innerHTML = '';
    currentBatch.forEach((item, idx) => {
        tbody.innerHTML += `
            <tr>
                <td>${item.model}</td>
                <td>${item.serial_number}</td>
                <td>${item.tag||'-'}</td>
                <td><button class="btn btn-danger btn-sm" onclick="window.removeItem(${idx})">X</button></td>
            </tr>`;
    });
    document.getElementById('btnFinishBatch').disabled = currentBatch.length === 0;
}

export function removeItem(idx) {
    currentBatch.splice(idx, 1);
    updateBatchTable();
}

export async function finishBatch() {
    const btn = document.getElementById('btnFinishBatch');
    btn.disabled = true; btn.innerText = "Processando...";

    try {
        const res = await request('/requests/fulfill-batch', 'POST', {
            allocations: currentBatch,
            send_email: document.getElementById('checkSendEmail').checked
        });
        const data = await res.json();
        
        if(res.ok) {
            alert(data.message);
            const el = document.getElementById('fulfillModal');
            const modal = bootstrap.Modal.getInstance(el);
            modal.hide();
            loadRequestsTable();
        } else {
            alert("Erro: " + data.message);
        }
    } catch(e) {
        alert("Erro de conexão");
    } finally {
        btn.disabled = false; btn.innerText = "Finalizar";
    }
}