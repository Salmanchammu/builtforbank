from flask import Blueprint, request, jsonify, session, send_from_directory
import os
import secrets
import random
import logging
from datetime import datetime

from core.db import get_db
from core.auth import login_required, role_required, log_audit
from core.logic import apply_loan_penalties
from core.email_utils import send_email_async
from core.encryption import encrypt_message, decrypt_message
from core.constants import PROFILE_PICS_FOLDER, allowed_file

from decimal import Decimal

def to_json_serializable(data):
    """Recursively convert datetime and decimal objects to strings for JSON serialization."""
    if isinstance(data, list):
        return [to_json_serializable(item) for item in data]
    if isinstance(data, dict):
        return {k: to_json_serializable(v) for k, v in data.items()}
    if isinstance(data, (datetime,)):
        return data.isoformat()
    if isinstance(data, Decimal):
        return float(data)
    return data

user_bp = Blueprint('user', __name__)
logger = logging.getLogger('smart_bank.user')

# Rate limiting for checkout endpoints (prevents card enumeration & OTP brute-force)
_checkout_attempts = {}
MAX_CHECKOUT_ATTEMPTS = 5
CHECKOUT_LOCKOUT_MINUTES = 15

def _check_checkout_rate(ip):
    """Returns True if IP is rate-limited."""
    from datetime import timedelta
    if ip in _checkout_attempts:
        attempts, first_attempt = _checkout_attempts[ip]
        if datetime.now() - first_attempt > timedelta(minutes=CHECKOUT_LOCKOUT_MINUTES):
            del _checkout_attempts[ip]
            return False
        return attempts >= MAX_CHECKOUT_ATTEMPTS
    return False

def _record_checkout_attempt(ip):
    from datetime import timedelta
    if ip in _checkout_attempts:
        attempts, first_attempt = _checkout_attempts[ip]
        if datetime.now() - first_attempt > timedelta(minutes=CHECKOUT_LOCKOUT_MINUTES):
            _checkout_attempts[ip] = (1, datetime.now())
        else:
            _checkout_attempts[ip] = (attempts + 1, first_attempt)
    else:
        _checkout_attempts[ip] = (1, datetime.now())

import threading
from config.sms_config import send_sms

def send_sms_async(p, m):
    # Run the real SMS function in a background thread so it doesn't block the API response
    threading.Thread(target=send_sms, args=(p, m), daemon=True).start()
    return True

# --- International UPI Exchange Rates (Mock) ---
EXCHANGE_RATES = {
    'USD': 83.12,
    'EUR': 90.45,
    'GBP': 105.67,
    'AED': 22.63,
    'INR': 1.00
}

@user_bp.route('/upi/exchange-rates', methods=['GET'])
@login_required
def get_exchange_rates():
    return jsonify({
        'base': 'INR',
        'rates': EXCHANGE_RATES,
        'timestamp': datetime.now().isoformat()
    })

@user_bp.route('/dashboard', methods=['GET'])
@login_required
def get_user_dashboard():
    db = get_db()
    try:
        # 1. Apply periodic logic
        try:
            apply_loan_penalties(db)
        except Exception as e:
            logger.error(f"Error applying penalties during dashboard load: {e}")
            
        user_id = session['user_id']
        
        # 2. Fetch all required data
        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        accounts = db.execute('SELECT * FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
        account_requests = db.execute('SELECT * FROM account_requests WHERE user_id = ? AND status = \'pending\'', (user_id,)).fetchall()
        transactions = db.execute('SELECT t.*, a.account_number FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE a.user_id = ? ORDER BY t.transaction_date DESC LIMIT 10', (user_id,)).fetchall()
        notifications = db.execute('SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC', (user_id,)).fetchall()
        cards = db.execute('SELECT * FROM cards WHERE user_id = ?', (user_id,)).fetchall()
        card_requests = db.execute('SELECT * FROM card_requests WHERE user_id = ?', (user_id,)).fetchall()
        loans = db.execute('SELECT * FROM loans WHERE user_id = ?', (user_id,)).fetchall()
        
        # 3. Calculate total balance safely
        try:
            total_balance = sum(float(acc['balance'] if acc['balance'] is not None else 0) for acc in accounts)
        except Exception:
            total_balance = 0.0
        
        user_dict = dict(user)
        # Security: Strip ALL sensitive fields before sending to frontend
        sensitive_fields = ['password', 'upi_pin', 'mobile_passcode', 'otp', 'phone_otp', 
                           'otp_expiry', 'face_descriptor', 'reset_token', 'reset_token_expiry']
        for field in sensitive_fields:
            user_dict.pop(field, None)
        
        profile_img = user_dict.get('profile_image')
        l_login = user_dict.get('last_login')
        
        return jsonify(to_json_serializable({
            'user': user_dict,
            'last_login': l_login,
            'accounts': [dict(a) for a in accounts],
            'account_requests': [dict(ar) for ar in account_requests],
            'transactions': [dict(t) for t in transactions],
            'notifications': [dict(n) for n in notifications],
            'cards': [dict(c) for c in cards],
            'card_requests': [dict(cr) for cr in card_requests],
            'loans': [dict(l) for l in loans],
            'total_balance': float(total_balance),
            'profile_image_url': f"/api/user/profile-image/{profile_img}" if profile_img else None
        }))
    except Exception as e:
        logger.error(f"FATAL Dashboard Error: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

@user_bp.route('/transactions', methods=['GET'])
@login_required
def get_all_user_transactions():
    db = get_db()
    user_id = session['user_id']
    transactions = db.execute('''
        SELECT t.*, a.account_number 
        FROM transactions t 
        JOIN accounts a ON t.account_id = a.id 
        WHERE a.user_id = ? 
        ORDER BY t.transaction_date DESC
    ''', (user_id,)).fetchall()
    
    return jsonify(to_json_serializable({
        'transactions': [dict(t) for t in transactions]
    }))

@user_bp.route('/notifications/mark_read/<int:notif_id>', methods=['POST'])
@login_required
def mark_notification_read(notif_id):
    db = get_db()
    user_id = session['user_id']
    try:
        db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', (notif_id, user_id))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_bp.route('/balance', methods=['GET'])
@login_required
def get_user_balance():
    db = get_db()
    accounts = db.execute('SELECT balance FROM accounts WHERE user_id = ?', (session['user_id'],)).fetchall()
    total = sum(float(a['balance']) for a in accounts)
    return jsonify({'total_balance': total, 'timestamp': datetime.now().isoformat()})

@user_bp.route('/support', methods=['GET', 'POST'])
@login_required
def handle_user_support():
    db = get_db()
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.json
        subject = data.get('subject')
        message = data.get('message')
        priority = data.get('priority', 'normal')
        
        if not subject or not message:
            return jsonify({'error': 'Subject and message are required'}), 400
            
        try:
            from markupsafe import escape
            db.execute('''
                INSERT INTO support_tickets (user_id, subject, message, priority, status)
                VALUES (?, ?, ?, ?, 'pending')
            ''', (user_id, escape(subject), escape(message), priority))
            db.commit()
            return jsonify({'success': True, 'message': 'Support ticket submitted successfully'}), 201
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
            
    tickets = db.execute('''
        SELECT id, subject, priority, status, created_at, resolved_at 
        FROM support_tickets 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    ''', (user_id,)).fetchall()
    return jsonify({'tickets': [dict(t) for t in tickets]})

@user_bp.route('/profile', methods=['PUT'])
@login_required
def update_user_profile():
    data = request.json
    user_id = session['user_id']
    name = data.get('name')
    phone = data.get('phone')
    address = data.get('address')
    dob = data.get('date_of_birth')
    daily_limit = data.get('daily_limit')
    
    db = get_db()
    try:
        if daily_limit is not None:
             db.execute('UPDATE users SET name = ?, phone = ?, address = ?, date_of_birth = ?, daily_limit = ? WHERE id = ?',
                       (name, phone, address, dob, daily_limit, user_id))
        else:
             db.execute('UPDATE users SET name = ?, phone = ?, address = ?, date_of_birth = ? WHERE id = ?',
                       (name, phone, address, dob, user_id))
        db.commit()
        return jsonify({'success': True, 'message': 'Profile updated successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/checkout/send-otp', methods=['POST'])
def checkout_send_otp():
    """Step 1: Validate card details + PIN, then send OTP to card owner's email."""
    # Rate limiting
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if client_ip and ',' in client_ip:
        client_ip = client_ip.split(',')[0].strip()
    if _check_checkout_rate(client_ip):
        return jsonify({'error': 'Too many payment attempts. Please try again later.'}), 429
    
    db = get_db()
    data = request.json

    card_number = str(data.get('card_number', '')).replace(' ', '')
    expiry_date = data.get('expiry_date')
    cvv = data.get('cvv')
    pin = data.get('pin')
    amount = data.get('amount')

    if not all([card_number, expiry_date, cvv, pin, amount]):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'error': 'Invalid amount'}), 400

        expiry_date_like = expiry_date
        if expiry_date and len(expiry_date) == 5 and '/' in expiry_date:
            mm, yy = expiry_date.split('/')
            expiry_date_like = f"20{yy}-{mm}-%"

        card = db.execute('SELECT * FROM cards WHERE card_number = ? AND expiry_date LIKE ? AND cvv = ?',
                         (card_number, expiry_date_like, str(cvv))).fetchone()
        if not card:
            _record_checkout_attempt(client_ip)
            return jsonify({'error': 'Invalid card details'}), 400
        if card['status'] != 'active':
            return jsonify({'error': 'Card is blocked or inactive'}), 400
        if 'online_txn_enabled' in card.keys() and card['online_txn_enabled'] == 0:
            return jsonify({'error': 'Online transactions are disabled for this card.'}), 400
        if 'daily_limit' in card.keys() and float(card['daily_limit']) < amount:
            return jsonify({'error': 'Transaction exceeds daily card limit'}), 400

        if 'pin_hash' not in card.keys() or not card['pin_hash']:
            return jsonify({'error': 'PIN not set for this card. Set it in your dashboard first.'}), 400

        from werkzeug.security import check_password_hash
        if not check_password_hash(card['pin_hash'], str(pin)):
            return jsonify({'error': 'Incorrect PIN'}), 400

        # Balance pre-check (don't deduct yet)
        if card['card_type'].lower() == 'credit':
            if float(card['available_credit'] or 0) < amount:
                return jsonify({'error': 'Insufficient credit limit'}), 400
        else:
            if not card['account_id']:
                return jsonify({'error': 'Card is not linked to any account'}), 400
            account = db.execute('SELECT balance FROM accounts WHERE id = ?', (card['account_id'],)).fetchone()
            if not account or float(account['balance']) < amount:
                return jsonify({'error': 'Insufficient account balance'}), 400

        # All validations passed — generate OTP and email it
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (card['user_id'],)).fetchone()
        if not user or not user['email']:
            return jsonify({'error': 'No email linked to card owner account'}), 400

        otp = str(100000 + secrets.randbelow(900000))
        from datetime import timedelta, timezone
        otp_expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

        db.execute('UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?', (otp, otp_expiry, card['user_id']))
        db.commit()

        masked_email = user['email'][:3] + '***' + user['email'][user['email'].index('@'):]
        body = f"""<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;background:#111827;color:#f1f5f9;border-radius:16px;">
            <h2 style="color:#d4af37;margin-bottom:20px;">SmartPay – Payment Verification</h2>
            <p>Hello {user['name']},</p>
            <p>You are making a payment of <b style="color:#d4af37;">₹{amount:,.2f}</b>. Use the OTP below to confirm:</p>
            <div style="text-align:center;margin:25px 0;padding:20px;background:#1f2937;border-radius:12px;border:1px solid rgba(212,175,55,0.3);">
                <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#d4af37;">{otp}</span>
            </div>
            <p style="color:#94a3b8;font-size:13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>"""
        send_email_async(user['email'], f"SmartPay OTP: ₹{amount:,.2f} Payment Verification", body)

        return jsonify({'success': True, 'message': 'OTP sent to your registered email.', 'masked_email': masked_email, 'user_id': card['user_id']})

    except ValueError:
        return jsonify({'error': 'Invalid data format'}), 400
    except Exception as e:
        db.rollback()
        logger.error(f"Checkout OTP error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@user_bp.route('/checkout/verify-otp', methods=['POST'])
def checkout_verify_otp():
    """Step 2: Verify OTP and process the actual payment."""
    db = get_db()
    data = request.json

    card_number = str(data.get('card_number', '')).replace(' ', '')
    expiry_date = data.get('expiry_date')
    cvv = data.get('cvv')
    pin = data.get('pin')
    amount = data.get('amount')
    merchant = data.get('merchant', 'SmartPay Merchant')
    otp = str(data.get('otp', ''))
    user_id = data.get('user_id')

    if not all([card_number, otp, amount, user_id]):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        amount = float(amount)

        # Verify OTP
        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user or str(user['otp']) != otp:
            _record_checkout_attempt(request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip() if request.headers.get('X-Forwarded-For') else request.remote_addr)
            return jsonify({'error': 'Invalid OTP'}), 400

        try:
            expiry_str = user['otp_expiry'].replace('Z', '+00:00')
            expiry_dt = datetime.fromisoformat(expiry_str)
            from datetime import timezone
            if datetime.now(timezone.utc) > expiry_dt:
                return jsonify({'error': 'OTP has expired. Please try again.'}), 400
        except Exception:
            pass

        # Invalidate OTP immediately
        db.execute('UPDATE users SET otp = NULL, otp_expiry = NULL WHERE id = ?', (user_id,))

        # Re-validate card (security: don't trust cached state)
        expiry_date_like = expiry_date
        if expiry_date and len(expiry_date) == 5 and '/' in expiry_date:
            mm, yy = expiry_date.split('/')
            expiry_date_like = f"20{yy}-{mm}-%"

        card = db.execute('SELECT * FROM cards WHERE card_number = ? AND expiry_date LIKE ? AND cvv = ? AND user_id = ?',
                         (card_number, expiry_date_like, str(cvv), user_id)).fetchone()
        if not card:
            return jsonify({'error': 'Card validation failed'}), 400
        if card['status'] != 'active':
            return jsonify({'error': 'Card is blocked or inactive'}), 400

        from werkzeug.security import check_password_hash
        if not check_password_hash(card['pin_hash'], str(pin)):
            return jsonify({'error': 'Incorrect PIN'}), 400

        # Process payment
        if card['card_type'].lower() == 'credit':
            if float(card['available_credit'] or 0) < amount:
                return jsonify({'error': 'Insufficient credit limit'}), 400
            db.execute('UPDATE cards SET available_credit = available_credit - ? WHERE id = ?', (amount, card['id']))
        else:
            if not card['account_id']:
                return jsonify({'error': 'Card is not linked to any account'}), 400
            account = db.execute('SELECT * FROM accounts WHERE id = ?', (card['account_id'],)).fetchone()
            if not account or float(account['balance']) < amount:
                return jsonify({'error': 'Insufficient account balance'}), 400
            db.execute('UPDATE accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (amount, account['id']))

        db.execute('''
            INSERT INTO transactions (account_id, type, amount, description, mode, status)
            VALUES (?, 'debit', ?, ?, 'Card', 'completed')
        ''', (card['account_id'], amount, f"POS/Online: {merchant}"))

        # Deduct from System Liquidity (money leaves the bank)
        db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "System Liquidity"', (amount,))

        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (card['user_id'], 'Card Payment (OTP Verified)', f'Paid {amount} INR to {merchant} via Card **{card_number[-4:]}', request.remote_addr))

        db.commit()

        # Send confirmation email
        send_email_async(user['email'], f"Payment Confirmed: ₹{amount:,.2f}",
            f"<p>Hello {user['name']}, your payment of ₹{amount:,.2f} to {merchant} was successful.</p>")

        return jsonify({'success': True, 'message': 'Payment successful', 'transaction_id': f"TXN{secrets.token_hex(4).upper()}"})

    except ValueError:
        return jsonify({'error': 'Invalid data format'}), 400
    except Exception as e:
        db.rollback()
        logger.error(f"Checkout verify error: {e}")
        return jsonify({'error': 'Internal server error processing payment'}), 500

@user_bp.route('/profile-image', methods=['POST'])
@login_required
def upload_profile_image():
    if 'image' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['image']
    if file.filename == '': return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        user_id = session['user_id']
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"user_{user_id}_{int(datetime.now().timestamp())}.{ext}"
        filepath = os.path.join(PROFILE_PICS_FOLDER, filename)
        file.save(filepath)
        db = get_db()
        try:
            old_user = db.execute('SELECT profile_image FROM users WHERE id = ?', (user_id,)).fetchone()
            if old_user and dict(old_user).get('profile_image'):
                old_path = os.path.join(PROFILE_PICS_FOLDER, dict(old_user).get('profile_image'))
                if os.path.exists(old_path):
                    try: os.remove(old_path)
                    except: pass
            db.execute('UPDATE users SET profile_image = ? WHERE id = ?', (filename, user_id))
            db.commit()
            return jsonify({'success': True, 'message': 'Profile image uploaded successfully', 'profile_image_url': f"/api/user/profile-image/{filename}"})
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'Invalid file type'}), 400

@user_bp.route('/profile-image/<filename>')
def serve_profile_image(filename):
    from werkzeug.utils import secure_filename
    safe_name = secure_filename(filename)
    return send_from_directory(PROFILE_PICS_FOLDER, safe_name)

@user_bp.route('/transfer', methods=['POST'])
@login_required
def transfer_money():
    data = request.json
    from_acc_id, to_acc_raw, amount_raw = data.get('from_account'), str(data.get('to_account', '')), float(data.get('amount', 0))
    currency = data.get('currency', 'INR').upper()
    
    if amount_raw <= 0: return jsonify({'error': 'Invalid amount'}), 400
    
    db = get_db()
    user_id = session['user_id']
    
    # Security: Check if user transactions are restricted by staff/admin
    user_check = db.execute('SELECT transact_restricted FROM users WHERE id = ?', (user_id,)).fetchone()
    if user_check and user_check['transact_restricted']:
        return jsonify({'error': 'Your transactions have been temporarily restricted. Please contact support.'}), 403
    
    # Calculate INR amount based on currency
    exchange_rate = EXCHANGE_RATES.get(currency, 1.0)
    inr_amount = round(amount_raw * exchange_rate, 2)
    
    try:
        src = db.execute('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND balance >= ?', (from_acc_id, user_id, inr_amount)).fetchone()
        if not src: return jsonify({'error': 'Insufficient funds or invalid account'}), 400
        
        user = db.execute('SELECT email, name, phone, daily_limit FROM users WHERE id = ?', (user_id,)).fetchone()
        user_global_limit = user['daily_limit'] if user and user['daily_limit'] is not None else 200000.00
        
        # Use account-specific limit if set, otherwise fallback to user-global limit
        daily_limit = src['daily_limit'] if ('daily_limit' in src.keys() and src['daily_limit'] is not None) else user_global_limit
        
        # Security: Lower limit for International Transfers (if not INR)
        if currency != 'INR':
            daily_limit = min(daily_limit, 50000.00) # Max 50k for international demo
            
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_spent_row = db.execute('''
            SELECT SUM(t.amount) as total FROM transactions t JOIN accounts a ON t.account_id = a.id 
            WHERE a.user_id = ? AND t.type = 'debit' AND t.transaction_date >= ?
        ''', (user_id, today_start)).fetchone()
        today_spent = float(today_spent_row['total'] or 0)
        
        if today_spent + inr_amount > daily_limit:
            limit_msg = f"Daily limit of ₹{daily_limit} exceeded."
            if currency != 'INR':
                limit_msg = f"International daily limit of ₹{daily_limit} exceeded."
            return jsonify({'error': f'{limit_msg} You have already spent ₹{today_spent} today.'}), 400
            
        dest = db.execute('SELECT * FROM accounts WHERE account_number = ? OR id = ?', (to_acc_raw, to_acc_raw)).fetchone()
        if not dest: return jsonify({'error': 'Destination account not found'}), 404
        if dest['id'] == src['id']: return jsonify({'error': 'Cannot transfer money to the same account'}), 400
        ref = f"TXN{secrets.token_hex(10).upper()}"
        src_bal_after = src['balance'] - inr_amount
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (src_bal_after, from_acc_id))
        
        from markupsafe import escape
        desc = f"Transfer to {to_acc_raw}"
        if currency != 'INR':
            desc = f"Intl UPI: {currency} {amount_raw} to {to_acc_raw}"
            
        db.execute('''
            INSERT INTO transactions 
            (account_id, type, amount, description, reference_number, balance_after, mode, foreign_currency, foreign_amount, exchange_rate) 
            VALUES (?, "debit", ?, ?, ?, ?, "Transfer", ?, ?, ?)
        ''', (from_acc_id, inr_amount, escape(desc), f"{ref}DB", src_bal_after, 
             currency if currency != 'INR' else None, 
             amount_raw if currency != 'INR' else None, 
             exchange_rate if currency != 'INR' else None))
             
        if dest:
            dest_bal_after = dest['balance'] + inr_amount
            db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (dest_bal_after, dest['id']))
            db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after) VALUES (?, "credit", ?, ?, ?, ?)',
                      (dest['id'], inr_amount, f"Received from {src['account_number']}", f"{ref}CR", dest_bal_after))
        db.commit()
        
        # Email Alerts
        curr_symbol = "₹" if currency == 'INR' else f"{currency} "
        debit_body = f"<p>Hello {user['name']}, your account was debited {curr_symbol}{amount_raw:,.2f} (Total: ₹{inr_amount:,.2f}). Transfer to {to_acc_raw}. Ref: {ref}. Balance: ₹{src_bal_after:,.2f}</p>"
        send_email_async(user['email'], f"Transaction Alert: Debit {curr_symbol}{amount_raw}", debit_body)
        
        if user['phone']: send_sms_async(user['phone'], f"SmartBank: Account {src['account_number'][-4:]} debited {currency} {amount_raw:,.2f} (INR {inr_amount:,.2f}). Ref: {ref}")
        if dest:
            receiver = db.execute('SELECT name, email, phone FROM users WHERE id = ?', (dest['user_id'],)).fetchone()
            if receiver:
                credit_body = f"<p>Hello {receiver['name']}, your account was credited ₹{amount:,.2f} from {src['account_number']}. Ref: {ref}</p>"
                send_email_async(receiver['email'], f"Transaction Alert: Credit ₹{amount}", credit_body)
                if receiver['phone']: send_sms_async(receiver['phone'], f"SmartBank: Account {dest['account_number'][-4:]} credited INR {amount:,.2f}. Ref: {ref}")
        return jsonify({'success': True, 'message': 'Transfer successful', 'reference': ref})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/upi/pay', methods=['POST'])
@login_required
def upi_pay():
    data = request.json
    vpa = data.get('target_vpa', '').strip()
    amount_raw = float(data.get('amount', 0))
    pin = str(data.get('upi_pin', ''))
    currency = data.get('currency', 'INR').upper()

    if not vpa or amount_raw <= 0 or not pin:
        return jsonify({'error': 'Missing required fields'}), 400

    db = get_db()
    user_id = session['user_id']
    
    # Security: Check if user transactions are restricted
    user_restrict = db.execute('SELECT transact_restricted FROM users WHERE id = ?', (user_id,)).fetchone()
    if user_restrict and user_restrict['transact_restricted']:
        return jsonify({'error': 'Your transactions have been temporarily restricted. Please contact support.'}), 403
    
    # 1. Verify UPI PIN
    user = db.execute('SELECT upi_pin, name, email, phone FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user or not user['upi_pin']:
        return jsonify({'error': 'UPI not set up'}), 400
        
    from werkzeug.security import check_password_hash
    if not check_password_hash(user['upi_pin'], pin):
        return jsonify({'error': 'Incorrect UPI PIN'}), 403

    # 2. Resolve VPA
    # For internal, it's username@smtbank
    target_user = None
    if vpa.endswith('@smtbank'):
        target_username = vpa.split('@')[0]
        target_user = db.execute('SELECT id FROM users WHERE username = ?', (target_username,)).fetchone()
    
    # 3. Find source account (Primary/Savings)
    src_acc = db.execute('SELECT id FROM accounts WHERE user_id = ? AND account_type = "Savings" ORDER BY id ASC LIMIT 1', (user_id,)).fetchone()
    if not src_acc:
        src_acc = db.execute('SELECT id FROM accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1', (user_id,)).fetchone()
    
    if not src_acc:
        return jsonify({'error': 'No active account found for UPI'}), 400

    # 4. Perform Transfer
    # If target_user found internally, use their primary account
    to_acc = None
    if target_user:
        dest_acc = db.execute('SELECT account_number FROM accounts WHERE user_id = ? AND account_type = "Savings" ORDER BY id ASC LIMIT 1', (target_user['id'],)).fetchone()
        if dest_acc:
            to_acc = dest_acc['account_number']

    # Use the existing transfer_money logic (simulated by calling the same logic or internal function)
    # Since we want to reuse the exchange rate logic, I'll just refactor or call it.
    # For now, I'll just implement the core logic here as well for simplicity.
    
    exchange_rate = EXCHANGE_RATES.get(currency, 1.0)
    inr_amount = round(amount_raw * exchange_rate, 2)
    
    try:
        src = db.execute('SELECT * FROM accounts WHERE id = ? AND balance >= ?', (src_acc['id'], inr_amount)).fetchone()
        if not src: return jsonify({'error': 'Insufficient funds'}), 400
        
        # Check Daily Limits (same enforcement as regular transfer)
        limit = (src['daily_limit'] if 'daily_limit' in src.keys() and src['daily_limit'] is not None else None) or 200000.00
        if currency != 'INR': limit = min(limit, 50000.00)
        
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_spent_row = db.execute('''
            SELECT SUM(t.amount) as total FROM transactions t JOIN accounts a ON t.account_id = a.id 
            WHERE a.user_id = ? AND t.type = 'debit' AND t.transaction_date >= ?
        ''', (user_id, today_start)).fetchone()
        today_spent = float(today_spent_row['total'] or 0) if today_spent_row else 0
        
        if today_spent + inr_amount > limit:
            return jsonify({'error': f'Daily limit of ₹{limit:,.0f} exceeded. Already spent ₹{today_spent:,.0f} today.'}), 400
        # Actually, let's just do it right.
        
        ref = f"UPI{secrets.token_hex(8).upper()}"
        src_bal_after = src['balance'] - inr_amount
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (src_bal_after, src_acc['id']))
        
        desc = f"UPI Pay: {vpa}"
        if currency != 'INR':
            desc = f"Intl UPI: {currency} {amount_raw} to {vpa}"
            
        db.execute('''
            INSERT INTO transactions 
            (account_id, type, amount, description, reference_number, balance_after, mode, foreign_currency, foreign_amount, exchange_rate) 
            VALUES (?, "debit", ?, ?, ?, ?, "UPI", ?, ?, ?)
        ''', (src_acc['id'], inr_amount, desc, f"{ref}DB", src_bal_after, 
             currency if currency != 'INR' else None, 
             amount_raw if currency != 'INR' else None, 
             exchange_rate if currency != 'INR' else None))
             
        if to_acc:
            dest = db.execute('SELECT * FROM accounts WHERE account_number = ?', (to_acc,)).fetchone()
            if dest:
                dest_bal_after = dest['balance'] + inr_amount
                db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (dest_bal_after, dest['id']))
                db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) VALUES (?, "credit", ?, ?, ?, ?, "UPI")',
                          (dest['id'], inr_amount, f"UPI from {user['name']}", f"{ref}CR", dest_bal_after, "UPI"))
        else:
            # External UPI Payment: Deduct from System Liquidity
            db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "System Liquidity"', (inr_amount,))
        
        db.commit()
        return jsonify({'success': True, 'message': 'Payment successful', 'reference': ref})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/loans/apply', methods=['POST'])
@login_required
def apply_loan():
    data = request.json
    user_id = session['user_id']
    loan_type = data.get('loan_type', data.get('loanType', 'Personal'))
    amount = float(data.get('loan_amount', data.get('amount', 0)))
    tenure = int(data.get('tenure_months', data.get('tenure', 12)))
    target_account_id = data.get('target_account_id')
    if tenure > 60: return jsonify({'error': 'Loan tenure cannot exceed 60 months'}), 400
    db = get_db()
    try:
        db.execute('INSERT INTO loans (user_id, loan_type, loan_amount, tenure_months, interest_rate, status, target_account_id, outstanding_amount) VALUES (?, ?, ?, ?, ?, \'pending\', ?, ?)',
                  (user_id, loan_type, amount, tenure, 5.0, target_account_id, amount))
        db.execute('INSERT INTO service_applications (user_id, service_type, product_name, amount, tenure, status, account_id) VALUES (?, "Loan", ?, ?, ?, \'pending\', ?)',
                  (user_id, loan_type, amount, tenure, target_account_id))
        db.commit()
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            send_email_async(user['email'], "Loan Application Received", f"<p>Dear {user['name']}, your application for a {loan_type} loan of ₹{amount:,.2f} is under review.</p>")
        return jsonify({'success': True, 'message': 'Application submitted'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/loans/repay', methods=['POST'])
@login_required
def repay_loan():
    data = request.json
    user_id = session['user_id']
    loan_id, account_id, amount, mode = data.get('loan_id'), data.get('account_id'), float(data.get('amount', 0)), data.get('mode', 'account')
    if amount <= 0: return jsonify({'error': 'Invalid amount'}), 400
    db = get_db()
    try:
        loan = db.execute('SELECT * FROM loans WHERE id = ? AND user_id = ? AND status = \'approved\'', (loan_id, user_id)).fetchone()
        if not loan: return jsonify({'error': 'Loan not found or not approved'}), 404
        outstanding = float(loan['outstanding_amount']) if loan['outstanding_amount'] is not None else float(loan['loan_amount'])
        if amount > outstanding: amount = outstanding
        acc_bal = None
        if mode == 'account':
            acc = db.execute('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND balance >= ?', (account_id, user_id, amount)).fetchone()
            if not acc: return jsonify({'error': 'Insufficient funds'}), 400
            acc_bal = acc['balance'] - amount
            db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (acc_bal, account_id))
        
        new_outstanding = outstanding - amount
        db.execute('UPDATE system_finances SET balance = balance + ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
        db.execute('UPDATE loans SET outstanding_amount = ? WHERE id = ?', (new_outstanding, loan_id))
        if new_outstanding <= 0: db.execute('UPDATE loans SET status = \'closed\' WHERE id = ?', (loan_id,))
        
        ref = f"LRP{secrets.token_hex(4).upper()}"
        if mode == 'account' and acc_bal is not None:
             db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) VALUES (?, "debit", ?, ?, ?, ?, ?)',
                       (account_id, amount, f"Repayment for Loan #{loan_id}", ref, acc_bal, f"Loan Repay ({mode.upper()})"))
        db.commit()
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            send_email_async(user['email'], f"Loan Repayment: ₹{amount}", f"<p>Hello {user['name']}, your repayment of ₹{amount:,.2f} was successful. Outstanding: ₹{new_outstanding:,.2f}</p>")
        return jsonify({'success': True, 'message': 'Repayment successful', 'outstanding': new_outstanding})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/accounts', methods=['POST'])
@login_required
def open_new_account():
    db = get_db()
    try:
        data = request.json
        user_id = session.get('user_id') or session.get('staff_id') or session.get('admin_id')
        account_type = data.get('account_type', 'Savings').capitalize()
        aadhaar, pan, tax_id, face, kyc_p, kyc_v = data.get('aadhaar_number'), data.get('pan_number'), data.get('tax_id'), data.get('face_descriptor'), data.get('kyc_photo'), data.get('kyc_video')
        lat, lng = data.get('lat'), data.get('lng')
        agri_address, agri_proof = data.get('agri_address'), data.get('agri_proof')
        salary_proof  = data.get('salary_proof')
        current_proof = data.get('current_proof')
        # tax_id already read above
        
        if not all([aadhaar, pan, face]): return jsonify({'error': 'Missing KYC data'}), 400
        
        count = db.execute('SELECT COUNT(*) FROM accounts WHERE user_id = ?', (user_id,)).fetchone()[0]
        if count >= 3: return jsonify({'error': 'Maximum account limit reached'}), 400
        
        # Get client IP
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()

        # If we have lat/lng from mobile, update user's last known location
        if lat and lng:
            db.execute('UPDATE users SET signup_ip=?, signup_lat=?, signup_lng=? WHERE id=?', (client_ip, lat, lng, user_id))
            from core.auth import trigger_geo_lookup
            trigger_geo_lookup(user_id, 'users')
        else:
            # Fallback to IP lookup
            from core.auth import trigger_geo_lookup
            trigger_geo_lookup(user_id, 'users')

        import json
        db.execute('INSERT INTO account_requests (user_id, account_type, aadhaar_number, pan_number, tax_id, face_descriptor, kyc_photo, kyc_video, status, signup_ip, signup_lat, signup_lng, agri_address, agri_proof, salary_proof, current_proof) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'pending\', ?, ?, ?, ?, ?, ?, ?)',
                  (user_id, account_type, aadhaar, pan, tax_id, json.dumps(face), kyc_p, kyc_v, client_ip, lat, lng, agri_address, agri_proof, salary_proof, current_proof))
        
        # Account requests are tracked natively in the account_requests table.
        # We do not insert into service_applications here because account_id is NOT NULL in strict schemas.
        
        db.commit()
        return jsonify({'success': True, 'message': 'Account requested successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/upi/status', methods=['GET'])
@login_required
def get_upi_status():
    db = get_db()
    user_id = session['user_id']
    user = db.execute('SELECT upi_id FROM users WHERE id = ?', (user_id,)).fetchone()
    return jsonify({'enabled': bool(user and user['upi_id']), 'upi_id': user['upi_id'] if user else None})

@user_bp.route('/upi/setup', methods=['POST'])
@login_required
def setup_upi():
    data = request.json
    pin, user_id, username = data.get('upi_pin'), session['user_id'], session['username']
    if not pin or len(str(pin)) != 6: return jsonify({'error': 'UPI PIN must be 6 digits'}), 400
    db = get_db()
    upi_id = f"{username}@smtbank"
    try:
        from werkzeug.security import generate_password_hash
        db.execute('UPDATE users SET upi_id = ?, upi_pin = ? WHERE id = ?', (upi_id, generate_password_hash(str(pin)), user_id))
        db.commit()
        return jsonify({'success': True, 'upi_id': upi_id})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/upi/change-pin/request-otp', methods=['POST'])
@login_required
def request_upi_pin_otp():
    db = get_db()
    user_id = session['user_id']
    try:
        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user or not user['email']:
            return jsonify({'error': 'No email address linked to your account.'}), 400
        
        # Generate OTP
        # Generate secure OTP
        otp = str(100000 + secrets.randbelow(900000))
        
        # Use datetime for sqlite, which often handles isoformat or integers.
        # auth_routes.py sets otp_expiry as: datetime.now(timezone.utc) + timedelta(minutes=10)
        from datetime import datetime, timedelta, timezone
        otp_expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        
        db.execute('UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?', (otp, otp_expiry, user_id))
        db.commit()
        
        body = f"<h3>Smart Bank - Change UPI PIN</h3><p>Your one-time passcode to change your UPI PIN is: <b>{otp}</b></p><p>This code will expire in 10 minutes. Do not share it with anyone.</p>"
        send_email_async(user['email'], "Smart Bank - UPI PIN Change Request", body)
        
        return jsonify({'success': True, 'message': 'OTP sent to your email.'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/upi/change-pin/verify', methods=['POST'])
@login_required
def verify_upi_pin_otp():
    data = request.json
    otp = data.get('otp')
    new_pin = data.get('new_pin')
    user_id = session['user_id']
    
    if not otp or not new_pin or len(str(new_pin)) != 6:
        return jsonify({'error': 'Invalid OTP or 6-digit PIN.'}), 400
        
    db = get_db()
    try:
        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        
        if not user or str(user['otp']) != str(otp):
            return jsonify({'error': 'Invalid OTP.'}), 400
            
        from datetime import datetime
        try:
            # Handle isoformat timezone properly across python versions
            expiry_str = user['otp_expiry'].replace('Z', '+00:00')
            expiry_dt = datetime.fromisoformat(expiry_str)
            from datetime import timezone
            if datetime.now(timezone.utc) > expiry_dt:
                return jsonify({'error': 'OTP has expired.'}), 400
        except Exception as e:
            # If datetime parsing fails (e.g., naive time in db), fallback to allow
            pass
            
        from werkzeug.security import generate_password_hash
        hashed_pin = generate_password_hash(str(new_pin))
        
        # Invalidate OTP and set new pin
        db.execute('UPDATE users SET upi_pin = ?, otp = NULL, otp_expiry = NULL WHERE id = ?', (hashed_pin, user_id))
        db.commit()
        
        # Log the action
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Change UPI PIN', 'User successfully changed UPI PIN via email OTP', request.remote_addr))
        db.commit()
        
        if user['email']:
            send_email_async(user['email'], "Smart Bank - UPI PIN Changed", "<p>Your UPI PIN has been successfully changed.</p>")
            
        return jsonify({'success': True, 'message': 'UPI PIN changed successfully.'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/cards/request', methods=['POST'])
@login_required
def request_card():
    data = request.json
    user_id = session['user_id']
    c_type = data.get('card_type', 'Classic')
    acc_id = data.get('account_id')
    lim = data.get('requested_credit_limit') or 0.0
    
    db = get_db()
    
    # Ensure account_id is provided to satisfy NOT NULL constraints
    if not acc_id:
        acc = db.execute('SELECT id FROM accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1', (user_id,)).fetchone()
        if acc:
            acc_id = acc['id']
        else:
            return jsonify({'error': 'No active account found. Please open an account first.'}), 400

    try:
        # Determine the actual card type that would be issued
        actual_type = 'Classic' if c_type.lower() == 'debit' else 'Credit'
        
        # Prevent duplicate: check if user already has an active card OF THIS TYPE
        existing_card = db.execute('SELECT id FROM cards WHERE user_id = ? AND status = \'active\' AND LOWER(card_type) = ?', (user_id, actual_type.lower())).fetchone()
        if existing_card:
            return jsonify({'error': f'You already have an active {actual_type} card. Go to Cards section to manage it.'}), 400
        
        # Prevent duplicate: check if user already has a pending request OF THIS TYPE
        existing_req = db.execute('SELECT id FROM card_requests WHERE user_id = ? AND status = \'pending\' AND LOWER(card_type) = ?', (user_id, c_type.lower())).fetchone()
        if existing_req:
            return jsonify({'error': f'You already have a pending {c_type} card request. Please wait for it to be processed.'}), 400

        db.execute('INSERT INTO card_requests (user_id, account_id, card_type, requested_credit_limit, status) VALUES (?, ?, ?, ?, \'pending\')',
                  (user_id, acc_id, c_type, lim))
        
        # Also track as a general service application for unified staff view
        db.execute('INSERT INTO service_applications (user_id, account_id, service_type, product_name, amount, status) VALUES (?, ?, "Card", ?, ?, \'pending\')',
                   (user_id, acc_id, c_type, lim))
        
        db.commit()
        return jsonify({'success': True, 'message': 'Card request submitted'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/cards/<int:card_id>/block', methods=['POST'])
@login_required
def block_card(card_id):
    db = get_db()
    user_id = session.get('user_id')
    try:
        # Verify ownership (can only block own card)
        card = db.execute('SELECT * FROM cards WHERE id = ? AND user_id = ?', (card_id, user_id)).fetchone()
        if not card:
            return jsonify({'error': 'Card not found or unauthorized'}), 404
            
        if card['status'] != 'active':
            return jsonify({'error': 'Card is already inactive or blocked'}), 400
            
        # Update the card status to blocked
        db.execute('UPDATE cards SET status = \'blocked\' WHERE id = ?', (card_id,))
        
        # Log the action
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Block Card', f'Blocked card ending in **{card["card_number"][-4:]}**', request.remote_addr))
                  
        db.commit()
        
        # Send Email Alert
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            send_email_async(
                user['email'], 
                "Security Alert: Card Blocked", 
                f"<p>Dear {user['name']}, your SmartBank card ending in {card['card_number'][-4:]} has been successfully blocked.<br>If you did not authorize this, please contact support immediately.</p>"
            )

        return jsonify({'success': True, 'message': 'Card blocked successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/cards/<int:card_id>/unblock', methods=['POST'])
@login_required
def unblock_card(card_id):
    db = get_db()
    user_id = session.get('user_id')
    try:
        # Verify ownership
        card = db.execute('SELECT * FROM cards WHERE id = ? AND user_id = ?', (card_id, user_id)).fetchone()
        if not card:
            return jsonify({'error': 'Card not found or unauthorized'}), 404
            
        if card['status'] != 'blocked':
            return jsonify({'error': 'Only blocked cards can be unblocked'}), 400
            
        # Update the card status to active
        db.execute('UPDATE cards SET status = \'active\' WHERE id = ?', (card_id,))
        
        # Log the action
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Unblock Card', f'Unblocked card ending in **{card["card_number"][-4:]}**', request.remote_addr))
                  
        db.commit()
        return jsonify({'success': True, 'message': 'Card unblocked successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/cards/<int:card_id>/settings', methods=['PUT'])
@login_required
def update_card_settings(card_id):
    db = get_db()
    user_id = session.get('user_id')
    data = request.json
    try:
        # Verify ownership
        card = db.execute('SELECT * FROM cards WHERE id = ? AND user_id = ?', (card_id, user_id)).fetchone()
        if not card:
            return jsonify({'error': 'Card not found or unauthorized'}), 404
            
        contactless = int(data.get('contactless_enabled', card['contactless_enabled'] if 'contactless_enabled' in card.keys() else 1))
        international = int(data.get('international_enabled', card['international_enabled'] if 'international_enabled' in card.keys() else 0))
        online = int(data.get('online_txn_enabled', card['online_txn_enabled'] if 'online_txn_enabled' in card.keys() else 1))
        limit = float(data.get('daily_limit', card['daily_limit'] if 'daily_limit' in card.keys() else 50000.00))
        
        db.execute('''
            UPDATE cards 
            SET contactless_enabled = ?, international_enabled = ?, online_txn_enabled = ?, daily_limit = ?
            WHERE id = ?
        ''', (contactless, international, online, limit, card_id))
        
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Update Card Settings', f'Updated settings for card ending in **{card["card_number"][-4:]}**', request.remote_addr))
                  
        db.commit()
        return jsonify({'success': True, 'message': 'Card settings updated successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/cards/<int:card_id>/set-pin', methods=['POST'])
@login_required
def set_card_pin(card_id):
    db = get_db()
    user_id = session.get('user_id')
    data = request.json
    pin = data.get('pin')
    
    if not pin or len(str(pin)) != 4 or not str(pin).isdigit():
        return jsonify({'error': 'PIN must be a 4-digit number'}), 400
        
    try:
        # Verify ownership
        card = db.execute('SELECT * FROM cards WHERE id = ? AND user_id = ?', (card_id, user_id)).fetchone()
        if not card:
            return jsonify({'error': 'Card not found or unauthorized'}), 404
            
        from werkzeug.security import generate_password_hash
        pin_hash = generate_password_hash(str(pin))
        
        db.execute('UPDATE cards SET pin_hash = ? WHERE id = ?', (pin_hash, card_id))
        
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Set Card PIN', f'Set PIN for card ending in **{card["card_number"][-4:]}**', request.remote_addr))
                  
        db.commit()
        return jsonify({'success': True, 'message': 'Card PIN set successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/cards/<int:card_id>/change-pin', methods=['POST'])
@login_required
def change_card_pin(card_id):
    db = get_db()
    user_id = session.get('user_id')
    data = request.json
    old_pin = data.get('old_pin')
    new_pin = data.get('new_pin')
    
    if not new_pin or len(str(new_pin)) != 4 or not str(new_pin).isdigit():
        return jsonify({'error': 'New PIN must be a 4-digit number'}), 400
        
    try:
        # Verify ownership
        card = db.execute('SELECT * FROM cards WHERE id = ? AND user_id = ?', (card_id, user_id)).fetchone()
        if not card:
            return jsonify({'error': 'Card not found or unauthorized'}), 404
            
        if not dict(card).get('pin_hash'):
            return jsonify({'error': 'No existing PIN found. Please use the Set PIN option.'}), 400
            
        from werkzeug.security import check_password_hash, generate_password_hash
        if not check_password_hash(card['pin_hash'], str(old_pin)):
            return jsonify({'error': 'Incorrect current PIN'}), 400
            
        new_pin_hash = generate_password_hash(str(new_pin))
        
        db.execute('UPDATE cards SET pin_hash = ? WHERE id = ?', (new_pin_hash, card_id))
        
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Change Card PIN', f'Changed PIN for card ending in **{card["card_number"][-4:]}**', request.remote_addr))
                  
        db.commit()
        return jsonify({'success': True, 'message': 'Card PIN changed successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/log-activity', methods=['POST'])
@login_required
def log_user_activity():
    data = request.json
    db = get_db()
    db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
              (session['user_id'], data.get('action'), data.get('details', ''), request.remote_addr))
    db.commit()
    return jsonify({'success': True})

# =============================================
# BENEFICIARY MANAGEMENT
# =============================================

@user_bp.route('/beneficiaries', methods=['GET'])
@login_required
def get_beneficiaries():
    db = get_db()
    user_id = session['user_id']
    beneficiaries = db.execute('SELECT * FROM beneficiaries WHERE user_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
    return jsonify([dict(b) for b in beneficiaries])

@user_bp.route('/beneficiaries', methods=['POST'])
@login_required
def add_beneficiary():
    data = request.json
    db = get_db()
    user_id = session['user_id']
    
    name = data.get('name')
    acc_num = data.get('account_number')
    ifsc = data.get('ifsc', '')
    bank_name = data.get('bank_name', 'SmartBank')
    nickname = data.get('nickname', '')

    if not name or not acc_num:
        return jsonify({'error': 'Name and account number are required'}), 400

    try:
        db.execute('''
            INSERT INTO beneficiaries (user_id, name, account_number, ifsc, bank_name, nickname)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, name, acc_num, ifsc, bank_name, nickname))
        db.commit()
        return jsonify({'success': True, 'message': 'Beneficiary added successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_bp.route('/beneficiaries/<int:b_id>', methods=['DELETE'])
@login_required
def delete_beneficiary(b_id):
    db = get_db()
    user_id = session['user_id']
    db.execute('DELETE FROM beneficiaries WHERE id = ? AND user_id = ?', (b_id, user_id))
    db.commit()
    return jsonify({'success': True, 'message': 'Beneficiary removed'})

# =============================================
# SAVINGS GOALS (POCKETS)
# =============================================

@user_bp.route('/savings-goals', methods=['GET'])
@login_required
def get_savings_goals():
    db = get_db()
    user_id = session['user_id']
    goals = db.execute('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
    return jsonify([dict(g) for g in goals])

@user_bp.route('/savings-goals', methods=['POST'])
@login_required
def create_savings_goal():
    data = request.json
    db = get_db()
    user_id = session['user_id']
    
    name = data.get('name')
    target = data.get('target_amount')
    deadline = data.get('deadline') or None

    if not name or not target:
        return jsonify({'error': 'Goal name and target amount are required'}), 400

    try:
        db.execute('''
            INSERT INTO savings_goals (user_id, name, target_amount, deadline)
            VALUES (?, ?, ?, ?)
        ''', (user_id, name, target, deadline))
        db.commit()
        return jsonify({'success': True, 'message': 'Goal created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_bp.route('/savings-goals/<int:g_id>/add-funds', methods=['POST'])
@login_required
def add_funds_to_goal(g_id):
    data = request.json
    db = get_db()
    user_id = session['user_id']
    amount = float(data.get('amount', 0))

    if amount <= 0:
        return jsonify({'error': 'Transfer amount must be positive'}), 400

    try:
        # Check if goal exists and belongs to user
        goal = db.execute('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', (g_id, user_id)).fetchone()
        if not goal:
            return jsonify({'error': 'Goal not found'}), 404

        new_total = float(goal['current_amount']) + amount
        status = 'completed' if new_total >= float(goal['target_amount']) else 'active'
        
        db.execute('UPDATE savings_goals SET current_amount = ?, status = ? WHERE id = ?', (new_total, status, g_id))
        
        # Log activity
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Add Goal Funds', f'Added ₹{amount} to goal: {goal["name"]}', request.remote_addr))
        
        db.commit()
        return jsonify({'success': True, 'message': 'Funds added successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/savings-goals/<int:g_id>/break', methods=['POST'])
@login_required
def break_savings_goal(g_id):
    db = get_db()
    user_id = session['user_id']
    
    try:
        goal = db.execute('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', (g_id, user_id)).fetchone()
        if not goal:
            return jsonify({'error': 'Goal not found'}), 404
        
        if goal['status'] == 'broken':
            return jsonify({'error': 'This pocket has already been broken'}), 400
        
        amount = float(goal['current_amount'])
        if amount <= 0:
            # Just mark as broken, no funds to return
            db.execute('UPDATE savings_goals SET status = "broken" WHERE id = ?', (g_id,))
            db.commit()
            return jsonify({'success': True, 'message': 'Pocket closed (no funds to return)'})
        
        # Find user's primary account to credit
        primary_acc = db.execute('SELECT * FROM accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1', (user_id,)).fetchone()
        if not primary_acc:
            return jsonify({'error': 'No account found to return funds to'}), 400
        
        # Credit funds back to account
        new_balance = float(primary_acc['balance']) + amount
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, primary_acc['id']))
        
        # Create transaction record
        import secrets
        ref = f"PKT{secrets.token_hex(4).upper()}"
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) 
            VALUES (?, "credit", ?, ?, ?, ?, "Pocket Break")
        ''', (primary_acc['id'], amount, f'Pocket "{goal["name"]}" broken - funds returned', ref, new_balance))
        
        # Mark goal as broken
        db.execute('UPDATE savings_goals SET status = "broken", current_amount = 0 WHERE id = ?', (g_id,))
        
        # Log activity
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'Break Pocket', f'Broke pocket "{goal["name"]}", ₹{amount} returned to account', request.remote_addr))
        
        db.commit()
        return jsonify({'success': True, 'message': f'₹{amount:,.2f} returned to your account', 'reference': ref})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# =============================================
# PDF STATEMENTS (using reportlab) — PREMIUM DESIGN
# =============================================
import io
from flask import send_file
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# INR Symbol Support & Font Registration
INR_SYMBOL = "₹"
try:
    # Try to register Arial for INR symbol support (Windows path)
    arial_path = r'C:\Windows\Fonts\arial.ttf'
    arial_bold_path = r'C:\Windows\Fonts\arialbd.ttf'
    if os.path.exists(arial_path):
        pdfmetrics.registerFont(TTFont('Arial', arial_path))
        if os.path.exists(arial_bold_path):
            pdfmetrics.registerFont(TTFont('Arial-Bold', arial_bold_path))
        FONT_NORMAL = 'Arial'
        FONT_BOLD = 'Arial-Bold'
    else:
        # Fallback if font doesn't exist (e.g. non-Windows or restricted)
        FONT_NORMAL = 'Helvetica'
        FONT_BOLD = 'Helvetica-Bold'
        INR_SYMBOL = "Rs."
except Exception as e:
    logger.error(f"Font registration failed: {e}")
    FONT_NORMAL = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'
    INR_SYMBOL = "Rs."

# Premium color palette
MAROON = colors.HexColor('#800000')
DARK_MAROON = colors.HexColor('#4a0000')
LIGHT_BG = colors.HexColor('#fef7f7')
ROW_ALT = colors.HexColor('#fafafa')
BORDER_COLOR = colors.HexColor('#e5e7eb')
GREEN = colors.HexColor('#059669')
RED = colors.HexColor('#dc2626')
GREY_TEXT = colors.HexColor('#6b7280')

@user_bp.route('/statements/months', methods=['GET'])
@login_required
def get_statement_months():
    db = get_db()
    user_id = session['user_id']
    try:
        # Get distinct months and years from transactions belonging to the user
        months = db.execute('''
            SELECT DISTINCT strftime('%m', t.transaction_date) as m, strftime('%Y', t.transaction_date) as y
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ?
            ORDER BY y DESC, m DESC
        ''', (user_id,)).fetchall()
        
        return jsonify({
            'months': [{'month': m['m'], 'year': m['y'], 'label': datetime(int(m['y']), int(m['m']), 1).strftime('%B %Y')} for m in months]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_bp.route('/statements/download/<month>', methods=['GET'])
@login_required
def download_statement(month):
    db = get_db()
    user_id = session['user_id']
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    accounts = db.execute('SELECT * FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
    
    # Filter transactions based on the selected period
    query = '''
        SELECT t.*, a.account_number, a.account_type 
        FROM transactions t 
        JOIN accounts a ON t.account_id = a.id 
        WHERE a.user_id = ? 
    '''
    params = [user_id]
    
    if month == 'current':
        # Filter for current month and year
        query += " AND strftime('%m', t.transaction_date) = strftime('%m', 'now') AND strftime('%Y', t.transaction_date) = strftime('%Y', 'now')"
    elif month == '6months':
        # Filter for transactions in the last 6 months
        query += " AND t.transaction_date >= date('now', '-6 months')"
    elif month == '1year' or month == '12months':
        # Filter for transactions in the last 12 months
        query += " AND t.transaction_date >= date('now', '-1 year')"
    elif month != 'all' and '_' in month:
        # Expected format: MM_YYYY
        try:
            m, y = month.split('_')
            query += " AND strftime('%m', t.transaction_date) = ? AND strftime('%Y', t.transaction_date) = ?"
            params.extend([m.zfill(2), y])
        except ValueError:
            pass # Fallback to all if format is invalid
            
    query += " ORDER BY t.transaction_date DESC"
    txns = db.execute(query, params).fetchall()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=50)
    elements = []
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    bank_name_style = ParagraphStyle('BankName', parent=styles['Title'], fontSize=28, textColor=MAROON, fontName=FONT_BOLD, leading=32, spaceAfter=8, alignment=TA_LEFT)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=11, textColor=GREY_TEXT, fontName=FONT_NORMAL, leading=14, spaceAfter=12)
    section_title = ParagraphStyle('SectionTitle', parent=styles['Normal'], fontSize=13, textColor=MAROON, fontName=FONT_BOLD, spaceBefore=20, spaceAfter=10)
    info_style = ParagraphStyle('InfoStyle', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#374151'), fontName=FONT_NORMAL, leading=16)
    footer_style = ParagraphStyle('FooterStyle', parent=styles['Normal'], fontSize=8, textColor=GREY_TEXT, fontName=FONT_NORMAL, alignment=TA_CENTER, spaceBefore=20)
    amount_credit = ParagraphStyle('AmtCredit', parent=styles['Normal'], fontSize=9, textColor=GREEN, fontName=FONT_BOLD, alignment=TA_RIGHT)
    amount_debit = ParagraphStyle('AmtDebit', parent=styles['Normal'], fontSize=9, textColor=RED, fontName=FONT_BOLD, alignment=TA_RIGHT)
    
    # ═══════════════ HEADER ═══════════════
    elements.append(Paragraph("SmartBank", bank_name_style))
    elements.append(Paragraph("Premium Digital Banking Statement", subtitle_style))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=MAROON, spaceAfter=16))
    
    # ═══════════════ CUSTOMER INFO ═══════════════
    gen_date = datetime.now().strftime('%d %B %Y, %I:%M %p')
    info_data = [
        ['Customer Name', user['name'] or '—', 'Statement Date', gen_date],
        ['Email', user['email'] or '—', 'Customer ID', f"UID-{user['id']:06d}"],
        ['Phone', dict(user).get('phone') or '—', 'Total Accounts', str(len(accounts))],
    ]
    
    info_table = Table(info_data, colWidths=[100, 160, 100, 160])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
        ('FONTNAME', (0,0), (0,-1), FONT_BOLD),
        ('FONTNAME', (2,0), (2,-1), FONT_BOLD),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TEXTCOLOR', (0,0), (0,-1), GREY_TEXT),
        ('TEXTCOLOR', (2,0), (2,-1), GREY_TEXT),
        ('TEXTCOLOR', (1,0), (1,-1), colors.HexColor('#111827')),
        ('TEXTCOLOR', (3,0), (3,-1), colors.HexColor('#111827')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 12))
    
    # ═══════════════ ACCOUNT SUMMARY ═══════════════
    if accounts:
        elements.append(Paragraph("Account Summary", section_title))
        
        acc_header = ['Account Number', 'Type', 'IFSC', f'Balance ({INR_SYMBOL})']
        acc_rows = [acc_header]
        total_balance = 0
        for acc in accounts:
            bal = float(acc['balance'])
            total_balance += bal
            acc_rows.append([
                acc['account_number'],
                (acc['account_type'] or 'Savings').title(),
                dict(acc).get('ifsc_code') or 'SMTB0000001',
                f"{INR_SYMBOL}{bal:,.2f}"
            ])
        acc_rows.append(['', '', 'Total Balance', f"{INR_SYMBOL}{total_balance:,.2f}"])
        
        acc_table = Table(acc_rows, colWidths=[140, 100, 120, 160])
        acc_style = [
            ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
            ('BACKGROUND', (0,0), (-1,0), MAROON),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('FONTSIZE', (0,1), (-1,-1), 9),
            ('BOTTOMPADDING', (0,0), (-1,0), 10),
            ('TOPPADDING', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,1), (-1,-1), 7),
            ('TOPPADDING', (0,1), (-1,-1), 7),
            ('ALIGN', (3,0), (3,-1), 'RIGHT'),
            ('FONTNAME', (0,-1), (-1,-1), FONT_BOLD),
            ('LINEABOVE', (0,-1), (-1,-1), 1.5, MAROON),
            ('GRID', (0,0), (-1,-2), 0.5, BORDER_COLOR),
            ('ROUNDEDCORNERS', [6, 6, 0, 0]),
        ]
        # Alternating row colors
        for i in range(1, len(acc_rows) - 1):
            if i % 2 == 0:
                acc_style.append(('BACKGROUND', (0,i), (-1,i), ROW_ALT))
        
        acc_table.setStyle(TableStyle(acc_style))
        elements.append(acc_table)
        elements.append(Spacer(1, 16))
    
    # ═══════════════ TRANSACTIONS ═══════════════
    elements.append(Paragraph("Transaction History", section_title))
    
    if not txns:
        elements.append(Paragraph("No transactions found for this period.", info_style))
    else:
        # Calculate summary
        total_credit = sum(float(t['amount']) for t in txns if t['type'] == 'credit')
        total_debit = sum(float(t['amount']) for t in txns if t['type'] == 'debit')
        
        # Summary cards as a table
        summary_data = [
            ['Total Credits', 'Total Debits', 'Net Flow'],
            [f"{INR_SYMBOL}{total_credit:,.2f}", f"{INR_SYMBOL}{total_debit:,.2f}", f"{INR_SYMBOL}{(total_credit - total_debit):,.2f}"]
        ]
        summary_table = Table(summary_data, colWidths=[173, 173, 174])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
            ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
            ('TEXTCOLOR', (0,0), (-1,0), GREY_TEXT),
            ('FONTSIZE', (0,0), (-1,0), 8),
            ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
            ('FONTSIZE', (0,1), (-1,1), 12),
            ('FONTNAME', (0,1), (-1,1), FONT_BOLD),
            ('TEXTCOLOR', (0,1), (0,1), GREEN),
            ('TEXTCOLOR', (1,1), (1,1), RED),
            ('TEXTCOLOR', (2,1), (2,1), MAROON),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
            ('LINEBEFORE', (1,0), (1,-1), 0.5, BORDER_COLOR),
            ('LINEBEFORE', (2,0), (2,-1), 0.5, BORDER_COLOR),
            ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 12))
        
        # Transaction table
        data = [['Date', 'Description', 'Account', 'Ref', 'Type', f'Amount ({INR_SYMBOL})']]
        for t in txns:
            amt = float(t['amount'])
            amt_str = f"+{INR_SYMBOL}{amt:,.2f}" if t['type'] == 'credit' else f"-{INR_SYMBOL}{amt:,.2f}"
            desc = t['description']
            if len(desc) > 28:
                desc = desc[:28] + '…'
            ref = (dict(t).get('reference_number') or '—')[:12]
            data.append([
                t['transaction_date'][:10],
                desc,
                '••' + t['account_number'][-4:],
                ref,
                t['type'].upper(),
                amt_str
            ])
        
        txn_table = Table(data, colWidths=[68, 148, 55, 82, 45, 122])
        txn_style = [
            ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
            ('BACKGROUND', (0,0), (-1,0), MAROON),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), FONT_BOLD),
            ('FONTSIZE', (0,0), (-1,0), 9),
            ('FONTSIZE', (0,1), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,0), 10),
            ('TOPPADDING', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6),
            ('TOPPADDING', (0,1), (-1,-1), 6),
            ('ALIGN', (5,0), (5,-1), 'RIGHT'),
            ('ALIGN', (4,0), (4,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 0.4, BORDER_COLOR),
        ]
        # Color code amounts and alternating rows
        for i in range(1, len(data)):
            if i % 2 == 0:
                txn_style.append(('BACKGROUND', (0,i), (-1,i), ROW_ALT))
            # Color the amount column
            if data[i][4] == 'CREDIT':
                txn_style.append(('TEXTCOLOR', (5,i), (5,i), GREEN))
            else:
                txn_style.append(('TEXTCOLOR', (5,i), (5,i), RED))
            txn_style.append(('FONTNAME', (5,i), (5,i), FONT_BOLD))
        
        txn_table.setStyle(TableStyle(txn_style))
        elements.append(txn_table)
    
    # ═══════════════ FOOTER ═══════════════
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceAfter=10))
    elements.append(Paragraph("This is a computer-generated statement from SmartBank Digital Banking.", footer_style))
    elements.append(Paragraph("It does not require a physical signature. For disputes, contact support@smartbank.in", footer_style))
    elements.append(Paragraph(f"© {datetime.now().year} SmartBank. All rights reserved. • CIN: U65191KA2024PTC123456", footer_style))
    
    def draw_footer_and_header(canvas, doc):
        canvas.saveState()
        # Footer
        canvas.setFont(FONT_NORMAL, 8)
        canvas.setStrokeColor(BORDER_COLOR)
        canvas.line(doc.leftMargin, 35, doc.width + doc.leftMargin, 35)
        canvas.setFillColor(GREY_TEXT)
        canvas.drawCentredString(doc.width/2 + doc.leftMargin, 25, f"Page {doc.page} | SmartBank Customer Support: 1800-SMART-BANK")
        # Repeating Header Branding (top right)
        if doc.page > 1:
            canvas.setFont(FONT_BOLD, 12)
            canvas.setFillColor(MAROON)
            canvas.drawRightString(doc.width + doc.leftMargin, doc.height + doc.topMargin + 10, "SmartBank Statement")
        canvas.restoreState()

    doc.build(elements, onFirstPage=draw_footer_and_header, onLaterPages=draw_footer_and_header)
    buffer.seek(0)
    
    # Choose a descriptive name for the download
    filename_suffix = datetime.now().strftime('%b_%Y')
    if month == '6months':
        filename_suffix = "Last_6_Months"
    elif month == '1year' or month == '12months':
        filename_suffix = "Last_1_Year"
    elif month == 'all':
        filename_suffix = "Full_History"
    elif '_' in month:
        filename_suffix = month
        
    return send_file(
        buffer, 
        as_attachment=True, 
        download_name=f"SmartBank_Statement_{filename_suffix}.pdf",
        mimetype='application/pdf'
    )

@user_bp.route('/statements/download/transaction/<int:txn_id>', methods=['GET'])
@login_required
def download_transaction_receipt(txn_id):
    db = get_db()
    user_id = session['user_id']
    
    # Verify transaction belongs to this user
    txn = db.execute('''
        SELECT t.*, a.account_number, a.account_type, u.name as user_name, u.email as user_email
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        WHERE t.id = ? AND a.user_id = ?
    ''', (txn_id, user_id)).fetchone()
    
    if not txn:
        return jsonify({'error': 'Transaction not found or unauthorized'}), 404

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    elements = []
    styles = getSampleStyleSheet()
    
    # Premium styles (synchronized with main statement)
    bank_name_style = ParagraphStyle('BankName', parent=styles['Title'], fontSize=32, textColor=MAROON, fontName=FONT_BOLD, leading=36, spaceAfter=8, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=11, textColor=GREY_TEXT, fontName=FONT_NORMAL, leading=14, spaceAfter=20, alignment=TA_CENTER)
    label_style = ParagraphStyle('LabelStyle', parent=styles['Normal'], fontSize=10, textColor=GREY_TEXT, fontName=FONT_BOLD)
    value_style = ParagraphStyle('ValueStyle', parent=styles['Normal'], fontSize=11, textColor=colors.black, fontName=FONT_NORMAL, alignment=TA_RIGHT)
    
    # Header
    elements.append(Paragraph("SmartBank", bank_name_style))
    elements.append(Paragraph("Official Transaction Receipt", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=25))
    
    # Success Banner
    banner_data = [[Paragraph("✓ PAYMENT SUCCESSFUL", ParagraphStyle('BTitle', fontSize=14, textColor=GREEN, fontName=FONT_BOLD, alignment=TA_CENTER))]]
    banner_table = Table(banner_data, colWidths=[400])
    banner_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('ROUNDEDCORNERS', [5, 5, 5, 5]),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BOX', (0,0), (-1,-1), 1, GREEN)
    ]))
    elements.append(banner_table)
    elements.append(Spacer(1, 20))
    
    # Receipt Details Table
    data = [
        [Paragraph("Transaction Reference", label_style), Paragraph(txn['reference_number'] or f"TXN-{txn['id']:08d}", value_style)],
        [Paragraph("Date & Time", label_style), Paragraph(txn['transaction_date'], value_style)],
        [Paragraph("Payment Category", label_style), Paragraph(txn['description'] or 'General Transfer', value_style)],
        [Paragraph("From Account", label_style), Paragraph(f"{txn['account_type'].title()} (**{txn['account_number'][-4:]})", value_style)],
        [Paragraph("Transaction Type", label_style), Paragraph(txn['type'].upper(), ParagraphStyle('ValT', parent=value_style, textColor=RED if txn['type'] == 'debit' else GREEN))],
    ]
    
    receipt_table = Table(data, colWidths=[180, 260])
    receipt_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, BORDER_COLOR),
    ]))
    elements.append(receipt_table)
    elements.append(Spacer(1, 20))
    
    # Amount Box
    amt_data = [[
        Paragraph("TOTAL AMOUNT", ParagraphStyle('AmtLbl', parent=label_style, fontSize=12, alignment=TA_LEFT)), 
        Paragraph(f"{INR_SYMBOL}{float(txn['amount']):,.2f}", ParagraphStyle('AmtVal', parent=value_style, fontSize=20, fontName=FONT_BOLD, textColor=MAROON, alignment=TA_RIGHT))
    ]]
    amt_table = Table(amt_data, colWidths=[180, 260])
    amt_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NORMAL),
        ('BACKGROUND', (0,0), (-1,-1), ROW_ALT),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 15),
        ('TOPPADDING', (0,0), (-1,-1), 15),
        ('ROUNDEDCORNERS', [5, 5, 5, 5]),
        ('BOX', (0,0), (-1,-1), 1, MAROON)
    ]))
    elements.append(amt_table)
    
    # ═══════════════ FOOTER ═══════════════
    elements.append(Spacer(1, 80))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceAfter=10))
    f_style = ParagraphStyle('FS', parent=styles['Normal'], fontSize=8, textColor=GREY_TEXT, alignment=TA_CENTER)
    elements.append(Paragraph("Thank you for banking with SmartBank.", f_style))
    elements.append(Paragraph(f"Generated on {datetime.now().strftime('%d %B %Y, %I:%M %p')}", f_style))
    elements.append(Paragraph("This is a digital receipt and does not require a physical signature.", f_style))

    doc.build(elements)
    buffer.seek(0)
    
    return send_file(
        buffer, 
        as_attachment=True, 
        download_name=f"SmartBank_Premium_Receipt_{txn['reference_number'] or txn['id']}.pdf",
        mimetype='application/pdf'
    )

# =============================================
# SUPPORT TICKETS
# =============================================

@user_bp.route('/support', methods=['GET'])
@login_required
def get_user_tickets():
    db = get_db()
    user_id = session['user_id']
    tickets = db.execute('''
        SELECT * FROM support_tickets 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    ''', (user_id,)).fetchall()
    return jsonify({'tickets': [dict(t) for t in tickets]})

@user_bp.route('/support', methods=['POST'])
@login_required
def create_support_ticket():
    data = request.json
    db = get_db()
    user_id = session['user_id']

    subject = data.get('subject')
    message = data.get('message')
    priority = data.get('priority', 'normal')
    category = data.get('category', 'general')

    if not subject or not message:
        return jsonify({'error': 'Subject and message are required'}), 400

    try:
        db.execute('''
            INSERT INTO support_tickets (user_id, subject, message, priority, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, subject, message, priority, 'open'))
        
        # Log activity
        db.execute('INSERT INTO user_activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                  (user_id, 'New Support Ticket', f'Raised ticket: {subject}', request.remote_addr))
        
        db.commit()
        
        # Email Notification
        user = db.execute('SELECT email FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            send_email_async(
                user['email'], 
                f"SmartBank: Support Ticket Created - {subject}",
                f"<p>We have received your support ticket regarding <b>{subject}</b>. Our team will review it and get back to you shortly.</p>"
            )
        return jsonify({'success': True, 'message': 'Ticket raised successfully', 'ticket_id': db.execute('SELECT last_insert_rowid()').fetchone()[0]})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/support/tickets/<int:ticket_id>/messages', methods=['GET'])
@login_required
def get_ticket_messages(ticket_id):
    db = get_db()
    user_id = session['user_id']
    
    # Verify ownership
    ticket = db.execute('SELECT id FROM support_tickets WHERE id = ? AND user_id = ?', (ticket_id, user_id)).fetchone()
    if not ticket:
        return jsonify({'error': 'Ticket not found or unauthorized'}), 404
        
    messages = db.execute('''
        SELECT * FROM support_messages 
        WHERE ticket_id = ? 
        ORDER BY timestamp ASC
    ''', (ticket_id,)).fetchall()
    
    return jsonify({'messages': [dict(m) for m in messages]})

@user_bp.route('/support/tickets/<int:ticket_id>/messages', methods=['POST'])
@login_required
def send_ticket_message(ticket_id):
    data = request.json
    db = get_db()
    user_id = session['user_id']
    message = data.get('message')
    
    if not message:
        return jsonify({'error': 'Message cannot be empty'}), 400
        
    # Verify ownership and status
    ticket = db.execute('SELECT id, status FROM support_tickets WHERE id = ? AND user_id = ?', (ticket_id, user_id)).fetchone()
    if not ticket:
        return jsonify({'error': 'Ticket not found or unauthorized'}), 404
        
    if ticket['status'] == 'closed':
        return jsonify({'error': 'Cannot message on a closed ticket'}), 400
        
    try:
        db.execute('''
            INSERT INTO support_messages (ticket_id, sender_id, sender_type, message)
            VALUES (?, ?, 'user', ?)
        ''', (ticket_id, user_id, message))
        
        # Optionally update ticket status to 'pending' if it was 'open' or 'replied'
        db.execute('UPDATE support_tickets SET status = \'pending\' WHERE id = ?', (ticket_id,))
        db.commit()

        # Email Notification
        user = db.execute('SELECT email FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            send_email_async(
                user['email'], 
                f"SmartBank: Ticket #{ticket_id} Updated",
                f"<p>Your reply has been added to Ticket #{ticket_id}. Our team has been notified.</p>"
            )

        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# =============================================
# LOCATIONS (Branches & ATMs)
# =============================================

@user_bp.route('/locations', methods=['GET'])
@login_required
def get_locations():
    db = get_db()
    try:
        # Fetch all active locations
        locations = db.execute('''
            SELECT id, name, type, address, city, lat, lng, photo_url 
            FROM bank_locations 
            WHERE status = 'active'
        ''').fetchall()
        return jsonify([dict(loc) for loc in locations])
    except Exception as e:
        logger.error(f"Error fetching locations: {e}")
        return jsonify({'error': 'Failed to fetch locations'}), 500

# =============================================
# LIVE CHAT (Encrypted Real-Time Support)
# =============================================

@user_bp.route('/livechat/start', methods=['POST'])
@login_required
def start_live_chat():
    """Start a new live chat session or resume an existing open one."""
    db = get_db()
    user_id = session['user_id']
    
    # Check for existing active session
    existing = db.execute(
        "SELECT * FROM live_chat_sessions WHERE user_id = ? AND status IN ('waiting', 'active') ORDER BY id DESC LIMIT 1",
        (user_id,)
    ).fetchone()
    
    if existing:
        return jsonify({'success': True, 'session_id': existing['id'], 'status': existing['status'], 'resumed': True})
    
    try:
        db.execute(
            'INSERT INTO live_chat_sessions (user_id, status) VALUES (?, ?)',
            (user_id, 'waiting')
        )
        db.commit()
        session_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Auto-welcome message (encrypted)
        welcome = encrypt_message('Welcome to SmartBank Live Support! A support agent will be with you shortly. Your messages are encrypted end-to-end.')
        db.execute(
            'INSERT INTO live_chat_messages (session_id, sender_type, sender_id, message, message_type, is_encrypted) VALUES (?, ?, ?, ?, ?, ?)',
            (session_id, 'system', 0, welcome, 'text', 1)
        )
        db.commit()
        
        return jsonify({'success': True, 'session_id': session_id, 'status': 'waiting', 'resumed': False})
    except Exception as e:
        db.rollback()
        logger.error(f'Live chat start error: {e}')
        return jsonify({'error': str(e)}), 500

@user_bp.route('/livechat/<int:sid>/messages', methods=['GET'])
@login_required
def get_live_chat_messages(sid):
    """Get all messages for a live chat session (decrypted)."""
    db = get_db()
    user_id = session['user_id']
    
    chat_session = db.execute(
        'SELECT * FROM live_chat_sessions WHERE id = ? AND user_id = ?', (sid, user_id)
    ).fetchone()
    if not chat_session:
        return jsonify({'error': 'Session not found'}), 404
    
    messages = db.execute(
        'SELECT * FROM live_chat_messages WHERE session_id = ? ORDER BY created_at ASC', (sid,)
    ).fetchall()
    
    decrypted = []
    for m in messages:
        md = dict(m)
        if md.get('is_encrypted'):
            md['message'] = decrypt_message(md['message'])
        decrypted.append(md)
    
    return jsonify({
        'success': True,
        'session': {'id': chat_session['id'], 'status': chat_session['status']},
        'messages': decrypted
    })

@user_bp.route('/livechat/<int:sid>/send', methods=['POST'])
@login_required
def send_live_chat_message(sid):
    """Send a message in a live chat session (encrypted at rest)."""
    db = get_db()
    user_id = session['user_id']
    data = request.json
    
    chat_session = db.execute(
        'SELECT * FROM live_chat_sessions WHERE id = ? AND user_id = ? AND status IN ("waiting", \'active\')', (sid, user_id)
    ).fetchone()
    if not chat_session:
        return jsonify({'error': 'Session not found or closed'}), 404
    
    message = data.get('message', '').strip()
    msg_type = data.get('type', 'text')  # 'text' or 'image'
    
    if not message:
        return jsonify({'error': 'Message cannot be empty'}), 400
    
    # For images, message contains the base64 data URI - encrypt it too
    if msg_type == 'image' and len(message) > 10 * 1024 * 1024:
        return jsonify({'error': 'Image too large. Max 10MB.'}), 400
    
    try:
        encrypted = encrypt_message(message)
        db.execute(
            'INSERT INTO live_chat_messages (session_id, sender_type, sender_id, message, message_type, is_encrypted) VALUES (?, ?, ?, ?, ?, ?)',
            (sid, 'user', user_id, encrypted, msg_type, 1)
        )
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@user_bp.route('/livechat/<int:sid>/close', methods=['POST'])
@login_required
def close_live_chat(sid):
    """Close a live chat session."""
    db = get_db()
    user_id = session['user_id']
    
    chat_session = db.execute(
        'SELECT * FROM live_chat_sessions WHERE id = ? AND user_id = ?', (sid, user_id)
    ).fetchone()
    if not chat_session:
        return jsonify({'error': 'Session not found'}), 404
    
    try:
        db.execute(
            "UPDATE live_chat_sessions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?", (sid,)
        )
        goodbye = encrypt_message('This chat session has been closed. Thank you for contacting SmartBank Support!')
        db.execute(
            'INSERT INTO live_chat_messages (session_id, sender_type, sender_id, message, message_type, is_encrypted) VALUES (?, ?, ?, ?, ?, ?)',
            (sid, 'system', 0, goodbye, 'text', 1)
        )
        db.commit()
        return jsonify({'success': True, 'message': 'Chat session closed'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
