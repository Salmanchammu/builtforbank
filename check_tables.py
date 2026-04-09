import sqlite3
import os

db_path = 'database/smartbank.db'
if not os.path.exists(db_path):
    print(f"ERROR: Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = c.fetchall()
print("Tables in database:")
for t in tables:
    print(f"- {t[0]}")
conn.close()
