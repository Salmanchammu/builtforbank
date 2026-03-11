import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'smart_bank.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Checking for base_salary column in staff table...")
    cursor.execute('PRAGMA table_info(staff)')
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'base_salary' not in columns:
        print("Adding base_salary column to staff table...")
        cursor.execute('ALTER TABLE staff ADD COLUMN base_salary DECIMAL(15, 2) DEFAULT 0.00')
        print("Done!")
    else:
        print("Column already exists.")
        
    conn.commit()
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
