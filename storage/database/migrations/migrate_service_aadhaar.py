import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Note: In previous turns I found the DB is in the 'database' folder
DATABASE = os.path.join(BASE_DIR, '..', 'database', 'smart_bank.db')

def migrate():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Add aadhaar_number column if it doesn't exist
        cursor.execute("ALTER TABLE service_applications ADD COLUMN aadhaar_number TEXT")
        print("Column aadhaar_number added to service_applications table.")
    except sqlite3.OperationalError:
        print("Column aadhaar_number already exists or another error occurred.")
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    migrate()
