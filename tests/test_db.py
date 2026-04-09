import sqlite3
import os
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')
db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row
try:
    print("Users count:", db.execute('SELECT COUNT(*) FROM users').fetchone()[0])
    print("Pending loans:", db.execute('SELECT COUNT(*) FROM loans WHERE status = "pending"').fetchone()[0])
    print("Total balance:", db.execute('SELECT SUM(balance) FROM accounts').fetchone()[0] or 0)
    print("Active accounts:", db.execute('SELECT COUNT(*) FROM accounts WHERE status = "active"').fetchone()[0])
    
    pending_loans_cur = db.execute('''
        SELECT l.id, l.loan_type as title, u.name as customer, "high" as priority 
        FROM loans l JOIN users u ON l.user_id = u.id 
        WHERE l.status = "pending" ORDER BY l.application_date DESC LIMIT 5
    ''').fetchall()
    print("Pending Loans Cur:", len(pending_loans_cur))
    
    recent_transactions_cur = db.execute('''
        SELECT t.id, t.reference_number, u.name as customer, a.account_number as account, t.type, t.amount, t.transaction_date as date, "completed" as status
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC LIMIT 5
    ''').fetchall()
    print("Recent TXN Cur:", len(recent_transactions_cur))
    
    customers = db.execute('''
        SELECT u.id, u.name, u.username, u.email, u.phone, u.status,
               COUNT(a.id) as account_count,
               SUM(COALESCE(a.balance, 0)) as total_balance
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ''').fetchall()
    print("Customers:", len(customers))
except Exception as e:
    import traceback
    traceback.print_exc()
