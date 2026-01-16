from flask import Blueprint, jsonify
from flask_login import login_required
from database import db

bp = Blueprint('dashboard', __name__)

@bp.route('/api/dashboard', methods=['GET'])
@login_required
def dashboard_data():
    conn_req = db.get_connection('requests')

    # KPIs (Contagem Geral)
    kpi = conn_req.execute("""
        SELECT
            SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status='Ready' THEN 1 ELSE 0 END) AS ready,
            SUM(CASE WHEN status='Delivered' OR status='Completed' THEN 1 ELSE 0 END) AS completed
        FROM requests;
    """).fetchone()

    # --- LÓGICA DE AGRUPAMENTO POR CHAMADO (Python) ---
    # Buscamos os itens ordenados por Chamado
    rows = conn_req.execute("""
        SELECT 
            id, 
            CHAMADO_number,
            requester_id,
            end_user_name AS destinatario,
            requested_model,
            destination_sector AS setor_destino,
            status,
            observation
        FROM requests
        WHERE status IN ('Pending', 'Ready')
        ORDER BY CHAMADO_number ASC, id ASC
    """).fetchall()
    
    # Dicionário para agrupar: Chave = (Chamado, Status)
    grouped_map = {}
    
    for r in rows:
        key = (r['CHAMADO_number'], r['status'])
        
        if key not in grouped_map:
            grouped_map[key] = {
                'id': r['id'], # ID de referência (o primeiro)
                'CHAMADO_number': r['CHAMADO_number'],
                'requester_id': r['requester_id'],
                'destinatario': r['destinatario'],
                'setor_destino': r['setor_destino'],
                'status': r['status'],
                'observation': r['observation'],
                'models_counter': {}, # Para contar: {'Notebook': 2, 'Monitor': 1}
                'qtd': 0
            }
        
        # Incrementa contadores
        group = grouped_map[key]
        model = r['requested_model']
        group['models_counter'][model] = group['models_counter'].get(model, 0) + 1
        group['qtd'] += 1

    # Transforma o mapa em lista e formata a string de modelos
    queue_data = []
    for group in grouped_map.values():
        # Cria string ex: "Notebook (2), Monitor (1)"
        models_str = ", ".join([f"{m} ({c})" for m, c in group['models_counter'].items()])
        group['requested_model'] = models_str
        
        # Limpa campo auxiliar
        del group['models_counter']
        queue_data.append(group)

    # --- BUSCA NOMES DOS USUÁRIOS ---
    requester_ids = set(i['requester_id'] for i in queue_data if i['requester_id'])
    user_map = {}
    
    if requester_ids:
        conn_usr = db.get_connection('users')
        # Queries com IN devem ser seguras
        placeholders = ','.join('?' for _ in requester_ids)
        users = conn_usr.execute(f"SELECT id, username FROM users WHERE id IN ({placeholders})", tuple(requester_ids)).fetchall()
        user_map = {u['id']: u['username'] for u in users}

    # Mescla nome do usuário
    for item in queue_data:
        item['solicitante'] = user_map.get(item.get('requester_id'), 'Desconhecido')

    return jsonify({
        "kpi": {k: (v or 0) for k, v in dict(kpi).items()},
        "queue": queue_data
    })