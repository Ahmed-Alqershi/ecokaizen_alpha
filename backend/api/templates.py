from flask import Blueprint, request, jsonify
from typing import Any, Dict

from models.workspace.templates.registry import get_template, list_templates
from models.workspace.templates.base import SamLayoutRequest


templates_bp = Blueprint('templates', __name__)


@templates_bp.route('/templates/workspace', methods=['GET'])
def list_workspace_templates():
    return jsonify(list_templates())


@templates_bp.route('/templates/workspace/<template_id>/schema', methods=['GET'])
def get_template_schema(template_id: str):
    t = get_template(template_id)
    input_schema = t.input_model().model_json_schema()
    output_schema = t.output_model().model_json_schema()
    return jsonify({
        'descriptor': t.descriptor.model_dump(),
        'inputSchema': input_schema,
        'outputSchema': output_schema,
    })


@templates_bp.route('/templates/workspace/<template_id>/sam/layout', methods=['POST'])
def get_sam_layout(template_id: str):
    t = get_template(template_id)
    data = request.get_json(force=True, silent=True) or {}
    req = SamLayoutRequest(
        sectors=int(data.get('sectors', 1)),
        households=int(data.get('households', 1)),
    )
    res = t.get_sam_layout(req)
    return jsonify(res.model_dump())


@templates_bp.route('/templates/workspace/<template_id>/run', methods=['POST'])
def run_template(template_id: str):
    t = get_template(template_id)
    payload = request.get_json(force=True, silent=True) or {}
    params = payload.get('params', {})
    sam = payload.get('sam')
    result = t.run(params, sam)
    return jsonify(result)



