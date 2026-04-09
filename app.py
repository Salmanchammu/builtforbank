# Smart Bank - Render Bridge
import sys
import os

# 1. Path Management: Add 'backend' to the path so internal imports work.
root = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(root, 'backend')

if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# 2. Application Import
# We import from 'main' (which was backend/app.py) to avoid circular imports 
# with this file (root app.py).
from main import app as application
app = application
