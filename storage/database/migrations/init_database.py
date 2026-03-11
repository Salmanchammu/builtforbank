#!/usr/bin/env python3
"""
Smart Bank - Database Initialization (Fixed)
Run from the database/ folder: python init_database.py
"""

import sqlite3
import os
import sys

DB_PATH = 'smart_bank.db'

def init_database():
    print("=" * 52)
    print("  Smart Bank - Database Initialization")
    print("=" * 52)

    # Always work from the script's own directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # Remove old database silently so re-runs always work
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("  Removed old database")

    try:
        from werkzeug.security import generate_password_hash
    except ImportError:
        print("\n[ERROR] werkzeug not installed.")
        print("  Run:  pip install flask flask-cors werkzeug")
        sys.exit(1)

    print(f"\n  Creating: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    print("  Building tables...")

    cur.executescript("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(50),
    position VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    face_auth_enabled INTEGER DEFAULT 0,
    face_descriptor TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    level VARCHAR(50) DEFAULT 'admin',
    status VARCHAR(20) DEFAULT 'active',
    face_auth_enabled INTEGER DEFAULT 0,
    face_descriptor TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'active',
    interest_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(50) UNIQUE,
    balance_after DECIMAL(15,2),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'completed',
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_id INTEGER,
    card_number VARCHAR(20) UNIQUE NOT NULL,
    card_type VARCHAR(20) NOT NULL,
    card_holder_name VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    cvv VARCHAR(4) NOT NULL,
    credit_limit DECIMAL(15,2),
    available_credit DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'active',
    issued_date DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    loan_type VARCHAR(50) NOT NULL,
    loan_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    tenure_months INTEGER NOT NULL,
    monthly_payment DECIMAL(15,2),
    outstanding_amount DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'pending',
    application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_date TIMESTAMP,
    approved_by INTEGER,
    disbursement_date TIMESTAMP,
    target_account_id INTEGER,
    penalty_amount DECIMAL(15,2) DEFAULT 0.00,
    last_charge_date TIMESTAMP,
    next_due_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS system_finances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_name VARCHAR(100) UNIQUE NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE TABLE IF NOT EXISTS card_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_id INTEGER,
    card_type VARCHAR(20) NOT NULL,
    requested_credit_limit DECIMAL(15, 2),
    reason TEXT,
    cardholder_name VARCHAR(100),
    delivery_address TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    staff_notes TEXT,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP,
    processed_by INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    intent VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_card_requests_user ON card_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_card_requests_status ON card_requests(status);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_history(timestamp);

-- Initialize Loan Liquidity Fund
INSERT OR IGNORE INTO system_finances (fund_name, balance) VALUES ('Loan Liquidity Fund', 1000000.00);
""")
    conn.commit()
    print("  [OK] All tables created")

    print("\n  Database is ready with empty tables")
    print("  Use the signup/registration features to create accounts")

    conn.close()

    print("\n" + "=" * 52)
    print("  DATABASE READY!")
    print("=" * 52)
    print("""
  FRESH DATABASE - NO SAMPLE DATA
  --------------------------------
  All tables have been created with no pre-existing data.
  
  To get started:
  1. Start the backend server
  2. Use the signup page to create accounts
  3. Or use the backend API to register users/staff/admin
  
  Database Location:
""")
    print(f"  {os.path.abspath(DB_PATH)}")
    print("=" * 52)
    print("  NEXT STEP:  cd ../backend && python app.py")
    print("=" * 52)

if __name__ == '__main__':
    init_database()
