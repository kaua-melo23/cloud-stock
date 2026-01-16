import { request } from '../api.js';

let wizState = { 
    mode: null, id: '', sheetName: '', headers: [], 
    columnMap: {}, valueMap: {}, valueMapQueue: [], 
    currentField: null, fixedType: null
};

const REQUIRED_COLS = [
    { key: 'serial_number', label: 'Serial (Obrigatório)' },
    { key: 'model', label: 'Modelo' },
    { key: 'tag', label: 'Tag' },
    { key: 'tombamento', label: 'Tombamento' },
    { key: 'status', label: 'Status (De-Para)' },
    { key: 'glpi_status', label: 'Cadastrado GLPI (De-Para)' },
    { key: 'standardized', label: 'Padronizado (De-Para)' }
];

export function renderWizard() {
    wizState = { mode: null, id: '', sheetName: '', headers: [], columnMap: {}, valueMap: {}, valueMapQueue: [], currentField: null, fixedType: null };
    document.getElementById('content').innerHTML = `
        <div class="container">
            <h2 class="mb-4">Assistente de Importação</h2>
            <div class="card shadow-sm"><div class="card-body" id="wiz-body">${renderStep0()}</div></div>
        </div>`;
}

export function wizBack() { renderWizard(); }

function renderStep0() {
    return `
        <div class="row g-4 text-center py-4">
            <div class="col-md-6"><div class="card h-100 border-primary p-4 hover-card" style="cursor:pointer" onclick="window.appFn.wizInit('link')">
                <i class="fas fa-link fa-3x text-primary mb-3"></i><h5>Google Sheets</h5>
            </div></div>
            <div class="col-md-6"><div class="card h-100 border-success p-4 hover-card" style="cursor:pointer" onclick="window.appFn.wizInit('file')">
                <i class="fas fa-file-excel fa-3x text-success mb-3"></i><h5>Arquivo Local</h5>
            </div></div>
        </div>`;
}

export function wizInit(mode) {
    wizState.mode = mode;
    const html = mode === 'link' ? `<input id="wizInput" class="form-control mb-3" placeholder="Cole o link aqui">` : `<input type="file" id="wizInput" class="form-control mb-3" accept=".xlsx">`;
    document.getElementById('wiz-body').innerHTML = `<button class="btn btn-sm btn-outline-secondary mb-3" onclick="window.appFn.wizBack()">Voltar</button><h4>1. Fonte de Dados</h4>${html}<button class="btn btn-primary" onclick="window.appFn.wizAnalyze()">Continuar</button>`;
}

export async function wizAnalyze() {
    const input = document.getElementById('wizInput');
    const fd = new FormData();
    let payload = {};

    if (wizState.mode === 'file') {
        if (!input.files[0]) return alert("Selecione um arquivo");
        fd.append('file', input.files[0]);
    } else {
        if (!input.value) return alert("Cole o link");
        payload = { url: input.value };
    }

    setLoading(true, "Analisando...");
    try {
        const res = wizState.mode === 'file' ? await request('/wizard/analyze', 'POST', fd) : await request('/wizard/analyze', 'POST', payload);
        const data = await res.json();
        if (res.ok) { wizState.id = data.id; renderSheetSelect(data.sheets); } 
        else alert(data.message);
    } catch (e) { alert("Erro de comunicação."); }
    setLoading(false);
}

function renderSheetSelect(sheets) {
    const opts = sheets.map(s => `<option value="${s}">${s}</option>`).join("");
    document.getElementById('wiz-body').innerHTML = `<button class="btn btn-sm btn-outline-secondary mb-3" onclick="window.appFn.wizBack()">Voltar</button><h4>2. Selecione a aba</h4><select id="wizSheet" class="form-select mb-3">${opts}</select><button class="btn btn-primary" onclick="window.appFn.wizFetchHeaders()">Próximo</button>`;
}

export async function wizFetchHeaders() {
    wizState.sheetName = document.getElementById('wizSheet').value;
    setLoading(true);
    const res = await request('/wizard/headers', 'POST', { mode: wizState.mode, id: wizState.id, sheet_name: wizState.sheetName });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { wizState.headers = data.headers; renderColumnMapping(); } else alert(data.message);
}

function renderColumnMapping() {
    let html = `<button class="btn btn-sm btn-outline-secondary mb-3" onclick="window.appFn.wizBack()">Voltar</button><h4>3. Mapear Colunas</h4>`;
    let colOptions = `<option value="">(Ignorar)</option>`;
    wizState.headers.forEach((h, i) => colOptions += `<option value="${i}">${h}</option>`);

    html += `<div class="card p-3 mb-3 bg-light border-primary"><label class="fw-bold text-primary mb-2">Definição do Tipo:</label><div class="row g-2">
    <div class="col-md-6"><label class="small text-muted">Por coluna</label><select id="map_col_type" class="form-select form-select-sm" onchange="window.appFn.toggleFixedType(this)">${colOptions}</select></div>
    <div class="col-md-6"><label class="small text-muted">Ou valor fixo</label><select id="fixed_type" class="form-select form-select-sm border-success"><option value="">-- Escolha --</option><option value="NOTEBOOK">Notebook</option><option value="DESKTOP">Desktop</option><option value="MONITOR">Monitor</option><option value="IMPRESSORA">Impressora</option><option value="OUTRO">Outro</option></select></div></div></div>`;

    REQUIRED_COLS.forEach(field => {
        const guess = wizState.headers.findIndex(h => h.toLowerCase().includes(field.key.split('_')[0]));
        let opts = `<option value="">(Ignorar)</option>`;
        wizState.headers.forEach((h, i) => opts += `<option value="${i}" ${i === guess ? 'selected' : ''}>${h}</option>`);
        html += `<div class="row mb-2 align-items-center"><div class="col-4 text-end fw-bold small">${field.label}</div><div class="col-8"><select id="map_col_${field.key}" class="form-select form-select-sm">${opts}</select></div></div>`;
    });
    document.getElementById("wiz-body").innerHTML = html + `<button class="btn btn-primary w-100 mt-3" onclick="window.appFn.wizPrepareValueMap()">Próximo</button>`;
}

export function toggleFixedType(select) {
    const fixedSelect = document.getElementById('fixed_type');
    if (select.value !== "") { fixedSelect.value = ""; fixedSelect.disabled = true; } 
    else { fixedSelect.disabled = false; }
}

export async function wizPrepareValueMap() {
    const colMap = {};
    REQUIRED_COLS.forEach(f => colMap[f.key] = document.getElementById(`map_col_${f.key}`).value);
    if (!colMap.serial_number) return alert("Defina a coluna do Serial.");
    
    const typeCol = document.getElementById('map_col_type').value;
    const typeFix = document.getElementById('fixed_type').value;
    if (!typeCol && !typeFix) return alert("Defina o TIPO.");
    
    colMap["type"] = typeCol;
    wizState.fixedType = typeCol ? null : typeFix;
    wizState.columnMap = colMap;
    wizState.valueMapQueue = ['status', 'glpi_status', 'standardized'].filter(k => colMap[k] !== "");
    
    if (wizState.valueMapQueue.length > 0) wizNextValueMap(); else wizExecute();
}

async function wizNextValueMap() {
    const fieldKey = wizState.valueMapQueue.shift();
    if (!fieldKey) return wizExecute();
    wizState.currentField = fieldKey;
    const label = REQUIRED_COLS.find(f => f.key === fieldKey).label;
    
    setLoading(true, `Analisando: ${label}`);
    
    try {
        const res = await request('/wizard/unique-values', 'POST', { 
            mode: wizState.mode, id: wizState.id, 
            sheet_name: wizState.sheetName, column_index: wizState.columnMap[fieldKey] 
        });
        const data = await res.json();
        setLoading(false);

        // CORREÇÃO: Evita erro de forEach se der erro no servidor
        if (!data.values) {
            alert(`Erro ao ler valores da coluna ${label}: ${data.message || 'Erro desconhecido'}`);
            return renderWizard(); // Reseta
        }

        let targetOpts = '<option value="IGNORE">Ignorar</option>';
        if (fieldKey === 'status') targetOpts = `<option value="Available">Disponível</option><option value="In Use">Em Uso</option><option value="Inspection">Garantia</option>` + targetOpts;
        if (fieldKey === 'glpi_status') targetOpts = `<option value="Cadastrado">Cadastrado</option><option value="Pendente">Pendente</option>` + targetOpts;
        if (fieldKey === 'standardized') targetOpts = `<option value="Sim">Sim</option><option value="Não">Não</option>` + targetOpts;

        let rows = '';
        data.values.forEach(val => {
            rows += `<tr><td>${val}</td><td><i class="fas fa-arrow-right"></i></td><td><select class="form-select wiz-val-map" data-orig="${val}">${targetOpts}</select></td></tr>`;
        });
        document.getElementById('wiz-body').innerHTML = `<h4>Mapear: ${label}</h4><div class="table-responsive border rounded p-2 mb-3" style="max-height: 300px; overflow-y: auto;"><table class="table table-sm mb-0"><tbody>${rows}</tbody></table></div><button class="btn btn-success w-100" onclick="window.appFn.wizSaveValueMap()">Confirmar</button>`;
    
    } catch(e) {
        setLoading(false);
        alert("Erro ao buscar valores únicos.");
        console.error(e);
    }
}

export function wizSaveValueMap() {
    const map = {};
    document.querySelectorAll('.wiz-val-map').forEach(sel => map[sel.dataset.orig] = sel.value);
    wizState.valueMap[wizState.currentField] = map;
    wizNextValueMap();
}

export async function wizExecute() {
    setLoading(true, "Importando...");
    const res = await request('/wizard/execute', 'POST', { 
        mode: wizState.mode, id: wizState.id, sheet_name: wizState.sheetName, 
        column_map: wizState.columnMap, value_map: wizState.valueMap, fixed_type: wizState.fixedType 
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
        document.getElementById('wiz-body').innerHTML = `<div class="text-center py-5"><i class="fas fa-check-circle text-success fa-5x mb-3"></i><h3>Concluído!</h3><p>${data.message}</p><button class="btn btn-primary mt-3" onclick="window.appFn.inventory()">Ver Estoque</button></div>`;
    } else alert(data.message);
}

function setLoading(active, txt = '') {
    const body = document.getElementById('wiz-body');
    if (active) body.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary mb-3"></div><h5>${txt}</h5></div>`;
}