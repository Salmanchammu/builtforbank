import sys
import os
import json
from werkzeug.security import generate_password_hash

# Add backend to path so we can import core modules
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from core.db import get_db, init_db
from flask import Flask

app = Flask(__name__)
app.config['DATABASE'] = os.path.join(os.getcwd(), 'database', 'smartbank.db')

def add_admin(username, password, name, email):
    with app.app_context():
        db = get_db()
        
        # Check if already exists
        existing = db.execute('SELECT id FROM admins WHERE username = ?', (username,)).fetchone()
        hashed = generate_password_hash(password)
        
        if existing:
            try:
                db.execute('UPDATE admins SET password = ? WHERE id = ?', (hashed, existing['id']))
                db.commit()
                print(f"Admin '{username}' already exists. Password updated successfully!")
                return True
            except Exception as e:
                print(f"Error updating admin: {e}")
                return False

        try:
            db.execute(
                'INSERT INTO admins (username, password, name, email, level, status) VALUES (?, ?, ?, ?, ?, ?)',
                (username, hashed, name, email, 'superadmin', 'active')
            )
            db.commit()
            print(f"Admin '{username}' successfully created!")
            return True
        except Exception as e:
            print(f"Error creating admin: {e}")
            return False

if __name__ == "__main__":
    # Credentials from user screenshot
    add_admin("salman", "Salman123", "Salman Admin", "salman@smartbank.com")
