import os
import secrets
import mimetypes
import sys
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_mail import Mail

# Banco de Dados + Login
from database import db
from auth import login_manager

# Rotas
from routes import users, inventory, requests as req_routes, audit, flow, wizard, returns
from routes.dashboard import bp as dashboard_bp

# ----------------------------------------------------------------
# 1. Carregar variáveis .env
# ----------------------------------------------------------------
load_dotenv()

REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME']

missing = [v for v in REQUIRED_ENV if not os.getenv(v)]
if missing:
    print("\n" + "="*60)
    print("⚠️  AVISO CRÍTICO: Variáveis de DB ausentes no .env")
    print("Faltando:", ", ".join(missing))
    print("Sem isso o banco não conecta!")
    print("="*60 + "\n")

# ----------------------------------------------------------------
# 2. Inicializar Flask
# ----------------------------------------------------------------
app = Flask(__name__, static_folder='public', template_folder='public')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or secrets.token_hex(16)

# ----------------------------------------------------------------
# 3. Email (Opcional)
# ----------------------------------------------------------------
try:
    from config.mail import MailConfig
    app.config.from_object(MailConfig)
    mail = Mail(app)
    print("📧 E-mail configurado com sucesso.")
except Exception as e:
    print(f"⚠️  Serviço de e-mail não ativo: {e}")
    mail = None

# ----------------------------------------------------------------
# 4. Correções MIME (JS/CSS)
# ----------------------------------------------------------------
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# ----------------------------------------------------------------
# 5. Banco de Dados (Google Cloud SQL)
# ----------------------------------------------------------------
try:
    db.init_app(app)

    with app.app_context():
        print("☁️  Tentando conectar e sincronizar tabelas no Cloud SQL...")
        db.init_tables()
        print("✅ Banco conectado e tabelas sincronizadas.")
except Exception as e:
    print("\n" + "="*60)
    print("❌ ERRO FATAL: FALHA AO CONECTAR NO BANCO DE DADOS")
    print(f"Detalhe: {e}")
    print("="*60 + "\n")
    # Aqui NÃO damos sys.exit() para não matar o app
    # Em produção faz sentido manter rodando
    pass

# ----------------------------------------------------------------
# 6. Login Manager
# ----------------------------------------------------------------
login_manager.init_app(app)

# ----------------------------------------------------------------
# 7. Registrar Blueprints
# ----------------------------------------------------------------
app.register_blueprint(users.bp)
app.register_blueprint(inventory.bp)
app.register_blueprint(req_routes.bp)
app.register_blueprint(audit.bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(flow.bp)
app.register_blueprint(wizard.bp)
app.register_blueprint(returns.bp)

# ----------------------------------------------------------------
# 8. Rotas estáticas (Front SPA)
# ----------------------------------------------------------------
@app.route('/<path:path>')
def serve_static(path):
    full_path = os.path.join(app.static_folder, path)

    if os.path.exists(full_path) and os.path.isfile(full_path):
        if path.endswith('.js'):
            return send_from_directory(app.static_folder, path, mimetype='application/javascript')
        return send_from_directory(app.static_folder, path)

    # Redireciona para frontend SPA caso não seja API
    if not path.startswith('api/'):
        return send_from_directory(app.static_folder, 'index.html')

    return "Not Found", 404


@app.route('/')
def serve_home():
    return send_from_directory(app.static_folder, 'index.html')


# ----------------------------------------------------------------
# 9. Inicialização da Aplicação
# ----------------------------------------------------------------
if __name__ == '__main__':
    print("--- SISTEMA INICIADO ---")
    print("Local: Recife/PE\n")
    app.run(host='0.0.0.0', port=8000, debug=True)
