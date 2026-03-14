# Render Deployment Entry Point
import os
import sys

# Add the backend directory to sys.path so it can find local imports
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# Now we can import from the backend folder
try:
    from app import app, init_db, migrate_db, DATABASE, get_db
except ImportError as e:
    print(f"Error: Could not import backend.app. Ensure 'backend' folder exists. {e}")
    sys.exit(1)

from werkzeug.security import generate_password_hash

def seed_default_data(db):
    """Seed the database with default accounts for initial testing.
    Accepts an already-open db connection so it runs in the same context as init_db.
    Each INSERT is wrapped individually so one failure doesn't abort everything.
    """
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

    # Default Staff: S001 / staff123
    try:
        db.execute(
            "INSERT INTO staff (staff_id, password, name, email, department, position) VALUES (?, ?, ?, ?, ?, ?)",
            ('S001', generate_password_hash('staff123'), 'Rajesh Kumar', 'rajesh@smartbank.com', 'Operations', 'Senior Teller')
        )
        db.commit()
        print("  [OK] Staff S001 seeded")
    except Exception as e:
        print(f"  [WARN] Staff S001 seed skipped: {e}")

    # Bonus Staff: yasir / Yasir123#
    try:
        db.execute(
            "INSERT INTO staff (staff_id, password, name, email, department, position) VALUES (?, ?, ?, ?, ?, ?)",
            ('yasir', generate_password_hash('Yasir123#'), 'Yasir Staff', 'yasir@smartbank.com', 'Management', 'Manager')
        )
        db.commit()
        print("  [OK] Staff yasir seeded")
    except Exception as e:
        print(f"  [WARN] Staff yasir seed skipped: {e}")

    # Default User: rajesh / user123
    try:
        db.execute(
            "INSERT INTO users (username, password, email, name, phone, status) VALUES (?, ?, ?, ?, ?, ?)",
            ('rajesh', generate_password_hash('user123'), 'customer@example.com', 'Rajesh Customer', '9876543210', 'active')
        )
        db.commit()
        print("  [OK] User rajesh seeded")
    except Exception as e:
        print(f"  [WARN] User rajesh seed skipped: {e}")

    print("Default accounts seeding complete.")


def initialize_deployment():
    """Run required initialization for deployment."""
    db_missing_or_empty = not os.path.exists(DATABASE) or os.path.getsize(DATABASE) == 0

    if db_missing_or_empty:
        print(f"Database missing or empty at {DATABASE}. Initializing...")
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        # Run init_db and seeding inside ONE shared app_context so the
        # freshly committed schema is visible to the seed inserts.
        with app.app_context():
            init_db()
            db = get_db()
            seed_default_data(db)
        print("Database initialized and seeded successfully.")
    else:
        print(f"Database found at {DATABASE}. Running migrations...")
        with app.app_context():
            migrate_db()


# Initialize on import so Gunicorn workers have a ready DB
initialize_deployment()

if __name__ == "__main__":
    # Local development run
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
