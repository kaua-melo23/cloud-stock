import os
import sqlalchemy
from sqlalchemy import text
from flask import g
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env
load_dotenv(acessos.env)

class DBManager:
    def __init__(self):
        # Configuração da Conexão Segura
        self.db_user = os.getenv('DB_USER')
        self.db_pass = os.getenv('DB_PASSWORD')
        self.db_host = os.getenv('DB_HOST')
        self.db_name = os.getenv('DB_NAME')
        
        # URL de conexão para MySQL (Google Cloud SQL)
        # O charset=utf8mb4 garante que acentos funcionem corretamente
        self.db_url = f"mysql+pymysql://{self.db_user}:{self.db_pass}@{self.db_host}/{self.db_name}?charset=utf8mb4"

        # Criamos a engine (gerenciador de conexões)
        # pool_recycle evita que o Google derrube a conexão por inatividade
        self.engine = sqlalchemy.create_engine(
            self.db_url,
            pool_size=10,
            pool_recycle=3600
        )

        # Mapeamento mantido para compatibilidade, mas todos apontam para o mesmo banco agora
        self.DATABASES = ['requests', 'logs', 'inventory', 'users', 'flow', 'dashboard']

    def init_app(self, app):
        app.teardown_appcontext(self.close_connection)

    def get_connection(self, db_key=None):
        """
        Retorna a conexão com o banco.
        Aceita db_key apenas para não quebrar chamadas antigas como get_connection('users'),
        mas retorna sempre a conexão principal do MySQL.
        """
        if db_key and db_key not in self.DATABASES:
             # Apenas um aviso, mas não impede a conexão
             print(f"Aviso: Solicitada conexão para '{db_key}', usando conexão padrão MySQL.")

        if 'db_conn' not in g:
            # Conecta ao Google Cloud SQL
            g.db_conn = self.engine.connect()
        
        return g.db_conn

    def close_connection(self, exception=None):
        db_conn = g.pop('db_conn', None)
        if db_conn:
            db_conn.close()

    def _ensure_col(self, conn, table, col, dtype):
        """Função auxiliar para adicionar colunas se não existirem (Migração)"""
        try:
            # Sintaxe MySQL para verificar coluna
            check_sql = text(f"SHOW COLUMNS FROM {table} LIKE '{col}'")
            result = conn.execute(check_sql).fetchone()
            
            if not result:
                print(f"🔄 Migrando: Adicionando coluna '{col}' na tabela '{table}'...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"))
                conn.commit()
        except Exception as e: 
            print(f"⚠️ Erro ao verificar coluna {col} em {table}: {e}")

    def init_tables(self):
        print("🚀 Verificando tabelas no Google Cloud SQL...")
        
        # Usamos uma conexão temporária para criar as tabelas
        with self.engine.connect() as conn:
            
            # 1. Users (Adaptado para MySQL: INT AUTO_INCREMENT)
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
                'first_name':'VARCHAR(255)', 'last_name':'VARCHAR(255)', 
                'email':'VARCHAR(255)', 'cellphone':'VARCHAR(20)', 
                'must_change_password':'INT DEFAULT 0'
            }
            for k,v in user_cols.items(): self._ensure_col(conn, 'users', k, v)
            
            # Cria Admin se não existir
            if not conn.execute(text("SELECT id FROM users WHERE username='admin'")).fetchone():
                admin_pass = os.getenv('ADMIN_PASSWORD', 'SEE-gste')
                conn.execute(text("INSERT INTO users (username, password, role, must_change_password) VALUES (:u, :p, :r, 0)"), 
                             {'u': 'admin', 'p': generate_password_hash(admin_pass), 'r': 'admin'})
                conn.commit()

            # 2. Inventory
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
                'tag':'VARCHAR(100)', 'tombamento':'VARCHAR(100)', 
                'condition_status':"VARCHAR(50) DEFAULT 'Novo'", # 'condition' é palavra reservada no MySQL 8, alterei para condition_status por segurança
                'glpi_status':"VARCHAR(50) DEFAULT 'Pendente'", 
                'standardized':"VARCHAR(10) DEFAULT 'Não'",
                'last_updated':"DATETIME DEFAULT CURRENT_TIMESTAMP", 
                'assigned_request_id':'INT'
            }
            for k,v in inv_cols.items(): self._ensure_col(conn, 'inventory', k, v)
            
            # Atualiza timestamp (Sintaxe MySQL)
            conn.execute(text("UPDATE inventory SET last_updated = CURRENT_TIMESTAMP WHERE last_updated IS NULL"))
            conn.commit()

            # 3. Requests
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

            # 4. Logs
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY, 
                    user_id INT, 
                    action VARCHAR(255), 
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
                    details TEXT
                )
            '''))
            
            # 5. Flow (Histórico)
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
            
            # Dashboard (Geralmente são views ou queries, mas se tiver tabela, cria aqui)
            # conn.execute(...)

            conn.commit()
            print("✅ Tabelas sincronizadas com Google Cloud SQL.")

db = DBManager()

def audit_log(user_id, action, details):
    try:
        conn = db.get_connection()
        # SQLAlchemy usa :parametro em vez de ?
        conn.execute(text('INSERT INTO audit_logs (user_id, action, details) VALUES (:uid, :act, :det)'), 
                     {'uid': user_id, 'act': action, 'det': details})
        conn.commit()
    except Exception as e: 
        print(f"Erro ao salvar log: {e}")
