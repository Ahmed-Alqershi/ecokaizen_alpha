from flask import Blueprint

# Namespaced blueprints will be defined in sibling modules and imported by app.py

# Placeholders to avoid circular imports during refactor steps
auth_bp = Blueprint('auth', __name__)
workspace_bp = Blueprint('workspace', __name__)
demolab_bp = Blueprint('demolab', __name__)
misc_bp = Blueprint('misc', __name__)
templates_bp = Blueprint('templates', __name__)


