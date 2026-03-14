import sqlite3
import os
import json

db_path = 'storage/database/smart_bank.db'
if not os.path.exists(db_path):
    print(json.dumps({"error": f"{db_path} not found"}))
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Core tables to migrate
core_tables = ['users', 'admins', 'staff', 'accounts', 'transactions', 'loans', 'cards', 'notifications', 'service_applications']

stats = {}
total_core_bytes = 0

for table in core_tables:
    try:
        cursor.execute(f"PRAGMA table_info({table})")
        cols = [c['name'] for c in cursor.fetchall()]
        
        sum_expr = " + ".join([f"COALESCE(length({c}), 0)" for c in cols])
        cursor.execute(f"SELECT SUM({sum_expr}) FROM {table}")
        table_bytes = cursor.fetchone()[0] or 0
        
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        rows = cursor.fetchone()[0]
        
        # Check size WITHOUT blobs if any column looks like a blob
        # (Assuming 'kyc_video', 'aadhaar_proof', 'pan_proof' are the large ones)
        large_cols = ['kyc_video', 'aadhaar_proof', 'pan_proof', 'kyc_photo', 'profile_image']
        core_cols = [c for c in cols if c not in large_cols]
        if core_cols:
            sum_core_expr = " + ".join([f"COALESCE(length({c}), 0)" for c in core_cols])
            cursor.execute(f"SELECT SUM({sum_core_expr}) FROM {table}")
            core_bytes = cursor.fetchone()[0] or 0
        else:
            core_bytes = 0

        stats[table] = {
            "total_kb": table_bytes / 1024,
            "core_kb": core_bytes / 1024,
            "rows": rows
        }
        total_core_bytes += core_bytes
    except Exception as e:
        stats[table] = {"error": str(e)}

print(json.dumps({
    "total_core_kb": total_core_bytes / 1024,
    "tables": stats
}, indent=2))
conn.close()
