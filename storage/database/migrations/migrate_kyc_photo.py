"""
Migration: Add kyc_photo column to account_requests table.
Run once: python migrate_kyc_photo.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'smart_bank.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check if column already exists
    cur.execute("PRAGMA table_info(account_requests)")
    cols = [row[1] for row in cur.fetchall()]

    if 'kyc_photo' not in cols:
        cur.execute("ALTER TABLE account_requests ADD COLUMN kyc_photo TEXT")
        conn.commit()
        print("✅ Added 'kyc_photo' column to account_requests table.")
    else:
        print("ℹ️  'kyc_photo' column already exists — skipping.")

    conn.close()

if __name__ == '__main__':
    migrate()
