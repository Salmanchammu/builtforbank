import sqlite3
import os

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')
db = sqlite3.connect(DB)

tables = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
table_names = [t[0] for t in tables]
print("All Tables:", table_names)

for t in table_names:
    if 'agri' in t.lower() or 'crop' in t.lower() or 'land' in t.lower() or 'loan' in t.lower():
        print(f"\n--- {t} ---")
        cols = db.execute(f"PRAGMA table_info({t})").fetchall()
        for c in cols:
            print(f"  {c[1]} ({c[2]})")
