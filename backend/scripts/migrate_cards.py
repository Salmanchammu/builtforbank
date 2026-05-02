import sqlite3
import os
import sys

def migrate():
    # Use the same path as core.constants
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    storage_dir = os.path.abspath(os.path.join(base_dir, '..', 'database'))
    db_path = os.path.abspath(os.path.join(storage_dir, 'smartbank.db'))
    
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    columns_to_add = [
        ("pin_hash", "VARCHAR(255)"),
        ("contactless_enabled", "INTEGER DEFAULT 1"),
        ("international_enabled", "INTEGER DEFAULT 0"),
        ("online_txn_enabled", "INTEGER DEFAULT 1"),
        ("daily_limit", "DECIMAL(15, 2) DEFAULT 50000.00")
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            c.execute(f"ALTER TABLE cards ADD COLUMN {col_name} {col_type}")
            print(f"Successfully added column '{col_name}' to 'cards' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column '{col_name}' already exists. Skipping.")
            else:
                print(f"Error adding column '{col_name}': {e}")
                
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate()
