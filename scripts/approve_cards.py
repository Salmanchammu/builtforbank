import sys
import os

# Add the directory containing 'backend' to python path to resolve core module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

import sqlite3, random
from datetime import datetime, timedelta
from core.constants import DATABASE

def create_card_from_request(db, req, user_name):
    c_num = f'4{str(random.randint(0, 999999999999999)).zfill(15)}'
    cvv = str(random.randint(100, 999))
    expiry = (datetime.now() + timedelta(days=365*5)).strftime('%Y-%m-%d')
    db.execute('INSERT INTO cards (user_id, account_id, card_number, card_type, card_holder_name, expiry_date, cvv, credit_limit, available_credit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
               (req['user_id'], req['account_id'], c_num, req['card_type'], user_name, expiry, cvv, req['requested_credit_limit'], req['requested_credit_limit'], 'active'))
    db.execute('UPDATE card_requests SET status = "approved", processed_date = CURRENT_TIMESTAMP WHERE id = ?', (req['id'],))
    print(f'Approved card request ID: {req["id"]} for user ID: {req["user_id"]}')

try:
    print(f"Connecting to database: {DATABASE}")
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    requests = db.execute('SELECT * FROM card_requests WHERE status = "pending"').fetchall()
    
    if not requests:
        print('No pending card requests found.')
    else:
        for req in requests:
            user = db.execute('SELECT name FROM users WHERE id = ?', (req['user_id'],)).fetchone()
            user_name = user['name'] if user else 'Unknown'
            create_card_from_request(db, req, user_name)
        db.commit()
except Exception as e:
    print(f'Error: {e}')
finally:
    if db:
        db.close()
