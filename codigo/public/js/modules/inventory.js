import { request } from '../api.js';
import { getCurrentUser } from '../auth.js';

let fullInventoryData = [];

// --------------------------------------------------------------------------
// 1. RENDERIZAÇÃO PRINCIPAL (DASHBOARD ESTOQUE)
// --------------------------------------------------------------------------
export async function inventory() {
    const user = getCurrentUser();
    
    // Busca estatísticas e dados
    try {
        const s = await(await request('/stats')).json();
        const d = await(await request('/inventory')).json(); 
        fullInventoryData = d; 

        const isAdmin = user.role === 'admin';
        const total = (s.inventory_kpi.available || 0) + (s.inventory_kpi.in_use || 0) + (s.inventory_kpi.inspection || 0);

        document.getElementById('content').innerHTML = `
        <div class="d-flex justify-content-between mb-3 align-items-center">
            <h2>Gestão de Estoque</h2>
            <div>
                <button class="btn btn-warning me-2" onclick="window.appFn.syncGoogle()">
                    <i class="fas fa-sync"></i> Sync G-Sheets
                </button>
                
                ${isAdmin ? `<button class="btn btn-danger me-2" id="btnBatchDelete" style="display:none;" onclick="window.appFn.deleteBatch()">Apagar Selecionados</button>` : ''}
                <button class="btn btn-success" onclick="document.getElementById('mi').classList.toggle('d-none')"><i class="fas fa-plus"></i> Manual</button>
            </div>
        </div>
        
        <!-- Cards KPI -->
        <div class="row mb-4">
            <div class="col-md-3"><div class="card border-0 shadow-sm bg-light text-dark text-center py-3"><h5>Total</h5><h2>${total}</h2></div></div>
            <div class="col-md-3"><div class="card border-0 shadow-sm bg-success text-white text-center py-3" style="cursor:pointer" onclick="window.appFn.setInventoryFilter('Available')"><h5>Disponíveis</h5><h2>${s.inventory_kpi.available}</h2></div></div>
            <div class="col-md-3"><div class="card border-0 shadow-sm bg-primary text-white text-center py-3"><h5>Disponibilizados</h5><h2>${s.inventory_kpi.in_use}</h2></div></div>
            <div class="col-md-3"><div class="card border-0 shadow-sm bg-warning text-dark text-center py-3" style="cursor:pointer" onclick="window.appFn.setInventoryFilter('Inspection')"><h5>Garantia</h5><h2>${s.inventory_kpi.inspection}</h2></div></div>
        </div>
        
        <!-- Form Cadastro Manual -->
        <div id="mi" class="card p-3 mb-3 d-none bg-light border-0 shadow-sm">
            <h5 class="mb-3">Cadastro Manual</h5>
            <form onsubmit="window.appFn.addManual(event)" class="row g-2">
                <div class="col-md-2"><input id="mt" placeholder="Tipo (Ex: Notebook)" class="form-control" required></div>
                <div class="col-md-3"><input id="mm" placeholder="Modelo" class="form-control" required></div>
                <div class="col-md-2"><input id="ms" placeholder="Serial" class="form-control" required></div>
                <div class="col-md-2"><input id="mtomb" placeholder="Tombamento" class="form-control"></div>
                
                <div class="col-md-3">
                    <select id="mg" class="form-select">
                        <option value="Pendente">GLPI Pendente</option>
                        <option value="Cadastrado">GLPI Cadastrado</option>
                    </select>
                </div>
                <div class="col-md-12 text-end">
                    <button class="btn btn-success"><i class="fas fa-save"></i> Salvar Item</button>
                </div>
            </form>
        </div>
        
        <!-- Filtros -->
        <div class="card p-3 mb-3 border shadow-sm"><div class="row g-2 align-items-center">
            <div class="col-md-3"><input id="is" class="form-control" placeholder="Buscar Serial, Tag, Tombamento..." onkeyup="window.appFn.filterInv()"></div>
            <div class="col-md-3"><select id="it" class="form-select" onchange="window.appFn.filterInv()"><option value="">Todos os Tipos</option></select></div>
            <div class="col-md-3"><select id="im" class="form-select" onchange="window.appFn.filterInv()"><option value="">Todos os Modelos</option></select></div>
            <div class="col-md-3"><select id="ist" class="form-select" onchange="window.appFn.filterInv()"><option value="">Todos os Status</option><option value="Available">Disponível</option><option value="In Use">Disponibilizados</option></select></div>
        </div></div>
        
        <div id="il">Carregando...</div>`;

        // Preenche Dropdowns de Filtro
        const types = [...new Set(d.map(i => i.type).filter(Boolean))].sort(); 
        const tSel = document.getElementById('it'); 
        types.forEach(t => tSel.innerHTML += `<option value="${t}">${t}</option>`);

        const models = [...new Set(d.map(i => i.model).filter(Boolean))].sort(); 
        const mSel = document.getElementById('im'); 
        models.forEach(m => mSel.innerHTML += `<option value="${m}">${m}</option>`);

        renderInvTable(d);

    } catch (e) {
        console.error(e);
        document.getElementById('content').innerHTML = `<div class="alert alert-danger">Erro ao carregar estoque: ${e.message}</div>`;
    }
}

function renderInvTable(d) {
    if(!d || d.length===0) return document.getElementById('il').innerHTML='<div class="alert alert-info">Nenhum item encontrado.</div>';
    
    const isAdmin = getCurrentUser().role === 'admin';
    
    let h = '<div class="table-responsive"><table class="table table-striped align-middle table-sm table-hover"><thead><tr>';
    
    if(isAdmin) h+= '<th width="30"><input type="checkbox" onchange="window.appFn.toggleAll(this)"></th>';
    
    h += `
        <th>Tipo</th>
        <th>Modelo</th>
        <th>Serial</th>
        <th>Tombamento</th>
        <th>Tag</th>
        <th>Status</th>
        <th>GLPI</th>
        <th>Padronizado</th>
        <th>Ação</th>
    </tr></thead><tbody>`;
    
    d.forEach(i => {
        // Cores dos status
        let cls = 'bg-secondary';
        if(i.status === 'Available') cls = 'bg-success'; 
        else if(i.status === 'In Use') cls = 'bg-primary'; 
        else if(i.status === 'Inspection') cls = 'bg-warning';
        else if(i.status === 'Defective') cls = 'bg-danger';
        
        h += `<tr>`; 
        if(isAdmin) h+= `<td><input type="checkbox" class="inv-check" value="${i.id}" onchange="window.appFn.checkSelection()"></td>`;
        
        h += `
            <td>${i.type || '-'}</td>
            <td>${i.model}</td>
            <td class="font-monospace fw-bold">${i.serial_number}</td>
            <td>${i.tombamento || '-'}</td>
            <td>${i.tag || '-'}</td>
            <td><span class="badge ${cls}">${i.status}</span></td>
            <td>${i.glpi_status || '-'}</td>
            <td>${i.standardized || 'Não'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="window.appFn.editItem(${i.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                ${isAdmin ? `<button class="btn btn-sm btn-outline-danger" onclick="window.appFn.deleteItem(${i.id})" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`;
    });
    
    document.getElementById('il').innerHTML = h + '</tbody></table></div>';
}

// --------------------------------------------------------------------------
// 2. SINCRONIZAÇÃO E API
// --------------------------------------------------------------------------

export async function syncGoogle() {
    if(!confirm("Deseja sincronizar o Banco de Dados com a Planilha Google?\n(A versão mais recente de cada item será mantida)")) return;

    const btn = document.querySelector('button[onclick="window.appFn.syncGoogle()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
    btn.disabled = true;

    try {
        const res = await request('/inventory/sync', 'POST');
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            inventory();
        } else {
            alert("Erro: " + data.message);
        }
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --------------------------------------------------------------------------
// 3. HELPERS E CRUD (Filtros, Delete, Manual)
// --------------------------------------------------------------------------

export function setInventoryFilter(s) { 
    document.getElementById('ist').value = s; 
    filterInv(); 
}

export function filterInv() { 
    const term = document.getElementById('is').value.toLowerCase(); 
    const type = document.getElementById('it').value; 
    const model = document.getElementById('im').value; 
    const stat = document.getElementById('ist').value;
    
    const filtered = fullInventoryData.filter(i => {
        const mTerm = (
            (i.model || '') + 
            (i.serial_number || '') + 
            (i.tag || '') + 
            (i.tombamento || '') + 
            (i.type || '')
        ).toLowerCase().includes(term);

        const mType = type ? i.type === type : true;
        const mMod = model ? i.model === model : true;
        const mStat = stat ? i.status === stat : true;
        
        return mTerm && mType && mMod && mStat;
    });

    renderInvTable(filtered);
}

export function toggleAll(s) { 
    document.querySelectorAll('.inv-check').forEach(c => c.checked = s.checked); 
    checkSelection(); 
}

export function checkSelection() { 
    const count = document.querySelectorAll('.inv-check:checked').length;
    const btn = document.getElementById('btnBatchDelete');
    if(btn) btn.style.display = count > 0 ? 'inline-block' : 'none'; 
}

export async function addManual(e) { 
    e.preventDefault(); 
    
    const payload = {
        type: document.getElementById('mt').value, 
        model: document.getElementById('mm').value, 
        serial_number: document.getElementById('ms').value,
        tombamento: document.getElementById('mtomb').value, 
        glpi_status: document.getElementById('mg').value,
        standardized: 'Não', 
        status: 'Available'
    };

    try {
        await request('/inventory/manual', 'POST', payload); 
        inventory(); 
    } catch(err) {
        alert("Erro ao salvar: " + err.message);
    }
}

export function editItem(id) {
    const i = fullInventoryData.find(x => x.id === id);
    if(!i) return;
    
    const old = document.getElementById('em'); if(old) old.remove();

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal fade" id="em">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header"><h5>Editar Item</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <input type="hidden" id="eid" value="${i.id}">
                    <label>Tipo:</label><input id="et" class="form-control mb-2" value="${i.type || ''}">
                    <label>Modelo:</label><input id="emod" class="form-control mb-2" value="${i.model}">
                    <label>Serial:</label><input id="es" class="form-control mb-2" value="${i.serial_number}">
                    <label>Tombamento:</label><input id="etomb" class="form-control mb-2" value="${i.tombamento || ''}">
                    <label>Status:</label>
                    <select id="est" class="form-select mb-2">
                        <option value="Available">Disponível</option>
                        <option value="In Use">Disponibilizado</option>
                        <option value="Inspection">Garantia/Inspeção</option>
                        <option value="Defective">Defeito</option>
                    </select>
                    <label>GLPI:</label>
                    <select id="eg" class="form-select mb-2">
                        <option value="Pendente">Pendente</option>
                        <option value="Cadastrado">Cadastrado</option>
                    </select>
                    <label>Padronizado:</label>
                    <select id="ep" class="form-select">
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="window.appFn.saveEdit()">Salvar Alterações</button>
                </div>
            </div>
        </div>
    </div>`);
    
    document.getElementById('est').value = i.status; 
    document.getElementById('eg').value = i.glpi_status || 'Pendente'; 
    document.getElementById('ep').value = i.standardized || 'Não';
    
    new bootstrap.Modal(document.getElementById('em')).show();
}

export async function saveEdit() { 
    const id = document.getElementById('eid').value;
    const payload = {
        type: document.getElementById('et').value, 
        model: document.getElementById('emod').value, 
        serial_number: document.getElementById('es').value, 
        tombamento: document.getElementById('etomb').value,
        status: document.getElementById('est').value, 
        glpi_status: document.getElementById('eg').value, 
        standardized: document.getElementById('ep').value
    };

    try {
        await request(`/inventory/${id}`, 'PUT', payload); 
        location.reload(); 
    } catch(err) {
        alert("Erro ao editar: " + err.message);
    }
}

export async function deleteItem(id) { 
    if(confirm('Tem certeza que deseja APAGAR este item?')) { 
        await request(`/inventory/${id}`, 'DELETE'); 
        inventory(); 
    } 
}

export async function deleteBatch() { 
    const ids = [...document.querySelectorAll('.inv-check:checked')].map(c => c.value); 
    if(ids.length > 0 && confirm(`Apagar ${ids.length} itens selecionados?`)) { 
        await request('/inventory/batch-delete', 'POST', {ids}); 
        inventory(); 
    } 
}

export async function trace(sn) { 
    try {
        const d = await(await request(`/inventory/trace/${sn}`)).json(); 
        if(d.logs && d.logs.length > 0) {
            alert(d.logs.map(l => `${l.timestamp}: ${l.action}`).join('\n')); 
        } else {
            alert("Sem histórico para este item.");
        }
    } catch(e) {
        console.error(e);
    }
}