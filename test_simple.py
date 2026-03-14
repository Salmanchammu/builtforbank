import requests
import json
import time

BASE_URL = "http://localhost:5000/api"

def test():
    username = f"u{int(time.time())}"
    data = {
        "username": username,
        "email": f"{username}@test.com",
        "password": "password123",
        "name": "Test User",
        "device_type": "mobile"
    }
    print(f"Sending data: {data}")
    try:
        r = requests.post(f"{BASE_URL}/auth/signup", json=data)
        print(f"Status: {r.status_code}")
        print(f"Text: {r.text[:200]}")
    except Exception as e:
        print(f"Error during request: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
