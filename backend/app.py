from flask import Flask
from flask_cors import CORS

from services.db import init_db
from api.auth import auth_bp
from api.workspace import workspace_bp
from api.demolab import demolab_bp
from api.misc import misc_bp
from api.templates import templates_bp
from models.workspace.templates.registry import register_template
from models.workspace.templates.mn1_template import MN1Template
from models.workspace.templates.open_economy_static_template import OpenEconomyTemplate
import os


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Initialize database
    init_db()

    # Register workspace templates (YAML-driven)
    base_dir = os.path.dirname(__file__)
    mn1_yaml = os.path.join(base_dir, 'models', 'workspace', 'templates', 'mn1', 'descriptor.yaml')
    oe_yaml = os.path.join(base_dir, 'models', 'workspace', 'templates', 'open_economy_static', 'descriptor.yaml')
    print(f"[templates] Base dir: {base_dir}")
    print(f"[templates] MN1 descriptor path: {mn1_yaml} exists={os.path.exists(mn1_yaml)}")
    print(f"[templates] OE descriptor path: {oe_yaml} exists={os.path.exists(oe_yaml)}")
    try:
        register_template(MN1Template(mn1_yaml))
        print("[templates] Registered MN1")
    except Exception as e:
        print(f"[templates] Failed to register MN1: {e}")
    try:
        register_template(OpenEconomyTemplate(oe_yaml))
        print("[templates] Registered OpenEconomyStatic")
    except Exception as e:
        print(f"[templates] Failed to register OpenEconomyStatic: {e}")

    # Register blueprints (URLs stay the same)
    app.register_blueprint(auth_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(demolab_bp)
    app.register_blueprint(misc_bp)
    app.register_blueprint(templates_bp)

    return app


app = create_app()


if __name__ == '__main__':
    app.run(debug=True, port=5002, host='0.0.0.0')


