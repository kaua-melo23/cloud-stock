import os
import secrets
import mimetypes
import sys
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_mail import Mail
# Importa o DBManager (que configuramos para usar MySQL/Cloud SQL)
from database import db
from auth import login_manager

# --- IMPORTAÇÃO DE ROTAS (MÓDULOS) ---
from routes import users, inventory, requests as req_routes, audit, flow, wizard, returns
from routes.dashboard import bp as dashboard_bp

# 1. Carrega variáveis de ambiente (.env)
# Isso é CRUCIAL para pegar a senha do Banco no Google Cloud
load_dotenv()

# Verificação de segurança rápida para garantir que o .env foi lido
if not os.getenv('DB_HOST'):
    print("⚠️  AVISO CRÍTICO: Variáveis de banco de dados não encontradas.")
    print("   Certifique-se de que o arquivo .env existe e tem DB_HOST, DB_USER, etc.")

app = Flask(__name__, static_folder='public', template_folder='public')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(16)

# --- Configuração de E-mail ---
try:
    from config.mail import MailConfig
    app.config.from_object(MailConfig)
    mail = Mail(app)
    print("✅ Serviço de E-mail configurado.")
except ImportError:
    print("⚠️  AVISO: config/mail.py não encontrado.")
    mail = None
except Exception as e:
    print(f"❌ Erro ao configurar e-mail: {e}")
    mail = None

# Corrige tipos MIME para evitar erros no Windows/Navegador
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# --- Inicialização do Banco de Dados (Google Cloud SQL) ---
try:
    db.init_app(app) # Registra o fechamento automático da conexão
    
    with app.app_context():
        # Tentamos criar/verificar as tabelas. 
        # Se a conexão com o Google falhar, o erro estoura aqui.
        print("☁️  Conectando ao Google Cloud SQL...")
        db.init_tables() 
        print("✅ Conexão com Banco de Dados estabelecida com sucesso.")

except Exception as e:
    print("\n" + "="*50)
    print("❌ ERRO FATAL DE CONEXÃO COM O BANCO DE DADOS")
    print(f"Detalhe: {e}")
    print("="*50 + "\n")
    # Em produção, talvez você não queira matar o app, mas no laboratório ajuda a ver o erro
    # sys.exit(1) 

login_manager.init_app(app)

# --- Registro de Blueprints (Rotas) ---
app.register_blueprint(users.bp)
app.register_blueprint(inventory.bp)
app.register_blueprint(req_routes.bp)
app.register_blueprint(audit.bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(flow.bp)
app.register_blueprint(wizard.bp)
app.register_blueprint(returns.bp)

# --- Rotas Estáticas / SPA (Frontend) ---
@app.route('/<path:path>')
def serve_static(path):
    full_path = os.path.join(app.static_folder, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        if path.endswith('.js'):
            return send_from_directory(app.static_folder, path, mimetype='application/javascript')
        return send_from_directory(app.static_folder, path)
    
    if not path.startswith('api/'):
        return send_from_directory(app.static_folder, 'index.html')
    
    return "Not Found", 404

@app.route('/')
def serve_home():
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    print("--- SISTEMA INICIADO (Recife/PE) ---")
    # host='0.0.0.0' permite que você acesse pelo IP Público da VM
    app.run(host='0.0.0.0', port=8000, debug=True)