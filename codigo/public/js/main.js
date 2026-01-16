import { checkAuth, handleLogin, handleLogout } from './auth.js';
import * as inv from './modules/inventory.js';
import * as req from './modules/requests.js';
import * as aud from './modules/audit.js';
import * as wiz from './modules/import_wizard.js';
import * as flow from './modules/flow.js';
import * as ret from './modules/returns.js'; // Importação das Devoluções

// --- IMPORTAÇÕES DO DASHBOARD ---
import { 
    dashboard, 
    openBulkFulfillScreen, 
    processBulkFulfill, 
    validateRow,
    deliverGroup // <--- NECESSÁRIO para o botão "Concluir" (Entregar Lote)
} from './modules/dashboard.js';

// --- IMPORTAÇÕES DE USUÁRIOS ---
import { 
    users, 
    openUserModal, 
    saveUser, 
    changeRole, 
    deleteUser, 
    resetPass,
    checkForcePasswordChange
} from './modules/users.js';

// -----------------------------------------------------------
//  REGISTRO GLOBAL (Para o HTML encontrar as funções via onclick)
// -----------------------------------------------------------

// Funções do Modal de Atendimento (Batch)
window.openFulfillModal = req.openFulfillModal;
window.searchItem = req.searchItem;
window.addItemToBatch = req.addItemToBatch;
window.removeItem = req.removeItem;
window.finishBatch = req.finishBatch;

// Funções do Carrinho de Solicitação (Requests)
window.addRequestItem = window.addRequestItem || function(){}; 
window.removeRequestItem = window.removeRequestItem || function(){};

const appFn = {
    // Navegação Principal
    dashboard, 

    // --- Dashboard Funcs (Lote e Entrega) ---
    openBulkFulfillScreen,
    processBulkFulfill,
    validateRow,
    deliverGroup, // <--- ADICIONADO AQUI PARA FUNCIONAR O BOTÃO 'CONCLUIR'

    // Módulos Principais
    inventory: inv.inventory,
    users: users, 
    request: req.requestPage,
    myRequests: req.myRequests,
    audit: aud.audit,
    renderWizard: wiz.renderWizard,
    
    // --- Devolução (Returns) ---
    renderReturns: ret.renderReturns,
    checkReturnItem: ret.checkReturnItem,
    executeReturn: ret.executeReturn,

    // Fluxo
    flow: flow.flow,
    loadFlowData: flow.loadFlowData,

    // Request Funcs
    toggleRequestType: req.toggleRequestType,
    filterModelsByType: req.filterModelsByType,
    sendReq: req.sendReq,
    
    // Inventory Funcs
    syncGoogle: inv.syncGoogle,
    toggleAll: inv.toggleAll,
    checkSelection: inv.checkSelection,
    setInventoryFilter: inv.setInventoryFilter,
    filterInv: inv.filterInv,
    addManual: inv.addManual,
    trace: inv.trace,
    editItem: inv.editItem,
    saveEdit: inv.saveEdit,
    deleteItem: inv.deleteItem,
    deleteBatch: inv.deleteBatch,
    
    deliver: req.deliver_request, 
    
    // Wizard Funcs (Importação)
    wizStartLink: wiz.wizStartLink, 
    wizStartFile: wiz.wizStartFile, 
    wizAnalyzeLink: wiz.wizAnalyzeLink,
    wizAnalyzeFile: wiz.wizAnalyzeFile, 
    wizFetchHeaders: wiz.wizFetchHeaders, 
    wizPrepareValueMap: wiz.wizPrepareValueMap,
    wizSaveValueMap: wiz.wizSaveValueMap, 
    wizExecute: wiz.wizExecute, 
    wizBack: wiz.wizBack, 
    wizGetUniqueValues: wiz.wizGetUniqueValues,
    wizInit: wiz.wizInit, 
    wizAnalyze: wiz.wizAnalyze,
    toggleFixedType: wiz.toggleFixedType, // <--- CORREÇÃO: Função necessária para o select do Wizard

    // Audit Funcs
    filterAudit: aud.filterAudit,

    // Users Funcs
    openUserModal,
    saveUser,
    changeRole,
    deleteUser,
    resetPass,

    // Toggle Sidebar
    toggleSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        const content = document.getElementById('content-wrapper');
        if(sidebar && content) {
            sidebar.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        }
    }
};

// Exposição global
window.appFn = appFn;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

export function renderAppLayout(user) {
    const role = user.role;
    checkForcePasswordChange(user);

    const link = (fn, icon, text) => 
        `<li><a href="#" class="nav-link" onclick="${fn}" title="${text}">
            <i class="fas ${icon}"></i> <span class="link-text">${text}</span>
        </a></li>`;

    let menu = link('window.appFn.dashboard()', 'fa-chart-line', 'Dashboard') +
               link('window.appFn.request()', 'fa-plus-circle', 'Solicitar') +
               link('window.appFn.myRequests()', 'fa-list', 'Meus Pedidos');

    if(role !== 'solicitante') {
        menu += link('window.appFn.inventory()', 'fa-boxes', 'Estoque') +
                link('window.appFn.renderReturns()', 'fa-undo', 'Devolução') +
                link('window.appFn.flow()', 'fa-stream', 'Fluxo') +
                link('window.appFn.renderWizard()', 'fa-cloud-upload-alt', 'Importar');
    }

    if(role === 'admin') {
        menu += `<hr class="dropdown-divider bg-light opacity-25 my-2">` +
                link('window.appFn.users()', 'fa-users', 'Usuários') +
                link('window.appFn.audit()', 'fa-history', 'Auditoria');
    }

    document.body.innerHTML = `
    <nav id="sidebar">
        <div class="sidebar-header">
            <span class="sidebar-title fw-bold fs-5">Stock Control</span>
            <button class="btn-toggle-sidebar" onclick="window.appFn.toggleSidebar()">
                <i class="fas fa-bars"></i>
            </button>
        </div>
        <ul class="list-unstyled components">${menu}</ul>
        <div class="sidebar-footer">
            <div class="user-details mb-2 text-white">
                <small>${user.username}</small> <span class="badge bg-secondary ms-1">${role}</span>
            </div>
            <button onclick="handleLogout()" class="btn btn-outline-danger w-100 btn-sm btn-logout" title="Sair">
                <i class="fas fa-sign-out-alt"></i> <span>Sair</span>
            </button>
        </div>
    </nav>
    <div id="content-wrapper"><div id="content"></div></div>`;

    if (role === 'solicitante') appFn.request();
    else appFn.dashboard();
}

export function renderLoginUI(msg='') {
    document.body.innerHTML = `
        <div class="login-wrapper">
            <div class="card p-4 shadow login-card">
                <h3 class="text-center mb-3">Login</h3>
                <p class="text-danger text-center">${msg}</p>
                <form onsubmit="handleLogin(event)">
                    <div class="mb-3"><label>Usuário</label><input id="user" class="form-control" required></div>
                    <div class="mb-3"><label>Senha</label><input type="password" id="pass" class="form-control" required></div>
                    <button class="btn btn-primary w-100">Entrar</button>
                </form>
            </div>
        </div>`;
}