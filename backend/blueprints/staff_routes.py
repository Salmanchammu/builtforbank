from flask import Blueprint, request, jsonify, session, send_from_directory
import os
import random
import secrets
import logging
from datetime import datetime, timedelta

from core.db import get_db
from core.auth import login_required, role_required, compare_face_descriptors
from core.email_utils import send_email_async
from core.constants import PROFILE_PICS_FOLDER, allowed_file

staff_bp = Blueprint('staff', __name__)
logger = logging.getLogger('smart_bank.staff')

import threading
from config.sms_config import send_sms

def send_sms_async(p, m):
    threading.Thread(target=send_sms, args=(p, m), daemon=True).start()
    return True

def notify_user(db, user_id, title, message, n_type='info'):
    """Insert a notification into the DB and send an email to the user."""
    db.execute(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        (user_id, title, message, n_type)
    )
    # Also send an email
    try:
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            email_html = f"""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f5f9;">
                <div style="background: linear-gradient(135deg, #800000, #4a0000); padding: 30px 24px; text-align: center;">
                    <h1 style="margin: 0; color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">SmartBank</h1>
                    <p style="margin: 6px 0 0; color: rgba(255,255,255,0.75); font-size: 12px;">Secure Notification Service</p>
                </div>
                <div style="padding: 28px 24px;">
                    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e293b; font-weight: 700;">{title}</h2>
                    <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.7;">{message}</p>
                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">This is an automated notification from SmartBank. Do not reply to this email.</p>
                </div>
            </div>
            """
            send_email_async(user['email'], f"SmartBank: {title}", email_html)
    except Exception as e:
        logger.error(f"Failed to send notification email for user {user_id}: {e}")

@staff_bp.route('/customers', methods=['GET'])
@role_required(['admin', 'staff'])
def get_customers():
    db = get_db()
    customers = db.execute('''
        SELECT u.id, u.name, u.username, u.email, u.phone, u.status, u.created_at, u.transact_restricted,
               COUNT(a.id) AS account_count,
               SUM(IFNULL(a.balance, 0)) AS total_balance
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ''').fetchall()
    return jsonify({'customers': [dict(c) for c in customers]})

@staff_bp.route('/dashboard', methods=['GET'])
@role_required('staff')
def dashboard():
    db = get_db()
    now = datetime.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    total_customers = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    stats = {
        'total_customers': total_customers,
        'pending_loans': db.execute('SELECT COUNT(*) FROM service_applications WHERE status = "pending"').fetchone()[0],
        'total_balance': db.execute('SELECT SUM(balance) FROM accounts WHERE status = "active"').fetchone()[0] or 0,
        'total_accounts': db.execute('SELECT COUNT(*) FROM accounts WHERE status = "active"').fetchone()[0]
    }
    
    recent_customers = [dict(c) for c in db.execute('SELECT id, name, username, email FROM users ORDER BY created_at DESC LIMIT 5').fetchall()]
    pending_loans = [dict(l) for l in db.execute('''
        SELECT sa.id, sa.product_name as title, sa.service_type, u.name as customer 
        FROM service_applications sa JOIN users u ON sa.user_id = u.id 
        WHERE sa.status = "pending" ORDER BY sa.applied_at DESC LIMIT 5

    ''').fetchall()]
    
    recent_activities = [dict(a) for a in db.execute('''
        SELECT al.*, u.name as user_name 
        FROM user_activity_logs al 
        JOIN users u ON al.user_id = u.id 
        ORDER BY al.created_at DESC LIMIT 5
    ''').fetchall()]
    
    recent_transactions = [dict(t) for t in db.execute('''
        SELECT t.*, u.name as customer, a.account_number as account
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC LIMIT 10
    ''').fetchall()]
    
    return jsonify({
        'success': True, 
        'stats': stats, 
        'recent_customers': recent_customers, 
        'pending_loans': pending_loans,
        'recent_activities': recent_activities,
        'recent_transactions': recent_transactions
    })

@staff_bp.route('/analytics', methods=['GET'])
@role_required(['staff', 'admin'])
def analytics():
    db = get_db()
    account_types = {row['account_type']: row['count'] for row in db.execute('SELECT account_type, COUNT(*) as count FROM accounts GROUP BY account_type').fetchall()}
    loan_status = {row['status']: row['count'] for row in db.execute('SELECT status, COUNT(*) as count FROM loans GROUP BY status').fetchall()}
    return jsonify({'success': True, 'account_types': account_types, 'loan_status': loan_status})

@staff_bp.route('/accounts', methods=['GET'])
@role_required(['staff', 'admin'])
def get_accounts():
    db = get_db()
    accounts = db.execute('''
        SELECT a.*, u.name as user_name, u.transact_restricted FROM accounts a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC
    ''').fetchall()
    return jsonify({'accounts': [dict(a) for a in accounts]})

@staff_bp.route('/accounts/<int:id>/details', methods=['GET'])
@role_required(['staff', 'admin'])
def get_account_details(id):
    db = get_db()
    # Support both id and account_number lookups
    account = db.execute('''
        SELECT a.*, u.name as user_name, u.phone as user_phone
        FROM accounts a
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ? OR a.account_number = ?
    ''', (id, id)).fetchone()
    if not account:
        return jsonify({'error': 'Account not found'}), 404
        
    transactions = db.execute('''
        SELECT * FROM transactions WHERE account_id = ? ORDER BY transaction_date DESC LIMIT 50
    ''', (account['id'],)).fetchall()
    
    return jsonify({
        'success': True,
        'account': dict(account),
        'transactions': [dict(t) for t in transactions]
    })

@staff_bp.route('/transactions', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_get_all_transactions():
    """Fetch all transactions with user and account details for the staff dashboard."""
    db = get_db()
    # Join with accounts and users to get the necessary details for the frontend
    txns = db.execute('''
        SELECT t.*, u.id as user_id, u.name as user_name, a.account_number
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC
        LIMIT 100
    ''').fetchall()
    
    return jsonify({
        'success': True,
        'transactions': [dict(t) for t in txns]
    })

@staff_bp.route('/lookup', methods=['GET'])
@role_required(['staff', 'admin'])
def lookup():
    query = request.args.get('q', '').strip()
    l_type = request.args.get('type', 'account')
    db = get_db()
    if l_type == 'account':
        account = db.execute('SELECT a.*, u.name as user_name FROM accounts a JOIN users u ON a.user_id = u.id WHERE a.account_number = ? OR a.id = ?', (query, query)).fetchone()
        return jsonify({'success': True, 'data': dict(account)}) if account else jsonify({'success': False, 'error': 'Not found'}), 404
    users = db.execute('SELECT id, name, username, email, phone, status FROM users WHERE name LIKE ? OR username LIKE ? OR phone LIKE ? LIMIT 10', (f"%{query}%", f"%{query}%", f"%{query}%")).fetchall()
    return jsonify({'success': True, 'data': [dict(u) for u in users]})

@staff_bp.route('/loans', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_get_loans():
    db = get_db()
    loans = db.execute('''
        SELECT l.*, u.name as user_name, u.email as user_email
        FROM loans l
        JOIN users u ON l.user_id = u.id
        ORDER BY l.id DESC
    ''').fetchall()
    return jsonify({'success': True, 'loans': [dict(row) for row in loans]})

@staff_bp.route('/liquidity-fund', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_get_liquidity_fund():
    db = get_db()
    fund = db.execute('SELECT balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
    balance = float(fund['balance']) if fund else 1000000.00
    active_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "approved"').fetchone()[0]
    paid_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "closed"').fetchone()[0]
    return jsonify({'success': True, 'fund_balance': balance, 'active_count': active_count, 'paid_count': paid_count})

@staff_bp.route('/service-applications', methods=['GET'])
@role_required(['staff', 'admin'])
def get_service_applications():
    db = get_db()
    apps = db.execute('''
        SELECT sa.*, u.name as user_name, u.email as user_email, a.account_number
        FROM service_applications sa JOIN users u ON sa.user_id = u.id LEFT JOIN accounts a ON sa.account_id = a.id ORDER BY sa.applied_at DESC
    ''').fetchall()
    return jsonify({'success': True, 'applications': [dict(row) for row in apps]})

@staff_bp.route('/service-applications/<int:app_id>', methods=['PUT'])
@role_required(['staff', 'admin'])
def update_service_application(app_id):
    data = request.json
    action, reason = data.get('action'), data.get('reason', '').strip()
    db = get_db()
    try:
        app_data = db.execute('SELECT sa.*, u.id as user_id, u.name as user_name FROM service_applications sa JOIN users u ON sa.user_id = u.id WHERE sa.id = ?', (app_id,)).fetchone()
        if not app_data: return jsonify({'error': 'Not found'}), 404
        status = 'approved' if action == 'approve' else 'rejected'
        db.execute('UPDATE service_applications SET status = ?, processed_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ?', (status, reason if status == 'rejected' else None, app_id))

        if status == 'approved':
            if app_data['service_type'] == 'Loan':
                # Handle Loan Disbursement
                loan = db.execute('SELECT * FROM loans WHERE user_id = ? AND loan_amount = ? AND status = "pending" AND target_account_id = ? ORDER BY application_date DESC LIMIT 1',
                                 (app_data['user_id'], app_data['amount'], app_data['account_id'])).fetchone()
                if loan:
                    target_acc = db.execute('SELECT * FROM accounts WHERE id = ?', (app_data['account_id'],)).fetchone()
                    if target_acc:
                        new_balance = target_acc['balance'] + app_data['amount']
                        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, target_acc['id']))
                        
                        db.execute('UPDATE loans SET status = "approved", approved_date = CURRENT_TIMESTAMP, disbursement_date = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?',
                                  (session.get('staff_id'), loan['id']))
                        
                        ref = f"LDIS{secrets.token_hex(4).upper()}"
                        db.execute('''
                            INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status, balance_after)
                            VALUES (?, 'credit', ?, ?, ?, 'Loan Disburse', 'completed', ?)
                        ''', (target_acc['id'], app_data['amount'], f"Loan Disbursement: {app_data['product_name']} (#{loan['id']})", ref, new_balance))
                        
                        # Deduct from Liquidity Fund
                        db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (app_data['amount'],))
            
            elif app_data['service_type'] == 'Investment':
                if 'Gold Loan' in app_data['product_name']:
                    # Handle Gold Loan Disbursement
                    target_acc = db.execute('SELECT * FROM accounts WHERE id = ?', (app_data['account_id'],)).fetchone()
                    if target_acc:
                        new_balance = target_acc['balance'] + app_data['amount']
                        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, target_acc['id']))
                        
                        ref = f"GLDIS{secrets.token_hex(4).upper()}"
                        db.execute('''
                            INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status, balance_after)
                            VALUES (?, 'credit', ?, ?, ?, 'Gold Loan Disburse', 'completed', ?)
                        ''', (target_acc['id'], app_data['amount'], f"Gold Loan Disbursement: {app_data['product_name']}", ref, new_balance))
                        
                        # Deduct from Liquidity Fund
                        db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (app_data['amount'],))
                
                # so approval doesn't need to move money unless specific logic is added later.
                pass

            elif app_data['service_type'] == 'Card':
                # Handle Card Issuance
                card_req = db.execute('SELECT * FROM card_requests WHERE user_id = ? AND account_id = ? AND status = "pending" ORDER BY request_date DESC LIMIT 1',
                                    (app_data['user_id'], app_data['account_id'])).fetchone()
                if card_req:
                    # Generate Card Details
                    c_num = f"4{''.join([str(random.randint(0, 9)) for _ in range(15)])}" # Mock Visa
                    cvv = str(random.randint(100, 999))
                    expiry = (datetime.now() + timedelta(days=365*5)).strftime("%Y-%m-%d") # 5 years
                    
                    # Insert into cards table
                    db.execute('''
                        INSERT INTO cards (user_id, account_id, card_number, card_type, card_holder_name, expiry_date, cvv, credit_limit, available_credit, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "active")
                    ''', (app_data['user_id'], app_data['account_id'], c_num, card_req['card_type'], app_data['user_name'], expiry, cvv, card_req['requested_credit_limit'], card_req['requested_credit_limit']))
                    
                    # Update card_requests
                    db.execute('UPDATE card_requests SET status = "approved", processed_date = CURRENT_TIMESTAMP, processed_by = ? WHERE id = ?', 
                              (session.get('staff_id'), card_req['id']))
                    
                    logger.info(f"Card Issued: card={c_num[-4:]} for user={app_data['user_id']}")

        elif status == 'rejected':
            if app_data['service_type'] == 'Card':
                db.execute('UPDATE card_requests SET status = "rejected", processed_date = CURRENT_TIMESTAMP, processed_by = ?, staff_notes = ? WHERE user_id = ? AND account_id = ? AND status = "pending"',
                          (session.get('staff_id'), reason, app_data['user_id'], app_data['account_id']))

        msg_title = f"{app_data['service_type']} Application - {status.capitalize()}"
        msg_body = f"Your application for {app_data['product_name']} (Ref: #{app_id}) has been {status}."
        if status == 'rejected' and reason:
            # For investments, if rejected, refund the amount
            if app_data['service_type'] == 'Investment' and app_data['amount'] > 0:
                target_acc = db.execute('SELECT * FROM accounts WHERE id = ?', (app_data['account_id'],)).fetchone()
                if target_acc:
                    refund_balance = target_acc['balance'] + app_data['amount']
                    db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (refund_balance, target_acc['id']))
                    ref = f"RFND{secrets.token_hex(4).upper()}"
                    db.execute('''
                        INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status, balance_after)
                        VALUES (?, 'credit', ?, ?, ?, 'Refund', 'completed', ?)
                    ''', (target_acc['id'], app_data['amount'], f"Refund: Rejected {app_data['product_name']}", ref, refund_balance))
            
            msg_body += f"\nReason: {reason}"
        
        notify_user(db, app_data['user_id'], msg_title, msg_body, 'success' if status == 'approved' else 'error')
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating service application: {e}")
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/account_requests', methods=['GET'])
@role_required(['staff', 'admin'])
def get_account_requests():
    db = get_db()
    requests = db.execute('SELECT ar.*, u.name as user_name, u.email as user_email FROM account_requests ar JOIN users u ON ar.user_id = u.id ORDER BY ar.request_date DESC').fetchall()
    return jsonify({'requests': [dict(r) for r in requests]})

@staff_bp.route('/account_requests/<int:req_id>', methods=['PUT'])
@role_required(['staff', 'admin'])
def approve_account_request(req_id):
    data = request.json
    action, staff_id = data.get('action'), session.get('staff_id')
    reason = data.get('reason', '').strip()
    db = get_db()
    req = db.execute('SELECT * FROM account_requests WHERE id = ?', (req_id,)).fetchone()
    if not req or req['status'] != 'pending': return jsonify({'error': 'Invalid request'}), 400
    req = dict(req)
    try:
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (req['user_id'],)).fetchone()
        if action == 'approve':
            acc_num = f"SB{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
            if req.get('original_account_id'):
                # SECURITY FIX: Ensure the original_account_id belongs to the same user
                orig_acc = db.execute('SELECT user_id FROM accounts WHERE id = ?', (req['original_account_id'],)).fetchone()
                if not orig_acc or orig_acc['user_id'] != req['user_id']:
                    return jsonify({'error': 'Unauthorized account link attempt'}), 403
                db.execute('UPDATE accounts SET account_type = ?, tax_id = ? WHERE id = ?', (req['account_type'], req['tax_id'], req['original_account_id']))
            else:
                db.execute('INSERT INTO accounts (user_id, account_number, account_type, tax_id, balance, status) VALUES (?, ?, ?, ?, 0.00, "active")', (req['user_id'], acc_num, req['account_type'], req['tax_id']))
            db.execute('UPDATE account_requests SET status = "approved", processed_date = CURRENT_TIMESTAMP, processed_by = ? WHERE id = ?', (staff_id, req_id))
            
            msg_title = "Account Request Approved"
            msg_body = f"Your request for a {req['account_type']} account has been approved and account has been created."
            notify_user(db, req['user_id'], msg_title, msg_body, 'success')
        else:
            db.execute('UPDATE account_requests SET status = "rejected", processed_date = CURRENT_TIMESTAMP, processed_by = ?, rejection_reason = ? WHERE id = ?', (staff_id, reason, req_id))
            
            msg_title = "Account Request Rejected"
            msg_body = f"Your request for a {req['account_type']} account has been rejected."
            if reason:
                msg_body += f"\nReason: {reason}"
            notify_user(db, req['user_id'], msg_title, msg_body, 'error')
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/transaction/add', methods=['POST'])
@role_required(['staff', 'admin'])
def add_transaction():
    data = request.json
    acc_id, amount = data.get('account_id'), float(data.get('amount', 0))
    if amount <= 0: return jsonify({'error': 'Invalid amount'}), 400
    db = get_db()
    try:
        account = db.execute('SELECT * FROM accounts WHERE id = ? OR account_number = ?', (acc_id, acc_id)).fetchone()
        if not account: return jsonify({'error': 'Account not found'}), 404
        new_bal = account['balance'] + amount
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_bal, account['id']))
        db.execute('INSERT INTO transactions (account_id, type, amount, balance_after, status, description, mode) VALUES (?, "credit", ?, ?, "completed", "Staff Deposit", "CASH")', (account['id'], amount, new_bal))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/transaction/withdraw', methods=['POST'])
@role_required(['staff', 'admin'])
def withdraw_transaction():
    data = request.json
    acc_id, amount = data.get('account_id'), float(data.get('amount', 0))
    if amount <= 0: return jsonify({'error': 'Invalid amount'}), 400
    db = get_db()
    try:
        account = db.execute('SELECT * FROM accounts WHERE id = ? OR account_number = ?', (acc_id, acc_id)).fetchone()
        if not account: return jsonify({'error': 'Account not found'}), 404
        if account['balance'] < amount: return jsonify({'error': 'Insufficient balance'}), 400
        new_bal = account['balance'] - amount
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_bal, account['id']))
        db.execute('INSERT INTO transactions (account_id, type, amount, balance_after, status, description, mode) VALUES (?, "debit", ?, ?, "completed", "Staff Withdrawal", "CASH")', (account['id'], amount, new_bal))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/transaction/transfer', methods=['POST'])
@role_required(['staff', 'admin'])
def transfer_transaction():
    data = request.json
    sender_id = data.get('sender_id')
    receiver_acc = data.get('receiver_account')
    amount = float(data.get('amount', 0))
    if amount <= 0: return jsonify({'error': 'Invalid amount'}), 400
    db = get_db()
    try:
        sender = db.execute('SELECT * FROM accounts WHERE id = ? OR account_number = ?', (sender_id, sender_id)).fetchone()
        if not sender: return jsonify({'error': 'Sender account not found'}), 404
        receiver = db.execute('SELECT * FROM accounts WHERE id = ? OR account_number = ?', (receiver_acc, receiver_acc)).fetchone()
        if not receiver: return jsonify({'error': 'Receiver account not found'}), 404
        if sender['id'] == receiver['id']: return jsonify({'error': 'Cannot transfer to same account'}), 400
        if sender['balance'] < amount: return jsonify({'error': 'Insufficient balance'}), 400
        sender_bal = sender['balance'] - amount
        receiver_bal = receiver['balance'] + amount
        ref = f"TRF{secrets.token_hex(4).upper()}"
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (sender_bal, sender['id']))
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (receiver_bal, receiver['id']))
        db.execute('INSERT INTO transactions (account_id, type, amount, balance_after, status, description, reference_number, mode) VALUES (?, "debit", ?, ?, "completed", ?, ?, "Transfer")', (sender['id'], amount, sender_bal, f"Transfer to {receiver['account_number']}", ref))
        db.execute('INSERT INTO transactions (account_id, type, amount, balance_after, status, description, reference_number, mode) VALUES (?, "credit", ?, ?, "completed", ?, ?, "Transfer")', (receiver['id'], amount, receiver_bal, f"Transfer from {sender['account_number']}", ref))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/user/<int:user_id>/activity', methods=['GET'])
@role_required(['admin', 'staff'])
def get_user_activity(user_id):
    db = get_db()
    # Explicitly check for signup_lat/lng if SELECT * misses them or they are named differently
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user: return jsonify({'error': 'User not found'}), 404
    accounts = db.execute('SELECT * FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
    transactions = db.execute('SELECT t.*, a.account_number FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE a.user_id = ? ORDER BY t.transaction_date DESC LIMIT 50', (user_id,)).fetchall()
    activity = db.execute('SELECT * FROM user_activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', (user_id,)).fetchall()
    cards = db.execute('SELECT * FROM cards WHERE user_id = ?', (user_id,)).fetchall()
    loans = db.execute('SELECT * FROM loans WHERE user_id = ?', (user_id,)).fetchall()
    
    # NEW: Fetch Agriculture specific data & KYC requests
    agri_loans = db.execute('SELECT * FROM agriculture_loans WHERE user_id = ?', (user_id,)).fetchall()
    kyc_request = db.execute('SELECT * FROM account_requests WHERE user_id = ? ORDER BY request_date DESC LIMIT 1', (user_id,)).fetchone()
    
    return jsonify({
        'user': dict(user), 
        'kyc_request': dict(kyc_request) if kyc_request else None,
        'accounts': [dict(a) for a in accounts], 
        'transactions': [dict(t) for t in transactions], 
        'activity_logs': [dict(act) for act in activity],
        'cards': [dict(c) for c in cards],
        'loans': [dict(l) for l in loans],
        'agriculture_loans': [dict(al) for al in agri_loans]
    })

@staff_bp.route('/notifications/send', methods=['POST'])
@role_required(['admin', 'staff'])
def send_staff_notification():
    data = request.json
    user_id = data.get('user_id')
    title = data.get('title')
    message = data.get('message')
    n_type = data.get('type', 'info')
    
    if not all([user_id, title, message]):
        return jsonify({'error': 'Missing fields'}), 400
    
    db = get_db()
        
    if user_id == 'ALL':
        try:
            users = db.execute('SELECT id FROM users').fetchall()
            for u in users:
                notify_user(db, u['id'], title, message, n_type)
            db.commit()
            return jsonify({'success': True, 'message': f'Notification sent to all {len(users)} users'})
        except Exception as e:
            db.rollback(); return jsonify({'error': str(e)}), 500
    
    try:
        notify_user(db, user_id, title, message, n_type)
        db.commit()
        return jsonify({'success': True, 'message': 'Notification sent successfully'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/attendance/status', methods=['GET'])
@role_required('staff')
def get_attendance_status():
    staff_id, today = session.get('staff_id'), datetime.now().date().isoformat()
    db = get_db()
    att = db.execute('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', (staff_id, today)).fetchone()
    staff = db.execute('SELECT id, face_descriptor FROM staff WHERE id = ?', (staff_id,)).fetchone()
    
    status_data = {
        'clocked_in': bool(att and att['clock_in']),
        'clocked_out': bool(att and att['clock_out']),
        'clock_in_time': att['clock_in'] if att else None,
        'clock_out_time': att['clock_out'] if att else None,
        'total_hours': float(att['total_hours'] or 0) if att else 0,
        'status': att['status'] if att else 'present',
        'face_registered': bool(staff and staff['face_descriptor'])
    }
    
    return jsonify({'success': True, 'status': status_data})

@staff_bp.route('/attendance/history', methods=['GET'])
@role_required('staff')
def get_attendance_history():
    staff_id = session.get('staff_id')
    db = get_db()
    history = db.execute('SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 30', (staff_id,)).fetchall()
    return jsonify({'success': True, 'history': [dict(h) for h in history]})

@staff_bp.route('/attendance/clock-in', methods=['POST'])
@role_required('staff')
def clock_in():
    staff_id = session.get('staff_id')
    face_descriptor = request.json.get('face_descriptor')
    now = datetime.now()
    today = now.date().isoformat()
    
    db = get_db()
    staff = db.execute('SELECT * FROM staff WHERE id = ?', (staff_id,)).fetchone()
    if not staff: return jsonify({'error': 'Staff not found'}), 404
    
    # Strict face verify for attendance (0.4 threshold)
    if not staff['face_descriptor']:
        return jsonify({'error': 'Face not registered. Please register your face in settings first.'}), 400
        
    if not face_descriptor or not compare_face_descriptors(face_descriptor, staff['face_descriptor'], threshold=0.4):
        return jsonify({'error': 'Face not recognized'}), 401
    
    # Check if already clocked in today
    existing = db.execute('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', (staff_id, today)).fetchone()
    if existing: return jsonify({'error': 'Already clocked in today'}), 400
    
    try:
        db.execute('INSERT INTO attendance (staff_id, date, clock_in, status) VALUES (?, ?, ?, "present")',
                  (staff_id, today, now.isoformat()))
        db.commit()
        return jsonify({'success': True, 'message': 'Clocked in successfully'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/attendance/clock-out', methods=['POST'])
@role_required('staff')
def clock_out():
    staff_id = session.get('staff_id')
    face_descriptor = request.json.get('face_descriptor')
    now = datetime.now()
    today = now.date().isoformat()
    
    db = get_db()
    staff = db.execute('SELECT * FROM staff WHERE id = ?', (staff_id,)).fetchone()
    if not staff: return jsonify({'error': 'Staff not found'}), 404
    
    # Strict face verify for attendance (0.4 threshold)
    if not staff['face_descriptor']:
        return jsonify({'error': 'Face not registered. Please register your face in settings first.'}), 400
        
    if not face_descriptor or not compare_face_descriptors(face_descriptor, staff['face_descriptor'], threshold=0.4):
        return jsonify({'error': 'Face not recognized'}), 401
    
    att = db.execute('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', (staff_id, today)).fetchone()
    if not att: return jsonify({'error': 'No clock-in record found for today'}), 400
    if att['clock_out']: return jsonify({'error': 'Already clocked out today'}), 400
    
    try:
        clock_in_time = datetime.fromisoformat(att['clock_in'])
        total_hours = (now - clock_in_time).total_seconds() / 3600
        db.execute('UPDATE attendance SET clock_out = ?, total_hours = ? WHERE id = ?',
                  (now.isoformat(), total_hours, att['id']))
        db.commit()
        return jsonify({'success': True, 'message': f'Clocked out successfully. Total hours: {total_hours:.2f}'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/face-login', methods=['POST'])
def face_login():
    data = request.json
    face_descriptor = data.get('face_descriptor')
    
    if not face_descriptor:
        return jsonify({'error': 'Face descriptor required'}), 400
    
    db = get_db()
    # Find all staff with face auth enabled
    staff_list = db.execute('SELECT * FROM staff WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    
    for s in staff_list:
        stored_descriptor = s['face_descriptor']
        if stored_descriptor and compare_face_descriptors(face_descriptor, stored_descriptor):
            # Login success
            session.clear()
            session.permanent = True
            session['user_id'] = s['id']
            session['staff_id'] = s['id']
            session['username'] = s['staff_id']
            session['role'] = 'staff'
            session['name'] = s['name']
            
            logger.info(f"Face Login Success: staff={s['staff_id']}")
            return jsonify({
                'success': True,
                'role': 'staff',
                'name': s['name'],
                'staff': {
                    'id': s['id'],
                    'staff_id': s['staff_id'],
                    'name': s['name'],
                    'email': s['email'],
                    'department': s['department'],
                    'position': s['position'],
                    'profile_image': s['profile_image']
                }
            })
            
    return jsonify({'error': 'Face not recognized'}), 401

@staff_bp.route('/geo-map', methods=['GET'])
@role_required(['staff', 'admin'])
def get_staff_geo_map_data():
    """Return user geolocation data for the staff live map."""
    db = get_db()
    # 1. Standard Users
    users_rows = db.execute('''
        SELECT u.id, u.name, u.username, u.status, u.created_at,
               u.signup_ip, u.signup_lat, u.signup_lng, u.signup_city, u.signup_country,
               COUNT(a.id) as account_count
        FROM users u
        LEFT JOIN accounts a ON a.user_id = u.id
        GROUP BY u.id
    ''').fetchall()
    markers = []
    for r in users_rows:
        d = dict(r)
        if d.get('signup_lat') and d.get('signup_lng'):
            markers.append({
                'id': f"u_{d['id']}", 'name': d['name'], 'username': d['username'], 'type': 'User', 'status': d['status'],
                'city': d.get('signup_city') or 'Unknown', 'country': d.get('signup_country') or '',
                'ip': d.get('signup_ip') or '', 'lat': float(d['signup_lat']), 'lng': float(d['signup_lng']),
                'account_count': d['account_count'], 'created_at': d['created_at']
            })
            
    # 2. Agri Buyers (Visible to Staff)
    buyers_rows = db.execute('''
        SELECT id, name, buyer_id as username, status, created_at,
               signup_ip, signup_lat, signup_lng, signup_city, signup_country
        FROM agri_buyers
        WHERE signup_lat IS NOT NULL AND signup_lng IS NOT NULL
    ''').fetchall()
    for r in buyers_rows:
        d = dict(r)
        markers.append({
            'id': f"b_{d['id']}", 'name': d['name'], 'username': d['username'], 'type': 'Buyer', 'status': d['status'],
            'city': d.get('signup_city') or 'Unknown', 'country': d.get('signup_country') or '',
            'ip': d.get('signup_ip') or '', 'lat': float(d['signup_lat']), 'lng': float(d['signup_lng']),
            'account_count': 1, 'created_at': d['created_at']
        })
        
    return jsonify({'success': True, 'markers': markers, 'total_users': len(users_rows), 'mapped_markers': len(markers)})
@staff_bp.route('/customers/<int:user_id>/toggle-transact-restriction', methods=['POST'])
@role_required(['admin', 'staff'])
def toggle_user_transact_restriction(user_id):
    db = get_db()
    staff_id = session.get('staff_id') or session.get('admin_id')
    try:
        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        new_status = 1 if not user['transact_restricted'] else 0
        db.execute('UPDATE users SET transact_restricted = ? WHERE id = ?', (new_status, user_id))
        
        # Log action
        action_text = "Restricted transactions" if new_status else "Unrestricted transactions"
        db.execute('INSERT INTO staff_activity_logs (staff_id, action, details) VALUES (?, ?, ?)',
                  (staff_id, 'Toggle Transaction Restriction', f'{action_text} for user {user["username"]} (ID: {user_id})'))
        
        db.commit()
        return jsonify({
            'success': True, 
            'message': f'User transactions successfully {"restricted" if new_status else "unrestricted"}',
            'transact_restricted': new_status
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/customers/<int:user_id>', methods=['PUT'])
@role_required(['admin', 'staff'])
def update_customer(user_id):
    """Update customer details (name, email, phone, address, date_of_birth, status)."""
    data = request.json
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'error': 'Customer not found'}), 404
    try:
        fields = []
        values = []
        allowed = ['name', 'email', 'phone', 'address', 'date_of_birth', 'status', 'aadhaar_number', 'pan_number']
        for key in allowed:
            if key in data:
                fields.append(f'{key} = ?')
                values.append(data[key])
        if not fields:
            return jsonify({'error': 'No fields to update'}), 400
        fields.append('updated_at = CURRENT_TIMESTAMP')
        values.append(user_id)
        db.execute(f'UPDATE users SET {", ".join(fields)} WHERE id = ?', values)
        # Log the action
        staff_id = session.get('staff_id') or session.get('admin_id')
        db.execute('INSERT INTO staff_activity_logs (staff_id, action, details) VALUES (?, ?, ?)',
                  (staff_id, 'Update Customer', f'Updated customer ID {user_id}: {", ".join(data.keys())}'))
        db.commit()
        return jsonify({'success': True, 'message': 'Customer updated successfully'})
    except Exception as e:
        db.rollback()
        logger.error(f'Error updating customer {user_id}: {e}')
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/accounts/<int:account_id>', methods=['PUT'])
@role_required(['admin', 'staff'])
def update_account(account_id):
    """Update account details (branch, ifsc, status, account_type, daily_limit)."""
    data = request.json
    db = get_db()
    account = db.execute('SELECT * FROM accounts WHERE id = ?', (account_id,)).fetchone()
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    try:
        fields = []
        values = []
        allowed = ['branch', 'ifsc', 'status', 'account_type', 'daily_limit']
        for key in allowed:
            if key in data:
                fields.append(f'{key} = ?')
                values.append(data[key])
        if not fields:
            return jsonify({'error': 'No fields to update'}), 400
        fields.append('updated_at = CURRENT_TIMESTAMP')
        values.append(account_id)
        db.execute(f'UPDATE accounts SET {", ".join(fields)} WHERE id = ?', values)
        # Log the action
        staff_id = session.get('staff_id') or session.get('admin_id')
        db.execute('INSERT INTO staff_activity_logs (staff_id, action, details) VALUES (?, ?, ?)',
                  (staff_id, 'Update Account', f'Updated account ID {account_id}: {", ".join(data.keys())}'))
        db.commit()
        return jsonify({'success': True, 'message': 'Account updated successfully'})
    except Exception as e:
        db.rollback()
        logger.error(f'Error updating account {account_id}: {e}')
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/add_account', methods=['POST'])
@role_required(['staff', 'admin'])
def staff_add_account():
    data = request.json
    user_id = data.get('user_id')
    account_type = data.get('account_type', 'Savings')
    
    try:
        initial_balance = float(data.get('balance', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid balance amount'}), 400
        
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
        
    db = get_db()
    try:
        # User ID bisa berupa ID numeric atau username string
        user = db.execute('SELECT * FROM users WHERE id = ? OR username = ?', (user_id, user_id)).fetchone()
        if not user:
            return jsonify({'error': 'Customer not found'}), 404
            
        acc_num = f"SB{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
        
        db.execute('''
            INSERT INTO accounts (user_id, account_number, account_type, balance, status) 
            VALUES (?, ?, ?, ?, 'active')
        ''', (user['id'], acc_num, account_type, initial_balance))
        
        account_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        if initial_balance > 0:
            ref = f"DEP{secrets.token_hex(4).upper()}"
            db.execute('''
                INSERT INTO transactions (account_id, type, amount, balance_after, status, description, reference_number, mode) 
                VALUES (?, 'credit', ?, ?, 'completed', ?, ?, 'Cash')
            ''', (account_id, initial_balance, initial_balance, 'Initial Deposit', ref))
            
        staff_id = session.get('staff_id') or session.get('admin_id')
        db.execute('INSERT INTO staff_activity_logs (staff_id, action, details) VALUES (?, ?, ?)',
                  (staff_id, 'Create Account', f'Created {account_type} account for user {user["username"]} with balance Rs. {initial_balance}'))
                  
        db.commit()
        return jsonify({'success': True, 'message': 'Account created successfully'})
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating account: {e}")
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/support', methods=['GET'])
@role_required(['staff', 'admin'])
def get_support_tickets():
    db = get_db()
    tickets = db.execute('''
        SELECT t.*, u.name as user_name, u.email as user_email
        FROM support_tickets t
        JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC
    ''').fetchall()
    return jsonify({'tickets': [dict(t) for t in tickets]})

@staff_bp.route('/support/tickets/<int:ticket_id>/messages', methods=['POST'])
@role_required(['staff', 'admin'])
def staff_ticket_reply(ticket_id):
    data = request.json
    db = get_db()
    staff_id = session.get('staff_id') or session.get('user_id') # Fallback for dual roles
    message = data.get('message')
    
    if not message:
        return jsonify({'error': 'Message cannot be empty'}), 400
        
    try:
        # Verify ticket exists
        ticket = db.execute('SELECT id, user_id FROM support_tickets WHERE id = ?', (ticket_id,)).fetchone()
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
            
        db.execute('''
            INSERT INTO support_messages (ticket_id, sender_id, sender_type, message)
            VALUES (?, ?, ?, ?)
        ''', (ticket_id, staff_id, session.get('role', 'staff'), message))
        
        # Update ticket status to 'replied' or similar
        db.execute('UPDATE support_tickets SET status = "replied", resolved_by = ? WHERE id = ?', (staff_id, ticket_id))
        
        # Notify the user
        notify_user(db, ticket['user_id'], "New Support Reply", f"You have a new message regarding ticket #{ticket_id}.", 'info')
        
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/profile', methods=['GET'])
@role_required('staff')
def get_staff_profile():
    db = get_db()
    staff_id = session.get('staff_id')
    staff = db.execute('SELECT id, staff_id, name, email, phone, department, position, status, profile_image, aadhaar_number, pan_number, "staff" as role FROM staff WHERE id = ?', (staff_id,)).fetchone()
    if not staff: return jsonify({'error': 'Staff not found'}), 404
    
    staff_dict = dict(staff)
    img = staff_dict.get('profile_image')
    staff_dict['profile_image_url'] = f"/api/staff/profile-image/{img}" if img else None
    
    return jsonify({
        'success': True, 
        'staff': staff_dict,
        'profile': staff_dict
    })

@staff_bp.route('/profile-image', methods=['POST'])
@role_required('staff')
def upload_staff_profile_image():
    if 'image' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['image']
    if file.filename == '': return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        staff_id = session.get('staff_id')
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"staff_{staff_id}_{int(datetime.now().timestamp())}.{ext}"
        filepath = os.path.join(PROFILE_PICS_FOLDER, filename)
        
        if not os.path.exists(PROFILE_PICS_FOLDER):
            os.makedirs(PROFILE_PICS_FOLDER, exist_ok=True)
            
        file.save(filepath)
        db = get_db()
        try:
            old_staff = db.execute('SELECT profile_image FROM staff WHERE id = ?', (staff_id,)).fetchone()
            if old_staff and old_staff['profile_image']:
                old_path = os.path.join(PROFILE_PICS_FOLDER, old_staff['profile_image'])
                if os.path.exists(old_path):
                    try: os.remove(old_path)
                    except: pass
            
            db.execute('UPDATE staff SET profile_image = ? WHERE id = ?', (filename, staff_id))
            db.commit()
            return jsonify({
                'success': True, 
                'message': 'Profile image uploaded successfully', 
                'profile_image': filename,
                'profile_image_url': f"/api/staff/profile-image/{filename}"
            })
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type'}), 400

@staff_bp.route('/profile-image/<filename>')
def serve_staff_profile_image(filename):
    from werkzeug.utils import secure_filename
    safe_name = secure_filename(filename)
    return send_from_directory(PROFILE_PICS_FOLDER, safe_name)

# =============================================
# PREMIUM PDF REPORT EXPORT (Staff / Admin)
# =============================================
import io
from flask import send_file
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

_MAROON = colors.HexColor('#800000')
_LIGHT_BG = colors.HexColor('#fef7f7')
_ROW_ALT = colors.HexColor('#fafafa')
_BORDER = colors.HexColor('#e5e7eb')
_GREEN = colors.HexColor('#059669')
_RED = colors.HexColor('#dc2626')
_GREY = colors.HexColor('#6b7280')

@staff_bp.route('/reports/download/<report_type>', methods=['GET'])
@role_required(['staff', 'admin'])
def download_report_pdf(report_type):
    db = get_db()
    staff_name = session.get('staff_name') or session.get('admin_name') or 'Staff'
    now = datetime.now()
    
    buffer = io.BytesIO()
    page_size = landscape(A4) if report_type in ['transactions', 'all'] else A4
    doc = SimpleDocTemplate(buffer, pagesize=page_size, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=40)
    elements = []
    styles = getSampleStyleSheet()
    
    bank_title = ParagraphStyle('BT', parent=styles['Title'], fontSize=26, textColor=_MAROON, fontName='Helvetica-Bold', spaceAfter=2, alignment=TA_LEFT)
    sub = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=_GREY, spaceAfter=4)
    sec = ParagraphStyle('Sec', parent=styles['Normal'], fontSize=13, textColor=_MAROON, fontName='Helvetica-Bold', spaceBefore=16, spaceAfter=8)
    footer_s = ParagraphStyle('Ft', parent=styles['Normal'], fontSize=8, textColor=_GREY, alignment=TA_CENTER, spaceBefore=16)
    
    # === HEADER ===
    report_titles = {
        'all': 'Complete System Report',
        'loans': 'Loan Portfolio Report',
        'transactions': 'Transaction Ledger Report',
        'users': 'Customer Registry Report',
        'saving_acc': 'Savings Account Report',
        'current_acc': 'Current Account Report',
        'salary_acc': 'Salary Account Report',
    }
    
    elements.append(Paragraph("SmartBank", bank_title))
    elements.append(Paragraph(report_titles.get(report_type, 'System Report'), sub))
    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=2, color=_MAROON, spaceAfter=12))
    
    # Meta info
    meta = [
        ['Generated By', staff_name, 'Date', now.strftime('%d %B %Y, %I:%M %p')],
        ['Report Type', report_titles.get(report_type, report_type).upper(), 'Format', 'Premium PDF'],
    ]
    meta_t = Table(meta, colWidths=[90, 180, 70, 180])
    meta_t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TEXTCOLOR', (0,0), (0,-1), _GREY),
        ('TEXTCOLOR', (2,0), (2,-1), _GREY),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(meta_t)
    elements.append(Spacer(1, 10))
    
    def build_table(headers, rows, col_widths=None):
        data = [headers] + rows
        if not col_widths:
            page_w = page_size[0] - 60
            col_widths = [page_w / len(headers)] * len(headers)
        t = Table(data, colWidths=col_widths)
        style = [
            ('BACKGROUND', (0,0), (-1,0), _MAROON),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 9),
            ('FONTSIZE', (0,1), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,0), 9),
            ('TOPPADDING', (0,0), (-1,0), 9),
            ('BOTTOMPADDING', (0,1), (-1,-1), 5),
            ('TOPPADDING', (0,1), (-1,-1), 5),
            ('GRID', (0,0), (-1,-1), 0.4, _BORDER),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.append(('BACKGROUND', (0,i), (-1,i), _ROW_ALT))
        t.setStyle(TableStyle(style))
        return t
    
    # === REPORT CONTENT ===
    if report_type in ['users', 'all']:
        users = db.execute('SELECT id, name, email, phone, status, created_at FROM users ORDER BY id DESC').fetchall()
        elements.append(Paragraph(f"Registered Customers ({len(users)})", sec))
        rows = [[u['id'], u['name'] or '—', u['email'] or '—', u['phone'] or '—', (u['status'] or 'active').upper(), (u['created_at'] or '—')[:10]] for u in users]
        elements.append(build_table(['ID', 'Name', 'Email', 'Phone', 'Status', 'Joined'], rows))
        elements.append(Spacer(1, 14))
    
    if report_type in ['loans', 'all']:
        loans = db.execute('SELECT l.*, u.name FROM loans l JOIN users u ON l.user_id = u.id ORDER BY l.id DESC').fetchall()
        elements.append(Paragraph(f"Loan Applications ({len(loans)})", sec))
        rows = []
        for l in loans:
            amt = float(l['loan_amount'] or 0)
            rows.append([l['id'], l['name'] or '—', l['loan_type'] or '—', f"₹{amt:,.0f}", f"{l['tenure_months']}M", f"{l['interest_rate']}%", (l['status'] or '—').upper()])
        elements.append(build_table(['ID', 'Customer', 'Type', 'Amount', 'Tenure', 'Rate', 'Status'], rows))
        elements.append(Spacer(1, 14))
    
    if report_type in ['transactions', 'all']:
        txns = db.execute('''
            SELECT t.*, u.name, a.account_number FROM transactions t 
            JOIN accounts a ON t.account_id = a.id 
            JOIN users u ON a.user_id = u.id 
            ORDER BY t.transaction_date DESC LIMIT 200
        ''').fetchall()
        elements.append(Paragraph(f"Recent Transactions ({len(txns)})", sec))
        rows = []
        for t in txns:
            amt = float(t['amount'])
            prefix = '+' if t['type'] == 'credit' else '-'
            desc = (t['description'] or '—')[:30]
            rows.append([(t['transaction_date'] or '—')[:10], t['name'] or '—', '••' + t['account_number'][-4:], desc, t['type'].upper(), f"{prefix}₹{amt:,.2f}"])
        elements.append(build_table(['Date', 'Customer', 'Account', 'Description', 'Type', 'Amount'], rows))
        elements.append(Spacer(1, 14))
    
    if report_type in ['saving_acc', 'current_acc', 'salary_acc', 'all']:
        type_map = {'saving_acc': 'Savings', 'current_acc': 'Current', 'salary_acc': 'Salary'}
        acc_type = type_map.get(report_type)
        if acc_type:
            accs = db.execute('SELECT a.*, u.name FROM accounts a JOIN users u ON a.user_id = u.id WHERE LOWER(a.account_type) = LOWER(?) ORDER BY a.id DESC', (acc_type,)).fetchall()
        else:
            accs = db.execute('SELECT a.*, u.name FROM accounts a JOIN users u ON a.user_id = u.id ORDER BY a.id DESC').fetchall()
        label = acc_type or 'All'
        elements.append(Paragraph(f"{label} Accounts ({len(accs)})", sec))
        rows = []
        for a in accs:
            bal = float(a['balance'] or 0)
            rows.append([a['id'], a['name'] or '—', a['account_number'], (a['account_type'] or '—').title(), f"₹{bal:,.2f}", (a.get('status') or 'active').upper()])
        elements.append(build_table(['ID', 'Customer', 'Account No.', 'Type', 'Balance', 'Status'], rows))
        elements.append(Spacer(1, 14))
    
    # === FOOTER ===
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceAfter=8))
    elements.append(Paragraph("Confidential — For Internal Use Only", footer_s))
    elements.append(Paragraph(f"© {now.year} SmartBank. This report was generated by {staff_name} on {now.strftime('%d/%m/%Y')}.", footer_s))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"SmartBank_Premium_Report_{report_titles.get(report_type, 'Report').replace(' ', '_')}_{now.strftime('%d%b%Y')}.pdf"
    return send_file(buffer, as_attachment=True, download_name=filename, mimetype='application/pdf')

@staff_bp.route('/profile/kyc', methods=['POST'])
@role_required('staff')
def update_staff_kyc():
    staff_id = session.get('staff_id')
    data = request.json
    aadhaar = data.get('aadhaar_number')
    pan = data.get('pan_number')
    
    if not aadhaar or not pan:
        return jsonify({'error': 'Aadhaar and PAN are required'}), 400
        
    db = get_db()
    try:
        db.execute('UPDATE staff SET aadhaar_number = ?, pan_number = ? WHERE id = ?', (aadhaar, pan, staff_id))
        db.commit()
        return jsonify({'success': True, 'message': 'KYC documents updated successfully'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@staff_bp.route('/notifications/request-kyc', methods=['POST'])
@role_required(['staff', 'admin'])
def request_user_kyc_update():
    data = request.json
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
        
    db = get_db()
    try:
        # Check if user exists
        user = db.execute('SELECT id, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        title = "Action Required: KYC Update"
        message = f"Hello {user['name']}, our records indicate your KYC documents need to be updated. Please visit the 'Manage KYC' section in your profile to resubmit your Aadhaar/PAN details."
        
        notify_user(db, user_id, title, message, 'warning')
        db.commit()
        return jsonify({'success': True, 'message': f'KYC update request sent to {user["name"]}'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

# =============================================
# LOCATIONS MANAGEMENT
# =============================================
LOCATIONS_PICS_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'locations')

@staff_bp.route('/locations', methods=['POST'])
@login_required
@role_required(['staff', 'admin'])
def add_location():
    # Support both JSON and form data
    if request.is_json:
        data = request.json
    else:
        data = request.form

    name, loc_type = data.get('name'), data.get('type')
    lat, lng = data.get('lat'), data.get('lng')
    address, city = data.get('address'), data.get('city')
    
    if not all([name, loc_type, lat, lng]):
        return jsonify({'error': 'Name, type, lat, and lng are required'}), 400
        
    db = get_db()
    
    # Handle Photo Upload
    photo_url = None
    if 'photo' in request.files:
        file = request.files['photo']
        if file and file.filename != '':
            from werkzeug.utils import secure_filename
            from core.constants import allowed_file
            if allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"loc_{int(datetime.now().timestamp())}_{secure_filename(file.filename)}"
                filepath = os.path.join(LOCATIONS_PICS_FOLDER, filename)
                
                os.makedirs(LOCATIONS_PICS_FOLDER, exist_ok=True)
                file.save(filepath)
                photo_url = filename
            else:
                return jsonify({'error': 'Invalid photo file type'}), 400

    try:
        db.execute('''
            INSERT INTO bank_locations (name, type, lat, lng, address, city, photo_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (name, loc_type, float(lat), float(lng), address, city, photo_url))
        
        # Log audit
        from core.auth import log_audit
        user_id = session.get('staff_id') or session.get('admin_id')
        user_type = 'staff' if 'staff_id' in session else 'admin'
        log_audit(user_id, user_type, 'Add Location', f"Added {loc_type}: {name}")
        
        db.commit()
        return jsonify({'success': True, 'message': 'Location added successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/locations/photo/<filename>')
def serve_location_photo(filename):
    from werkzeug.utils import secure_filename
    return send_from_directory(LOCATIONS_PICS_FOLDER, secure_filename(filename))

@staff_bp.route('/locations/<int:loc_id>', methods=['DELETE'])
@login_required
@role_required(['staff', 'admin'])
def delete_location(loc_id):
    db = get_db()
    try:
        loc = db.execute('SELECT name, type FROM bank_locations WHERE id = ?', (loc_id,)).fetchone()
        if not loc:
            return jsonify({'error': 'Location not found'}), 404
            
        db.execute('DELETE FROM bank_locations WHERE id = ?', (loc_id,))
        
        # Log audit
        from core.auth import log_audit
        user_id = session.get('staff_id') or session.get('admin_id')
        user_type = 'staff' if 'staff_id' in session else 'admin'
        log_audit(user_id, user_type, 'Delete Location', f"Deleted {loc['type']}: {loc['name']}")
        
        db.commit()
        return jsonify({'success': True, 'message': 'Location removed'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
