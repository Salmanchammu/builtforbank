import sys
sys.path.append('.')
from core.constants import DATABASE
from werkzeug.security import check_password_hash
import sqlite3

def check():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    user = conn.execute("SELECT * FROM staff WHERE staff_id='yasir'").fetchone()
    if user:
        print("Found yasir")
        is_valid = check_password_hash(user['password'], "Yasir123#")
        print("Password match:", is_valid)
        print("Status:", user['status'])
    else:
        print("yasir not found")

if __name__ == "__main__":
    check()
