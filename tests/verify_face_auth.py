import requests
import json
import random

BASE_URL = 'http://localhost:5001/api'

def create_dummy_descriptor(base_val=0.5, noise=0.01):
    return [base_val + random.uniform(-noise, noise) for _ in range(128)]

def test_flow(role, username, password):
    print(f"--- Testing {role.capitalize()} Flow ---")
    session = requests.Session()
    
    # 1. Login
    print(f"[1] Logging in as {username}...")
    res = session.post(f"{BASE_URL}/auth/login", json={'username': username, 'password': password, 'role': role})
    if res.status_code != 200:
        print(f"Login failed: {res.text}")
        return
    print("Login successful.")
    
    # 2. Register Face
    print("[2] Registering face descriptor...")
    base_descriptor = create_dummy_descriptor(0.5)
    res = session.post(f"{BASE_URL}/face/register", json={'face_descriptor': base_descriptor})
    print(f"Register face response: {res.json()}")
    
    # 3. Check Status
    print("[3] Checking face status...")
    res = session.get(f"{BASE_URL}/face/status")
    print(f"Face status response: {res.json()}")
    
    # 4. Try Face Login (new session)
    print("[4] Attempting Face Login...")
    new_session = requests.Session()
    # Create a slightly different descriptor that should still map (< 0.6 distance)
    # distance = sqrt( sum( (d1 - d2)^2 ) )
    # If noise is 0.02, difference per dimension is ~0.02.
    # 128 * 0.02^2 = 128 * 0.0004 = 0.0512. sqrt(0.0512) = ~0.22 < 0.6
    login_descriptor = [val + random.uniform(-0.02, 0.02) for val in base_descriptor]
    
    endpoint = f"{BASE_URL}/admin/face-login" if role == 'admin' else f"{BASE_URL}/staff/face-login"
    res = new_session.post(endpoint, json={'face_descriptor': login_descriptor})
    print(f"Face Login response: {res.json()}")
    if res.status_code == 200:
        print("Face Login SUCCESSFUL!")
    else:
        print("Face Login FAILED!")
        
    # 5. Delete Face
    print("[5] Deleting face data...")
    res = session.delete(f"{BASE_URL}/face/delete")
    print(f"Delete face response: {res.json()}")
    
    print("\n")

if __name__ == '__main__':
    test_flow('staff', 'yasir', 'password123') 
    test_flow('admin', 'salman', 'password123')
