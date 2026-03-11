import sqlite3
import os

db_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\smart_bank.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f"Tables in {db_path}:")
for t in tables:
    print(t[0])
conn.close()
