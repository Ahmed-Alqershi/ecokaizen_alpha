from typing import Dict

import threading

from .base import WorkspaceTemplate


_REGISTRY: Dict[str, WorkspaceTemplate] = {}
_LOCK = threading.Lock()


def register_template(template: WorkspaceTemplate) -> None:
    with _LOCK:
        _REGISTRY[template.id] = template


def get_template(template_id: str) -> WorkspaceTemplate:
    with _LOCK:
        if template_id not in _REGISTRY:
            raise KeyError(f"Template not found: {template_id}")
        return _REGISTRY[template_id]


def list_templates():
    with _LOCK:
        return [
            {
                'id': t.id,
                'name': t.name,
                'version': t.version,
                'description': t.descriptor.description,
                'tags': t.descriptor.tags or [],
            }
            for t in _REGISTRY.values()
        ]


