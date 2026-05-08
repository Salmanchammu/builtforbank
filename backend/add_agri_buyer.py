"""
Create an Agri Buyer for the user with email builtforbank@gmail.com.
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

    email = 'builtforbank@gmail.com'
    password = 'Salman123#'
    pw_hash = generate_password_hash(password)

    # 1. Check if user already exists
    user = cursor.execute('SELECT id, username FROM users WHERE email = ?', (email,)).fetchone()

    if user:
        buyer_user_id = user['id']
        print(f"Found existing user: id={buyer_user_id}, username={user['username']}")
    else:
        # Create user
        cursor.execute('''
            INSERT INTO users (username, password, email, name, phone, address, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('builtforbank', pw_hash, email, 'Built For Bank', '9999999999', 'Headquarters', 'active', dt_now))
        buyer_user_id = cursor.lastrowid
        print(f"Created new user: id={buyer_user_id}, email={email}")

    # 2. Check if Business account exists
    existing_acc = cursor.execute(
        "SELECT id, account_number FROM accounts WHERE user_id = ? AND LOWER(account_type) = 'business' AND status = 'active'",
        (buyer_user_id,)
    ).fetchone()

    if existing_acc:
        buyer_acc_id = existing_acc['id']
        print(f"User already has a Business account: {existing_acc['account_number']}")
    else:
        # Create Business account
        acc_no = f"SB{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
        cursor.execute('''
            INSERT INTO accounts (user_id, account_number, account_type, balance, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (buyer_user_id, acc_no, 'Business', 150000.00, 'active', dt_now))
        buyer_acc_id = cursor.lastrowid
        print(f"Created Business account: {acc_no} with balance Rs.150,000")

    # 3. Create Agri Buyer Record
    # Check if exists
    existing_buyer = cursor.execute('SELECT id FROM agri_buyers WHERE email = ?', (email,)).fetchone()
    if existing_buyer:
         print("Agri Buyer record already exists.")
    else:
         cursor.execute('''
             INSERT INTO agri_buyers (buyer_id, password, name, email, phone, business_name, gst_number, status, associated_account_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ''', ('builtforbank', pw_hash, 'Built For Bank Buyer', email, '9999999999', 'BuiltForBank Enterprises', '22AAAAA0000A1Z5', 'active', buyer_acc_id, dt_now))
         print(f"Added Agri Buyer: builtforbank / {password}")

    conn.commit()
    conn.close()
    print("\nDone! Login to Agri Marketplace with:")
    print(f"  Email: {email} (or ID: builtforbank)")
    print(f"  Password: {password}")

if __name__ == '__main__':
    run()
