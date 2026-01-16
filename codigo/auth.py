from flask import jsonify
from flask_login import LoginManager, UserMixin, login_required, current_user
from database import db

login_manager = LoginManager()

class User(UserMixin):
    def __init__(self, id, username, role, must_change_password=0):
        self.id = id
        self.username = username
        self.role = role
        self.must_change_password = bool(must_change_password)
        self.name = username 

@login_manager.user_loader
def load_user(user_id):
    conn = db.get_connection('users')
    u = conn.execute('SELECT id, username, role, must_change_password FROM users WHERE id = %s', (user_id,)).fetchone()
    if u: 
        return User(u['id'], u['username'], u['role'], u['must_change_password'])
    return None

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'message': 'Não autorizado. Faça login.'}), 401

def required_roles(roles):
    def wrapper(f):
        @login_required
        def wrapped(*args, **kwargs):
            if current_user.role not in roles: return jsonify({'message': 'Acesso negado.'}), 403
            return f(*args, **kwargs)
        wrapped.__name__ = f.__name__ 
        return wrapped
    return wrapper

is_admin = required_roles(['admin'])
is_analyst_or_admin = required_roles(['analista', 'admin'])