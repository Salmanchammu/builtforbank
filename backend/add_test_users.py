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
    cursor = conn.cursor()

    pw_hash = generate_password_hash('password123')
    dt_now = datetime.now().isoformat()

    print("Adding Agriculture User...")
    # Add Agriculture User
    cursor.execute('''
        INSERT INTO users (username, password, email, name, phone, address, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('agri_user', pw_hash, 'agri@test.com', 'Test Farmer', '9999999999', 'Village Farm', 'active', dt_now))
    farmer_id = cursor.lastrowid

    # Create Agriculture Account for farmer
    farmer_acc_no = f"SB{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
    cursor.execute('''
        INSERT INTO accounts (user_id, account_number, account_type, balance, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (farmer_id, farmer_acc_no, 'Agriculture', 50000.00, 'active', dt_now))
    print(f"Added Agriculture User: agri_user / password123")

    print("Adding Agri Buyer...")
    # Add Buyer Banking User
    cursor.execute('''
        INSERT INTO users (username, password, email, name, phone, address, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('buyer_user', pw_hash, 'buyer_user@test.com', 'Test Buyer', '8888888888', 'City Market', 'active', dt_now))
    buyer_user_id = cursor.lastrowid

    # Create Business Account for Buyer
    buyer_acc_no = f"SB{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
    cursor.execute('''
        INSERT INTO accounts (user_id, account_number, account_type, balance, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (buyer_user_id, buyer_acc_no, 'Business', 150000.00, 'active', dt_now))
    buyer_acc_id = cursor.lastrowid

    # Add Agri Buyer Record
    cursor.execute('''
        INSERT INTO agri_buyers (buyer_id, password, name, email, phone, business_name, gst_number, status, associated_account_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('agri_buyer', pw_hash, 'Test Buyer', 'buyer@test.com', '8888888888', 'Fresh Produce Ltd', '22AAAAA0000A1Z5', 'active', buyer_acc_id, dt_now))
    
    print(f"Added Agri Buyer: agri_buyer / password123")

    conn.commit()
    conn.close()
    print("Test users successfully created!")

if __name__ == '__main__':
    run()
