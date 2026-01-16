from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import check_password_hash, generate_password_hash
from database import db, audit_log
from auth import User, is_admin

bp = Blueprint('users', __name__)
DEFAULT_PASS = 'fluxo-gste'

@bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    conn = db.get_connection('users')
    u = conn.execute('SELECT * FROM users WHERE username = %s', (data.get('username'),)).fetchone()
    
    if u and check_password_hash(u['password'], data.get('password')):
        user_obj = User(u['id'], u['username'], u['role'], u['must_change_password'])
        login_user(user_obj)
        audit_log(u['id'], 'Login', 'Entrou no sistema')
        return jsonify({
            'success': True, 
            'user': u['username'], 
            'role': u['role'],
            'must_change_password': bool(u['must_change_password'])
        })
    return jsonify({'message': 'Credenciais inválidas'}), 401

@bp.route('/api/logout', methods=['POST'])
@login_required
def logout(): 
    logout_user()
    return jsonify({'success': True})

@bp.route('/api/current-user')
@login_required
def me(): 
    return jsonify({
        'id': current_user.id, 
        'username': current_user.username, 
        'role': current_user.role,
        'must_change_password': current_user.must_change_password
    })

@bp.route('/api/users', methods=['GET'])
@is_admin
def list_users():
    conn = db.get_connection('users')
    users = conn.execute('SELECT id, username, role, first_name, last_name, email, cellphone FROM users').fetchall()
    return jsonify([dict(u) for u in users])

@bp.route('/api/users', methods=['POST'])
@is_admin
def create():
    d = request.get_json()
    conn = db.get_connection('users')
    if conn.execute('SELECT id FROM users WHERE username = ', (d['username'],)).fetchone(): 
        return jsonify({'message': 'Usuário já existe'}), 400
    
    hashed = generate_password_hash(DEFAULT_PASS)
    conn.execute('''
        INSERT INTO users (username, password, role, first_name, last_name, email, cellphone, must_change_password) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
    ''', (d['username'], hashed, d.get('role', 'solicitante'), d.get('first_name'), d.get('last_name'), d.get('email'), d.get('cellphone')))
    conn.commit()
    audit_log(current_user.id, 'Create User', f"Criou usuário {d['username']}")
    return jsonify({'success': True}), 201

@bp.route('/api/users/<int:uid>', methods=['PUT'])
@is_admin
def update_role(uid):
    d = request.get_json()
    conn = db.get_connection('users')
    target_user = conn.execute('SELECT username FROM users WHERE id=%s', (uid,)).fetchone()
    if not target_user: return jsonify({'message': 'User not found'}), 404
    if (uid == 1 or target_user['username'] == 'admin') and current_user.id != 1:
         return jsonify({'message': 'Admin é imutável'}), 403

    if 'role' in d:
        conn.execute('UPDATE users SET role = %s WHERE id = %s', (d['role'], uid))
    conn.commit()
    return jsonify({'success': True})

@bp.route('/api/users/<int:uid>', methods=['DELETE'])
@is_admin
def delete_user(uid):
    conn = db.get_connection('users')
    target = conn.execute('SELECT username FROM users WHERE id=%s', (uid,)).fetchone()
    if not target or target['username'] == 'admin':
        return jsonify({'message': 'Não pode deletar admin'}), 403

    conn.execute('DELETE FROM users WHERE id = %s', (uid,))
    conn.commit()
    audit_log(current_user.id, 'Delete User', f"Deletou ID {uid}")
    return jsonify({'success': True})

@bp.route('/api/users/<int:uid>/reset', methods=['POST'])
@is_admin
def reset_password(uid):
    conn = db.get_connection('users')
    hashed = generate_password_hash(DEFAULT_PASS)
    conn.execute('UPDATE users SET password = %s, must_change_password = 1 WHERE id = %s', (hashed, uid))
    conn.commit()
    audit_log(current_user.id, 'Reset Password', f"Resetou senha do ID {uid}")
    return jsonify({'success': True})

@bp.route('/api/change-password', methods=['POST'])
@login_required
def change_own_password():
    data = request.get_json()
    new_pass = data.get('password')
    if not new_pass or len(new_pass) < 6: return jsonify({'message': 'Senha muito curta'}), 400
        
    conn = db.get_connection('users')
    hashed = generate_password_hash(new_pass)
    conn.execute('UPDATE users SET password = %s, must_change_password = 0 WHERE id = %s', (hashed, current_user.id))
    conn.commit()
    audit_log(current_user.id, 'Password Change', 'Usuário alterou a própria senha')
    return jsonify({'success': True})