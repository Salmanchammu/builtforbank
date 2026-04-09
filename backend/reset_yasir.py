import sys
sys.path.append('.')
from core.constants import DATABASE
from werkzeug.security import generate_password_hash
import sqlite3

def update():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    hashed = generate_password_hash("Yasir123#")
    cursor.execute("UPDATE staff SET password=? WHERE staff_id='yasir'", (hashed,))
    conn.commit()
    print("Password updated for yasir.")

if __name__ == "__main__":
    update()
