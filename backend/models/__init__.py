# Initialize models package
# Re-export paths for compatibility after reorg
# DemoLab models
from .demolab.splcge import *  # noqa: F401,F403
from .demolab.dynamic_splcge import *  # noqa: F401,F403
from .demolab.model_wrappers import *  # noqa: F401,F403

# Workspace models are intentionally NOT re-exported here to avoid
# importing heavy modules at app startup. Import them directly where needed:
# from models.workspace.mn1_wrapper import solve_mn1