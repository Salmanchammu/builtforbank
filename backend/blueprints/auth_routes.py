from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets
import random
import re
import os
import logging
import threading
from config.sms_config import send_sms

from core.db import get_db, DATABASE
from core.auth import login_required, log_audit, compare_face_descriptors, get_face_encoding, trigger_geo_lookup
from core.email_utils import send_email_async
from core.utils import validate_email, validate_password

auth_bp = Blueprint('auth', __name__)

def send_sms_async(p, m):
    if p:
        threading.Thread(target=send_sms, args=(p, m), daemon=True).start()
    return True

logger = logging.getLogger('smart_bank.auth')



# Validation functions
def validate_phone(phone):
    if not phone: return True
    pattern = r'^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$'
    return re.match(pattern, phone) is not None

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.json
    username, email, password, name = data.get('username'), data.get('email'), data.get('password'), data.get('name')
    phone = data.get('phone')
    device_type = data.get('device_type', 'unknown')
    
    if not all([username, email, password, name, phone]):
        return jsonify({'error': 'Required fields missing'}), 400
    
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
        
    if not validate_phone(phone):
        return jsonify({'error': 'Invalid phone number format'}), 400
        
    is_valid, pwd_error = validate_password(password)
    if not is_valid:
        return jsonify({'error': pwd_error}), 400
        
    db = get_db()
    if db.execute('SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?', (username, email, phone)).fetchone():
        return jsonify({'error': 'Username, email, or phone already exists'}), 400
    
    try:
        hashed = generate_password_hash(password)
        otp = str(random.randint(100000, 999999))
        otp_expiry = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor = db.execute('INSERT INTO users (username, password, email, phone, name, status, otp, phone_otp, otp_expiry, device_type) VALUES (?, ?, ?, ?, ?, "pending", ?, NULL, ?, ?)',
                           (username, hashed, email, phone, name, otp, otp_expiry, device_type))
        user_id = cursor.lastrowid
        db.commit()

        trigger_geo_lookup(user_id, 'users')

        welcome_body = f"<h3>Verify your Smart Bank Account</h3><p>Your Email Code is: <b>{otp}</b></p>"
        send_email_async(email, "Verify your Smart Bank Account", welcome_body)
        
        # Developer debug print to assist local testing if email APIs are delayed
        print(f"\n[DEV MODE] Created User: {username}")
        print(f"[DEV MODE] Email OTP for {email}: {otp}\n")
        
        return jsonify({'success': True, 'message': 'Account created! Please check your email for the verification code.', 'username': username}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    username = data.get('username')
    email_otp = data.get('email_otp')
    phone_otp = data.get('phone_otp')
    
    if not username or not email_otp:
        return jsonify({'error': 'Username and email OTP are required'}), 400
        
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user: return jsonify({'error': 'User not found'}), 404
    if user['status'] == 'active': return jsonify({'success': True, 'message': 'Account is already active'}), 200
    
    if user['otp'] != email_otp:
        return jsonify({'error': 'Invalid verification code'}), 400
        
    expiry = datetime.strptime(user['otp_expiry'], '%Y-%m-%d %H:%M:%S')
    if datetime.now() > expiry: return jsonify({'error': 'verification codes expired'}), 400
    
    try:
        db.execute('UPDATE users SET status = "active", otp = NULL, phone_otp = NULL, otp_expiry = NULL WHERE id = ?', (user['id'],))
        db.commit()
        return jsonify({'success': True, 'message': 'Account activated!'}), 200
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    data = request.json
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user['status'] == 'active':
        return jsonify({'success': True, 'message': 'Account is already active'}), 200
    
    try:
        otp = str(random.randint(100000, 999999))
        otp_expiry = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
        db.execute('UPDATE users SET otp = ?, phone_otp = NULL, otp_expiry = ? WHERE id = ?', (otp, otp_expiry, user['id']))
        db.commit()
        
        body = f"<h3>Verify your Smart Bank Account</h3><p>Your new Email Code is: <b>{otp}</b></p>"
        send_email_async(user['email'], "Smart Bank - New Verification Code", body)
        
        # Developer debug print to assist local testing if email APIs are delayed
        print(f"\n[DEV MODE] Resend OTP for User: {username}")
        print(f"[DEV MODE] New Email OTP: {otp}\n")
        print(f"\n[DEV MODE] Resend OTP for User: {username}")
        print(f"[DEV MODE] New Email OTP for {user['email']}: {otp}")
        if user['phone']:
            print(f"[DEV MODE] New SMS OTP for {user['phone']}: {phone_otp}\n")

        return jsonify({'success': True, 'message': 'New codes sent to your email and phone'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username_input = data.get('username')
    password = data.get('password')
    requested_role = data.get('role', 'user')
    face_descriptor = data.get('face_descriptor')
    
    db = get_db()
    user, role = None, requested_role

    if requested_role == 'user':
        user = db.execute('SELECT * FROM users WHERE username = ? OR email = ?', (username_input, username_input)).fetchone()
    elif requested_role == 'staff':
        user = db.execute('SELECT * FROM staff WHERE staff_id = ? OR email = ?', (username_input, username_input)).fetchone()
    elif requested_role == 'admin':
        user = db.execute('SELECT * FROM admins WHERE username = ? OR email = ?', (username_input, username_input)).fetchone()
    elif requested_role == 'agri_buyer':
         user = db.execute('SELECT * FROM agri_buyers WHERE buyer_id = ? OR email = ?', (username_input, username_input)).fetchone()
    
    role = requested_role
    if not user: return jsonify({'error': 'Invalid credentials'}), 401
    if user['status'] == 'pending': return jsonify({'error': 'Account pending activation/approval', 'unverified': True, 'username': username_input}), 403
    
    auth_method = None
    if face_descriptor and role != 'user' and dict(user).get('face_auth_enabled'):
        stored_descriptor = get_face_encoding(user['id'], role)
        if stored_descriptor and compare_face_descriptors(face_descriptor, stored_descriptor):
            auth_method = 'face'
    
    if not auth_method and password and check_password_hash(user['password'], password):
        auth_method = 'password'
        
    if auth_method:
        user_dict = dict(user)
        actual_username = user_dict.get('username') or user_dict.get('staff_id') or user_dict.get('buyer_id')
        table_map = {'user': 'users', 'staff': 'staff', 'admin': 'admins', 'agri_buyer': 'agri_buyers'}
        table = table_map.get(role, 'users')

        if role in ['user', 'staff', 'agri_buyer']:
            try:
                otp = str(random.randint(100000, 999999))
                otp_expiry = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
                
                try:
                    db.execute(f'UPDATE {table} SET otp = ?, phone_otp = NULL, otp_expiry = ? WHERE id = ?', (otp, otp_expiry, user['id']))
                    db.commit()
                except Exception as db_e:
                    logger.warning(f"Lazy migration needed for {table}. Adding phone_otp column: {db_e}")
                    db.rollback()
                    db.execute(f'ALTER TABLE {table} ADD COLUMN phone_otp TEXT')
                    db.execute(f'UPDATE {table} SET otp = ?, phone_otp = NULL, otp_expiry = ? WHERE id = ?', (otp, otp_expiry, user['id']))
                    db.commit()
                
                email = user_dict.get('email')
                
                if email:
                    send_email_async(email, "Smart Bank - Login Verification", f"<h3>Smart Bank Login</h3><p>Your Email Code is: <b>{otp}</b></p>")
                    
                # Developer debug print to assist local testing if email APIs are delayed
                print(f"\n[DEV MODE] 2FA Login for User: {actual_username}")
                if email:
                    print(f"[DEV MODE] Email OTP for {email}: {otp}\n")

                return jsonify({'success': True, 'requires_2fa': True, 'username': actual_username, 'role': role})
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to generate 2FA for {actual_username}: {e}")
                return jsonify({'error': 'Failed to generate 2FA. Ensure your account is fully set up.'}), 500

        # Admin bypass
        session.clear()
        session.permanent = True
        session['user_id'] = user['id']
        user_dict = dict(user)
        actual_username = user_dict.get('username') or user_dict.get('staff_id') or user_dict.get('buyer_id')
        session['username'] = actual_username
        session['role'] = role
        session['name'] = user['name']
        if role == 'staff': session['staff_id'] = user['id']
        elif role == 'admin': session['admin_id'] = user['id']
        elif role == 'agri_buyer': session['buyer_id'] = user['id']

        # Trigger real-time geolocation update on login
        table_map = {'user': 'users', 'staff': 'staff', 'admin': 'admins', 'agri_buyer': 'agri_buyers'}
        table = table_map.get(role, 'users')
        try:
            db.execute(f'UPDATE {table} SET last_login = ? WHERE id = ?', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user['id']))
            db.commit()
        except Exception as e:
            # Lazy migration: Add last_login column if missing
            try:
                db.execute(f'ALTER TABLE {table} ADD COLUMN last_login TIMESTAMP')
                db.execute(f'UPDATE {table} SET last_login = ? WHERE id = ?', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user['id']))
                db.commit()
            except:
                db.rollback()
                logger.error(f"Failed to update last_login for {actual_username} in {table}")

        trigger_geo_lookup(user['id'], table)

        return jsonify({'success': True, 'user': {'id': user['id'], 'username': actual_username, 'name': user['name'], 'role': role, 'profile_image': user_dict.get('profile_image')}})
    
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/verify-login', methods=['POST'])
def verify_login():
    data = request.json
    username = data.get('username')
    email_otp = data.get('email_otp')
    role = data.get('role', 'user')
    
    if not username or not email_otp:
        return jsonify({'error': 'Username and email OTP are required'}), 400
        
    db = get_db()
    table_map = {'user': 'users', 'staff': 'staff', 'agri_buyer': 'agri_buyers'}
    table = table_map.get(role, 'users')
    uname_col = 'username' if role == 'user' else ('staff_id' if role == 'staff' else 'buyer_id')
    
    user = db.execute(f'SELECT * FROM {table} WHERE {uname_col} = ?', (username,)).fetchone()
    if not user: return jsonify({'error': 'User not found'}), 404
    
    if user['otp'] != email_otp:
        return jsonify({'error': 'Invalid Email verification code'}), 401
        
    expiry = datetime.strptime(user['otp_expiry'], '%Y-%m-%d %H:%M:%S')
    if datetime.now() > expiry: return jsonify({'error': 'verification codes expired'}), 401
    
    try:
        db.execute(f'UPDATE {table} SET otp = NULL, phone_otp = NULL, otp_expiry = NULL WHERE id = ?', (user['id'],))
        
        # Login successful - establish session
        session.clear()
        session.permanent = True
        session['user_id'] = user['id']
        session['username'] = username
        session['role'] = role
        session['name'] = user['name']
        if role == 'staff': session['staff_id'] = user['id']
        elif role == 'agri_buyer': session['buyer_id'] = user['id']

        try:
            db.execute(f'UPDATE {table} SET last_login = ? WHERE id = ?', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user['id']))
            db.commit()
        except:
            try:
                db.execute(f'ALTER TABLE {table} ADD COLUMN last_login TIMESTAMP')
                db.execute(f'UPDATE {table} SET last_login = ? WHERE id = ?', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user['id']))
                db.commit()
            except:
                db.rollback()

        trigger_geo_lookup(user['id'], table)

        return jsonify({'success': True, 'user': {'id': user['id'], 'username': username, 'name': user['name'], 'role': role, 'profile_image': dict(user).get('profile_image')}})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/face-login', methods=['POST'])
def face_login():
    """Face authentication for regular users and agri buyers"""
    data = request.json
    face_descriptor = data.get('face_descriptor')
    
    if not face_descriptor:
        return jsonify({'error': 'Face descriptor required'}), 400
    
    db = get_db()
    # Search regular users first
    users = db.execute('SELECT * FROM users WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    for u in users:
        stored_descriptor = u['face_descriptor']
        if stored_descriptor and compare_face_descriptors(face_descriptor, stored_descriptor):
            session.clear()
            session.permanent = True
            session['user_id'] = u['id']
            session['username'] = u['username']
            session['role'] = 'user'
            session['name'] = u['name']
            
            # Update current login location
            trigger_geo_lookup(u['id'], 'users')
            try:
                db.execute('UPDATE users SET last_login = ? WHERE id = ?', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), u['id']))
                db.commit()
            except:
                db.rollback()

            log_audit(u['id'], 'user', 'face_login', f"Successful face login for {u['username']}")
            logger.info(f"Face Login Success: user={u['username']}")
            return jsonify({
                'success': True, 'role': 'user', 'name': u['name'],
                'user': {'id': u['id'], 'username': u['username'], 'name': u['name'], 'email': u['email'], 'profile_image': u['profile_image']}
            })

    # Search agri_buyers if no user match
    buyers = db.execute('SELECT * FROM agri_buyers WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    for b in buyers:
        stored_descriptor = b['face_descriptor']
        if stored_descriptor and compare_face_descriptors(face_descriptor, stored_descriptor):
            session.clear()
            session.permanent = True
            session['user_id'] = b['id']
            session['buyer_id'] = b['id']
            session['username'] = b['buyer_id']
            session['role'] = 'agri_buyer'
            session['name'] = b['name']
            
            # Update current login location
            trigger_geo_lookup(b['id'], 'agri_buyers')

            log_audit(b['id'], 'agri_buyer', 'face_login', f"Successful face login for buyer {b['buyer_id']}")
            logger.info(f"Face Login Success: agri_buyer={b['buyer_id']}")
            return jsonify({
                'success': True, 'role': 'agri_buyer', 'name': b['name'],
                'buyer': {'id': b['id'], 'buyer_id': b['buyer_id'], 'name': b['name'], 'email': b['email'], 'role': 'agri_buyer'}
            })
            
    return jsonify({'error': 'Face not recognized'}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@auth_bp.route('/check', methods=['GET'])
def check_auth():
    user_id = session.get('user_id')
    role = session.get('role')
    if user_id and role:
        db = get_db()
        table_map = {'user': 'users', 'staff': 'staff', 'admin': 'admins', 'agri_buyer': 'agri_buyers'}
        table = table_map.get(role, 'users')
        user = db.execute(f'SELECT profile_image FROM {table} WHERE id = ?', (user_id,)).fetchone()
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user_id,
                'username': session.get('username'),
                'name': session.get('name'),
                'role': role,
                'profile_image': user['profile_image'] if user else None
            }
        })
    return jsonify({'authenticated': False}), 401

@auth_bp.route('/buyer/signup', methods=['POST'])
def buyer_signup():
    data = request.json
    b_id, pwd, name, email = data.get('buyer_id'), data.get('password'), data.get('name'), data.get('email')
    if not all([b_id, pwd, name, email]): return jsonify({'error': 'Missing fields'}), 400

    is_valid, pwd_error = validate_password(pwd)
    if not is_valid:
        return jsonify({'error': pwd_error}), 400
    db = get_db()
    if db.execute('SELECT id FROM agri_buyers WHERE buyer_id = ? OR email = ?', (b_id, email)).fetchone():
        return jsonify({'error': 'Exists'}), 400
    try:
        cursor = db.execute('INSERT INTO agri_buyers (buyer_id, password, name, email, phone, business_name, gst_number, status) VALUES (?, ?, ?, ?, ?, ?, ?, "pending")',
                  (b_id, generate_password_hash(pwd), name, email, data.get('phone'), data.get('business_name'), data.get('gst_number')))
        buyer_id = cursor.lastrowid
        db.commit()
        trigger_geo_lookup(buyer_id, 'agri_buyers')
        return jsonify({'success': True, 'message': 'Registered, pending approval'}), 201
    except Exception as e:
        db.rollback(); return jsonify({'error': str(e)}), 500

@auth_bp.route('/buyer/login', methods=['POST'])
def buyer_login():
    data = request.json
    buyer_id = data.get('buyer_id')
    password = data.get('password')
    
    if not buyer_id or not password:
        return jsonify({'error': 'Missing credentials'}), 400
        
    db = get_db()
    buyer = db.execute('SELECT * FROM agri_buyers WHERE (buyer_id = ? OR email = ?) AND status = "active"', (buyer_id, buyer_id)).fetchone()
    
    # If not active, check if it's pending
    if not buyer:
        pending = db.execute('SELECT id FROM agri_buyers WHERE (buyer_id = ? OR email = ?) AND status = "pending"', (buyer_id, buyer_id)).fetchone()
        if pending:
            return jsonify({'error': 'Buyer account is pending approval'}), 403
        return jsonify({'error': 'Invalid buyer credentials'}), 401
        
    if check_password_hash(buyer['password'], password):
        session.clear()
        session.permanent = True
        session['user_id'] = buyer['id']
        session['buyer_id'] = buyer['id']
        session['username'] = buyer['buyer_id']
        session['role'] = 'agri_buyer'
        session['name'] = buyer['name']
        
        # Update current login location
        trigger_geo_lookup(buyer['id'], 'agri_buyers')

        return jsonify({
            'success': True, 
            'buyer': {
                'id': buyer['id'],
                'buyer_id': buyer['buyer_id'],
                'name': buyer['name'],
                'email': buyer['email'],
                'role': 'agri_buyer'
            }
        })
        
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/forgot-username', methods=['POST'])
def forgot_username():
    data = request.json
    email = data.get('email')
    if not email: return jsonify({'error': 'Email is required'}), 400
    
    db = get_db()
    # Check all tables
    user = db.execute('SELECT username FROM users WHERE email = ?', (email,)).fetchone()
    if not user:
        user = db.execute('SELECT staff_id as username FROM staff WHERE email = ?', (email,)).fetchone()
    if not user:
        user = db.execute('SELECT buyer_id as username FROM agri_buyers WHERE email = ?', (email,)).fetchone()
        
    if not user:
        # For security, don't reveal if email exists
        return jsonify({'success': True, 'message': 'If an account is associated with this email, your username has been sent.'}), 200
    
    username = user['username']
    body = f"""
    Hello,
    
    You requested to recover your Smart Bank username.
    Your username is: {username}
    
    If you did not request this, please ignore this email.
    
    Best regards,
    Smart Bank Team
    """
    send_email_async(email, "Smart Bank: Username Recovery", body)
    return jsonify({'success': True, 'message': 'If an account is associated with this email, your username has been sent.'}), 200

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    if not email: return jsonify({'error': 'Email is required'}), 400
    
    db = get_db()
    # Find user in any table - get consistent names
    user = db.execute('SELECT id, username, "user" as role FROM users WHERE email = ?', (email,)).fetchone()
    if not user:
        # staff uses staff_id as username
        user = db.execute('SELECT id, staff_id as username, "staff" as role FROM staff WHERE email = ?', (email,)).fetchone()
    if not user:
        # agri_buyers uses buyer_id as username
        user = db.execute('SELECT id, buyer_id as username, "agri_buyer" as role FROM agri_buyers WHERE email = ?', (email,)).fetchone()
        
    if not user:
        return jsonify({'success': True, 'message': 'If an account is associated with this email, a reset link has been sent.'}), 200
    
    token = secrets.token_urlsafe(32)
    expiry = (datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    
    table_map = {'user': 'users', 'staff': 'staff', 'agri_buyer': 'agri_buyers'}
    table = table_map.get(user['role'], 'users')
    
    try:
        db.execute(f'UPDATE {table} SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', (token, expiry, user['id']))
        db.commit()
    except Exception as e:
        # Attempt to add missing columns
        try:
            db.execute(f'ALTER TABLE {table} ADD COLUMN reset_token VARCHAR(100)')
            db.execute(f'ALTER TABLE {table} ADD COLUMN reset_token_expiry TIMESTAMP')
            db.commit()
            db.execute(f'UPDATE {table} SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', (token, expiry, user['id']))
            db.commit()
        except:
            db.rollback()
            logger.error(f"Failed to update reset token for {email} in {table}")

    reset_url = f"{request.host_url}reset-password.html?token={token}&email={email}"
    body = f"""
    Hello {user['username']},
    
    We received a request to reset your Smart Bank account password.
    Click the link below (or copy and paste it into your browser) to reset it:
    
    {reset_url}
    
    This link will expire in 1 hour.
    
    Best regards,
    Smart Bank Team
    """
    send_email_async(email, "Reset your Smart Bank password", body)
    return jsonify({'success': True, 'message': 'If an account is associated with this email, a reset link has been sent.'}), 200

@auth_bp.route('/verify-reset-token', methods=['POST'])
def verify_reset_token():
    """Verify a password-reset token and return the associated user info."""
    data = request.json
    token = data.get('token')
    if not token:
        return jsonify({'error': 'Token is required'}), 400

    db = get_db()
    # Search across all user tables
    tables = [
        ('users',       'username'),
        ('staff',       'staff_id'),
        ('agri_buyers', 'buyer_id'),
    ]

    for table, uname_col in tables:
        try:
            user = db.execute(
                f'SELECT id, {uname_col} AS username, email, reset_token_expiry '
                f'FROM {table} WHERE reset_token = ?', (token,)
            ).fetchone()
        except Exception:
            continue   # table may lack the column

        if user:
            expiry = datetime.strptime(user['reset_token_expiry'], '%Y-%m-%d %H:%M:%S')
            if datetime.now() > expiry:
                return jsonify({'error': 'This reset link has expired. Please request a new one.'}), 400
            return jsonify({
                'success': True,
                'username': user['username'],
                'email': user['email']
            })

    return jsonify({'error': 'Invalid or expired reset token.'}), 400


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Set a new password using a valid reset token."""
    data = request.json
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    if len(new_password) < 9:
        return jsonify({'error': 'Password must be at least 9 characters'}), 400

    db = get_db()
    tables = [
        ('users',       'username'),
        ('staff',       'staff_id'),
        ('agri_buyers', 'buyer_id'),
    ]

    for table, uname_col in tables:
        try:
            user = db.execute(
                f'SELECT id, {uname_col} AS username, reset_token_expiry '
                f'FROM {table} WHERE reset_token = ?', (token,)
            ).fetchone()
        except Exception:
            continue

        if user:
            expiry = datetime.strptime(user['reset_token_expiry'], '%Y-%m-%d %H:%M:%S')
            if datetime.now() > expiry:
                return jsonify({'error': 'This reset link has expired. Please request a new one.'}), 400

            hashed = generate_password_hash(new_password)
            try:
                db.execute(
                    f'UPDATE {table} SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
                    (hashed, user['id'])
                )
                db.commit()
                logger.info(f"Password reset successful for {user['username']} in {table}")
                return jsonify({'success': True, 'message': 'Password has been reset successfully.'})
            except Exception as e:
                db.rollback()
                logger.error(f"Password reset failed: {e}")
                return jsonify({'error': 'Failed to update password. Please try again.'}), 500

    return jsonify({'error': 'Invalid or expired reset token.'}), 400


# ═══════════════════════════════════════════════════════════════
#  BALANCE PASSCODE (4-digit PIN for viewing balance)
# ═══════════════════════════════════════════════════════════════

@auth_bp.route('/mobile/passcode-status', methods=['GET'])
@login_required
def passcode_status():
    """Check if the user has already set up a balance passcode."""
    db = get_db()
    user = db.execute('SELECT passcode_enabled FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'enabled': bool(user['passcode_enabled'])})


@auth_bp.route('/mobile/setup-passcode', methods=['POST'])
@login_required
def setup_passcode():
    """One-time setup of a 4-digit balance passcode."""
    data = request.json
    passcode = data.get('passcode', '')

    if len(passcode) != 4 or not passcode.isdigit():
        return jsonify({'error': 'Passcode must be exactly 4 digits'}), 400

    db = get_db()
    user = db.execute('SELECT passcode_enabled FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user['passcode_enabled']:
        return jsonify({'error': 'Passcode already set. Use change-passcode to update it.'}), 409

    hashed = generate_password_hash(passcode)
    try:
        db.execute('UPDATE users SET mobile_passcode = ?, passcode_enabled = 1 WHERE id = ?',
                   (hashed, session['user_id']))
        db.commit()
        log_audit(session['user_id'], 'user', 'passcode_setup', 'Balance passcode configured')
        return jsonify({'success': True, 'message': 'Balance passcode set successfully!'})
    except Exception as e:
        db.rollback()
        logger.error(f"Passcode setup failed: {e}")
        return jsonify({'error': 'Failed to save passcode'}), 500


@auth_bp.route('/mobile/verify-passcode', methods=['POST'])
@login_required
def verify_passcode():
    """Verify the 4-digit balance passcode."""
    data = request.json
    passcode = data.get('passcode', '')

    if not passcode:
        return jsonify({'error': 'Passcode is required'}), 400

    db = get_db()
    user = db.execute('SELECT mobile_passcode, passcode_enabled FROM users WHERE id = ?',
                      (session['user_id'],)).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not user['passcode_enabled'] or not user['mobile_passcode']:
        return jsonify({'error': 'Passcode not configured'}), 400

    if check_password_hash(user['mobile_passcode'], passcode):
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'error': 'Incorrect passcode'}), 401


@auth_bp.route('/mobile/change-passcode', methods=['POST'])
@login_required
def change_passcode():
    """Change the balance passcode (requires current passcode)."""
    data = request.json
    current = data.get('current_passcode', '')
    new_pin = data.get('new_passcode', '')

    if not current or not new_pin:
        return jsonify({'error': 'Both current and new passcode are required'}), 400
    if len(new_pin) != 4 or not new_pin.isdigit():
        return jsonify({'error': 'New passcode must be exactly 4 digits'}), 400

    db = get_db()
    user = db.execute('SELECT mobile_passcode, passcode_enabled FROM users WHERE id = ?',
                      (session['user_id'],)).fetchone()
    if not user or not user['passcode_enabled']:
        return jsonify({'error': 'Passcode not configured yet'}), 400

    if not check_password_hash(user['mobile_passcode'], current):
        return jsonify({'error': 'Current passcode is incorrect'}), 401

    hashed = generate_password_hash(new_pin)
    try:
        db.execute('UPDATE users SET mobile_passcode = ? WHERE id = ?', (hashed, session['user_id']))
        db.commit()
        log_audit(session['user_id'], 'user', 'passcode_change', 'Balance passcode changed')
        return jsonify({'success': True, 'message': 'Passcode updated successfully!'})
    except Exception as e:
        db.rollback()
        logger.error(f"Passcode change failed: {e}")
        return jsonify({'error': 'Failed to update passcode'}), 500
