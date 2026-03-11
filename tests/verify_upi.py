import sys
import os
import json
from werkzeug.security import generate_password_hash

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import app, get_db

app.config['TESTING'] = True
app.config['SECRET_KEY'] = 'test_secret'

def setup_test_data():
    with app.app_context():
        db = get_db()
        # Create a test user
        hashed = generate_password_hash('test123')
        db.execute("INSERT OR REPLACE INTO users (id, username, password, email, name, status) VALUES (999, 'testuser', ?, 'test@example.com', 'Test User', 'active')", (hashed,))
        db.execute("INSERT OR REPLACE INTO accounts (id, user_id, account_number, account_type, balance, status) VALUES (9999, 999, 'SB999000000001', 'Savings', 5000.00, 'active')")
        
        # Create a receiver user
        db.execute("INSERT OR REPLACE INTO users (id, username, password, email, name, status, upi_id) VALUES (888, 'receiver', ?, 'receiver@example.com', 'Receiver User', 'active', 'receiver@smtbank')", (hashed,))
        db.execute("INSERT OR REPLACE INTO accounts (id, user_id, account_number, account_type, balance, status) VALUES (8888, 888, 'SB888000000001', 'Savings', 1000.00, 'active')")
        db.commit()

def test_upi_flow():
    print("Starting UPI Verification...")
    client = app.test_client()
    
    # Simulate Login
    with client.session_transaction() as sess:
        sess['user_id'] = 999
        sess['username'] = 'testuser'
        sess['role'] = 'user'
        sess['name'] = 'Test User'
        
    # Check UPI Initial Status
    res = client.get('/api/user/upi/status')
    print("Initial Status:", res.json)
    
    # Setup UPI
    res = client.post('/api/user/upi/setup', json={'upi_pin': '123456'})
    print("Setup Status:", res.json)
    
    # Check UPI Status Again
    res = client.get('/api/user/upi/status')
    print("Status After Setup:", res.json)
    
    # Internal UPI Transfer
    res = client.post('/api/transfer/upi', json={
        'target_vpa': 'receiver@smtbank',
        'amount': 500.0,
        'upi_pin': '123456'
    })
    print("Internal Transfer Status:", res.json)
    
    # External UPI Transfer (Mock)
    res = client.post('/api/transfer/upi', json={
        'target_vpa': 'external@axis',
        'amount': 200.0,
        'upi_pin': '123456'
    })
    print("External Transfer Status:", res.json)
    
    # Verify Balances
    with app.app_context():
        db = get_db()
        sender_bal = db.execute("SELECT balance FROM accounts WHERE user_id = 999").fetchone()['balance']
        receiver_bal = db.execute("SELECT balance FROM accounts WHERE user_id = 888").fetchone()['balance']
        print(f"Final Balances -> Sender: {sender_bal}, Receiver: {receiver_bal}")
        
    print("Verifying Transactions Table...")
    with app.app_context():
        db = get_db()
        txns = db.execute("SELECT * FROM transactions WHERE mode = 'UPI' ORDER BY transaction_date DESC").fetchall()
        print(f"Found {len(txns)} UPI transactions.")
        for t in txns:
            print(f"- {t['description']}: ₹{t['amount']} ({t['type']})")

if __name__ == "__main__":
    try:
        setup_test_data()
        test_upi_flow()
    except Exception as e:
        print(f"Error during verification: {e}")
