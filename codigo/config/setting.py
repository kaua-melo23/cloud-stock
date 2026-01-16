import os

# Caminho base do projeto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- CONFIGURAÇÕES DO GOOGLE SHEETS ---

# ID da Planilha (Copiado da URL da sua planilha)
GOOGLE_SHEET_ID = "128kQcyyDmUSaJP-XrVlqqhCwSnytC3-tqY4y7KBjfdU"

# Caminho para o arquivo JSON de credenciais
GOOGLE_SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, 'config', 'google_credentials.json')

# Intervalo de células (Ex: aba 'Estoque' colunas A até H)
INVENTORY_RANGE = "Estoque!A:H"

# Mapeamento: Ordem exata das colunas na Planilha Google
# Deve bater com a ordem que você quer ver no Sheets (A, B, C...)
INVENTORY_COLUMNS = [
    "serial_number", # Coluna A (Chave Primária)
    "type",          # Coluna B
    "model",         # Coluna C
    "tag",           # Coluna D
    "asset_id",      # Coluna E
    "condition",     # Coluna F
    "status",        # Coluna G
    "assigned_request_id" # Coluna H (Opcional, para debug)
]

# Política de conflito (apenas informativo por enquanto)
SYNC_CONFLICT_POLICY = "prefer_db"

# Caminho do Banco de Dados
SQLITE_DB = os.path.join(BASE_DIR, 'stock_control.db')
