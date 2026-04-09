import requests
import time
import sqlite3
import os

BASE_URL = "http://localhost:5001"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')

def print_result(name, condition, msg=""):
    print(f"{'✅ PASS' if condition else '❌ FAIL'} | {name} | {msg}")

def run_tests():
    s = requests.Session()
    
    # 1. Register and Login
    username = f"testuser_{int(time.time())}"
    reg_data = {
        "username": username, "password": "password123", "email": f"{username}@test.com",
        "name": "Test User", "phone": "1234567890", "date_of_birth": "1990-01-01"
    }
    r = s.post(f"{BASE_URL}/api/auth/signup", json=reg_data)
    print("Register response:", r.text)
    
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": "password123", "role": "user"})
    print("Login response:", r.text)
    
    if r.status_code != 200:
        print_result("Login", False, "Could not login test user")
        return
        
    user_id = r.json().get('user', {}).get('id')
    print_result("Authentication", True, f"Logged in as {username} (ID: {user_id})")
    
    import random
    acc_num_1 = f"ACC{random.randint(100000, 999999)}"
    acc_num_2 = f"ACC{random.randint(100000, 999999)}"
    # Setup test data directly in DB to bypass staff approvals
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # Add Account 1
    cur.execute("INSERT INTO accounts (user_id, account_number, account_type, balance, status) VALUES (?, ?, 'Savings', 500000.00, 'active')", (user_id, acc_num_1))
    acc1_id = cur.lastrowid
    # Add Account 2
    cur.execute("INSERT INTO accounts (user_id, account_number, account_type, balance, status) VALUES (?, ?, 'Savings', 0.00, 'active')", (user_id, acc_num_2))
    card_num = f"{random.randint(1000, 9999)}{random.randint(1000, 9999)}{random.randint(1000, 9999)}{random.randint(1000, 9999)}"
    # Add Card
    cur.execute("INSERT INTO cards (user_id, card_number, card_type, status, card_holder_name, expiry_date, cvv) VALUES (?, ?, 'Debit', 'active', 'Test User', '2030-12-31', '123')", (user_id, card_num))
    card_id = cur.lastrowid
    conn.commit()
    conn.close()
    
    # 2. Test Profile Daily Limit Update
    r = s.put(f"{BASE_URL}/api/user/profile", json={"name": "Test User", "daily_limit": 5000.00})
    print_result("Update Daily Limit", r.ok and r.json().get('success'), f"Set to 5000 -> {r.text}")
    
    # 3. Test Transfer with limit enforcement
    r = s.post(f"{BASE_URL}/api/user/transfer", json={
        "from_account": acc1_id,
        "to_account": acc_num_2,
        "amount": 6000.00,
        "description": "Test Transfer",
        "mode": "NEFT"
    })
    print_result("Transfer Exceeds Limit", r.status_code == 400 and "Daily limit" in r.text, f"Attempted 6000 limit 5000 -> {r.text}")
    
    r = s.post(f"{BASE_URL}/api/user/transfer", json={
        "from_account": acc1_id,
        "to_account": acc_num_2,
        "amount": 4000.00,
        "description": "Test Transfer",
        "mode": "NEFT"
    })
    print_result("Transfer Within Limit", r.ok, f"Attempted 4000 limit 5000 -> {r.text}")
    
    r = s.post(f"{BASE_URL}/api/user/transfer", json={
        "from_account": acc1_id,
        "to_account": acc_num_2,
        "amount": 2000.00,
        "description": "Test Transfer 2",
        "mode": "NEFT"
    })
    print_result("Transfer Exhausts Limit", r.status_code == 400 and "Daily limit" in r.text, f"Attempted 2000 limit 5000 -> {r.text}")
    
    # 4. Test Account Conversion to Current (requires tax ID and approval)
    r = s.post(f"{BASE_URL}/api/user/accounts/{acc1_id}/convert", json={"new_type": "Current", "tax_id": "TAX998877"})
    print_result("Convert Account To Current (Pending)", r.ok and "Pending" in r.text, r.text)
    
    # 5. Approve the conversion as Staff
    r_staff = requests.Session()
    r_staff.post(f"{BASE_URL}/api/auth/login", json={"username": "STF001", "password": "password123", "role": "staff"})
    
    # Get pending requests
    r_reqs = r_staff.get(f"{BASE_URL}/api/staff/account_requests")
    reqs = r_reqs.json().get('requests', [])
    pending_conversion = next((req for req in reqs if req['original_account_id'] == acc1_id), None)
    
    if pending_conversion:
        r_approve = r_staff.put(f"{BASE_URL}/api/staff/account_requests/{pending_conversion['id']}", json={"action": "approve"})
        print_result("Staff Approve Conversion", r_approve.ok, r_approve.text)
    else:
        print_result("Staff Approve Conversion", False, "Could not find pending conversion request")
    
    # Check if original account was updated
    # (Since we just rely on DB directly to check without setting up an explicit API query)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT account_type, tax_id FROM accounts WHERE id = ?", (acc1_id,))
    updated_acc = cur.fetchone()
    conn.close()
    
    if updated_acc:
        print_result("Account Successfully Updated", updated_acc[0] == "Current" and updated_acc[1] == "TAX998877", f"Type: {updated_acc[0]}, Tax ID: {updated_acc[1]}")
    else:
        print_result("Account Successfully Updated", False, "Account missing")
    
    # 6. Test Card Blocking
    r = s.post(f"{BASE_URL}/api/user/cards/{card_id}/block")
    print_result("Block Card", r.ok, r.text)
    
    r = s.post(f"{BASE_URL}/api/user/cards/{card_id}/block")
    print_result("Block Card (Already Blocked)", r.status_code == 400, r.text)

if __name__ == "__main__":
    run_tests()
