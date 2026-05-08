"""
Create an Agriculture account for the user with email mahasalman029@gmail.com.
If no user exists with that email, create the user first with password Salman123#.
"""
import sqlite3
import os
import random
from datetime import datetime
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')

def run():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    dt_now = datetime.now().isoformat()

    email = 'mahasalman029@gmail.com'
    password = 'Salman123#'

    # 1. Check if user with this email already exists
    user = cursor.execute('SELECT id, username, name FROM users WHERE email = ?', (email,)).fetchone()

    if user:
        user_id = user['id']
        print(f"Found existing user: id={user_id}, username={user['username']}, name={user['name']}")
    else:
        # Create user
        pw_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (username, password, email, name, phone, address, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('salman_agri', pw_hash, email, 'Salman (Farmer)', '9876543210', 'Nagpur, Maharashtra', 'active', dt_now))
        user_id = cursor.lastrowid
        print(f"Created new user: id={user_id}, username=salman_agri, email={email}")

    # 2. Check if this user already has an Agriculture account
    existing_agri = cursor.execute(
        "SELECT id, account_number FROM accounts WHERE user_id = ? AND LOWER(account_type) = 'agriculture' AND status = 'active'",
        (user_id,)
    ).fetchone()

    if existing_agri:
        print(f"User already has an Agriculture account: {existing_agri['account_number']}")
    else:
        # Create Agriculture account
        acc_no = f"SB{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
        cursor.execute('''
            INSERT INTO accounts (user_id, account_number, account_type, balance, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, acc_no, 'Agriculture', 50000.00, 'active', dt_now))
        print(f"Created Agriculture account: {acc_no} with balance Rs.50,000")

    conn.commit()

    # Verify
    accounts = cursor.execute('SELECT account_number, account_type, balance, status FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
    print(f"\nAll accounts for user {user_id}:")
    for a in accounts:
        print(f"  - {a['account_type']}: {a['account_number']} | Balance: Rs.{a['balance']:,.2f} | Status: {a['status']}")

    conn.close()
    print("\nDone! Login with:")
    print(f"  Email: {email}")
    print(f"  Password: {password}")

if __name__ == '__main__':
    run()
