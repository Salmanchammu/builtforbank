import sqlite3
import os

db_path = 'database/smartbank.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

columns = [
    ('foreign_currency', 'VARCHAR(3) DEFAULT NULL'),
    ('foreign_amount', 'DECIMAL(15, 2) DEFAULT NULL'),
    ('exchange_rate', 'DECIMAL(15, 6) DEFAULT NULL')
]

for col_name, col_type in columns:
    try:
        c.execute(f"ALTER TABLE transactions ADD COLUMN {col_name} {col_type}")
        print(f"Added column {col_name}")
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e).lower():
            print(f"Column {col_name} already exists")
        else:
            print(f"Error adding {col_name}: {e}")

conn.commit()
conn.close()
print("Database migration completed")
