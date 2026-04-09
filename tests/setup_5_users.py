# Complete system setup and verification for 5 real users
# This script: checks DB state, adds 5 real users, verifies everything works

import sqlite3
import os
import sys
import json
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import random
import string

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '..', 'database', 'smartbank.db')

def get_random_date(start_days_ago, end_days_ago=0):
    start_dt = datetime.now() - timedelta(days=start_days_ago)
    end_dt = datetime.now() - timedelta(days=end_days_ago)
    diff = (end_dt - start_dt).total_seconds()
    random_dt = start_dt + timedelta(seconds=random.randint(0, max(1, int(diff))))
    return random_dt.strftime('%Y-%m-%d %H:%M:%S')

def gen_ref():
    return f"TXN{''.join(random.choices(string.ascii_uppercase + string.digits, k=10))}"

# 5 real users to add/verify
USERS = [
    {"username": "alice_johnson", "name": "Alice Johnson", "email": "alice.johnson@smartbank.com", "phone": "+91 9811234561", "password": "Alice@123"},
    {"username": "bob_smith", "name": "Bob Smith", "email": "bob.smith@smartbank.com", "phone": "+91 9811234562", "password": "Bob@1234"},
    {"username": "carol_white", "name": "Carol White", "email": "carol.white@smartbank.com", "phone": "+91 9811234563", "password": "Carol@123"},
    {"username": "david_brown", "name": "David Brown", "email": "david.brown@smartbank.com", "phone": "+91 9811234564", "password": "David@123"},
    {"username": "eva_green", "name": "Eva Green", "email": "eva.green@smartbank.com", "phone": "+91 9811234565", "password": "Eva@12345"},
]

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 60)
print("SMART BANK - FULL SYSTEM SETUP WITH 5 REAL USERS")
print("=" * 60)
print(f"\nDB: {DB_PATH}")
print(f"DB Exists: {os.path.exists(DB_PATH)}\n")

# --- Check existing state ---
tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Current DB State:")
for t in tables:
    cnt = cursor.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {cnt} records")

print("\n--- Existing Users ---")
existing_users = cursor.execute("SELECT id, username, name, email, status FROM users").fetchall()
for u in existing_users:
    accs = cursor.execute("SELECT COUNT(*) FROM accounts WHERE user_id = ?", (u['id'],)).fetchone()[0]
    txns = cursor.execute("SELECT COUNT(*) FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.user_id=?", (u['id'],)).fetchone()[0]
    bal = cursor.execute("SELECT SUM(balance) FROM accounts WHERE user_id=?", (u['id'],)).fetchone()[0] or 0
    print(f"  [{u['id']}] {u['username']} | {u['name']} | status={u['status']} | accounts={accs} | txns={txns} | bal=INR {bal:.2f}")

print("\n--- Existing Staff ---")
for s in cursor.execute("SELECT id, staff_id, name, email, department, status FROM staff").fetchall():
    print(f"  [{s['id']}] {s['staff_id']} | {s['name']} | {s['department']} | status={s['status']}")

print("\n--- Existing Admins ---")
for a in cursor.execute("SELECT id, username, name, email, status FROM admins").fetchall():
    print(f"  [{a['id']}] {a['username']} | {a['name']} | status={a['status']}")

# --- Generate 5 real users ---
print("\n" + "=" * 60)
print("GENERATING 5 REAL USERS")
print("=" * 60)

created = []
skipped = []

for u in USERS:
    # Check if exists
    existing = cursor.execute("SELECT id FROM users WHERE username=? OR email=?", (u['username'], u['email'])).fetchone()
    if existing:
        skipped.append(u['username'])
        user_id = existing['id']
        print(f"  SKIP (exists): {u['username']} (id={user_id})")
        
        # Ensure they have an account with balance
        acc = cursor.execute("SELECT id, balance FROM accounts WHERE user_id=?", (user_id,)).fetchone()
        if not acc:
            acc_num = f"SB{str(user_id).zfill(12)}"
            bal = round(random.uniform(75000, 500000), 2)
            cursor.execute(
                'INSERT INTO accounts (user_id, account_number, account_type, balance, currency, status) VALUES (?, ?, "Savings", ?, "INR", "active")',
                (user_id, acc_num, bal)
            )
            print(f"    Created account SB{str(user_id).zfill(12)} with balance INR {bal:.2f}")
        continue
    
    # Create user
    pw_hash = generate_password_hash(u['password'])
    created_at = get_random_date(90, 2)
    cursor.execute(
        'INSERT INTO users (username, password, email, name, phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, "active", ?, ?)',
        (u['username'], pw_hash, u['email'], u['name'], u['phone'], created_at, created_at)
    )
    user_id = cursor.lastrowid
    
    # Create savings account
    acc_num = f"SB{str(user_id).zfill(12)}"
    initial_balance = round(random.uniform(75000, 500000), 2)
    cursor.execute(
        'INSERT INTO accounts (user_id, account_number, account_type, balance, currency, status, created_at, updated_at) VALUES (?, ?, "Savings", ?, "INR", "active", ?, ?)',
        (user_id, acc_num, initial_balance, created_at, created_at)
    )
    account_id = cursor.lastrowid
    current_balance = initial_balance
    
    # Generate realistic transactions (15-25 transactions)
    num_txns = random.randint(15, 25)
    for i in range(num_txns):
        txn_type = random.choice(['credit', 'debit', 'debit'])  # more debits = more realistic
        amount = round(random.uniform(500, 30000), 2)
        txn_date = get_random_date(85, 0)
        ref = gen_ref()
        
        if txn_type == 'credit':
            desc = random.choice(['Salary Credit', 'Cash Deposit', 'Interest Credit', 'Received Payment', 'Refund'])
            current_balance += amount
        else:
            desc = random.choice(['Utility Bill', 'ATM Withdrawal', 'Online Shopping', 'Grocery Purchase', 'EMI Payment', 'Insurance Premium'])
            if current_balance - amount < 1000:
                continue  # Keep minimum balance
            current_balance -= amount
        
        mode = random.choice(['UPI', 'NEFT', 'IMPS', 'ATM', 'RTGS'])
        current_balance = round(current_balance, 2)
        
        cursor.execute(
            'INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, transaction_date, mode, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "completed")',
            (account_id, txn_type, amount, desc, ref, current_balance, txn_date, mode)
        )
    
    # Update final balance
    cursor.execute("UPDATE accounts SET balance=? WHERE id=?", (current_balance, account_id))
    
    # Maybe add a loan (50% chance)
    if random.choice([True, False]):
        loan_type = random.choice(['Personal', 'Home', 'Vehicle', 'Education'])
        loan_amt = round(random.uniform(100000, 1500000), 2)
        tenure = random.choice([12, 24, 36, 60])
        rate = round(random.uniform(7.5, 12.5), 2)
        loan_status = random.choice(['pending', 'approved', 'active'])
        cursor.execute(
            'INSERT INTO loans (user_id, loan_type, loan_amount, interest_rate, tenure_months, outstanding_amount, status, application_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (user_id, loan_type, loan_amt, rate, tenure, round(loan_amt * 0.85, 2), loan_status, get_random_date(30, 0))
        )
    
    # Maybe add a card (60% chance)
    if random.choice([True, True, False]):
        card_num = f"{random.randint(4000,4999)}{random.randint(1000,9999)}{random.randint(1000,9999)}{random.randint(1000,9999)}"
        expiry = (datetime.now() + timedelta(days=365*3)).strftime('%Y-%m-%d')
        cvv = str(random.randint(100, 999))
        c_type = random.choice(['Debit', 'Credit'])
        cursor.execute(
            'INSERT INTO cards (user_id, account_id, card_number, card_type, card_holder_name, expiry_date, cvv, status) VALUES (?, ?, ?, ?, ?, ?, ?, "active")',
            (user_id, account_id, card_num, c_type, u['name'], expiry, cvv)
        )
    
    created.append(u['username'])
    print(f"  CREATED: {u['username']} (id={user_id}) | account={acc_num} | balance=INR {current_balance:.2f} | txns={num_txns}")

conn.commit()

# --- Final summary ---
print("\n" + "=" * 60)
print("FINAL DATABASE STATE")
print("=" * 60)

for t in tables:
    cnt = cursor.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {cnt} records")

print("\n--- All 5 Target Users (Final State) ---")
for u in USERS:
    row = cursor.execute("SELECT id, username, name, status FROM users WHERE username=?", (u['username'],)).fetchone()
    if row:
        acc = cursor.execute("SELECT account_number, balance FROM accounts WHERE user_id=?", (row['id'],)).fetchone()
        txn_cnt = cursor.execute("SELECT COUNT(*) FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.user_id=?", (row['id'],)).fetchone()[0]
        loan_cnt = cursor.execute("SELECT COUNT(*) FROM loans WHERE user_id=?", (row['id'],)).fetchone()[0]
        card_cnt = cursor.execute("SELECT COUNT(*) FROM cards WHERE user_id=?", (row['id'],)).fetchone()[0]
        print(f"\n  User: {row['username']} (id={row['id']})")
        print(f"    Status: {row['status']}")
        print(f"    Login: username={u['username']}, password={u['password']}")
        print(f"    Account: {acc['account_number'] if acc else 'N/A'}")
        print(f"    Balance: INR {acc['balance']:.2f}" if acc else "    Balance: N/A")
        print(f"    Transactions: {txn_cnt}, Loans: {loan_cnt}, Cards: {card_cnt}")
    else:
        print(f"  {u['username']}: NOT FOUND!")

conn.close()

print("\n" + "=" * 60)
print("SETUP COMPLETE!")
print("Created:", created)
print("Skipped (already existed):", skipped)
print("=" * 60)
print("\nTo start the backend: python backend/app.py")
print("Backend runs at: http://127.0.0.1:5001")
