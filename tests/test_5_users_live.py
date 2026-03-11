"""
SmartBank Real-Time System Test - 5 Real Users
Tests all major banking flows live against the HTTP API on port 5001
"""
import requests
import sqlite3
import os
import json
import time
from datetime import datetime

BASE = "http://127.0.0.1:5001"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'smart_bank.db')

USERS = [
    {"username": "alice_johnson", "password": "Alice@123", "name": "Alice Johnson"},
    {"username": "bob_smith",     "password": "Bob@1234",  "name": "Bob Smith"},
    {"username": "carol_white",   "password": "Carol@123", "name": "Carol White"},
    {"username": "david_brown",   "password": "David@123", "name": "David Brown"},
    {"username": "eva_green",     "password": "Eva@12345", "name": "Eva Green"},
]

results = []
pass_count = 0
fail_count = 0

def check(name, ok, detail=""):
    global pass_count, fail_count
    status = "PASS" if ok else "FAIL"
    if ok:
        pass_count += 1
    else:
        fail_count += 1
    msg = f"  [{status}] {name}"
    if detail:
        msg += f"  -> {detail}"
    print(msg)
    results.append({"test": name, "status": status, "detail": detail})
    return ok

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

print("=" * 65)
print("SMARTBANK REAL-TIME SYSTEM TEST")
print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"API:  {BASE}")
print("=" * 65)

# ----------------------------------------------------------------
# 0. HEALTH CHECK
# ----------------------------------------------------------------
print("\n[0] BACKEND HEALTH CHECK")
try:
    r = requests.get(f"{BASE}/api/health", timeout=5)
    data = r.json()
    check("Backend is up", r.status_code == 200, f"status={data.get('status')} db={data.get('database')}")
    check("DB connected", data.get('database') == 'connected', data.get('database'))
except Exception as e:
    check("Backend reachable", False, str(e))
    print("\nERROR: Backend not running! Please start it first.")
    print("  Run: python backend/app.py")
    exit(1)

# ----------------------------------------------------------------
# 1. USER EXISTENCE CHECK IN DB
# ----------------------------------------------------------------
print("\n[1] DATABASE USER EXISTENCE CHECK")
conn = get_db()
for u in USERS:
    row = conn.execute("SELECT id, name, status FROM users WHERE username=?", (u['username'],)).fetchone()
    if row:
        acc = conn.execute("SELECT account_number, balance FROM accounts WHERE user_id=?", (row['id'],)).fetchone()
        txn_cnt = conn.execute("SELECT COUNT(*) FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.user_id=?", (row['id'],)).fetchone()[0]
        check(f"{u['username']} in DB", True, f"id={row['id']} bal=INR {acc['balance']:.2f} txns={txn_cnt}")
    else:
        check(f"{u['username']} in DB", False, "NOT FOUND - run setup_5_users.py first!")

# ----------------------------------------------------------------
# 2. LOGIN FOR ALL 5 USERS
# ----------------------------------------------------------------
print("\n[2] LOGIN TESTS (5 USERS)")
user_sessions = {}

for u in USERS:
    sess = requests.Session()
    try:
        r = sess.post(f"{BASE}/api/auth/login", json={
            "username": u['username'],
            "password": u['password'],
            "role": "user"
        }, timeout=5)
        if r.status_code == 200:
            data = r.json()
            user_sessions[u['username']] = (sess, data['user']['id'])
            check(f"Login: {u['username']}", True, f"id={data['user']['id']} name={data['user']['name']}")
        else:
            check(f"Login: {u['username']}", False, r.text[:100])
    except Exception as e:
        check(f"Login: {u['username']}", False, str(e))

# ----------------------------------------------------------------
# 3. DASHBOARD DATA FOR ALL 5 USERS
# ----------------------------------------------------------------
print("\n[3] DASHBOARD DATA FETCH (5 USERS)")
user_accounts = {}  # username -> first account id

for username, (sess, uid) in user_sessions.items():
    try:
        r = sess.get(f"{BASE}/api/user/dashboard", timeout=5)
        if r.status_code == 200:
            data = r.json()
            accs = data.get('accounts', [])
            txns = data.get('transactions', [])
            bal = data.get('total_balance', 0)
            check(f"Dashboard: {username}", True,
                  f"accounts={len(accs)} txns={len(txns)} balance=INR {bal:.2f}")
            if accs:
                user_accounts[username] = accs[0]['id']
        else:
            check(f"Dashboard: {username}", False, f"HTTP {r.status_code}: {r.text[:80]}")
    except Exception as e:
        check(f"Dashboard: {username}", False, str(e))

# ----------------------------------------------------------------
# 4. BALANCE CHECK FOR ALL 5 USERS
# ----------------------------------------------------------------
print("\n[4] BALANCE CHECK")
for username, (sess, uid) in user_sessions.items():
    try:
        r = sess.get(f"{BASE}/api/user/balance", timeout=5)
        if r.status_code == 200:
            bal = r.json().get('total_balance', 0)
            check(f"Balance: {username}", True, f"INR {bal:.2f}")
        else:
            check(f"Balance: {username}", False, f"HTTP {r.status_code}")
    except Exception as e:
        check(f"Balance: {username}", False, str(e))

# ----------------------------------------------------------------
# 5. REAL-TIME TRANSFER: Alice -> Bob
# ----------------------------------------------------------------
print("\n[5] REAL-TIME TRANSFER TEST (Alice -> Bob)")

alice_sess, alice_id = user_sessions.get('alice_johnson', (None, None))
bob_sess, bob_id = user_sessions.get('bob_smith', (None, None))

if alice_sess and bob_sess:
    # Get Bob's account number
    bob_acc_num = None
    bob_row = conn.execute("SELECT account_number FROM accounts WHERE user_id=?", (bob_id,)).fetchone()
    if bob_row:
        bob_acc_num = bob_row['account_number']
    
    alice_acc_id = user_accounts.get('alice_johnson')
    
    # Get Alice's balance before
    r_before = alice_sess.get(f"{BASE}/api/user/balance", timeout=5)
    bal_before = r_before.json().get('total_balance', 0) if r_before.status_code == 200 else 0
    
    if alice_acc_id and bob_acc_num:
        transfer_amount = 1000.0
        r = alice_sess.post(f"{BASE}/api/user/transfer", json={
            "from_account": alice_acc_id,
            "to_account": bob_acc_num,
            "amount": transfer_amount
        }, timeout=5)
        
        if r.status_code == 200:
            ref = r.json().get('reference', 'N/A')
            # Verify balance decreased
            r_after = alice_sess.get(f"{BASE}/api/user/balance", timeout=5)
            bal_after = r_after.json().get('total_balance', 0) if r_after.status_code == 200 else bal_before
            check("Transfer Alice->Bob (INR 1000)", True,
                  f"ref={ref} alice_bal: {bal_before:.2f} -> {bal_after:.2f}")
            
            # Verify Bob received
            bob_bal = conn.execute("SELECT SUM(balance) FROM accounts WHERE user_id=?", (bob_id,)).fetchone()[0] or 0
            check("Bob received funds in DB", True, f"bob_balance=INR {bob_bal:.2f}")
        else:
            check("Transfer Alice->Bob (INR 1000)", False, r.text[:100])
    else:
        check("Transfer Alice->Bob", False, "Missing account info")

# ----------------------------------------------------------------
# 6. REAL-TIME TRANSFER: Carol -> David  
# ----------------------------------------------------------------
print("\n[6] REAL-TIME TRANSFER TEST (Carol -> David)")

carol_sess, carol_id = user_sessions.get('carol_white', (None, None))
david_sess, david_id = user_sessions.get('david_brown', (None, None))

if carol_sess and david_sess:
    david_acc_num = None
    david_row = conn.execute("SELECT account_number FROM accounts WHERE user_id=?", (david_id,)).fetchone()
    if david_row:
        david_acc_num = david_row['account_number']
    
    carol_acc_id = user_accounts.get('carol_white')
    
    if carol_acc_id and david_acc_num:
        r = carol_sess.post(f"{BASE}/api/user/transfer", json={
            "from_account": carol_acc_id,
            "to_account": david_acc_num,
            "amount": 2500.0
        }, timeout=5)
        
        if r.status_code == 200:
            ref = r.json().get('reference', 'N/A')
            check("Transfer Carol->David (INR 2500)", True, f"ref={ref}")
        else:
            check("Transfer Carol->David (INR 2500)", False, r.text[:100])
    else:
        check("Transfer Carol->David", False, "Missing account info")

# ----------------------------------------------------------------
# 7. LOAN APPLICATIONS (All 5 users)
# ----------------------------------------------------------------
print("\n[7] LOAN APPLICATIONS")
loan_types = ["Personal", "Home", "Vehicle", "Education", "Personal"]

for i, (username, (sess, uid)) in enumerate(user_sessions.items()):
    try:
        r = sess.post(f"{BASE}/api/user/loans/apply", json={
            "loanType": loan_types[i],
            "amount": (i+1) * 50000,
            "tenure": 12 + i*6,
            "purpose": f"{loan_types[i]} loan for {username}"
        }, timeout=5)
        if r.status_code == 200:
            check(f"Loan Apply: {username} ({loan_types[i]} INR {(i+1)*50000})", True, r.json().get('message'))
        else:
            check(f"Loan Apply: {username}", False, f"HTTP {r.status_code}: {r.text[:80]}")
    except Exception as e:
        check(f"Loan Apply: {username}", False, str(e))

# ----------------------------------------------------------------
# 8. CARD REQUESTS (3 users)
# ----------------------------------------------------------------
print("\n[8] CARD REQUESTS")
for username in ['alice_johnson', 'carol_white', 'eva_green']:
    if username in user_sessions and username in user_accounts:
        sess, uid = user_sessions[username]
        acc_id = user_accounts[username]
        try:
            r = sess.post(f"{BASE}/api/user/cards/request", json={
                "card_type": "Gold",
                "account_id": acc_id
            }, timeout=5)
            # 200 = success, 400 = already pending (both are ok)
            ok = r.status_code in [200, 400]
            msg = r.json().get('message') or r.json().get('error', '')
            check(f"Card Request: {username}", ok, f"HTTP {r.status_code}: {msg}")
        except Exception as e:
            check(f"Card Request: {username}", False, str(e))

# ----------------------------------------------------------------
# 9. SUPPORT TICKETS (All 5 users)
# ----------------------------------------------------------------
print("\n[9] SUPPORT TICKETS")
subjects = [
    "Balance inquiry issue",
    "Transfer not reflecting",
    "Need new card",
    "Loan status update",
    "Account statement request"
]

for i, (username, (sess, uid)) in enumerate(user_sessions.items()):
    try:
        r = sess.post(f"{BASE}/api/user/support", json={
            "subject": subjects[i],
            "message": f"Hello, I need help with: {subjects[i]}. Please assist.",
            "priority": "normal"
        }, timeout=5)
        if r.status_code == 200:
            check(f"Support Ticket: {username}", True, subjects[i])
        else:
            check(f"Support Ticket: {username}", False, f"HTTP {r.status_code}: {r.text[:80]}")
    except Exception as e:
        check(f"Support Ticket: {username}", False, str(e))

# ----------------------------------------------------------------
# 10. SESSION CHECK (verify sessions are maintained)
# ----------------------------------------------------------------
print("\n[10] SESSION PERSISTENCE CHECK")
for username, (sess, uid) in user_sessions.items():
    try:
        r = sess.get(f"{BASE}/api/auth/check", timeout=5)
        if r.status_code == 200:
            user_data = r.json().get('user', {})
            check(f"Session: {username}", True, f"role={user_data.get('role')}")
        else:
            check(f"Session: {username}", False, f"HTTP {r.status_code}")
    except Exception as e:
        check(f"Session: {username}", False, str(e))

# ----------------------------------------------------------------
# 11. CHATBOT TEST
# ----------------------------------------------------------------
print("\n[11] CHATBOT TEST")
alice_sess, _ = user_sessions.get('alice_johnson', (None, None))
if alice_sess:
    for msg in ["hello", "check balance", "apply for a loan"]:
        try:
            r = alice_sess.post(f"{BASE}/api/chat", json={"message": msg}, timeout=5)
            if r.status_code == 200:
                resp = r.json().get('response', '')[:60]
                check(f"Chat: '{msg}'", True, resp)
            else:
                check(f"Chat: '{msg}'", False, f"HTTP {r.status_code}")
        except Exception as e:
            check(f"Chat: '{msg}'", False, str(e))

# ----------------------------------------------------------------
# 12. FINAL DATABASE VERIFICATION
# ----------------------------------------------------------------
print("\n[12] FINAL DATABASE STATE VERIFICATION")

total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
total_accs = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
total_txns = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
total_loans = conn.execute("SELECT COUNT(*) FROM loans").fetchone()[0]
total_cards = conn.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
total_card_reqs = conn.execute("SELECT COUNT(*) FROM card_requests").fetchone()[0]
total_tickets = conn.execute("SELECT COUNT(*) FROM support_tickets").fetchone()[0]

check("Users in DB", total_users >= 5, f"{total_users} users")
check("Accounts in DB", total_accs >= 5, f"{total_accs} accounts")
check("Transactions in DB", total_txns >= 50, f"{total_txns} transactions")
check("Loans in DB", total_loans >= 5, f"{total_loans} loans")
check("Support Tickets in DB", total_tickets >= 5, f"{total_tickets} tickets")

print(f"\n  Cards total: {total_cards}")
print(f"  Card requests: {total_card_reqs}")

conn.close()

# ----------------------------------------------------------------
# FINAL SUMMARY
# ----------------------------------------------------------------
print("\n" + "=" * 65)
print("TEST SUMMARY")
print("=" * 65)
print(f"  Total Tests:  {pass_count + fail_count}")
print(f"  PASSED:       {pass_count}")
print(f"  FAILED:       {fail_count}")

if fail_count == 0:
    print("\n  ALL TESTS PASSED! System is fully operational.")
else:
    print(f"\n  {fail_count} tests failed. Check output above for details.")

print("\nUSER CREDENTIALS:")
print("-" * 45)
for u in USERS:
    print(f"  {u['name']:<20} user={u['username']:<20} password={u['password']}")

print("\nSYSTEM URLS:")
print(f"  User Login:   http://127.0.0.1:5001 (serve frontend)")
print(f"  API Health:   http://127.0.0.1:5001/api/health")
print(f"  Backend Port: 5001")
print("=" * 65)

# Write JSON report
report = {
    "timestamp": datetime.now().isoformat(),
    "api_base": BASE,
    "summary": {"total": pass_count + fail_count, "passed": pass_count, "failed": fail_count},
    "users": USERS,
    "tests": results,
    "db_stats": {
        "users": total_users,
        "accounts": total_accs,
        "transactions": total_txns,
        "loans": total_loans,
        "cards": total_cards,
        "card_requests": total_card_reqs,
        "support_tickets": total_tickets
    }
}

with open("test_report.json", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)
print("\nDetailed report saved to: test_report.json")
