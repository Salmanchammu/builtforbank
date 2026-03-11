import requests
import json
import sqlite3
import random

BASE_URL = "http://localhost:5001"
session = requests.Session()

def verify_staff_management():
    print("--- Starting Staff Management Verification ---")
    
    # Login as admin
    print("\n1. Logging in as admin...")
    res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": "salman",
        "password": "password123",
        "role": "admin"
    })
    if res.status_code != 200:
        print("Admin login failed:", res.json())
        return False
    print("Admin login successful.")

    email_to_promote = f"promote_{random.randint(100,999)}@smartbank.com"
    email_to_delete = f"delete_{random.randint(100,999)}@smartbank.com"

    # Add staff for promotion test
    print(f"\n2. Adding a dummy staff member to test Promotion ({email_to_promote})...")
    res = session.post(f"{BASE_URL}/api/admin/staff", json={
        "name": "Promote Me",
        "email": email_to_promote,
        "password": "testpassword",
        "department": "IT",
        "position": "Junior SE"
    })
    
    if res.status_code != 201:
        print("Failed to add staff member.", res.json())
        return False
    
    promote_db_id = res.json()['id']
    promote_staff_id = res.json()['staff_id']
    print(f"Added Staff ID: {promote_db_id} (STF: {promote_staff_id})")

    # Add staff for deletion test
    print(f"\n3. Adding a dummy staff member to test Deletion ({email_to_delete})...")
    res = session.post(f"{BASE_URL}/api/admin/staff", json={
        "name": "Delete Me",
        "email": email_to_delete,
        "password": "testpassword",
        "department": "HR",
        "position": "Recruiter"
    })
    delete_db_id = res.json()['id']
    print(f"Added Staff ID: {delete_db_id}")

    # Test Deletion
    print("\n4. Triggering DELETE endpoint...")
    res = session.delete(f"{BASE_URL}/api/admin/staff/{delete_db_id}")
    if res.status_code == 200:
        print("Deleted returned Success:", res.json().get('message'))
    else:
        print("Failed to delete staff:", res.text)
        return False

    # Test Promotion
    print("\n5. Triggering PROMOTE endpoint...")
    res = session.put(f"{BASE_URL}/api/admin/staff/{promote_db_id}/promote")
    if res.status_code == 200:
        print("Promote returned Success:", res.json().get('message'))
    else:
        print("Failed to promote staff:", res.text)
        return False

    # Verify Database Integrity
    print("\n6. Validating SQLite Integrities...")
    db = sqlite3.connect('database/smart_bank.db')
    
    deleted_staff = db.execute('SELECT * FROM staff WHERE email = ?', (email_to_delete,)).fetchone()
    if deleted_staff is not None:
        print("FAIL: Deleted staff is still in the 'staff' table.")
        return False
    else:
        print("PASS: Deleted staff removed from 'staff' table.")

    promoted_staff = db.execute('SELECT * FROM staff WHERE email = ?', (email_to_promote,)).fetchone()
    if promoted_staff is not None:
        print("FAIL: Promoted staff is still in the 'staff' table.")
        return False
    else:
        print("PASS: Promoted staff removed from 'staff' table.")
        
    admin_record = db.execute('SELECT * FROM admins WHERE email = ?', (email_to_promote,)).fetchone()
    if admin_record is None:
        print("FAIL: Promoted staff was NOT added to the 'admins' table.")
        return False
    else:
        print(f"PASS: Promoted staff found in 'admins' table under username {admin_record[1]}.")
        
    print("\n--- All Staff Management Steps Verified Successfully ---")
    return True

if __name__ == "__main__":
    verify_staff_management()
