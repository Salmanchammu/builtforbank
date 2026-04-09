import sqlite3
import os
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import random

# Path to database
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')

def seed():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🌱 Seeding Smart Bank database...")

    # 1. Clear existing data
    tables_to_clear = ['users', 'accounts', 'transactions', 'loans', 'agri_buyers', 'service_applications', 'notifications']
    for table in tables_to_clear:
        try:
            cursor.execute(f"DELETE FROM {table}")
        except:
            pass
    
    # 2. Add Users
    users_data = [
        ('rahul', 'Rahul Sharma', 'rahul@example.com', '9876543210', 'Mumbai'),
        ('priya', 'Priya Patel', 'priya@example.com', '9876543211', 'Ahmedabad'),
        ('amit', 'Amit Kumar', 'amit@example.com', '9876543212', 'Delhi'),
        ('sneha', 'Sneha Gupta', 'sneha@example.com', '9876543213', 'Bangalore'),
        ('vikram', 'Vikram Singh', 'vikram@example.com', '9876543214', 'Jaipur'),
    ]

    pw_hash = generate_password_hash('password123')
    user_ids = []
    
    for username, name, email, phone, address in users_data:
        dt = (datetime.now() - timedelta(days=random.randint(10, 50))).isoformat()
        cursor.execute('''
            INSERT INTO users (username, password, email, name, phone, address, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (username, pw_hash, email, name, phone, address, 'active', dt))
        user_ids.append(cursor.lastrowid)

    # 3. Add Accounts
    for i, u_id in enumerate(user_ids):
        acc_no = f"SB{1000000 + i}"
        cursor.execute('''
            INSERT INTO accounts (user_id, account_number, account_type, balance, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (u_id, acc_no, 'Savings', random.randint(50000, 200000), 'active', datetime.now().isoformat()))
        acc_id = cursor.lastrowid
        
        # 4. Add Transactions for each account
        for _ in range(3):
            cursor.execute('''
                INSERT INTO transactions (account_id, type, amount, description, status, transaction_date)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (acc_id, 'credit', random.randint(1000, 10000), 'Monthly Salary Deposit', 'completed', datetime.now().isoformat()))

    # 5. Add Loans
    for u_id in user_ids[:2]:
        cursor.execute('''
            INSERT INTO loans (user_id, loan_type, loan_amount, interest_rate, tenure_months, status, application_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (u_id, 'Personal Loan', 500000, 10.5, 36, 'pending', datetime.now().isoformat()))

    # 6. Add Agri Buyers
    cursor.execute('''
        INSERT INTO agri_buyers (buyer_id, password, name, email, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', ('buyer1', pw_hash, 'Suresh Agri-Mart', 'suresh@agri.com', 'active', datetime.now().isoformat()))

    conn.commit()
    conn.close()
    print("✨ Database successfully seeded with demo data!")

if __name__ == '__main__':
    seed()
