import requests
import sqlite3
import time
import os

BASE_URL = "http://localhost:5000/api"
DB_PATH = "storage/database/smart_bank.db"

def get_user_from_db(username):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    user = cursor.execute("SELECT otp, status FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return user

def test_signup_otp_flow():
    username = f"tu_{int(time.time())}"
    email = f"{username}@example.com"
    password = "password123"
    name = "Test User"

    print(f"--- 1. Testing Signup for {username} ---")
    r = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": username, "email": email, "password": password, "name": name, "device_type": "mobile"
    })
    print(f"Status: {r.status_code}")
    if r.status_code != 201:
        print(f"Signup failed: {r.text[:200]}")
        return
    
    user = get_user_from_db(username)
    print(f"DB Status: {user['status']}, OTP: {user['otp']}")
    otp1 = user['otp']

    print(f"\n--- 2. Testing Resend OTP ---")
    r = requests.post(f"{BASE_URL}/auth/resend-otp", json={"username": username})
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"Resend failed: {r.text[:200]}")
        return
        
    user = get_user_from_db(username)
    otp2 = user['otp']
    print(f"New OTP: {otp2}")
    if otp1 == otp2:
        print("Warning: OTP didn't change (unlikely but possible)")

    print(f"\n--- 3. Testing Verify OTP ---")
    r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"username": username, "otp": otp2})
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"Verification failed: {r.text[:200]}")
        return

    user = get_user_from_db(username)
    print(f"Final DB Status: {user['status']}, OTP: {user['otp']}")
    
    if user['status'] == 'active' and user['otp'] is None:
        print("\n✅ Signup, Resend, and Verification flow VERIFIED!")
    else:
        print("\n❌ Verification failed to update DB status correctly.")

if __name__ == "__main__":
    test_signup_otp_flow()
