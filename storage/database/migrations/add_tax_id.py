import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '..', 'database', 'smart_bank.db')

def migrate(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        cur.execute("ALTER TABLE account_requests ADD COLUMN tax_id VARCHAR(50)")
        print("Added tax_id to account_requests")
    except sqlite3.OperationalError as e:
        print(f"Skipped account_requests: {e}")
        
    try:
        cur.execute("ALTER TABLE accounts ADD COLUMN tax_id VARCHAR(50)")
        print("Added tax_id to accounts")
    except sqlite3.OperationalError as e:
        print(f"Skipped accounts: {e}")
        
    conn.commit()
    conn.close()
    
if __name__ == "__main__":
    migrate(DB_PATH)
