import sqlite3
import os

dbs = ['bank.db', 'smartbank.db', 'smart_bank.db']

query = """
CREATE TABLE IF NOT EXISTS bank_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    lat DECIMAL(10, 6) NOT NULL,
    lng DECIMAL(10, 6) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

for db in dbs:
    if os.path.exists(db):
        print(f"Applying schema to {db}")
        conn = sqlite3.connect(db)
        conn.execute(query)
        conn.commit()
        conn.close()
        print(f"Success for {db}")
    else:
        print(f"Skipped {db} (not found)")

print("Done.")
