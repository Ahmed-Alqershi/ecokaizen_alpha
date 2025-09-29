import os
# Namespace package for Workspace-related models

DATA_DIR = os.path.dirname(__file__)

# Data folder for workspace-specific datasets
DATA_PATH = os.path.join(DATA_DIR, 'data')
os.makedirs(DATA_PATH, exist_ok=True)




