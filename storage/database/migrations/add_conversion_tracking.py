import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '..', 'database', 'smart_bank.db')

def migrate(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        cur.execute("ALTER TABLE account_requests ADD COLUMN original_account_id INTEGER")
        print("Added original_account_id to account_requests")
    except sqlite3.OperationalError as e:
        print(f"Skipped original_account_id: {e}")
        
    conn.commit()
    conn.close()
    
if __name__ == "__main__":
    migrate(DB_PATH)
