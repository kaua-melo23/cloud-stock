import { request } from './api.js';
import { renderAppLayout, renderLoginUI } from './main.js';

export let currentUser = null;

export async function checkAuth() {
    try {
        const res = await request('/current-user');
        if (res && res.ok) {
            currentUser = await res.json();
            renderAppLayout(currentUser);
        } else {
            renderLoginUI();
        }
    } catch {
        renderLoginUI('<div class="alert alert-warning">Falha de conexão.</div>');
    }
}

export async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const res = await request('/login', 'POST', { username: user, password: pass });
    if (res && res.ok) window.location.reload();
    else {
        const d = res ? await res.json() : { message: 'Erro' };
        renderLoginUI(d.message);
    }
}

export async function handleLogout() {
    await request('/logout', 'POST');
    window.location.reload();
}

export function getCurrentUser() { return currentUser; }