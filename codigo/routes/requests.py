import uuid
import pytz
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user, login_required
from flask_mail import Message
from database import db, audit_log
from auth import is_analyst_or_admin

# --- CORREÇÃO DEFINITIVA DO ERRO DE NOME ---
# Mudamos para 'requests_module_v3' para garantir que é ÚNICO no sistema
bp = Blueprint('requests_module_v3', __name__)

def get_now_br():
    tz = pytz.timezone('America/Recife')
    return datetime.now(tz).strftime('%Y-%m-%d %H:%M:%S')

# ---------------------------------------------------------
#  FUNÇÃO DE E-MAIL (AGRUPADO E DETALHADO)
# ---------------------------------------------------------
def send_batch_ready_email(recipient_email, recipient_name, items_list, chamado_number, fulfiller_name):
    mail = current_app.extensions.get('mail')
    if not mail or not recipient_email: return
    
    rows_html = ""
    for item in items_list:
        rows_html += f"""
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:5px; border:1px solid #ddd; font-size:12px">{item['type']}</td>
            <td style="padding:5px; border:1px solid #ddd; font-size:12px">{item['model']}</td>
            <td style="padding:5px; border:1px solid #ddd; font-size:12px">{item['tag']}</td>
            <td style="padding:5px; border:1px solid #ddd; font-size:12px">{item['serial']}</td>
            <td style="padding:5px; border:1px solid #ddd; font-size:12px">{item['tombamento']}</td>
            <td style="padding:5px; border:1px solid #ddd; font-size:12px">{item['end_user']}</td>
            <td style="padding:5px; border:1px solid #ddd; font-size:12px">{item['sector']}</td>
        </tr>"""

    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0d6efd;">Olá, {recipient_name}!</h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #0d6efd; margin-bottom: 20px;">
            <p style="margin: 0;">✅ <b>Status:</b> Equipamentos Separados / Aguardando Retirada</p>
            <p style="margin: 5px 0 0;">👨‍💻 <b>Atendido por:</b> {fulfiller_name}</p>
            <p style="margin: 5px 0 0;">🆔 <b>Chamado Referência:</b> {chamado_number}</p>
        </div>

        <p>Os seguintes itens foram preparados:</p>
        
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
            <thead>
                <tr style="background-color:#0d6efd; color:white;">
                    <th style="padding:8px; border:1px solid #0d6efd">Tipo</th>
                    <th style="padding:8px; border:1px solid #0d6efd">Modelo</th>
                    <th style="padding:8px; border:1px solid #0d6efd">Tag</th>
                    <th style="padding:8px; border:1px solid #0d6efd">Serial</th>
                    <th style="padding:8px; border:1px solid #0d6efd">Tombamento</th>
                    <th style="padding:8px; border:1px solid #0d6efd">Usuário Final</th>
                    <th style="padding:8px; border:1px solid #0d6efd">Setor</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
        
        <br>
        <p style="font-size:12px; color:#666;">Por favor, dirija-se ao setor de estoque para assinar o termo de responsabilidade e retirar os equipamentos.</p>
    </div>
    """
    
    try:
        subject = f"✅ Atendimento Concluído - Chamado {chamado_number}"
        msg = Message(subject, recipients=[recipient_email])
        msg.html = html_body
        mail.send(msg)
    except Exception as e: 
        print(f"❌ Erro ao enviar E-mail: {e}")

# ---------------------------------------------------------
#  ROTAS (CRUD) - ADAPTADAS PARA MYSQL
# ---------------------------------------------------------

@bp.route('/api/requests', methods=['POST'])
@login_required
def create_request():
    d = request.get_json()
    num = d.get('CHAMADO_number')
    if not num: return jsonify({'message': 'Chamado é obrigatório'}), 400
    
    qty = int(d.get('quantity', 1))
    conn = db.get_connection('requests')
    
    for _ in range(qty):
        conn.execute('INSERT INTO requests (CHAMADO_number,end_user_name,requested_model,destination_sector,requester_id,observation) VALUES (%s,%s,%s,%s,%s,%s)',
                     (num, d['end_user_name'], d['requested_model'], d.get("destination_sector",""), current_user.id, d.get('observation','')))
    conn.commit()
    audit_log(current_user.id, 'Request Created', f"ID: {num} (Qtd: {qty})")
    return jsonify({'success': True, 'message': f'Criado {qty} itens.'}), 201

@bp.route('/api/requests/pending', methods=['GET'])
@login_required
def list_pending_requests():
    return jsonify([dict(r) for r in db.get_connection('requests').execute("SELECT * FROM requests WHERE status IN ('Pending','Ready') ORDER BY id ASC").fetchall()])

@bp.route('/api/requests/my', methods=['GET'])
@login_required
def list_my_requests():
    return jsonify([dict(r) for r in db.get_connection('requests').execute("SELECT * FROM requests WHERE requester_id=%s ORDER BY id DESC", (current_user.id,)).fetchall()])


# ---------------------------------------------------------
#  ATENDIMENTO EM LOTE (BATCH)
# ---------------------------------------------------------
@bp.route('/api/requests/fulfill-batch', methods=['POST'])
@is_analyst_or_admin
def fulfill_batch():
    d = request.get_json()
    allocations = d.get('allocations', [])
    should_send_email = d.get('send_email', False)
    
    if not allocations: 
        return jsonify({'message': 'Nenhum item enviado.'}), 400

    conn_inv = db.get_connection('inventory')
    conn_req = db.get_connection('requests')
    conn_usr = db.get_connection('users')
    
    processed = []
    user_data = None
    chamado_ref = None
    now_br = get_now_br()

    for alloc in allocations:
        # Busca Dados
        item = conn_inv.execute('SELECT * FROM inventory WHERE serial_number=%s', (alloc.get('serial_number'),)).fetchone()
        req = conn_req.execute('SELECT * FROM requests WHERE id=%s', (alloc.get('request_id'),)).fetchone()
        
        # Validação
        if not item or item['status'] != 'Available' or not req: 
            continue

        # Dados para Email
        if not chamado_ref: chamado_ref = req['CHAMADO_number']
        
        if not user_data and req['requester_id']:
            u = conn_usr.execute('SELECT * FROM users WHERE id=%s', (req['requester_id'],)).fetchone()
            if u: user_data = dict(u)

        # Atualiza Bancos
        conn_inv.execute('UPDATE inventory SET status="In Use", assigned_request_id=%s, last_updated=%s WHERE id=%s', 
                         (req['id'], now_br, item['id']))
        
        conn_req.execute('UPDATE requests SET status="Ready", assigned_inventory_id=%s WHERE id=%s', 
                         (item['id'], req['id']))
        
        # Adiciona na lista de processados
        processed.append({
            'type': item['type'] or '-',
            'model': item['model'], 
            'serial': item['serial_number'], 
            'tag': item['tag'] or '-',
            'tombamento': item['tombamento'] or '-',
            'end_user': req['end_user_name'],
            'sector': req['destination_sector'] or '-'
        })

    conn_inv.commit()
    conn_req.commit()

    # Envio de E-mail
    if should_send_email and user_data and processed:
        recipient = user_data.get('first_name') or user_data.get('username')
        
        send_batch_ready_email(
            recipient_email=user_data['email'], 
            recipient_name=recipient, 
            items_list=processed, 
            chamado_number=chamado_ref,
            fulfiller_name=current_user.username 
        )

    audit_log(current_user.id, 'Batch Fulfill', f"Atendeu {len(processed)} itens")
    return jsonify({'success': True, 'message': f'{len(processed)} itens processados.'})

# ---------------------------------------------------------
#  ENTREGA (DELIVER) - COM PROTEÇÃO DE FLUXO
# ---------------------------------------------------------
@bp.route('/api/requests/deliver', methods=['POST'])
@is_analyst_or_admin
def deliver_request():
    try:
        d = request.get_json()
        req_id = d.get('request_id')

        conn_req = db.get_connection('requests')
        req = conn_req.execute('SELECT * FROM requests WHERE id=%s', (req_id,)).fetchone()
        
        if not req:
            return jsonify({'message': 'Solicitação não encontrada'}), 404

        conn_inv = db.get_connection('inventory')
        item = conn_inv.execute('SELECT * FROM inventory WHERE id=%s', (req['assigned_inventory_id'],)).fetchone()
        
        conn_usr = db.get_connection('users')
        user_row = conn_usr.execute('SELECT username FROM users WHERE id=%s', (req['requester_id'],)).fetchone()
        requester_name = user_row['username'] if user_row else "Usuário Removido"
        
        # Atualiza Status
        conn_req.execute('UPDATE requests SET status="Completed" WHERE id=%s', (req_id,))
        conn_req.commit()
        
        # Salva no Fluxo (Com valores padrão para evitar erro de None)
        model = item['model'] if item else 'Desconhecido'
        serial = item['serial_number'] if item else 'Desconhecido'
        tomb = item['tombamento'] if item and item['tombamento'] else '-'
        tag = item['tag'] if item and item['tag'] else '-'

        conn_flow = db.get_connection('flow')
        conn_flow.execute('''
            INSERT INTO completed_requests 
            (CHAMADO_number, requester_name, model, serial_number, tombamento, tag, recipient_name, fulfilled_by, completion_date) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            req['CHAMADO_number'], 
            requester_name, 
            model, 
            serial, 
            tomb, 
            tag, 
            req['end_user_name'], 
            current_user.username, 
            get_now_br()
        ))
        conn_flow.commit()
        
        audit_log(current_user.id, 'Deliver', f"Req {req_id} entregue.")
        return jsonify({'success': True})

    except Exception as e:
        print(f"Erro Crítico Deliver: {e}")
        return jsonify({'message': 'Erro ao entregar item.'}), 500