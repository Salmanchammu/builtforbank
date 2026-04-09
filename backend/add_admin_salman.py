import sqlite3
import os
from werkzeug.security import generate_password_hash

# Path to the database
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')

def add_admin():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    username = 'salman'
    password = 'Salman123#'
    hashed_password = generate_password_hash(password)
    name = 'Salman'
    email = 'salman@smartbank.com'

    try:
        # Check if admin already exists
        cursor.execute("SELECT id FROM admins WHERE username = ?", (username,))
        if cursor.fetchone():
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
