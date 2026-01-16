import { request } from '../api.js';

// Entry point da tela de usuários
export function users() { 
    document.getElementById('content').innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2>Gerenciamento de Usuários</h2>
            <button class="btn btn-primary" onclick="window.appFn.openUserModal()">+ Novo Usuário</button>
        </div>
        <div id="ulist" class="table-responsive"></div>
        
        <div id="userModalContainer"></div>
    `; 
    fetchUsers(); 
}

async function fetchUsers() { 
    try {
        const u = await(await request('/users')).json(); 
        let h = `
        <table class="table table-hover table-bordered">
            <thead class="table-light">
                <tr>
                    <th>Nome</th>
                    <th>Login</th>
                    <th>Grupo</th>
                    <th>Email / Celular</th>
                    <th class="text-center">Ações</th>
                </tr>
            </thead>
            <tbody>`;
            
        u.forEach(x => {
            const fullName = `${x.first_name || ''} ${x.last_name || ''}`.trim() || '-';
            const contact = `${x.email || '-'} <br> <small>${x.cellphone || ''}</small>`;
            h += `
            <tr>
                <td>${fullName}</td>
                <td><strong>${x.username}</strong></td>
                <td><span class="badge bg-secondary">${x.role}</span></td>
                <td>${contact}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-warning" title="Mudar Grupo" onclick="window.appFn.changeRole(${x.id}, '${x.role}')"><i class="bi bi-people"></i> Role</button>
                    <button class="btn btn-sm btn-outline-danger" title="Resetar Senha" onclick="window.appFn.resetPass(${x.id})"><i class="bi bi-key"></i> Reset</button>
                    <button class="btn btn-sm btn-danger" title="Excluir" onclick="window.appFn.deleteUser(${x.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        });
        document.getElementById('ulist').innerHTML = h + '</tbody></table>'; 
    } catch (e) { console.error(e); }
}

// Abre Modal de Criação
export function openUserModal() {
    const modalHtml = `
    <div class="modal fade show" style="display:block; background:rgba(0,0,0,0.5)" id="uModal">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Novo Usuário</h5>
                    <button type="button" class="btn-close" onclick="document.getElementById('uModal').remove()"></button>
                </div>
                <div class="modal-body">
                    <form id="formNewUser">
                        <div class="row g-2">
                            <div class="col-6"><input class="form-control" name="first_name" placeholder="Nome" required></div>
                            <div class="col-6"><input class="form-control" name="last_name" placeholder="Sobrenome"></div>
                            <div class="col-12"><input class="form-control" name="username" placeholder="Login (Usuário)" required></div>
                            <div class="col-12"><input type="email" class="form-control" name="email" placeholder="Email"></div>
                            <div class="col-12"><input class="form-control" name="cellphone" placeholder="Celular"></div>
                            <div class="col-12">
                                <label>Grupo:</label>
                                <select class="form-select" name="role">
                                    <option value="solicitante">Solicitante</option>
                                    <option value="analista">Analista</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        <div class="alert alert-info mt-3 py-1"><small>Senha padrão: <b>fluxo-gste</b></small></div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('uModal').remove()">Cancelar</button>
                    <button class="btn btn-primary" onclick="window.appFn.saveUser()">Salvar</button>
                </div>
            </div>
        </div>
    </div>`;
    document.getElementById('userModalContainer').innerHTML = modalHtml;
}

export async function saveUser() {
    const form = document.getElementById('formNewUser');
    if(!form.checkValidity()) { alert("Preencha os campos obrigatórios"); return; }
    
    const data = Object.fromEntries(new FormData(form));
    
    const res = await request('/users', 'POST', data);
    if(res.ok) {
        document.getElementById('uModal').remove();
        users(); // Reload list
        alert('Usuário criado com sucesso!');
    } else {
        const err = await res.json();
        alert('Erro: ' + err.message);
    }
}

export async function deleteUser(id) {
    if(!confirm("Tem certeza que deseja apagar este usuário?")) return;
    const res = await request(`/users/${id}`, 'DELETE');
    if(res.ok) users();
    else alert("Erro ao apagar");
}

export async function changeRole(id, currentRole) {
    const r = prompt("Novo Grupo (admin/analista/solicitante):", currentRole);
    if(r && r !== currentRole) {
        await request(`/users/${id}`, 'PUT', {role: r});
        users();
    }
}

export async function resetPass(id) {
    if(!confirm("Resetar senha para 'fluxo-gste'? O usuário terá que trocá-la no próximo login.")) return;
    const res = await request(`/users/${id}/reset`, 'POST');
    if(res.ok) alert("Senha resetada.");
}

// --- Lógica de Mudança de Senha Obrigatória ---
// Chame esta função logo após o login ser bem sucedido no seu script principal (ex: main.js ou login.js)
export async function checkForcePasswordChange(userData) {
    if (userData.must_change_password) {
        const newPass = prompt("⚠️ PRIMEIRO ACESSO ou RESET DETECTADO ⚠️\n\nPor favor, defina sua nova senha pessoal:");
        if (newPass) {
            const res = await request('/change-password', 'POST', { password: newPass });
            if (res.ok) {
                alert("Senha atualizada com sucesso! Você pode continuar.");
            } else {
                alert("Erro ao atualizar senha. Tente novamente.");
                window.location.reload(); // Força reload para tentar de novo ou logout
            }
        } else {
            alert("É obrigatório trocar a senha.");
            // Opcional: fazer logout se cancelar
        }
    }
}