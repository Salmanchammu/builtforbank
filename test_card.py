from backend.main import app
from backend.core.db import get_db

with app.app_context():
    db = get_db()
    try:
        user_id = 1
        acc_id = None
        c_type = 'Debit'
        lim = None
        db.execute('INSERT INTO card_requests (user_id, account_id, card_type, requested_credit_limit, status) VALUES (?, ?, ?, ?, "pending")', (user_id, acc_id, c_type, lim))
        db.execute('INSERT INTO service_applications (user_id, account_id, service_type, product_name, amount, status) VALUES (?, ?, "Card", ?, ?, "pending")', (user_id, acc_id, c_type, lim))
        db.commit()
        print('SUCCESS')
    except Exception as e:
        print('ERROR:', e)
