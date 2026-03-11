import requests
import csv
import io

BASE_URL = "http://localhost:5001"
session = requests.Session()

def verify_reports():
    print("--- Starting Admin Reports Verification ---")
    
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

    reports_to_test = ['users', 'transactions', 'summary']
    all_passed = True

    for report_type in reports_to_test:
        print(f"\n2. Downloading '{report_type}' report...")
        res = session.get(f"{BASE_URL}/api/admin/reports/download?type={report_type}")
        
        if res.status_code != 200:
            print(f"FAILED to download {report_type} report. Status Code: {res.status_code}")
            print(f"Error Details: {res.text}")
            all_passed = False
            continue
            
        print(f"SUCCESS. Headers: {res.headers.get('Content-Disposition')}")
        
        # Parse CSV
        content = res.content.decode('utf-8')
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        
        print(f"Report has {len(rows)} rows.")
        if len(rows) > 0:
            print(f"Sample First Row: {rows[0]}")
            if len(rows) > 1:
                print(f"Sample Data Row: {rows[1]}")
        else:
            print("WARNING: Report is empty.")
            
    if all_passed:
        print("\n--- All Reports Verified Successfully ---")
    else:
        print("\n--- Verification Failed ---")
        
    return all_passed

if __name__ == "__main__":
    verify_reports()
