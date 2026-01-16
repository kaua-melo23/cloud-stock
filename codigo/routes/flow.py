import pytz
from datetime import datetime
from flask import Blueprint, jsonify
from flask_login import login_required
from database import db

bp = Blueprint('flow', __name__, url_prefix='/api/flow')

@bp.route('', methods=['GET'])
@login_required
def get_flow_history():
    try:
        conn = db.get_connection('flow')
        # Tenta buscar. Se a tabela não existir, retorna lista vazia (o database.py cria, mas por segurança)
        items = conn.execute("SELECT * FROM completed_requests ORDER BY completion_date DESC").fetchall()
        
        result = []
        for item in items:
            d = dict(item)
            # Formata data para BR
            try:
                dt_str = str(item['completion_date']).split('.')[0] # Remove milissegundos se houver
                dt_obj = datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
                d['completion_date'] = dt_obj.strftime('%d/%m/%Y %H:%M')
            except:
                d['completion_date'] = str(item['completion_date'])
            result.append(d)
            
        return jsonify(result)
    except Exception as e:
        print(f"Erro Flow Route: {e}")
        return jsonify([])