import pytz
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from database import db, audit_log
from auth import is_analyst_or_admin

# --- CORREÇÃO: NOME ÚNICO ALTERADO ---
# Mudamos de 'returns_sys' para 'returns_sys_final' para evitar o erro de duplicidade
bp = Blueprint('returns_sys_final', __name__)

def get_now_br():
    return datetime.now(pytz.timezone('America/Recife')).strftime('%Y-%m-%d %H:%M:%S')

@bp.route('/api/returns/check', methods=['GET'])
@login_required
def check_item_for_return():
    q = request.args.get('q', '').strip()
    if not q: return jsonify({'found': False, 'message': 'Digite algo.'}), 400
    
    conn = db.get_connection('inventory')
    
    # Busca item por Serial, Tag ou Tombamento
    item = conn.execute('''
        SELECT * FROM inventory 
        WHERE (serial_number = %s OR tag = %s OR tombamento = %s)
    ''', (q, q, q)).fetchone()
    
    if not item:
        return jsonify({'found': False, 'message': 'Item não encontrado.'}), 404
    
    if item['status'] == 'Available':
        return jsonify({'found': False, 'message': 'Aviso: Este item já consta como DISPONÍVEL.'}), 400

    # Busca dados prévios
    user_name = ''
    chamado_origem = ''
    sector = ''

    if item['assigned_request_id']:
        try:
            req = db.get_connection('requests').execute(
                'SELECT CHAMADO_number, end_user_name, destination_sector FROM requests WHERE id = %s', 
                (item['assigned_request_id'],)
            ).fetchone()
            if req:
                user_name = req['end_user_name']
                chamado_origem = req['CHAMADO_number']
                sector = req['destination_sector']
        except:
            pass

    return jsonify({
        'found': True,
        'item': {
            'id': item['id'],
            'model': item['model'],
            'serial': item['serial_number'],
            'tag': item['tag'] or '',
            'tombamento': item['tombamento'] or '',
            'status': item['status'],
            'current_user': user_name,
            'origin_chamado': chamado_origem,
            'sector': sector
        }
    })

# --- ROTA DE DEVOLUÇÃO EM LOTE (STATUS INDIVIDUAL) ---
@bp.route('/api/returns/execute-batch', methods=['POST'])
@is_analyst_or_admin
def execute_return_batch():
    d = request.get_json()
    items_data = d.get('items_data', []) 
    chamado_devolucao = d.get('chamado_devolucao', 'SEM CHAMADO')
    notes = d.get('notes', '')
    
    if not items_data: 
        return jsonify({'message': 'Nenhum item enviado.'}), 400

    conn_inv = db.get_connection('inventory')
    conn_flow = db.get_connection('flow')
    now = get_now_br()
    count = 0

    try:
        for item_obj in items_data:
            item_id = item_obj.get('id')
            
            # Status Individual
            new_status = item_obj.get('status', 'Available') 
            
            user_devolveu = item_obj.get('user') or "Não Identificado"
            chamado_origem = item_obj.get('origin') or "N/A"
            setor_origem = item_obj.get('sector') or "N/A"

            item_db = conn_inv.execute('SELECT * FROM inventory WHERE id=%s', (item_id,)).fetchone()
            if not item_db: continue

            # Atualiza Estoque
            conn_inv.execute('''
                UPDATE inventory 
                SET status=%s, assigned_request_id=NULL, last_updated=%s 
                WHERE id=%s
            ''', (new_status, now, item_id))
            
            # Registra no Fluxo (Com o status específico)
            details_text = f"Estoque ({new_status}) | Origem: {chamado_origem} | Setor: {setor_origem} | Obs: {notes}"
            
            conn_flow.execute('''
                INSERT INTO completed_requests 
                (CHAMADO_number, requester_name, model, serial_number, tombamento, tag, recipient_name, fulfilled_by, completion_date, flow_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'Devolução')
            ''', (
                chamado_devolucao,
                user_devolveu,
                item_db['model'], 
                item_db['serial_number'], 
                item_db['tombamento'], 
                item_db['tag'], 
                details_text,
                current_user.username, 
                now
            ))
            count += 1

        conn_inv.commit()
        conn_flow.commit()
        
        audit_log(current_user.id, 'Return Batch', f"Devolveu {count} itens. Chamado Dev: {chamado_devolucao}")
        return jsonify({'success': True, 'message': f'{count} itens devolvidos com status individuais!'})

    except Exception as e:
        return jsonify({'message': f"Erro no processamento: {str(e)}"}), 500