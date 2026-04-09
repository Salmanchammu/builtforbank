# Smart Bank - Render Bridge
# This file allows Gunicorn to find the app even if the dashboard settings are default.
import sys
import os

# 1. Path Management: Add 'backend' to the path so internal imports work.
root = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(root, 'backend')

if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# 2. Application Import
# When Gunicorn runs 'app:app', it looks for this variable.
from app import app as application
app = application
