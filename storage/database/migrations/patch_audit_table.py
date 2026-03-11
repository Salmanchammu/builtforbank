import sqlite3

def patch_database():
    db = sqlite3.connect('database/smart_bank.db')
    try:
        db.execute('''
            CREATE TABLE IF NOT EXISTS system_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_type TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.commit()
        print("Successfully created 'system_audit' table.")
    except Exception as e:
        print(f"Error creating table: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    patch_database()
