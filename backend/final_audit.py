import sqlite3
import os

dbs = [
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\database\smartbank.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\database\smartbank.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\smartbank.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\database.db',
    r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\bank.db'
]

results = []
for db in dbs:
    if os.path.exists(db):
        try:
            conn = sqlite3.connect(db)
            count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            results.append(f"{db}: {count} users")
            conn.close()
        except Exception as e:
            results.append(f"{db}: Error -> {str(e)}")
    else:
        results.append(f"{db}: NOT FOUND")

with open('db_final_audit.txt', 'w') as f:
    f.write("\n".join(results))
print("Audit complete. Check db_final_audit.txt")
