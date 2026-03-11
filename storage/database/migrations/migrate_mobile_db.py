import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'database', 'smart_bank.db')

def migrate():
    print(f"Migrating database at: {DATABASE}")
    if not os.path.exists(DATABASE):
        print("Database file NOT FOUND!")
        return
        
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Check current columns
    cursor.execute("PRAGMA table_info(users);")
    columns = [col[1] for col in cursor.fetchall()]
    
    new_cols = [
        ('upi_id', 'VARCHAR(50) UNIQUE'),
        ('upi_pin', 'VARCHAR(255)'),
        ('mobile_passcode', 'VARCHAR(255)'),
        ('passcode_enabled', 'INTEGER DEFAULT 0')
    ]
    
    for col_name, col_def in new_cols:
        if col_name not in columns:
            print(f"Adding column: {col_name}")
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
