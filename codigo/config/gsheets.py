import os.path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from config import settings

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_service():
    if not os.path.exists(settings.GOOGLE_SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError(f"Arquivo de credenciais não encontrado em: {settings.GOOGLE_SERVICE_ACCOUNT_FILE}")
    creds = service_account.Credentials.from_service_account_file(settings.GOOGLE_SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds)

def get_sheet_metadata(spreadsheet_id):
    """Retorna metadados (título, abas) de uma planilha específica."""
    service = get_service()
    return service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()

def read_sheet(range_name, spreadsheet_id=None):
    """
    Lê dados. Se spreadsheet_id for None, usa o do settings.py.
    """
    sid = spreadsheet_id if spreadsheet_id else settings.GOOGLE_SHEET_ID
    service = get_service()
    result = service.spreadsheets().values().get(
        spreadsheetId=sid, range=range_name).execute()
    return result.get('values', [])

def write_sheet(range_name, values, spreadsheet_id=None):
    """Escreve dados."""
    sid = spreadsheet_id if spreadsheet_id else settings.GOOGLE_SHEET_ID
    service = get_service()
    service.spreadsheets().values().clear(spreadsheetId=sid, range=range_name).execute()
    body = {'values': values}
    return service.spreadsheets().values().update(
        spreadsheetId=sid, range=range_name, valueInputOption="RAW", body=body).execute()

def append_row(range_name, values, spreadsheet_id=None):
    sid = spreadsheet_id if spreadsheet_id else settings.GOOGLE_SHEET_ID
    service = get_service()
    body = {'values': values}
    return service.spreadsheets().values().append(
        spreadsheetId=sid, range=range_name, valueInputOption="RAW", body=body).execute()
