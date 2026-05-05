import sqlite3
import os

db_path = os.path.abspath(os.path.join('..', 'database', 'smartbank.db'))
print("DB Path:", db_path)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

user = c.execute("SELECT id FROM users WHERE username='salman'").fetchone()
if not user:
    print("User not found!")
else:
    uid = user['id']
    cards = c.execute("SELECT id, user_id, card_type, card_number, status FROM cards WHERE user_id = ?", (uid,)).fetchall()
    print("CARDS:", [dict(r) for r in cards])
    
    reqs = c.execute("SELECT id, user_id, card_type, status FROM card_requests WHERE user_id = ?", (uid,)).fetchall()
    print("REQUESTS:", [dict(r) for r in reqs])

conn.close()
