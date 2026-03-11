import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smart_bank.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print(f"Connecting to database at {DB_PATH}...")
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS service_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        tenure VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        account_id INTEGER NOT NULL,
        application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_date TIMESTAMP,
        processed_by INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
    """)
    conn.commit()
    conn.close()
    print("Service applications table created successfully.")

if __name__ == "__main__":
    migrate()
