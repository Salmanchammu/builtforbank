import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, '..', 'database', 'smart_bank.db')

def migrate():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Add rejection_reason column if it doesn't exist
        cursor.execute("ALTER TABLE service_applications ADD COLUMN rejection_reason TEXT")
        print("Column rejection_reason added to service_applications table.")
    except sqlite3.OperationalError:
        print("Column rejection_reason already exists or another error occurred.")
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    migrate()
