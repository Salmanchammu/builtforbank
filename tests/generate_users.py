import sqlite3
import random
import string
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'smart_bank.db')

def get_random_date(start_days_ago, end_days_ago):
    start_dt = datetime.now() - timedelta(days=start_days_ago)
    end_dt = datetime.now() - timedelta(days=end_days_ago)
    random_dt = start_dt + timedelta(seconds=random.randint(0, int((end_dt - start_dt).total_seconds())))
    return random_dt.strftime('%Y-%m-%d %H:%M:%S')

def generate_random_string(length):
    letters = string.ascii_uppercase
    return ''.join(random.choice(letters) for i in range(length))

users = [
    {"username": "arjun_k", "name": "Arjun Kumar", "email": "arjun@example.com", "phone": "+91 9876543211"},
    {"username": "sneha_r", "name": "Sneha Reddy", "email": "sneha@example.com", "phone": "+91 9876543212"},
    {"username": "rohit_s", "name": "Rohit Sharma", "email": "rohit@example.com", "phone": "+91 9876543213"},
    {"username": "priya_d", "name": "Priya Das", "email": "priya@example.com", "phone": "+91 9876543214"},
    {"username": "vikram_c", "name": "Vikram Chauhan", "email": "vikram@example.com", "phone": "+91 9876543215"},
    {"username": "neha_g", "name": "Neha Gupta", "email": "neha@example.com", "phone": "+91 9876543216"},
    {"username": "amit_p", "name": "Amit Patel", "email": "amit@example.com", "phone": "+91 9876543217"},
    {"username": "kavya_n", "name": "Kavya Nair", "email": "kavya@example.com", "phone": "+91 9876543218"},
    {"username": "sanjay_m", "name": "Sanjay Mishra", "email": "sanjay@example.com", "phone": "+91 9876543219"},
    {"username": "pooja_v", "name": "Pooja Verma", "email": "pooja@example.com", "phone": "+91 9876543220"}
]

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

password_hash = generate_password_hash("user123")

for u in users:
    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE username = ?", (u['username'],))
    if cursor.fetchone():
        continue

    # Insert user
    created_at = get_random_date(180, 10)
    cursor.execute('''
        INSERT INTO users (username, password, email, name, phone, status, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    ''', (u['username'], password_hash, u['email'], u['name'], u['phone'], created_at, created_at))
    
    user_id = cursor.lastrowid
    
    # Create account
    account_number = f"SB{str(user_id).zfill(12)}"
    initial_balance = random.uniform(50000, 500000)
    
    cursor.execute('''
        INSERT INTO accounts (user_id, account_number, account_type, balance, currency, status, created_at, updated_at)
        VALUES (?, ?, 'Savings', ?, 'INR', 'active', ?, ?)
    ''', (user_id, account_number, round(initial_balance, 2), created_at, created_at))
    
    account_id = cursor.lastrowid
    
    # Generate transactions
    num_txns = random.randint(10, 25)
    current_balance = initial_balance
    
    for _ in range(num_txns):
        txn_type = random.choice(['credit', 'debit'])
        amount = round(random.uniform(500, 25000), 2)
        txn_date = get_random_date(90, 0)
        reference_number = f"TXN{generate_random_string(8)}"
        
        if txn_type == 'credit':
            desc = random.choice(['Salary Credit', 'Refund', 'Cash Deposit', 'Interest Credit', 'Received from Friend'])
            current_balance += amount
        else:
            desc = random.choice(['Utility Bill', 'ATM Withdrawal', 'Online Shopping', 'Grocery Store', 'Transfer to Relative'])
            current_balance -= amount
            if current_balance < 0:
                current_balance += amount
                continue # Skip if negative
                
        mode = random.choice(['UPI', 'NEFT', 'IMPS', 'ATM'])
        
        cursor.execute('''
            INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, transaction_date, mode, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
        ''', (account_id, txn_type, amount, desc, reference_number, round(current_balance, 2), txn_date, mode))
    
    # Update final balance
    cursor.execute('UPDATE accounts SET balance = ? WHERE id = ?', (round(current_balance, 2), account_id))

    # Occasionally generate card requests or active cards
    if random.choice([True, False]):
        card_num = f"{random.randint(4000, 4999)}{random.randint(1000, 9999)}{random.randint(1000, 9999)}{random.randint(1000, 9999)}"
        expiry = (datetime.now() + timedelta(days=365*3)).strftime('%Y-%m-%d')
        cvv = str(random.randint(100, 999))
        c_type = random.choice(['Debit', 'Credit'])
        cursor.execute('''
            INSERT INTO cards (user_id, account_id, card_number, card_type, card_holder_name, expiry_date, cvv, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, "active")
        ''', (user_id, account_id, card_num, c_type, u['name'], expiry, cvv))

    # Occasionally generate loans
    if random.choice([True, False, False]):
        loan_type = random.choice(['Personal', 'Home', 'Vehicle', 'Education'])
        loan_amt = random.uniform(100000, 2000000)
        tenure = random.choice([12, 24, 36, 48, 60])
        status = random.choice(['pending', 'approved', 'active'])
        cursor.execute('''
            INSERT INTO loans (user_id, loan_type, loan_amount, interest_rate, tenure_months, outstanding_amount, status, application_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, loan_type, round(loan_amt, 2), round(random.uniform(7.5, 12.0), 2), tenure, round(loan_amt * 0.9, 2), status, get_random_date(30, 0)))

conn.commit()
conn.close()

print("Successfully generated 10 test users and populated dashboard activity.")
print("Login credentials for all new users:")
for u in users:
    print(f"Username: {u['username']}  |  Password: user123")
