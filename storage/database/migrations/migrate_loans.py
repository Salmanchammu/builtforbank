import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'smart_bank.db')

def migrate():
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print("Migrating 'loans' table...")
    try:
        # Check if target_account_id already exists to avoid errors
        cur.execute("PRAGMA table_info(loans)")
        columns = [col[1] for col in cur.fetchall()]
        
        if 'target_account_id' not in columns:
            print("  Adding 'target_account_id' column...")
            cur.execute("ALTER TABLE loans ADD COLUMN target_account_id INTEGER REFERENCES accounts(id)")
            conn.commit()
            print("  [OK] Column added successfully")
        else:
            print("  [SKIP] 'target_account_id' already exists")
            
    except Exception as e:
        print(f"  [ERROR] Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
