import sqlite3
import os

dbs = [
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\database\smartbank.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\smartbank.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\database.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\bank.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\database\smartbank.db'
]

print("--- Database Audit ---")
for db_path in dbs:
    exists = os.path.exists(db_path)
    if exists:
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('SELECT COUNT(*) FROM users')
            count = c.fetchone()[0]
            # Get the first 3 usernames to identify if it's the expected data
            c.execute('SELECT username FROM users LIMIT 3')
            users = [u[0] for u in c.fetchall()]
            print(f"PATH: {db_path}")
            print(f"COUNT: {count} users")
            print(f"SAMPLES: {users}")
            print("-" * 20)
            conn.close()
        except Exception as e:
            print(f"PATH: {db_path} - ERROR: {e}")
    else:
        print(f"PATH: {db_path} - NOT FOUND")
