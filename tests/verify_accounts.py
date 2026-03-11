import requests

BASE_URL = "http://localhost:5001"
session = requests.Session()

def verify_accounts():
    print("--- Starting Zero/Multi-Account Verification ---")
    
    # 1. Signup a new user
    import time
    timestamp = int(time.time())
    username = f"testuser_{timestamp}"
    print(f"\n1. Signing up as new user: {username}")
    res = session.post(f"{BASE_URL}/api/auth/signup", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "password123",
        "name": "Test User"
    })
    if res.status_code != 201:
        print("Signup failed:", res.json())
        return False
    print("Signup successful.")

    # 2. Login
    print("\n2. Logging in...")
    res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": "password123"
    })
    if res.status_code != 200:
        print("Login failed:", res.json())
        return False
    print("Login successful.")

    # 3. Check Dashboard - should have 0 accounts
    print("\n3. Fetching Dashboard Data (Expecting 0 accounts)...")
    res = session.get(f"{BASE_URL}/api/user/dashboard")
    if res.status_code != 200:
        print("Failed to fetch dashboard:", res.json())
        return False
    
    dashboard_data = res.json()
    accounts = dashboard_data.get('accounts', [])
    print(f"Found {len(accounts)} accounts.")
    if len(accounts) != 0:
        print("TEST FAILED: New user should have 0 accounts.")
        return False

    # 4. Open a Savings Account
    print("\n4. Opening a Savings Account...")
    res = session.post(f"{BASE_URL}/api/user/accounts", json={"account_type": "Savings"})
    if res.status_code != 201:
        print("Failed to open Savings Account:", res.json())
        return False
    print("Savings Account opened:", res.json())

    # 5. Open a Current Account
    print("\n5. Opening a Current Account...")
    res = session.post(f"{BASE_URL}/api/user/accounts", json={"account_type": "Current"})
    if res.status_code != 201:
        print("Failed to open Current Account:", res.json())
        return False
    print("Current Account opened:", res.json())

    # 6. Open a Salary Account
    print("\n6. Opening a Salary Account...")
    res = session.post(f"{BASE_URL}/api/user/accounts", json={"account_type": "Salary"})
    if res.status_code != 201:
        print("Failed to open Salary Account:", res.json())
        return False
    print("Salary Account opened:", res.json())

    # 7. Attempt to open a 4th account (should fail)
    print("\n7. Attempting to open an extra Salary Account (should fail)...")
    res = session.post(f"{BASE_URL}/api/user/accounts", json={"account_type": "Salary"})
    if res.status_code == 400:
        print("Successfully blocked duplicate account creation:", res.json())
    else:
        print(f"TEST FAILED: Expected 400 error, got {res.status_code}:", res.json())
        return False

    # 8. Check Dashboard again
    print("\n8. Fetching Dashboard Data (Expecting 3 accounts)...")
    res = session.get(f"{BASE_URL}/api/user/dashboard")
    dashboard_data = res.json()
    accounts = dashboard_data.get('accounts', [])
    print(f"Found {len(accounts)} accounts.")
    if len(accounts) != 3:
        print("TEST FAILED: User should have exactly 3 accounts now.")
        return False
        
    print("\n--- Verification completely successful ---")
    return True

if __name__ == "__main__":
    verify_accounts()
