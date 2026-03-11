import sqlite3
import os

db_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\backend\smart_bank.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print(f"Connected to: {db_path}")

print("\n--- Users (first 5) ---")
try:
    users = cursor.execute("SELECT id, username, role, name FROM users LIMIT 5").fetchall()
    for u in users:
        print(dict(u))
except Exception as e:
    print(f"Users table error: {e}")

print("\n--- Staff (first 5) ---")
try:
    staff = cursor.execute("SELECT id, name, email FROM staff LIMIT 5").fetchall()
    for s in staff:
        print(dict(s))
except Exception as e:
    print(f"Staff table error: {e}")

print("\n--- Admins (first 5) ---")
try:
    admins = cursor.execute("SELECT id, name, username FROM admins LIMIT 5").fetchall()
    for a in admins:
        print(dict(a))
except Exception as e:
    print(f"Admins table error: {e}")

print("\n--- Service Applications (first 5) ---")
try:
    apps = cursor.execute("SELECT * FROM service_applications LIMIT 5").fetchall()
    for app in apps:
        print(dict(app))
except Exception as e:
    print(f"Service Applications table error: {e}")

conn.close()
