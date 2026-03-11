import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), 'smart_bank.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print(f"Connecting to database at: {db_path}")

    try:
        # Add aadhaar_proof column
        cursor.execute("ALTER TABLE account_requests ADD COLUMN aadhaar_proof TEXT")
        print("Added aadhaar_proof column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("aadhaar_proof column already exists.")
        else:
            print(f"Error adding aadhaar_proof: {e}")

    try:
        # Add pan_proof column
        cursor.execute("ALTER TABLE account_requests ADD COLUMN pan_proof TEXT")
        print("Added pan_proof column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("pan_proof column already exists.")
        else:
            print(f"Error adding pan_proof: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
