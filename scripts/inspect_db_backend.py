import sqlite3
import os

def inspect():
    # Try common database locations
    paths = [
        'backend/bank.db',
        'bank.db',
        'database/bank.db'
    ]
    
    for db_path in paths:
        if os.path.exists(db_path):
            print(f"Checking database at: {db_path}")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            try:
                cursor.execute("PRAGMA table_info(account_requests)")
                columns = cursor.fetchall()
                print(f"Columns in account_requests:")
                for col in columns:
                    print(f"  {col[1]} ({col[2]})")
            except Exception as e:
                print(f"Error inspecting {db_path}: {e}")
            conn.close()

if __name__ == "__main__":
    inspect()
