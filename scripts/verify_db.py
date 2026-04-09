import sys
import os
import sqlite3

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from core.constants import DATABASE

try:
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row['name'] for row in cursor.fetchall()]
    print(f"Tables in DB: {tables}")
    
    # 2. Check agriculture_loans
    if 'agriculture_loans' in tables:
        cursor.execute("SELECT COUNT(*) as count FROM agriculture_loans")
        print(f"Agriculture Loans count: {cursor.fetchone()['count']}")
    else:
        print("❌ agriculture_loans table STILL missing!")
        
    conn.close()
except Exception as e:
    print(f"❌ Verification failed: {e}")
