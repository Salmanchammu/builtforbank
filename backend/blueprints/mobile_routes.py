from flask import Blueprint, request, jsonify, session
import secrets
import logging
from datetime import datetime

from core.db import get_db
from core.auth import login_required, log_audit
from core.email_utils import send_email_async

mobile_bp = Blueprint('mobile', __name__)
logger = logging.getLogger('smart_bank.mobile')

import threading
from config.sms_config import send_sms

def send_sms_async(p, m):
    threading.Thread(target=send_sms, args=(p, m), daemon=True).start()
    return True

@mobile_bp.route('/billpay', methods=['POST'])
@login_required
def billpay():
    data = request.json
    biller, consumer_id, amount, category = data.get('biller'), data.get('consumer_id'), float(data.get('amount', 0)), data.get('category', 'Utility')
    if not biller or not consumer_id or amount <= 0: return jsonify({'error': 'Invalid biller, consumer ID or amount'}), 400
    db = get_db()
    user_id = session['user_id']
    account = db.execute('SELECT * FROM accounts WHERE user_id = ? AND balance >= ?', (user_id, amount)).fetchone()
    if not account: return jsonify({'error': 'Insufficient balance'}), 400
    
    # Daily Limit Check
    user = db.execute('SELECT daily_limit FROM users WHERE id = ?', (user_id,)).fetchone()
    user_global_limit = user['daily_limit'] if user and user['daily_limit'] is not None else 200000.00
    daily_limit = account['daily_limit'] if account.get('daily_limit') is not None else user_global_limit
    
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_spent_row = db.execute('''
        SELECT SUM(t.amount) as total FROM transactions t JOIN accounts a ON t.account_id = a.id 
        WHERE a.user_id = ? AND t.type = 'debit' AND t.transaction_date >= ?
    ''', (user_id, today_start)).fetchone()
    today_spent = float(today_spent_row['total'] or 0)
    
    if today_spent + amount > daily_limit:
        return jsonify({'error': f'Daily limit of ₹{daily_limit} exceeded. Already spent ₹{today_spent} today.'}), 400
    
    new_balance = account['balance'] - amount
    db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, account['id']))
    
    ref = f"BBPS{secrets.token_hex(4).upper()}"
    db.execute('''
        INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status, balance_after)
        VALUES (?, 'debit', ?, ?, ?, 'Bill Pay', 'completed', ?)
    ''', (account['id'], amount, f"BBPS: {category} - {biller} ({consumer_id})", ref, new_balance))
    
    log_audit(user_id, 'user', 'bill_payment', f"Paid {category} bill to {biller}: {amount}")
    db.commit()
    
    user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
    if user and user['email']:
        subject = f"Bill Payment Successful - {biller}"
        body = f"<h3>Smart Bank Bill Payment</h3><p>Dear {user['name']}, your payment of ₹{amount:,.2f} to {biller} was successful. Ref: {ref}</p>"
        send_email_async(user['email'], subject, body)
    return jsonify({'success': True, 'message': f'Payment to {biller} successful!', 'reference': ref})

@mobile_bp.route('/apply-fd', methods=['POST'])
@login_required
def apply_fd():
    data = request.json
    amount, tenure = float(data.get('amount', 0)), data.get('tenure', '1 Year')
    if amount < 5000: return jsonify({'error': 'Minimum FD amount is ₹5,000'}), 400
    db = get_db()
    user_id = session['user_id']
    account = db.execute('SELECT * FROM accounts WHERE user_id = ? AND balance >= ?', (user_id, amount)).fetchone()
    if not account: return jsonify({'error': 'Insufficient balance to open FD'}), 400
    
    new_balance = account['balance'] - amount
    db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, account['id']))
    
    ref = f"FD{secrets.token_hex(4).upper()}"
    db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status, balance_after) VALUES (?, "debit", ?, ?, ?, "Investment", "completed", ?)',
              (account['id'], amount, f"Fixed Deposit Booked: {tenure}", ref, new_balance))
    db.execute('INSERT INTO service_applications (user_id, service_type, product_name, amount, tenure, account_id, status) VALUES (?, "Investment", "Fixed Deposit", ?, ?, ?, "pending")',
              (user_id, amount, str(tenure), account['id']))
    
    log_audit(user_id, 'user', 'fd_creation', f"Booked FD of {amount}")
    db.commit()
    return jsonify({'success': True, 'message': 'Fixed Deposit booked successfully!', 'reference': ref})

@mobile_bp.route('/apply-investment', methods=['POST'])
@login_required
def apply_investment():
    data = request.json
    user_id = session['user_id']
    product_name = data.get('product_name')
    amount = float(data.get('amount', 0))
    account_number = data.get('account_number')
    aadhaar = data.get('aadhaar_number')
    
    if not all([product_name, amount, account_number, aadhaar]):
        return jsonify({'error': 'Missing required fields'}), 400
        
    db = get_db()
    account = db.execute('SELECT * FROM accounts WHERE user_id = ? AND (account_number = ? OR id = ?)', 
                        (user_id, account_number, account_number)).fetchone()
    
    if not account or account['balance'] < amount:
        return jsonify({'error': 'Insufficient balance or invalid account'}), 400
        
    try:
        new_balance = account['balance'] - amount
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, account['id']))
        
        ref = f"INV{secrets.token_hex(4).upper()}"
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status, balance_after)
            VALUES (?, 'debit', ?, ?, ?, 'Investment', 'completed', ?)
        ''', (account['id'], amount, f"Investment: {product_name}", ref, new_balance))
        
        db.execute('''
            INSERT INTO service_applications (user_id, account_id, service_type, product_name, amount, status, aadhaar_number)
            VALUES (?, ?, 'Investment', ?, ?, 'pending', ?)
        ''', (user_id, account['id'], product_name, amount, aadhaar))
        
        log_audit(user_id, 'user', 'investment_application', f"Applied for {product_name}: ₹{amount}")
        db.commit()
        
        return jsonify({'success': True, 'message': f'Application for {product_name} submitted successfully!', 'reference': ref})
    except Exception as e:
        db.rollback()
        logger.error(f"Error applying for investment: {e}")
        return jsonify({'error': 'Internal server error'}), 500
