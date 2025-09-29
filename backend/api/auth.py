from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from services.db import get_db_connection


auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    avatar = data.get('avatar')
    if not avatar and username:
        import random
        color = '#%06x' % random.randint(0, 0xFFFFFF)
        avatar = f"{username[0].upper()}|{color}"
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    try:
        with get_db_connection() as conn:
            conn.execute(
                'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
                (username, generate_password_hash(password), avatar)
            )
            conn.commit()
        return jsonify({'message': 'User registered successfully'})
    except Exception as e:
        # Return conflict for existing usernames
        if 'UNIQUE constraint failed' in str(e):
            return jsonify({'error': 'Username already exists'}), 400
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    try:
        with get_db_connection() as conn:
            cur = conn.execute('SELECT password, avatar FROM users WHERE username=?', (username,))
            row = cur.fetchone()
        if row and check_password_hash(row['password'], password):
            return jsonify({'message': 'Login successful', 'username': username, 'avatar': row['avatar']})
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500


