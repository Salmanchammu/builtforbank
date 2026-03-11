import requests
import json

BASE_URL = "http://127.0.0.1:5001/api"

def test_mobile_passcode():
    session = requests.Session()
    
    # 1. Login as regular User
    print("--- 1. Setting up Passcode for 'salman' (User) ---")
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "username": "salman",
        "password": "password123",
        "role": "user"
    })
    
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    
    print("Login successful")
    
    # Set passcode
    resp = session.post(f"{BASE_URL}/auth/mobile/setup-passcode", json={"passcode": "7777"})
    if resp.status_code == 200:
        print("SUCCESS: Passcode set via backend for User")
    else:
        print(f"FAILURE: Passcode setup failed: {resp.text}")
        
    # 2. Try Login with Passcode
    print("\n--- 2. Testing Passcode Login for 'salman' (User) ---")
    session = requests.Session() # Clear session
    resp = session.post(f"{BASE_URL}/auth/mobile/login-passcode", json={
        "username": "salman",
        "passcode": "7777"
    })
    
    if resp.status_code == 200:
        data = resp.json()
        print(f"SUCCESS: Passcode login worked for {data['user']['role']} role")
        
        # Verify real session
        resp = session.get(f"{BASE_URL}/auth/check")
        if resp.status_code == 200 and resp.json().get('authenticated'):
            print("SUCCESS: Real session established after passcode login")
        else:
            print("FAILURE: Session not authenticated after passcode login")
    else:
        print(f"FAILURE: Passcode login failed: {resp.text}")


if __name__ == "__main__":
    test_mobile_passcode()
