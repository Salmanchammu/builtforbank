import sqlite3
import os

db_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\database\smart_bank.db'

def check_table(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"Columns in '{table}': {columns}")
    return 'device_type' in columns

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    u = check_table(cursor, 'users')
    s = check_table(cursor, 'staff')
    a = check_table(cursor, 'admins')
    
    if u and s and a:
        print("VERIFICATION SUCCESS: device_type column found in all tables.")
    else:
        print("VERIFICATION FAILURE: device_type column missing!")
        
    conn.close()
except Exception as e:
    print(f"Error during verification: {e}")
