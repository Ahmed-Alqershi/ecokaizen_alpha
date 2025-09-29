import os
import smtplib
from email.message import EmailMessage

from flask import Blueprint, request, jsonify


misc_bp = Blueprint('misc', __name__)


def send_contact_email(name: str, email: str, message: str):
    smtp_server = os.environ.get('SMTP_SERVER', 'localhost')
    smtp_port = int(os.environ.get('SMTP_PORT', 25))
    smtp_user = os.environ.get('SMTP_USERNAME')
    smtp_password = os.environ.get('SMTP_PASSWORD')

    msg = EmailMessage()
    msg['Subject'] = 'Contact Form Submission'
    msg['From'] = email
    msg['To'] = os.environ.get('CONTACT_EMAIL', 'support@example.com')
    msg.set_content(f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}")

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if smtp_user and smtp_password:
                server.starttls()
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True, 'Message sent'
    except Exception as e:
        return False, str(e)


@misc_bp.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'ok',
        'message': 'CGE Model API is running'
    })


@misc_bp.route('/contact', methods=['POST'])
def contact():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')
    if not name or not email or not message:
        return jsonify({'error': 'Name, email and message are required'}), 400

    success, info = send_contact_email(name, email, message)
    if success:
        return jsonify({'message': 'Message sent'})
    return jsonify({'error': info}), 500


