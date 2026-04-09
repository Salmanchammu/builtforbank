import sys
sys.path.append('.')
from core.constants import DATABASE
import sqlite3

def check():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    staff = conn.execute("SELECT staff_id, name, status FROM staff").fetchall()
    print("STAFF:")
    for s in staff:
        print(dict(s))
        
    admins = conn.execute("SELECT username, name, status FROM admins").fetchall()
    print("ADMINS:")
    for a in admins:
        print(dict(a))

if __name__ == "__main__":
    check()
