import sqlite3
import os

db_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\database\smart_bank.db'

def check():
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("--- SYSTEM FINANCES ---")
    finances = cursor.execute("SELECT * FROM system_finances").fetchall()
    for row in finances:
        print(dict(row))

    print("\n--- LOAN STATUS COUNTS ---")
    loan_counts = cursor.execute("SELECT status, COUNT(*) as count FROM loans GROUP BY status").fetchall()
    for row in loan_counts:
        print(dict(row))

    print("\n--- DASHBOARD STATS ---")
    total_users = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    total_deposits = cursor.execute("SELECT SUM(balance) FROM accounts").fetchone()[0] or 0
    active_staff = cursor.execute("SELECT COUNT(*) FROM staff WHERE status = 'active'").fetchone()[0]
    today_tx = cursor.execute("SELECT COUNT(*) FROM transactions WHERE date(transaction_date) = date('now')").fetchone()[0]
    
    print(f"Total Users: {total_users}")
    print(f"Total Deposits: {total_deposits}")
    print(f"Active Staff: {active_staff}")
    print(f"Today's Transactions: {today_tx}")

    print("\n--- ADDITIONAL COUNTS ---")
    audit_count = cursor.execute("SELECT COUNT(*) FROM system_audit").fetchone()[0]
    tx_count = cursor.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    print(f"Audit Logs: {audit_count}")
    print(f"Total Transactions: {tx_count}")

    conn.close()

if __name__ == "__main__":
    check()
