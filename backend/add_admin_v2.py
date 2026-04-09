import sqlite3
import os
from werkzeug.security import generate_password_hash

# Path to the correct database
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')

def add_admin():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    username = 'salman'
    password = 'Salman123#'
    hashed_password = generate_password_hash(password)
    name = 'Salman'
    email = 'salman@smartbank.com'

    try:
        # 1. Ensure admins table exists (just in case)
        cursor.execute('''CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            level VARCHAR(50) DEFAULT 'admin',
            status VARCHAR(20) DEFAULT 'active',
            face_auth_enabled INTEGER DEFAULT 0,
            face_descriptor TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            device_type VARCHAR(50) DEFAULT 'unknown'
        )''')

        # 2. Check if admin already exists
        cursor.execute("SELECT id FROM admins WHERE username = ?", (username,))
        existing = cursor.fetchone()
        if existing:
            print(f"Admin '{username}' already exists. Updating password...")
            cursor.execute("UPDATE admins SET password = ? WHERE username = ?", (hashed_password, username))
        else:
            print(f"Adding admin '{username}'...")
            cursor.execute("""
                INSERT INTO admins (username, password, name, email, level, status)
                VALUES (?, ?, ?, ?, 'admin', 'active')
            """, (username, hashed_password, name, email))
        
        conn.commit()
        print("Success!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_admin()
