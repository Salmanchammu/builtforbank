# Render Deployment Entry Point
import os
import sys
import json
from datetime import datetime

# Add the root directory and backend directory to sys.path (High Priority)
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, 'backend')

# Highly aggressive path insertion
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

print(f"Deployment Boot: Root={root_dir}, Backend={backend_dir}")
print(f"Current Sys Path: {sys.path[:3]}") # Debug top 3 paths

# Now we can import from the backend folder
try:
    # We try both methods for maximum compatibility
    try:
        from app import app, init_db, migrate_db, DATABASE, get_db
    except ImportError:
        from backend.app import app, init_db, migrate_db, DATABASE, get_db
except ImportError as e:
    print(f"❌ CRITICAL IMPORT ERROR: {e}")
    print(f"Working Directory: {os.getcwd()}")
    print(f"Files in root: {os.listdir(root_dir)}")
    if os.path.exists(backend_dir):
        print(f"Files in backend: {os.listdir(backend_dir)}")
    sys.exit(1)

from werkzeug.security import generate_password_hash

def seed_default_data(db):
    """Seed the database with default accounts for initial testing."""
    try:
        cursor = db.execute("SELECT count(*) FROM admins")
        if cursor.fetchone()[0] > 0:
            print("Default accounts already exist. Skipping seed.")
            return
    except Exception as e:
        print(f"Could not check admins table: {e}")
        return

    print("Seeding default accounts...")

    # Default Admin: admin / admin123
    try:
        db.execute(
            "INSERT INTO admins (username, password, name, email) VALUES (?, ?, ?, ?)",
            ('admin', generate_password_hash('admin123'), 'System Admin', 'admin@smartbank.com')
        )
        db.commit()
        print("  [OK] Admin seeded")
    except Exception as e:
        print(f"  [WARN] Admin seed skipped: {e}")

def load_smart_seed(db):
    """Load data from smart_seed.json if it exists."""
    seed_file = os.path.join(backend_dir, 'smart_seed.json')
    if not os.path.exists(seed_file):
        return

    print(f"Loading data from {seed_file}...")
    try:
        with open(seed_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for table, rows in data.items():
            if not rows: continue
            print(f"  Inserting {len(rows)} rows into '{table}'...")
            for row in rows:
                cols = row.keys()
                placeholders = ', '.join(['?'] * len(cols))
                col_names = ', '.join(cols)
                vals = [row[c] for c in cols]
                
                try:
                    query = f"INSERT OR IGNORE INTO {table} ({col_names}) VALUES ({placeholders})"
                    db.execute(query, vals)
                except Exception as e:
                    pass
            db.commit()
    except Exception as e:
        print(f"Error loading smart seed: {e}")

def initialize_deployment():
    """Run required initialization for deployment."""
    # Ensure database directory exists
    os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
    
    force_reseed = os.environ.get('FORCE_RESEED', 'false').lower() == 'true'
    db_missing_or_empty = not os.path.exists(DATABASE) or os.path.getsize(DATABASE) == 0 or force_reseed

    with app.app_context():
        if db_missing_or_empty:
            print(f"Initializing database at {DATABASE}...")
            init_db()
            db = get_db()
            seed_file = os.path.join(backend_dir, 'smart_seed.json')
            if os.path.exists(seed_file):
                load_smart_seed(db)
            else:
                seed_default_data(db)
            print("Database initialized successfully.")
        else:
            print(f"Database found at {DATABASE}. Running migrations...")
            migrate_db()

# Initialize on import so Gunicorn workers have a ready DB
initialize_deployment()

if __name__ == "__main__":
    # Local development run
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
