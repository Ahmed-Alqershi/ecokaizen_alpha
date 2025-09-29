from flask import Flask
from flask_cors import CORS

from services.db import init_db
from api.auth import auth_bp
from api.workspace import workspace_bp
from api.demolab import demolab_bp
from api.misc import misc_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Initialize database
    init_db()

    # Register blueprints (URLs stay the same)
    app.register_blueprint(auth_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(demolab_bp)
    app.register_blueprint(misc_bp)

    return app


app = create_app()


if __name__ == '__main__':
    app.run(debug=True, port=5002, host='0.0.0.0')


