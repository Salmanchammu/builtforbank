import sqlite3
import os

db_path = 'database/smartbank.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
try:
    cursor = conn.execute('SELECT id FROM service_applications LIMIT 1')
    row = cursor.fetchone()
    if row:
        app_id = row[0]
        # Test the UPDATE with processed_at
        conn.execute('UPDATE service_applications SET status = "approved", processed_at = CURRENT_TIMESTAMP WHERE id = ?', (app_id,))
        conn.commit()
        print(f"Success: verified processed_at update for ID {app_id}")
        
        # Test the SELECT with applied_at
        cursor = conn.execute('SELECT applied_at FROM service_applications WHERE id = ?', (app_id,))
        applied_at = cursor.fetchone()[0]
        print(f"Success: verified applied_at select: {applied_at}")
    else:
        print("Warning: No service applications found to test")
finally:
    conn.close()
