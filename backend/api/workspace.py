from flask import Blueprint, request, jsonify

from services.db import (
    get_user_id,
    insert_run,
    fetch_runs_for_user,
    fetch_run,
    delete_run,
    delete_runs_for_user,
    insert_project,
    fetch_projects_for_user,
    fetch_project,
    update_project_status,
    delete_project,
)
from utils.validators import (
    RequestValidationError,
    parse_json_request,
)


workspace_bp = Blueprint('workspace', __name__)


@workspace_bp.route('/runs', methods=['POST'])
def record_run():
    try:
        data = parse_json_request(request)
    except RequestValidationError as exc:
        return jsonify({'error': exc.message}), exc.status_code

    user_id = data.get('userId')
    username = data.get('username')
    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    template_id = data.get('templateId')
    params = data.get('params', {})
    sam = data.get('sam')
    results = data.get('results', {})

    run_id = insert_run(user_id, template_id, params, sam, results)
    return jsonify({'id': run_id, 'message': 'Run saved'})


@workspace_bp.route('/runs', methods=['GET'])
def list_runs():
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    runs = fetch_runs_for_user(user_id)
    return jsonify(runs)


@workspace_bp.route('/runs/<int:run_id>', methods=['GET'])
def get_run_route(run_id: int):
    run = fetch_run(run_id)
    if run:
        return jsonify(run)
    return jsonify({'error': 'Run not found'}), 404


@workspace_bp.route('/runs/<int:run_id>', methods=['DELETE'])
def remove_run(run_id: int):
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    run = fetch_run(run_id)
    if not run:
        return jsonify({'error': 'Run not found'}), 404

    if user_id and run['user_id'] != user_id:
        return jsonify({'error': 'Run not found for this user'}), 404

    delete_run(run_id)
    return jsonify({'message': 'Run deleted'})


@workspace_bp.route('/runs', methods=['DELETE'])
def clear_runs():
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    delete_runs_for_user(user_id)
    return jsonify({'message': 'Run history cleared'})


@workspace_bp.route('/projects', methods=['POST'])
def create_project():
    try:
        data = parse_json_request(request)
    except RequestValidationError as exc:
        return jsonify({'error': exc.message}), exc.status_code

    name = data.get('name')
    description = data.get('description', '')
    template = data.get('template', 'A')
    user_id = data.get('userId')
    username = data.get('username')
    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id or not name:
        return jsonify({'error': 'Project name and valid userId or username required'}), 400

    project_id = insert_project(user_id, name, description, template)
    project = fetch_project(project_id)
    return jsonify(project), 201


@workspace_bp.route('/projects', methods=['GET'])
def list_projects_route():
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    projects = fetch_projects_for_user(user_id)
    return jsonify(projects)


@workspace_bp.route('/projects/<int:project_id>', methods=['PATCH'])
def update_project_route(project_id: int):
    try:
        data = parse_json_request(request)
    except RequestValidationError as exc:
        return jsonify({'error': exc.message}), exc.status_code

    username = data.get('username')
    user_id = data.get('userId')
    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    project = fetch_project(project_id)
    if not project or project['user_id'] != user_id:
        return jsonify({'error': 'Project not found'}), 404

    status = data.get('status')
    if status not in ['open', 'archived']:
        return jsonify({'error': 'Invalid status'}), 400

    update_project_status(project_id, status)
    project = fetch_project(project_id)
    return jsonify(project)


@workspace_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project_route(project_id: int):
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    project = fetch_project(project_id)
    if not project or project['user_id'] != user_id:
        return jsonify({'error': 'Project not found'}), 404

    delete_project(project_id)
    return jsonify({'message': 'Project deleted'})


