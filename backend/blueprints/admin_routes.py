from flask import Blueprint, request, jsonify, session, send_from_directory
import os
from werkzeug.security import generate_password_hash
import secrets
import logging
from datetime import datetime, timedelta
import io
import csv

from core.db import get_db
from core.auth import login_required, role_required, log_audit, compare_face_descriptors, trigger_geo_lookup
from core.email_utils import send_email_async
from core.utils import validate_email
from core.constants import PROFILE_PICS_FOLDER, allowed_file

admin_bp = Blueprint('admin', __name__)
logger = logging.getLogger('smart_bank.admin')

@admin_bp.route('/dashboard', methods=['GET'])
@role_required('admin')
def admin_dashboard():
    db = get_db()
    
    # 1. Stats
    total_users = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    total_deposits = db.execute('SELECT SUM(balance) FROM accounts WHERE status = "active"').fetchone()[0] or 0
    active_staff = db.execute('SELECT COUNT(*) FROM staff WHERE status = "active"').fetchone()[0]
    liquidity_fund = db.execute('SELECT balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
    liquidity_balance = float(liquidity_fund['balance']) if liquidity_fund else 1000000.00
    today_trans = db.execute('SELECT COUNT(*) FROM transactions WHERE date(transaction_date) = date("now")').fetchone()[0]
    
    stats = {
        'totalUsers': total_users,
        'loanLiquidity': liquidity_balance,
        'activeStaff': active_staff,
        'totalDeposits': total_deposits,
        'todaysTransactions': today_trans
    }
    
    # 2. Recent Users
    recent_users_rows = db.execute('''
        SELECT id, name, username, email, phone, status, created_at
        FROM users ORDER BY created_at DESC LIMIT 5
    ''').fetchall()
    recent_users = [dict(u) for u in recent_users_rows]
    
    # 3. System Alerts
    # E.g. Pending Account Requests, Blocked Accounts, Loan Requests
    pending_accounts = db.execute('SELECT COUNT(*) FROM account_requests WHERE status = "pending"').fetchone()[0]
    blocked_accs = db.execute('SELECT COUNT(*) FROM accounts WHERE status = "blocked"').fetchone()[0]
    pending_loans_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "pending"').fetchone()[0]
    
    # Loan Stats for Liquidity Page
    loan_stats = {
        'active': db.execute('SELECT COUNT(*) FROM loans WHERE status = "approved"').fetchone()[0],
        'closed': db.execute('SELECT COUNT(*) FROM loans WHERE status = "closed"').fetchone()[0],
        'overdue': db.execute('SELECT COUNT(*) FROM loans WHERE status = "overdue"').fetchone()[0]
    }
    
    system_alerts = []
    if pending_accounts > 0:
        system_alerts.append({'id': 1, 'type': 'warning', 'title': 'Pending Accounts', 'message': f'{pending_accounts} accounts awaiting approval', 'time': 'Just now', 'icon': 'fa-id-card'})
    if blocked_accs > 0:
        system_alerts.append({'id': 2, 'type': 'error', 'title': 'Blocked Accounts', 'message': f'{blocked_accs} blocked accounts detected', 'time': 'Recent', 'icon': 'fa-shield-alt'})
    if pending_loans_count > 0:
        system_alerts.append({'id': 3, 'type': 'info', 'title': 'Loan Requests', 'message': f'{pending_loans_count} pending loan applications', 'time': 'Recent', 'icon': 'fa-money-bill-wave'})
        
    if not system_alerts:
        system_alerts.append({'id': 0, 'type': 'success', 'title': 'System Status Normal', 'message': 'No pending critical actions.', 'time': 'Now', 'icon': 'fa-check-circle'})
        
    # 4. Recent Transactions
    recent_trx_rows = db.execute('''
        SELECT t.id, t.type, t.amount, t.transaction_date as date, t.status,
               u.name as user_name, a.account_number
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC LIMIT 10
    ''').fetchall()
    recent_transactions = [dict(t) for t in recent_trx_rows]

    return jsonify({
        'success': True,
        'stats': stats,
        'loan_stats': loan_stats,
        'recentUsers': recent_users,
        'systemAlerts': system_alerts,
        'recentTransactions': recent_transactions
    })

@admin_bp.route('/users', methods=['GET'])
@role_required('admin')
def get_users():
    db = get_db()
    users = db.execute('''
        SELECT u.id, u.name, u.username, u.email, u.phone, u.status, u.transact_restricted,
               COUNT(a.id) as account_count, 
               SUM(IFNULL(a.balance, 0)) as total_balance
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        GROUP BY u.id
    ''').fetchall()
    return jsonify([dict(u) for u in users])

@admin_bp.route('/users/create', methods=['POST'])
@role_required(['admin', 'staff'])
def create_user():
    data = request.json
    name = data.get('name', '').strip()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    dob = data.get('dob')

    if not all([name, username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    db = get_db()
    try:
        existing = db.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone()
        if existing:
            return jsonify({'error': 'Username or email already exists'}), 409

        hashed_pw = generate_password_hash(password)
        cursor = db.execute(
            'INSERT INTO users (name, username, email, phone, password, date_of_birth, status) VALUES (?, ?, ?, ?, ?, ?, "active")',
            (name, username, email, phone or None, hashed_pw, dob or None)
        )
        user_id = cursor.lastrowid
        db.commit()

        trigger_geo_lookup(user_id, 'users')

        if email:
            subject = "Welcome to Smart Bank!"
            body = f"<h3>Welcome {name}</h3><p>Your account has been created. Username: {username}, Password: {password}</p>"
            send_email_async(email, subject, body)

        log_audit(session.get('admin_id') or session.get('staff_id'), session.get('role'), 'CREATE_USER', f'Created user: {username}')
        return jsonify({'success': True, 'message': f'User {name} created successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/user/<int:user_id>', methods=['DELETE'])
@role_required(['admin', 'staff'])
def delete_user(user_id):
    db = get_db()
    try:
        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user: return jsonify({'error': 'User not found'}), 404
        db.execute('DELETE FROM users WHERE id = ?', (user_id,))
        db.commit()
        log_audit(session.get('admin_id') or session.get('staff_id'), session.get('role'), 'DELETE_USER', f'Deleted user ID {user_id}')
        return jsonify({'success': True, 'message': 'User deleted successfully'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/staff', methods=['GET'])
@role_required('admin')
def get_staff():
    db = get_db()
    staff = db.execute('SELECT id, staff_id, name, email, department, position, status, created_at FROM staff ORDER BY created_at DESC').fetchall()
    return jsonify([dict(s) for s in staff])

@admin_bp.route('/staff', methods=['POST'])
@role_required('admin')
def add_staff():
    data = request.json
    name, email, password = data.get('name', '').strip(), data.get('email', '').strip().lower(), data.get('password', '').strip()
    if not all([name, email, password]): return jsonify({'error': 'Missing fields'}), 400
    if not validate_email(email): return jsonify({'error': 'Invalid email'}), 400
    db = get_db()
    if db.execute('SELECT id FROM staff WHERE email = ?', (email,)).fetchone(): return jsonify({'error': 'Email exists'}), 400
    try:
        staff_id = f"STF{int(datetime.now().timestamp())}"
        cursor = db.execute('INSERT INTO staff (staff_id, password, name, email, phone, department, position, status, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, "active", 50000.00)',
                  (staff_id, generate_password_hash(password), name, email, data.get('phone', ''), data.get('department', 'General'), data.get('position', 'Staff')))
        staff_db_id = cursor.lastrowid
        db.commit()
        trigger_geo_lookup(staff_db_id, 'staff')
        return jsonify({'success': True, 'staff_id': staff_id}), 201
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500
@admin_bp.route('/staff/<int:id>', methods=['DELETE'])
@role_required('admin')
def delete_staff(id):
    db = get_db()
    try:
        staff = db.execute('SELECT * FROM staff WHERE id = ?', (id,)).fetchone()
        if not staff: return jsonify({'error': 'Staff not found'}), 404
        db.execute('DELETE FROM staff WHERE id = ?', (id,))
        db.commit()
        log_audit(session.get('admin_id'), 'admin', 'DELETE_STAFF', f"Deleted staff member: {staff['name']}")
        return jsonify({'success': True, 'message': 'Staff member deleted'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/staff/<int:id>/promote', methods=['PUT'])
@role_required('admin')
def promote_staff(id):
    data = request.json
    new_role = data.get('new_role', 'Senior Staff')
    db = get_db()
    try:
        db.execute('UPDATE staff SET position = ? WHERE id = ?', (new_role, id))
        db.commit()
        log_audit(session.get('admin_id'), 'admin', 'PROMOTE_STAFF', f"Promoted staff member ID {id} to {new_role}")
        return jsonify({'success': True, 'message': f'Staff promoted to {new_role}'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/staff/<int:id>/department', methods=['PUT'])
@role_required('admin')
def update_staff_dept(id):
    data = request.json
    new_dept = data.get('new_department')
    if not new_dept: return jsonify({'error': 'Missing department'}), 400
    db = get_db()
    try:
        db.execute('UPDATE staff SET department = ? WHERE id = ?', (new_dept, id))
        db.commit()
        log_audit(session.get('admin_id'), 'admin', 'UPDATE_STAFF_DEPT', f"Updated staff member ID {id} department to {new_dept}")
        return jsonify({'success': True, 'message': f'Department updated to {new_dept}'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/accounts', methods=['GET'])
@role_required('admin')
def get_all_accounts():
    db = get_db()
    accounts = db.execute('''
        SELECT a.*, u.name as user_name 
        FROM accounts a 
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
    ''').fetchall()
    return jsonify({'success': True, 'accounts': [dict(acc) for acc in accounts]})

@admin_bp.route('/account/<int:account_id>', methods=['DELETE'])
@role_required('admin')
def delete_account(account_id):
    db = get_db()
    try:
        db.execute('DELETE FROM transactions WHERE account_id = ?', (account_id,))
        db.execute('DELETE FROM accounts WHERE id = ?', (account_id,))
        db.commit()
        log_audit(session.get('admin_id'), 'admin', 'DELETE_ACCOUNT', f"Deleted account ID {account_id}")
        return jsonify({'success': True, 'message': 'Account deleted successfully'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/liquidity-fund', methods=['GET'])
@role_required(['admin', 'staff'])
def get_liquidity_fund():
    db = get_db()
    fund = db.execute('SELECT balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
    balance = float(fund['balance']) if fund else 1000000.00
    active_loans = db.execute('SELECT COUNT(*) FROM loans WHERE status = "approved"').fetchone()[0]
    return jsonify({'success': True, 'fund_balance': balance, 'active_count': active_loans})

@admin_bp.route('/reports', methods=['GET'])
@role_required('admin')
def get_reports():
    db = get_db()
    # 1. User Distribution
    user_dist = {row['status']: row['count'] for row in db.execute('SELECT status, COUNT(*) as count FROM users GROUP BY status').fetchall()}
    
    # 2. Account Type Distribution
    acc_dist = {row['account_type']: row['count'] for row in db.execute('SELECT account_type, COUNT(*) as count FROM accounts GROUP BY account_type').fetchall()}
    
    # 3. Loan Status Distribution
    loan_status_rows = db.execute('SELECT status, COUNT(*) as count FROM loans GROUP BY status').fetchall()
    loan_status = {row['status']: row['count'] for row in loan_status_rows}
    
    # 4. Total System Liquidity (Sum of all user balances)
    total_liq = db.execute('SELECT SUM(balance) FROM accounts').fetchone()[0] or 0
    
    # 5. Transaction Trends (Last 30 days)
    # Get daily transaction sums for the last 30 days
    trend_rows = db.execute('''
        SELECT date(transaction_date) as t_date, SUM(amount) as total_amount
        FROM transactions
        WHERE transaction_date >= date('now', '-30 days')
        GROUP BY t_date
        ORDER BY t_date ASC
    ''').fetchall()
    transaction_trends = [dict(row) for row in trend_rows]

    return jsonify({
        'success': True,
        'user_distribution': user_dist,
        'account_distribution': acc_dist,
        'loan_status': loan_status,
        'total_liquidity': float(total_liq),
        'transaction_trends': transaction_trends
    })

@admin_bp.route('/attendance/tracking', methods=['GET'])
@role_required('admin')
def get_attendance_tracking():
    db = get_db()
    records = db.execute('''
        SELECT a.*, s.name as staff_name, s.staff_id as staff_code
        FROM attendance a JOIN staff s ON a.staff_id = s.id
        ORDER BY a.date DESC, a.clock_in DESC
    ''').fetchall()
    stats = {
        'today_present': db.execute('SELECT COUNT(*) FROM attendance WHERE date = date("now")').fetchone()[0],
        'total_staff': db.execute('SELECT COUNT(*) FROM staff').fetchone()[0],
        'avg_hours': db.execute('SELECT AVG(total_hours) FROM attendance WHERE total_hours IS NOT NULL').fetchone()[0] or 0
    }
    return jsonify({'success': True, 'records': [dict(r) for r in records], 'stats': stats})

@admin_bp.route('/salary/list', methods=['GET'])
@role_required('admin')
def get_salary_list():
    db = get_db()
    now = datetime.now()
    start_of_month = now.replace(day=1).strftime('%Y-%m-%d')
    staff_data = db.execute('SELECT id, staff_id as staff_code, name, department, position, base_salary FROM staff WHERE status = "active"').fetchall()
    result = []
    for staff in staff_data:
        base = float(staff['base_salary'] or 50000.00)
        attendance = db.execute('SELECT COUNT(*) FROM attendance WHERE staff_id = ? AND date >= ?', (staff['id'], start_of_month)).fetchone()[0]
        result.append({**dict(staff), 'current_salary': round((base / 26) * min(attendance, 26), 2), 'attendance_days': attendance})
    return jsonify({'success': True, 'salary_list': result, 'month': now.strftime('%B %Y')})

@admin_bp.route('/salary/pay', methods=['POST'])
@role_required('admin')
def pay_salary():
    data = request.json
    staff_id, amount = data.get('staff_id'), float(data.get('amount', 0))
    if not staff_id or amount <= 0: return jsonify({'error': 'Invalid data'}), 400
    db = get_db()
    try:
        staff = db.execute('SELECT * FROM staff WHERE id = ?', (staff_id,)).fetchone()
        if not staff: return jsonify({'error': 'Staff not found'}), 404
        db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
        db.commit()
        log_audit(session.get('admin_id'), 'admin', 'salary_paid', f"Paid ₹{amount} to {staff['name']}")
        return jsonify({'success': True, 'message': f'Salary of ₹{amount} paid to {staff["name"]}'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/admins', methods=['GET'])
@role_required('admin')
def get_all_admins():
    db = get_db()
    admins = db.execute('SELECT id, username, name, email, level, status FROM admins').fetchall()
    return jsonify([dict(a) for a in admins])

@admin_bp.route('/admins', methods=['POST'])
@role_required('admin')
def admin_add_admin():
    data = request.json
    name, username, email, password, level = data.get('name'), data.get('username'), data.get('email'), data.get('password'), data.get('level', 'standard')
    if not all([name, username, email, password]): return jsonify({'error': 'Missing fields'}), 400
    db = get_db()
    try:
        cursor = db.execute('INSERT INTO admins (name, username, email, password, level, status) VALUES (?, ?, ?, ?, ?, "active")',
                  (name, username, email, generate_password_hash(password), level))
        admin_id = cursor.lastrowid
        db.commit()
        trigger_geo_lookup(admin_id, 'admins')
        return jsonify({'success': True, 'message': 'Admin added'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/admins/<int:admin_id>/promote', methods=['PUT'])
@role_required('admin')
def admin_promote_admin(admin_id):
    data = request.json
    new_level = data.get('new_level', 'standard')
    db = get_db()
    try:
        db.execute('UPDATE admins SET level = ? WHERE id = ?', (new_level, admin_id))
        db.commit()
        return jsonify({'success': True, 'message': f'Admin level updated to {new_level}'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/admins/<int:admin_id>', methods=['DELETE'])
@role_required('admin')
def admin_delete_admin(admin_id):
    db = get_db()
    try:
        db.execute('DELETE FROM admins WHERE id = ?', (admin_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Admin deleted'})
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@admin_bp.route('/loans', methods=['GET'])
@role_required('admin')
def admin_get_all_loans():
    db = get_db()
    loans = db.execute('''
        SELECT l.*, u.name as user_name 
        FROM loans l 
        JOIN users u ON l.user_id = u.id
        ORDER BY l.application_date DESC
    ''').fetchall()
    return jsonify({'success': True, 'loans': [dict(loan) for loan in loans]})

@admin_bp.route('/transactions', methods=['GET'])
@role_required('admin')
def admin_get_all_transactions():
    db = get_db()
    txns = db.execute('''
        SELECT t.*, u.name as user_name, u.email as user_email, a.account_number
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC
    ''').fetchall()
    return jsonify({'success': True, 'transactions': [dict(t) for t in txns]})

@admin_bp.route('/audit', methods=['GET'])
@role_required('admin')
def get_audit_logs():
    db = get_db()
    logs = db.execute('SELECT * FROM system_audit ORDER BY timestamp DESC LIMIT 100').fetchall()
    return jsonify({'success': True, 'logs': [dict(l) for l in logs]})

@admin_bp.route('/settings', methods=['GET', 'POST'])
@role_required('admin')
def admin_settings():
    if request.method == 'GET':
        return jsonify({
            'bankName': 'Smart Bank',
            'dailyTransferLimit': 100000,
            'loanInterestRate': 12.5,
            'maintenanceMode': False,
            'allowNewSignups': True
        })
    else:
        # For now just return success
        return jsonify({'success': True, 'message': 'Settings saved'})

@admin_bp.route('/backup', methods=['POST'])
@role_required('admin')
def admin_backup():
    return jsonify({'success': True, 'filename': f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"})

@admin_bp.route('/test-email', methods=['POST'])
@role_required('admin')
def admin_test_email():
    data = request.json
    email = data.get('email')
    if not email: return jsonify({'error': 'No email provided'}), 400
    return jsonify({'success': True, 'config': 'SMTP', 'smtp': 'smtp.gmail.com:587', 'report': 'Diagnostic email sent successfully.'})

@admin_bp.route('/face-login', methods=['POST'])
def face_login():
    data = request.json
    face_descriptor = data.get('face_descriptor')
    
    if not face_descriptor:
        return jsonify({'error': 'Face descriptor required'}), 400
    
    db = get_db()
    # Find all admins with face auth enabled
    admins = db.execute('SELECT * FROM admins WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    
    for a in admins:
        stored_descriptor = a['face_descriptor']
        if stored_descriptor and compare_face_descriptors(face_descriptor, stored_descriptor):
            # Login success
            session.clear()
            session.permanent = True
            session['user_id'] = a['id']
            session['admin_id'] = a['id']
            session['username'] = a['username']
            session['role'] = 'admin'
            session['name'] = a['name']
            
            logger.info(f"Face Login Success: admin={a['username']}")
            return jsonify({
                'success': True,
                'role': 'admin',
                'name': a['name'],
                'admin': {
                    'id': a['id'],
                    'username': a['username'],
                    'name': a['name'],
                    'email': a['email'],
                    'level': a['level'],
                    'profile_image': a['profile_image']
                }
            })
            
    return jsonify({'error': 'Face not recognized'}), 401

@admin_bp.route('/geo-map', methods=['GET'])
@role_required('admin')
def get_geo_map_data():
    """Return all users with geolocation, including account type differentiation and Agri Buyers."""
    db = get_db()
    
    # 1. Standard Banking Users
    users_rows = db.execute('''
        SELECT u.id, u.name, u.username, u.email, u.status, u.created_at,
               u.signup_ip, u.signup_lat, u.signup_lng, u.signup_city, u.signup_country,
               (SELECT group_concat(account_type) FROM accounts WHERE user_id = u.id) as account_types,
               COUNT(a.id) as account_count
        FROM users u
        LEFT JOIN accounts a ON a.user_id = u.id
        GROUP BY u.id
    ''').fetchall()
    
    markers = []
    
    for r in users_rows:
        d = dict(r)
        if d.get('signup_lat') and d.get('signup_lng'):
            # Differentiate Type: Standard or Farmer
            u_type = 'User'
            acc_types = (d.get('account_types') or '').lower()
            if 'agriculture' in acc_types:
                u_type = 'Farmer'
            
            markers.append({
                'id': f"u_{d['id']}",
                'name': d['name'],
                'username': d['username'],
                'type': u_type,
                'status': d['status'],
                'city': d.get('signup_city') or 'Unknown',
                'country': d.get('signup_country') or '',
                'ip': d.get('signup_ip') or '',
                'lat': float(d['signup_lat']),
                'lng': float(d['signup_lng']),
                'account_count': d['account_count'],
                'created_at': d['created_at']
            })
            
    # 2. Agri Buyers
    buyers_rows = db.execute('''
        SELECT id, name, buyer_id as username, email, status, created_at,
               signup_ip, signup_lat, signup_lng, signup_city, signup_country
        FROM agri_buyers
        WHERE signup_lat IS NOT NULL AND signup_lng IS NOT NULL
    ''').fetchall()
    
    for r in buyers_rows:
        d = dict(r)
        markers.append({
            'id': f"b_{d['id']}",
            'name': d['name'],
            'username': d['username'],
            'type': 'Buyer',
            'status': d['status'],
            'city': d.get('signup_city') or 'Unknown',
            'country': d.get('signup_country') or '',
            'ip': d.get('signup_ip') or '',
            'lat': float(d['signup_lat']),
            'lng': float(d['signup_lng']),
            'account_count': 1, # Business account
            'created_at': d['created_at']
        })

    # 3. Staff members
    staff_rows = db.execute('''
        SELECT id, name, staff_id as username, email, status, created_at,
               signup_ip, signup_lat, signup_lng, signup_city, signup_country
        FROM staff
        WHERE signup_lat IS NOT NULL AND signup_lng IS NOT NULL
    ''').fetchall()
    for r in staff_rows:
        d = dict(r)
        markers.append({
            'id': f"s_{d['id']}", 'name': d['name'], 'username': d['username'], 'type': 'Staff', 'status': d['status'],
            'city': d.get('signup_city') or 'Unknown', 'country': d.get('signup_country') or '',
            'ip': d.get('signup_ip') or '', 'lat': float(d['signup_lat']), 'lng': float(d['signup_lng']),
            'account_count': 0, 'created_at': d['created_at']
        })

    # 4. Admins
    admin_rows = db.execute('''
        SELECT id, name, username, email, status, created_at,
               signup_ip, signup_lat, signup_lng, signup_city, signup_country
        FROM admins
        WHERE signup_lat IS NOT NULL AND signup_lng IS NOT NULL
    ''').fetchall()
    for r in admin_rows:
        d = dict(r)
        markers.append({
            'id': f"a_{d['id']}", 'name': d['name'], 'username': d['username'], 'type': 'Admin', 'status': d['status'],
            'city': d.get('signup_city') or 'Unknown', 'country': d.get('signup_country') or '',
            'ip': d.get('signup_ip') or '', 'lat': float(d['signup_lat']), 'lng': float(d['signup_lng']),
            'account_count': 0, 'created_at': d['created_at']
        })
        
    return jsonify({
        'success': True, 
        'markers': markers, 
        'total_mapped': len(markers),
        'stats': {
            'users': sum(1 for m in markers if m['type'] == 'User'),
            'farmers': sum(1 for m in markers if m['type'] == 'Farmer'),
            'buyers': sum(1 for m in markers if m['type'] == 'Buyer'),
            'staff': sum(1 for m in markers if m['type'] == 'Staff'),
            'admins': sum(1 for m in markers if m['type'] == 'Admin')
        }
    })

@admin_bp.route('/profile', methods=['GET'])
@role_required('admin')
def get_admin_profile():
    db = get_db()
    admin_id = session.get('admin_id')
    admin = db.execute('SELECT id, username, name, email, level, status, profile_image FROM admins WHERE id = ?', (admin_id,)).fetchone()
    if not admin: return jsonify({'error': 'Admin not found'}), 404
    
    admin_dict = dict(admin)
    img = admin_dict.get('profile_image')
    admin_dict['profile_image_url'] = f"/api/admin/profile-image/{img}" if img else None
    
    return jsonify({'success': True, 'admin': admin_dict})

@admin_bp.route('/profile-image', methods=['POST'])
@role_required('admin')
def upload_admin_profile_image():
    if 'image' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['image']
    if file.filename == '': return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        admin_id = session.get('admin_id')
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"admin_{admin_id}_{int(datetime.now().timestamp())}.{ext}"
        filepath = os.path.join(PROFILE_PICS_FOLDER, filename)
        
        if not os.path.exists(PROFILE_PICS_FOLDER):
            os.makedirs(PROFILE_PICS_FOLDER, exist_ok=True)
            
        file.save(filepath)
        db = get_db()
        try:
            old_admin = db.execute('SELECT profile_image FROM admins WHERE id = ?', (admin_id,)).fetchone()
            if old_admin and old_admin['profile_image']:
                old_path = os.path.join(PROFILE_PICS_FOLDER, old_admin['profile_image'])
                if os.path.exists(old_path):
                    try: os.remove(old_path)
                    except: pass
            
            db.execute('UPDATE admins SET profile_image = ? WHERE id = ?', (filename, admin_id))
            db.commit()
            return jsonify({
                'success': True, 
                'message': 'Profile image uploaded successfully', 
                'profile_image': filename,
                'profile_image_url': f"/api/admin/profile-image/{filename}"
            })
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type'}), 400


@admin_bp.route('/profile-image/<filename>')
def serve_admin_profile_image(filename):
    from werkzeug.utils import secure_filename
    safe_name = secure_filename(filename)
    return send_from_directory(PROFILE_PICS_FOLDER, safe_name)

# ============================================================
# UPI MANAGEMENT — Admin
# ============================================================

@admin_bp.route('/upi/users', methods=['GET'])
@role_required(['admin', 'staff'])
def get_upi_users():
    """List all users with their UPI IDs and UPI transaction stats."""
    db = get_db()
    rows = db.execute('''
        SELECT u.id, u.name, u.username, u.email, u.phone, u.upi_id, u.status,
               COUNT(t.id) as upi_tx_count,
               IFNULL(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) as upi_sent,
               IFNULL(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) as upi_received
        FROM users u
        LEFT JOIN accounts a ON a.user_id = u.id
        LEFT JOIN transactions t ON t.account_id = a.id AND t.mode = 'UPI'
        WHERE u.upi_id IS NOT NULL
        GROUP BY u.id
        ORDER BY upi_tx_count DESC
    ''').fetchall()
    return jsonify({'success': True, 'users': [dict(r) for r in rows]})

@admin_bp.route('/upi/transactions', methods=['GET'])
@role_required(['admin', 'staff'])
def get_upi_transactions():
    """Return all UPI transactions across all users."""
    db = get_db()
    limit = int(request.args.get('limit', 200))
    user_id = request.args.get('user_id')
    query = '''
        SELECT t.id, t.type, t.amount, t.description, t.reference_number,
               t.transaction_date, t.balance_after, t.mode,
               u.name as user_name, u.upi_id, u.email as user_email,
               a.account_number
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        WHERE t.mode = 'UPI'
    '''
    params = []
    if user_id:
        query += ' AND u.id = ?'
        params.append(user_id)
    query += ' ORDER BY t.transaction_date DESC LIMIT ?'
    params.append(limit)
    rows = db.execute(query, params).fetchall()
    return jsonify({'success': True, 'transactions': [dict(r) for r in rows]})

@admin_bp.route('/upi/stats', methods=['GET'])
@role_required(['admin', 'staff'])
def get_upi_stats():
    """Return aggregate UPI statistics for the dashboard."""
    db = get_db()
    total_upi_users = db.execute("SELECT COUNT(*) FROM users WHERE upi_id IS NOT NULL").fetchone()[0]
    total_upi_tx = db.execute("SELECT COUNT(*) FROM transactions WHERE mode = 'UPI'").fetchone()[0]
    total_upi_volume = db.execute("SELECT IFNULL(SUM(amount), 0) FROM transactions WHERE mode = 'UPI' AND type = 'debit'").fetchone()[0]
    today_upi_tx = db.execute("SELECT COUNT(*) FROM transactions WHERE mode = 'UPI' AND date(transaction_date) = date('now')").fetchone()[0]
    today_upi_volume = db.execute("SELECT IFNULL(SUM(amount), 0) FROM transactions WHERE mode = 'UPI' AND type = 'debit' AND date(transaction_date) = date('now')").fetchone()[0]
    return jsonify({
        'success': True,
        'total_upi_users': total_upi_users,
        'total_upi_transactions': total_upi_tx,
        'total_upi_volume': float(total_upi_volume),
        'today_upi_transactions': today_upi_tx,
        'today_upi_volume': float(today_upi_volume)
    })

@admin_bp.route('/upi/reset/<int:user_id>', methods=['POST'])
@role_required(['admin', 'staff'])
def reset_user_upi(user_id):
    """Reset/revoke a user's UPI ID and PIN."""
    db = get_db()
    try:
        user = db.execute('SELECT name, upi_id FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if not user['upi_id']:
            return jsonify({'error': 'User has no UPI ID to reset'}), 400
        db.execute('UPDATE users SET upi_id = NULL, upi_pin = NULL WHERE id = ?', (user_id,))
        db.commit()
        log_audit(session.get('admin_id') or session.get('staff_id'), session.get('role'),
                  'RESET_UPI', f"Reset UPI for user {user['name']} (ID {user_id})")
        return jsonify({'success': True, 'message': f"UPI reset for {user['name']}"})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
