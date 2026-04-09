import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from backend.core.db import migrate_db
    from flask import Flask
    
    app = Flask(__name__)
    with app.app_context():
        migrate_db()
        print("✅ Database migration triggered successfully.")
except Exception as e:
    print(f"❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
