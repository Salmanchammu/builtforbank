# Render Deployment Entry Point
import os
import sys

# Add the backend directory to sys.path so it can find local imports
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.append(backend_dir)

# Now we can import from the backend folder
from app import app, init_db, DATABASE, get_db
from werkzeug.security import generate_password_hash

def seed_default_data():
    """Seed the database with default accounts for initial testing."""
    with app.app_context():
        db = get_db()
        
        # Check if we already have an admin
        cursor = db.execute("SELECT count(*) FROM admins")
        if cursor.fetchone()[0] == 0:
            print("Seeding default accounts...")
            
            # Default Admin: admin / admin123
            db.execute(
                "INSERT INTO admins (username, password, name, email) VALUES (?, ?, ?, ?)",
                ('admin', generate_password_hash('admin123'), 'System Admin', 'admin@smartbank.com')
            )
            
            # Default Staff: S001 / staff123
            db.execute(
                "INSERT INTO staff (staff_id, password, name, email, department, position) VALUES (?, ?, ?, ?, ?, ?)",
                ('S001', generate_password_hash('staff123'), 'Rajesh Kumar', 'rajesh@smartbank.com', 'Operations', 'Senior Teller')
            )
            
            # Default User: rajesh / user123
            db.execute(
                "INSERT INTO users (username, password, email, name, phone) VALUES (?, ?, ?, ?, ?)",
                ('rajesh', generate_password_hash('user123'), 'customer@example.com', 'Rajesh Customer', '9876543210')
            )
            
            db.commit()
            print("Default accounts (admin, S001, rajesh) seeded successfully.")

if __name__ == "__main__":
    # Check if database exists or is empty, if so initialize it
    db_missing_or_empty = not os.path.exists(DATABASE) or os.path.getsize(DATABASE) == 0
    
    if db_missing_or_empty:
        print(f"Database missing or empty at {DATABASE}. Initializing...")
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        init_db()
        seed_default_data()
        print("Database initialized and seeded successfully.")
    else:
        print(f"Database found at {DATABASE}.")

    # Render provides the PORT environment variable
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
