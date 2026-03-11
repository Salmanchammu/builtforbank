import requests
import json
import sqlite3
import random

BASE_URL = "http://localhost:5001"
session = requests.Session()

def verify_multi_promotion():
    print("--- Starting Multi-Level Promotion Verification ---")
    
    # Login as admin
    res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": "salman",
        "password": "password123",
        "role": "admin"
    })
    if res.status_code != 200:
        print("Admin login failed!")
        return False

    email_senior = f"senior_{random.randint(100,999)}@smartbank.com"
    email_manager = f"manager_{random.randint(100,999)}@smartbank.com"
    email_sysadmin = f"sysadmin_{random.randint(100,999)}@smartbank.com"

    # Add 3 test staff
    print("\n1. Adding 3 dummy staff members...")
    
    def create_staff(name, email):
        res = session.post(f"{BASE_URL}/api/admin/staff", json={"name": name, "email": email, "password": "password123", "department": "IT", "position": "Staff"})
        if res.status_code != 201:
            print(f"Failed to create {name}: {res.text}")
            return None
        return res.json()['id']

    id_senior = create_staff("S1", email_senior)
    id_manager = create_staff("M1", email_manager)
    id_sysadmin = create_staff("A1", email_sysadmin)
    
    if not all([id_senior, id_manager, id_sysadmin]):
        print("Failed to create all dummy staff. Exiting.")
        return False

    # Promote to Senior Staff
    print("\n2. Promoting to Senior Staff...")
    res1 = session.put(f"{BASE_URL}/api/admin/staff/{id_senior}/promote", json={"new_role": "Senior Staff"})
    print("Status:", res1.status_code, "Message:", res1.json().get('message'))

    # Promote to Manager
    print("\n3. Promoting to Manager...")
    res2 = session.put(f"{BASE_URL}/api/admin/staff/{id_manager}/promote", json={"new_role": "Manager"})
    print("Status:", res2.status_code, "Message:", res2.json().get('message'))

    # Promote to System Admin
    print("\n4. Promoting to System Admin...")
    res3 = session.put(f"{BASE_URL}/api/admin/staff/{id_sysadmin}/promote", json={"new_role": "System Admin"})
    print("Status:", res3.status_code, "Message:", res3.json().get('message'))

    # Verify Database Integrity
    print("\n5. Validating SQLite Integrities...")
    db = sqlite3.connect('database/smart_bank.db')
    
    # Senior Staff Check
    senior_rec = db.execute('SELECT position FROM staff WHERE email = ?', (email_senior,)).fetchone()
    if senior_rec and senior_rec[0] == 'Senior Staff':
        print(f"PASS: Senior Staff updated correctly in 'staff' table. (Position={senior_rec[0]})")
    else:
        print("FAIL: Senior Staff was not updated properly.")
        return False

    # Manager Check
    manager_rec = db.execute('SELECT position FROM staff WHERE email = ?', (email_manager,)).fetchone()
    if manager_rec and manager_rec[0] == 'Manager':
        print(f"PASS: Manager updated correctly in 'staff' table. (Position={manager_rec[0]})")
    else:
        print("FAIL: Manager was not updated properly.")
        return False

    # System Admin Check
    sysadmin_staff_rec = db.execute('SELECT position FROM staff WHERE email = ?', (email_sysadmin,)).fetchone()
    sysadmin_admin_rec = db.execute('SELECT username FROM admins WHERE email = ?', (email_sysadmin,)).fetchone()
    
    if sysadmin_staff_rec is None and sysadmin_admin_rec is not None:
        print(f"PASS: System Admin correctly migrated to 'admins' table and removed from 'staff'.")
    else:
        print("FAIL: System Admin migration failed.")
        return False
        
    print("\n--- All Multi-Level Promotion Steps Verified Successfully ---")
    return True

if __name__ == "__main__":
    verify_multi_promotion()
