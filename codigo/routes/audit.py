from flask import Blueprint, jsonify, request
from flask_login import login_required
from database import db
from auth import is_admin

bp = Blueprint('audit', __name__)

@bp.route('/api/audit', methods=['GET'])
@is_admin
def list_logs():
    uid, act, start, end = request.args.get('user_id'), request.args.get('action'), request.args.get('start_date'), request.args.get('end_date')
    
    conn_logs = db.get_connection('logs')
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = []
    if uid: query += " AND user_id=?"; params.append(uid)
    if act: query += " AND action LIKE ?"; params.append(f"%{act}%")
    if start: query += " AND date(timestamp)>=?"; params.append(start)
    if end: query += " AND date(timestamp)<=?"; params.append(end)
    query += " ORDER BY timestamp DESC"
    
    logs = conn_logs.execute(query, params).fetchall()
    actions = conn_logs.execute("SELECT DISTINCT action FROM audit_logs").fetchall()

    conn_usr = db.get_connection('users')
    users = conn_usr.execute("SELECT id, username FROM users").fetchall()
    user_map = {u['id']: u['username'] for u in users}

    final_logs = []
    for l in logs:
        d = dict(l)
        d['username'] = user_map.get(d['user_id'], 'Ex-Usuário')
        final_logs.append(d)

    return jsonify({'logs': final_logs, 'users': [dict(u) for u in users], 'actions': [a['action'] for a in actions]})

@bp.route('/api/stats', methods=['GET'])
@login_required
def stats():
    c_req = db.get_connection('requests')
    req = {r['status']:r['count'] for r in c_req.execute("SELECT status, COUNT(*) as count FROM requests GROUP BY status").fetchall()}
    
    c_inv = db.get_connection('inventory')
    inv = {r['status']:r['count'] for r in c_inv.execute("SELECT status, COUNT(*) as count FROM inventory GROUP BY status").fetchall()}
    
    return jsonify({
        'requests': {'pending': req.get('Pending',0), 'ready': req.get('Ready',0), 'completed': req.get('Completed',0)},
        'inventory_kpi': {'available': inv.get('Available',0), 'in_use': inv.get('In Use',0), 'inspection': inv.get('Inspection',0)}
    })