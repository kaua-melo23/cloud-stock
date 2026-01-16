import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 🔴 COLOQUE O ID DA SUA PLANILHA AQUI
GOOGLE_SHEET_ID = "128kQcyyDmUSaJP-XrVlqqhCwSnytC3-tqY4y7KBjfdU" 

GOOGLE_SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, 'config', 'google_credentials.json')
INVENTORY_RANGE = "Estoque" 
SQLITE_DB = os.path.join(BASE_DIR, 'stock_control.db')

# Mapeamento Visual da Planilha
INVENTORY_COLUMNS = [
    "serial_number",
    "type",
    "model",
    "tag",
    "asset_id",
    "condition",
    "status",
    "assigned_request_id",
    "termo_disp", # Placeholder
    "termo_dev",  # Placeholder
    "glpi_status", # NOVO (Coluna K / 10)
    "last_updated" # (Coluna L / 11)
]

SYNC_CONFLICT_POLICY = "last_write_wins"
