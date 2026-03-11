import sqlite3
import os

db_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\database\smart_bank.db'

if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

def add_column_if_not_exists(cursor, table, column, column_type):
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [col[1] for col in cursor.fetchall()]
    if column not in columns:
        print(f"Adding '{column}' column to '{table}'...")
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
    else:
        print(f"'{column}' column already exists in '{table}'.")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    add_column_if_not_exists(cursor, 'users', 'device_type', 'VARCHAR(20)')
    add_column_if_not_exists(cursor, 'staff', 'device_type', 'VARCHAR(20)')
    add_column_if_not_exists(cursor, 'admins', 'device_type', 'VARCHAR(20)')
    
    conn.commit()
    print("Migration successful!")
    conn.close()
except Exception as e:
    print(f"Migration failed: {e}")
    exit(1)
