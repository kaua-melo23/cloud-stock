import { request } from '../api.js';
export async function audit() {
    const d = await(await request('/audit')).json();
    let h = '<table class="table table-sm"><thead><tr><th>Data</th><th>User</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>';
    d.logs.forEach(l => h += `<tr><td>${l.timestamp}</td><td>${l.username}</td><td>${l.action}</td><td>${l.details}</td></tr>`);
    document.getElementById('content').innerHTML = `<h2>Auditoria</h2><div class="card p-3">${h}</tbody></table></div>`;
}