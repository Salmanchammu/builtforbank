import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '..', 'database', 'smart_bank.db')

def migrate(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        cur.execute("ALTER TABLE users ADD COLUMN daily_limit DECIMAL(15,2) DEFAULT 200000.00")
        print("Added daily_limit to users")
    except sqlite3.OperationalError as e:
        print(f"Skipped users daily_limit: {e}")
        
    conn.commit()
    conn.close()
    
if __name__ == "__main__":
    migrate(DB_PATH)
