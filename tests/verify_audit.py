import requests

BASE_URL = "http://localhost:5001"
session = requests.Session()

def verify_audit_route():
    print("--- Verifying Audit Logs Fix ---")
    
    # Login
    print("\n1. Logging in as admin...")
    res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": "salman",
        "password": "password123",
        "role": "admin"
    })
    
    if res.status_code != 200:
        print("Login failed")
        return False
        
    # Poll table
    print("\n2. Requesting Audit Data array...")
    audit_res = session.get(f"{BASE_URL}/api/admin/audit")
    
    if audit_res.status_code == 200:
        print("PASS: The API cleanly returned a 200 Status Code resolving the internal 500 fault.")
        logs = audit_res.json().get('logs', [])
        print(f"Detected {len(logs)} existing audit rows.")
        return True
    else:
        print(f"FAIL: The server returned internal error code {audit_res.status_code}\n{audit_res.text}")
        return False
        
if __name__ == '__main__':
    verify_audit_route()
