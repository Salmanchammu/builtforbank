import requests
import json
import sqlite3
import random

BASE_URL = "http://localhost:5001"
session = requests.Session()

def verify_department_change():
    print("--- Starting Department Change Verification ---")
    
    # 1. Login as admin
    print("\n1. Logging in as admin...")
    res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": "salman",
        "password": "password123",
        "role": "admin"
    })
    if res.status_code != 200:
        print("Admin login failed!")
        return False

    email_it_staff = f"itstaff_{random.randint(100,999)}@smartbank.com"

    # 2. Add a dummy test staff inside IT
    print(f"\n2. Adding dummy staff member in IT department ({email_it_staff})...")
    
    def create_staff(name, email, dept):
        res = session.post(f"{BASE_URL}/api/admin/staff", json={"name": name, "email": email, "password": "password123", "department": dept, "position": "Staff"})
        if res.status_code != 201:
            print(f"Failed to create {name}: {res.text}")
            return None
        return res.json()['id']

    staff_db_id = create_staff("IT Tester", email_it_staff, "Technical Support")
    if not staff_db_id:
        print("Failed to spawn staff account.")
        return False

    # 3. Request Department Transfer
    TARGET_DEPARTMENT = "Operations"
    print(f"\n3. Requesting transfer to --> {TARGET_DEPARTMENT}")
    res = session.put(f"{BASE_URL}/api/admin/staff/{staff_db_id}/department", json={"new_department": TARGET_DEPARTMENT})
    
    if res.status_code == 200:
        print("Transfer Status:", res.status_code, "Message:", res.json().get('message'))
    else:
        print("Transfer Failed:", res.text)
        return False

    # 4. Verify Database Integrity Securely
    print("\n4. Validating SQLite Integrities...")
    db = sqlite3.connect('database/smart_bank.db')
    
    staff_rec = db.execute('SELECT department FROM staff WHERE id = ?', (staff_db_id,)).fetchone()
    if staff_rec and staff_rec[0] == TARGET_DEPARTMENT:
        print(f"PASS: SQLite database accurately reflects the new department. ({staff_rec[0]})")
    else:
        print(f"FAIL: SQLite table was not updated. Expected: {TARGET_DEPARTMENT}, Got: {staff_rec[0] if staff_rec else 'None'}")
        return False
        
    print("\n--- Staff Department Handlers Successfully Verified ---")
    return True

if __name__ == "__main__":
    verify_department_change()
