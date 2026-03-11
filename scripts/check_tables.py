import sqlite3
conn = sqlite3.connect('database/smart_bank.db')
print("=== STAFF COLUMNS ===")
cols = conn.execute("PRAGMA table_info(staff)").fetchall()
print([c[1] for c in cols])
print("=== SAMPLE STAFF ===")
rows = conn.execute("SELECT * FROM staff LIMIT 2").fetchall()
for r in rows:
    print(dict(zip([c[1] for c in conn.execute('PRAGMA table_info(staff)')], r)))
print("=== SYSTEM_FINANCES ===")
for r in conn.execute("SELECT * FROM system_finances").fetchall():
    print(r)
