import sqlite3
import os

db_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\database\smart_bank.db'

if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'otp' not in columns:
        print("Adding 'otp' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN otp VARCHAR(10)")
    else:
        print("'otp' column already exists.")
        
    if 'otp_expiry' not in columns:
        print("Adding 'otp_expiry' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN otp_expiry TIMESTAMP")
    else:
        print("'otp_expiry' column already exists.")
        
    conn.commit()
    print("Migration successful!")
    conn.close()
except Exception as e:
    print(f"Migration failed: {e}")
    exit(1)
