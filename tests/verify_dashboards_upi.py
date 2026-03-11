import requests
import json

BASE_URL = "http://localhost:5001/api"

def test_visibility():
    session = requests.Session()
    
    # 1. Login as Admin
    print("--- Testing Admin Visibility ---")
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "username": "test_admin", 
        "password": "password123",
        "role": "admin"
    })
    
    if resp.status_code != 200:
        print(f"Admin login failed: {resp.status_code} - {resp.text}")
    else:
        print("Admin login successful")
        
        # Check Admin Transactions
        resp = session.get(f"{BASE_URL}/admin/transactions")
        if resp.status_code == 200:
            txns = resp.json().get('transactions', [])
            if txns:
                # print(f"Admin Transactions (first 1): {json.dumps(txns[0], indent=2)}")
                if 'mode' in txns[0]:
                    print(f"SUCCESS: 'mode' found in admin transactions: {txns[0].get('mode')}")
                else:
                    print("FAILURE: 'mode' NOT found in admin transactions")
        
        # Check Admin User Activity (for user 1)
        resp = session.get(f"{BASE_URL}/admin/user/1/activity")
        if resp.status_code == 200:
            data = resp.json()
            txns = data.get('transactions', [])
            if txns:
                if 'mode' in txns[0]:
                    print(f"SUCCESS: 'mode' found in admin user activity: {txns[0].get('mode')}")
                else:
                    print("FAILURE: 'mode' NOT found in admin user activity")

    # 2. Login as Staff
    print("\n--- Testing Staff Visibility ---")
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "username": "yasir", 
        "password": "password123",
        "role": "staff"
    })
    
    if resp.status_code != 200:
        print(f"Staff login failed: {resp.status_code} - {resp.text}")
    else:
        print("Staff login successful")
        
        # Check Staff Transactions
        resp = session.get(f"{BASE_URL}/staff/transactions")
        if resp.status_code == 200:
            txns = resp.json().get('transactions', [])
            if txns:
                # print(f"Staff Transactions (first 1): {json.dumps(txns[0], indent=2)}")
                if 'mode' in txns[0]:
                    print(f"SUCCESS: 'mode' found in staff transactions: {txns[0].get('mode')}")
                else:
                    print("FAILURE: 'mode' NOT found in staff transactions")
        
        # Check Staff User Activity (for user 1)
        resp = session.get(f"{BASE_URL}/staff/user/1/activity")
        if resp.status_code == 200:
            data = resp.json()
            txns = data.get('transactions', [])
            if txns:
                if 'mode' in txns[0]:
                    print(f"SUCCESS: 'mode' found in staff user activity: {txns[0].get('mode')}")
                else:
                    print("FAILURE: 'mode' NOT found in staff user activity")

if __name__ == "__main__":
    test_visibility()
