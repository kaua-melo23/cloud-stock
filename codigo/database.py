import os
import sqlalchemy
from sqlalchemy import text
from flask import g
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

# Carrega arquivo .env CORRETO
load_dotenv("acessos.env")

class DBManager:
    def __init__(self):
        # Lê variáveis
        self.db_user = os.getenv('DB_USER')
        self.db_pass = os.getenv('DB_PASS')  # mantém nome original
        self.db_host = os.getenv('DB_HOST')
        self.db_name = os.getenv('DB_NAME')

        # Validação para evitar host=None
        missing_vars = [v for v in ["DB_USER", "DB_PASS", "DB_HOST", "DB_NAME"] if os.getenv(v) is None]
        if missing_vars:
            raise Exception(
                f"Variáveis ausentes no arquivo acessos.env: {', '.join(missing_vars)}\n"
                f"Corrija antes de continuar."
            )

        # Configuração URL MySQL
        self.db_url = (
            f"mysql+pymysql://{self.db_user}:{self.db_pass}"
            f"@{self.db_host}/{self.db_name}?charset=utf8mb4"
        )

        # Engine de conexão (sem alterar funcionalidades)
        self.engine = sqlalchemy.create_engine(
            self.db_url,
            pool_size=10,
            pool_recycle=3600
        )

        # Mantém compatibilidade
        self.DATABASES = ['requests', 'logs', 'inventory', 'users', 'flow', 'dashboard']

    def init_app(self, app):
        app.teardown_appcontext(self.close_connection)

    def get_connection(self, db_key=None):
        if db_key and db_key not in self.DATABASES:
            print(f"Aviso: conexão solicitada para '{db_key}', usando padrão MySQL.")

        if 'db_conn' not in g:
            g.db_conn = self.engine.connect()

        return g.db_conn

    def close_connection(self, exception=None):
        db_conn = g.pop('db_conn', None)
        if db_conn:
            db_conn.close()

    def _ensure_col(self, conn, table, col, dtype):
        try:
            result = conn.execute(text(f"SHOW COLUMNS FROM {table} LIKE '{col}'")).fetchone()
            if not result:
                print(f"🔄 Adicionando coluna '{col}' em '{table}'...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"))
                conn.commit()
        except Exception as e:
            print(f"⚠️ Erro migrando coluna {col} em {table}: {e}")

    def init_tables(self):
        print("🚀 Iniciando sincronização das tabelas...")

        with self.engine.connect() as conn:

            # Users
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) UNIQUE,
                    password VARCHAR(255),
                    role VARCHAR(50) DEFAULT 'solicitante',
                    google_id VARCHAR(255) UNIQUE
                )
            '''))
            user_cols = {
                'first_name': 'VARCHAR(255)',
                'last_name': 'VARCHAR(255)',
                'email': 'VARCHAR(255)',
                'cellphone': 'VARCHAR(20)',
                'must_change_password': 'INT DEFAULT 0'
            }
            for k,v in user_cols.items(): self._ensure_col(conn, 'users', k, v)

            if not conn.execute(text("SELECT id FROM users WHERE username='admin'")).fetchone():
                admin_pass = os.getenv('ADMIN_PASSWORD', 'SEE-gste')
                conn.execute(
                    text("INSERT INTO users (username, password, role, must_change_password) VALUES (:u, :p, :r, 0)"),
                    {'u': 'admin', 'p': generate_password_hash(admin_pass), 'r': 'admin'}
                )
                conn.commit()

            # Inventory
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS inventory (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    type VARCHAR(100),
                    model VARCHAR(100),
                    serial_number VARCHAR(100) UNIQUE,
                    status VARCHAR(50) DEFAULT 'Available'
                )
            '''))
            inv_cols = {
                'tag': 'VARCHAR(100)',
                'tombamento': 'VARCHAR(100)',
                'condition_status': "VARCHAR(50) DEFAULT 'Novo'",
                'glpi_status': "VARCHAR(50) DEFAULT 'Pendente'",
                'standardized': "VARCHAR(10) DEFAULT 'Não'",
                'last_updated': "DATETIME DEFAULT CURRENT_TIMESTAMP",
                'assigned_request_id': 'INT'
            }
            for k,v in inv_cols.items(): self._ensure_col(conn, 'inventory', k, v)

            conn.execute(text("UPDATE inventory SET last_updated = CURRENT_TIMESTAMP WHERE last_updated IS NULL"))
            conn.commit()

            # Requests
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    CHAMADO_number VARCHAR(100),
                    end_user_name VARCHAR(255),
                    requested_model VARCHAR(255),
                    requester_id INT,
                    status VARCHAR(50) DEFAULT 'Pending',
                    assigned_inventory_id INT
                )
            '''))
            self._ensure_col(conn, 'requests', 'destination_sector', 'VARCHAR(255)')
            self._ensure_col(conn, 'requests', 'observation', 'TEXT')

            # Logs
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    action VARCHAR(255),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    details TEXT
                )
            '''))

            # Flow
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS completed_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    CHAMADO_number VARCHAR(100),
                    requester_name VARCHAR(255),
                    model VARCHAR(255),
                    serial_number VARCHAR(100),
                    tombamento VARCHAR(100),
                    tag VARCHAR(100),
                    recipient_name VARCHAR(255),
                    fulfilled_by VARCHAR(255),
                    completion_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            '''))
            self._ensure_col(conn, 'completed_requests', 'flow_type', "VARCHAR(50) DEFAULT 'Saída'")

            conn.commit()
            print("✅ Tabelas sincronizadas com sucesso.")

db = DBManager()

def audit_log(user_id, action, details):
    try:
        conn = db.get_connection()
        conn.execute(
            text('INSERT INTO audit_logs (user_id, action, details) VALUES (:uid, :act, :det)'),
            {'uid': user_id, 'act': action, 'det': details}
        )
        conn.commit()
    except Exception as e:
        print(f"Erro ao salvar log: {e}")
