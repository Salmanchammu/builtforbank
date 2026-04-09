# Standard WSGI Entry Point for Smart Bank
import sys
import os
import traceback

# 1. Path Management: Add 'backend' to the path so internal imports like 
# 'from core.db' or 'from blueprints' work correctly.
root = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(root, 'backend')

if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# 2. Application Import
try:
    print(f"WSGI Boot: Initializing application | CWD: {os.getcwd()}")
    from app import app
except Exception as e:
    print(f"❌ WSGI CRITICAL ERROR DURING IMPORT: {e}")
    traceback.print_exc()
    sys.exit(1)

# 3. Final Initialization (Database, Seeding, Migrations)
# This is a one-time check when the server starts up.
try:
    from core.db import init_db, migrate_db
    from core.constants import DATABASE
    
    with app.app_context():
        # Ensure 'database' folder exists
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        
        if not os.path.exists(DATABASE) or os.path.getsize(DATABASE) == 0:
            print(f"WSGI Boot: No database found at {DATABASE}. Running init_db...")
            init_db()
        else:
            print(f"WSGI Boot: Existing database found. Running migrations...")
            migrate_db()
            
except Exception as e:
    print(f"⚠️ WSGI Initialization Warning: {e}")
    traceback.print_exc()
    # We don't exit here because the app might still be able to serve static files
    # or handle requests once the DB issue is resolved in the dashboard.

# This object 'app' is what Gunicorn looks for
application = app
