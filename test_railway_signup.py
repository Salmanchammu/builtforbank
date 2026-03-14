import requests
import json
import random

def test_railway_signup_subaddress():
    # Railway URL
    BASE_URL = "https://smart-bank-v2-production.up.railway.app/api"
    SIGNUP_URL = f"{BASE_URL}/auth/signup"
    
    # Random username and sub-addressed email to ensure uniqueness
    username = f"user_{random.randint(100000, 999999)}"
    target_email = "salmanchamumu+test_" + str(random.randint(1000, 9999)) + "@gmail.com"
    
    payload = {
        "username": username,
        "email": target_email,
        "password": "Password123!",
        "name": "Live Verification Test",
        "device_type": "desktop"
    }
    
    print(f"--- Triggering Signup with Sub-address ---")
    print(f"URL: {SIGNUP_URL}")
    print(f"Username: {username}")
    print(f"Email: {target_email}")
    
    try:
        response = requests.post(SIGNUP_URL, json=payload, timeout=20)
        print(f"Status Code: {response.status_code}")
        
        try:
            res_data = response.json()
            print(f"Response: {json.dumps(res_data, indent=2)}")
            
            if response.status_code == 201:
                print("\n✅ SUCCESS: Signup accepted on Railway!")
                print(f"Please check {target_email} (lands in salmanchamumu@gmail.com inbox) for the OTP.")
            else:
                print(f"\n❌ FAILED: {res_data.get('error', 'Unknown error')}")
        except:
            print(f"❌ FAILED: Response was not JSON: {response.text}")
            
    except Exception as e:
        print(f"❌ CONNECTION ERROR: {e}")

if __name__ == "__main__":
    test_railway_signup_subaddress()
