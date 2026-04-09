import sqlite3
import os

dbs = [
    r'database/smartbank.db',
    r'backend/smartbank.db',
    r'backend/database.db',
    r'backend/bank.db'
]

print("--- Data Consolidation Audit ---")
for db_path in dbs:
    if not os.path.exists(db_path):
        print(f"PATH: {db_path} - NOT FOUND")
        continue
    
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Check counts
        users = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        try: admins = cur.execute("SELECT COUNT(*) FROM admins").fetchone()[0]
        except: admins = 0
        try: staff = cur.execute("SELECT COUNT(*) FROM staff").fetchone()[0]
        except: staff = 0
        try: trans = cur.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        except: trans = 0
        
        # Get one example from each
        u_sample = cur.execute("SELECT username FROM users LIMIT 1").fetchone()
        a_sample = cur.execute("SELECT username FROM admins LIMIT 1").fetchone() if admins > 0 else (None,)
        s_sample = cur.execute("SELECT name FROM staff LIMIT 1").fetchone() if staff > 0 else (None,)
        
        print(f"\nPATH: {db_path}")
        print(f"  Users: {users} (Example: {u_sample[0]})")
        print(f"  Admins: {admins} (Example: {a_sample[0]})")
        print(f"  Staff: {staff} (Example: {s_sample[0]})")
        print(f"  Transactions: {trans}")
        
        conn.close()
    except Exception as e:
        print(f"PATH: {db_path} - ERROR: {e}")
