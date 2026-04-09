import requests
import sqlite3
import os
import time

# Use the exact same URL as test_simple.py
BASE_URL = "http://localhost:5000/api"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')

def test_full_flow():
    ts = int(time.time())
    username = f"u{ts}"
    data = {
        "username": username,
        "email": f"{username}@test.com",
        "password": "password123",
        "name": "Test User",
        "device_type": "mobile"
    }

    # 1. Signup
    url = f"{BASE_URL}/auth/signup"
    print(f"POSTing to {url}")
    r = requests.post(url, json=data)
    print(f"Signup Status: {r.status_code}")
    if r.status_code != 201:
        print(f"Error: {r.text[:500]}")
        return

    # 2. Get OTP
    conn = sqlite3.connect(DB_PATH)
    res = conn.execute("SELECT otp FROM users WHERE username = ?", (username,)).fetchone()
    otp = res[0]
    conn.close()
    print(f"Got OTP from DB: {otp}")

    # 3. Resend OTP
    url = f"{BASE_URL}/auth/resend-otp"
    print(f"POSTing to {url}")
    r = requests.post(url, json={"username": username})
    print(f"Resend Status: {r.status_code}")
    
    conn = sqlite3.connect(DB_PATH)
    res = conn.execute("SELECT otp FROM users WHERE username = ?", (username,)).fetchone()
    new_otp = res[0]
    conn.close()
    print(f"Got New OTP from DB: {new_otp}")

    # 4. Verify OTP
    url = f"{BASE_URL}/auth/verify-otp"
    print(f"POSTing to {url}")
    r = requests.post(url, json={"username": username, "otp": new_otp})
    print(f"Verify Status: {r.status_code}")
    
    conn = sqlite3.connect(DB_PATH)
    res = conn.execute("SELECT status FROM users WHERE username = ?", (username,)).fetchone()
    status = res[0]
    conn.close()
    print(f"User Status in DB: {status}")

    if status == 'active':
        print("\nSUCCESS: Full Mobile OTP flow verified.")
    else:
        print("\nFAILURE: User status is not active.")

if __name__ == "__main__":
    test_full_flow()
