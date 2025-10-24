# Ensure templates are registered on app import
import os
from models.workspace.templates.registry import register_template as _register
from models.workspace.templates.mn1_template import MN1Template
from models.workspace.templates.open_economy_static_template import OpenEconomyTemplate

base_dir = os.path.dirname(__file__)
mn1_yaml = os.path.join(base_dir, 'models', 'workspace', 'templates', 'mn1', 'descriptor.yaml')
oe_yaml = os.path.join(base_dir, 'models', 'workspace', 'templates', 'open_economy_static', 'descriptor.yaml')

try:
    _register(MN1Template(mn1_yaml))
except Exception:
    pass

try:
    _register(OpenEconomyTemplate(oe_yaml))
except Exception:
    pass


