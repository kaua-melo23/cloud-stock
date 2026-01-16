# config/mail.py

class MailConfig:
    """
    Configurações de E-mail (SMTP).
    Altere aqui caso mude de Gmail para Outlook ou precise trocar a senha.
    """
    
    # Servidor do Gmail (padrão)
    MAIL_SERVER = 'smtp.gmail.com'
    
    # Porta padrão para TLS (587) ou SSL (465)
    MAIL_PORT = 587
    
    # Segurança (True para TLS, False para SSL puro)
    MAIL_USE_TLS = True
    
    # --- SUAS CREDENCIAIS ---
    # Seu e-mail completo
    MAIL_USERNAME = 'kaua.wfmelo@adm.educacao.pe.gov.br'
    
    # Sua Senha de App (16 letras) - NÃO USE A SENHA NORMAL
    MAIL_PASSWORD = 'egcw vgkt iiyo askz'
    
    # Remetente padrão (aparece como "De:" no e-mail)
    MAIL_DEFAULT_SENDER = ('Sistema Estoque', MAIL_USERNAME)