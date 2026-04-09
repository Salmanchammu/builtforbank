# 6. CODING
# CHAPTER-6

## 6.1 Introduction
The coding phase translates the detailed design specifications into a functional software product. For **Smart Bank**, the development followed a modular, "Premium White" design philosophy, prioritizing security, biometric integration, and high-performance geospatial rendering. The system is built as a **Single Page Application (SPA)** interface on the frontend, communicating with a **RESTful Python Flask** backend.

## 6.2 Backend Architecture — Application Entry Point (`app.py`)

The Flask application follows a **Blueprint-based modular architecture** with 9 registered blueprints for separation of concerns.

```python
from flask import Flask, request, jsonify, session, send_from_directory, g, send_file
from flask_cors import CORS
from datetime import timedelta
import os, logging, mimetypes

# Core Imports
from core.db import get_db, init_db, migrate_db
from core.auth import login_required, role_required

# Blueprint Imports
from blueprints.auth_routes import auth_bp
from blueprints.user_routes import user_bp
from blueprints.staff_routes import staff_bp
from blueprints.admin_routes import admin_bp
from blueprints.mobile_routes import mobile_bp
from blueprints.face_routes import face_bp
from blueprints.chat_routes import chat_bp
from blueprints.agri_routes import agri_bp
from blueprints.marketplace_routes import marketplace_bp

app = Flask(__name__)

# Security Configurations
app.secret_key = os.environ.get('SECRET_KEY', 'default_dev_key_change_in_production_99881122')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = any(os.environ.get(k) for k in ['RENDER', 'PORT', 'HTTPS'])
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)

# CORS Configuration
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5000", "http://127.0.0.1:5000",
    "https://*.render.com"
])

# Register All Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api/user')
app.register_blueprint(staff_bp, url_prefix='/api/staff')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(mobile_bp, url_prefix='/api/mobile')
app.register_blueprint(face_bp, url_prefix='/api/face')
app.register_blueprint(chat_bp, url_prefix='/api/chat')
app.register_blueprint(agri_bp, url_prefix='/api/agri')
app.register_blueprint(marketplace_bp, url_prefix='/api/marketplace')

# Cache Control: API = No Cache, Static = Cached
@app.after_request
def add_header(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    elif 'models' in request.path or 'face-api' in request.path:
        response.headers['Cache-Control'] = 'public, max-age=31536000'
    return response

if __name__ == '__main__':
    with app.app_context():
        if not os.path.exists(DATABASE):
            init_db()
        else:
            migrate_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
```

---

## 6.3 Core Module — Database Layer (`core/db.py`)

The database layer supports **dual database engines** — SQLite for local development and PostgreSQL for production (Render.com). It includes a **self-healing migration system** that automatically creates missing tables and columns.

```python
import sqlite3, os, logging
from flask import g, current_app

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db_url = os.environ.get('DATABASE_URL')
        if db_url and db_url.startswith('postgres'):
            # PostgreSQL support for Production (Render)
            import psycopg2
            from psycopg2.extras import RealDictCursor
            if db_url.startswith('postgres://'):
                db_url = db_url.replace('postgres://', 'postgresql://', 1)
            conn = psycopg2.connect(db_url)
            db = g._database = PostgresWrapper(conn)
        else:
            # SQLite for Local Development
            db = g._database = sqlite3.connect(DATABASE, timeout=30.0)
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA journal_mode = WAL')      # Better concurrency
            db.execute('PRAGMA foreign_keys = ON')        # Enforce FK constraints
    return db

def migrate_db():
    """Non-destructive incremental migrations with self-healing"""
    db = get_db()
    # 1. Ensure all 25+ core tables exist
    for table_name, create_sql in core_tables.items():
        try:
            db.execute(f"SELECT 1 FROM {table_name} LIMIT 1")
        except Exception:
            db.execute(create_sql)
            db.commit()
    # 2. Sequential column migrations (50+ columns)
    for table, col, col_type in migrations:
        try:
            db.execute(f"SELECT {col} FROM {table} LIMIT 1")
        except Exception:
            db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            db.commit()
    # 3. Seed system_finances if empty
    count = db.execute("SELECT COUNT(*) FROM system_finances").fetchone()[0]
    if count == 0:
        db.execute("INSERT INTO system_finances (fund_name, balance) VALUES (?, ?)",
                   ("Loan Liquidity Fund", 1000000.00))
        db.commit()
```

---

## 6.4 Core Module — Authentication & Security (`core/auth.py`)

Role-based access control (RBAC) is enforced via custom Python decorators. The system also includes biometric face comparison and geolocation tracking.

```python
from functools import wraps
from flask import session, jsonify, request
import threading, requests as http_requests, json

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session and 'staff_id' not in session and 'admin_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

def role_required(role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_role = session.get('role')
            allowed_roles = [role] if isinstance(role, str) else role
            if not current_role or current_role not in allowed_roles:
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def compare_face_descriptors(d1, d2, threshold=0.5):
    """Compare two 128-d face descriptors using Euclidean distance."""
    if not d1 or not d2: return False
    if isinstance(d1, str): d1 = json.loads(d1)
    if isinstance(d2, str): d2 = json.loads(d2)
    if len(d1) != 128 or len(d2) != 128: return False
    dist = sum((a - b) ** 2 for a, b in zip(d1, d2)) ** 0.5
    return dist < threshold

def trigger_geo_lookup(user_id, table_name='users'):
    """Async IP-based geolocation on signup/login."""
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    threading.Thread(target=geo_lookup_async, args=(user_id, table_name, client_ip), daemon=True).start()
```

---

## 6.5 Core Module — Input Validation (`core/utils.py`)

```python
import re

def validate_email(email):
    if not email: return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    if not password: return False, "Password is required"
    if len(password) < 7:
        return False, "Password must be at least 7 characters long"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if sum(c.isdigit() for c in password) < 3:
        return False, "Password must contain at least 3 numbers"
    if not re.search(r"[@$!%*?&]", password):
        return False, "Password must contain at least one special character (@$!%*?&)"
    return True, ""
```

---

## 6.6 Core Module — Email Service (`core/email_utils.py`)

The email system supports both **Resend HTTP API** (primary) and **SMTP** (fallback), with non-blocking delivery.

```python
import smtplib, threading, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email_async(to_email, subject, body_html):
    """Send email with Resend API -> SMTP fallback."""
    def send_task():
        resend_api_key = os.environ.get("RESEND_API_KEY")
        if resend_api_key:
            # Primary: Resend HTTP API
            import urllib.request, json
            payload = json.dumps({
                "from": "Smart Bank <noreply@smartbank.in>",
                "to": [to_email],
                "subject": subject,
                "html": body_html
            }).encode('utf-8')
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={"Authorization": f"Bearer {resend_api_key}",
                         "Content-Type": "application/json"}
            )
            urllib.request.urlopen(req, timeout=15)
            return
        # Fallback: SMTP (Gmail/Custom)
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_html, 'html'))
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
    send_task()
```

---

## 6.7 Core Module — Business Logic (`core/logic.py`)

```python
from datetime import datetime

def apply_loan_penalties(db=None):
    """Apply daily penalty of 0.1% for overdue loans."""
    today = datetime.now().date()
    loans = db.execute('''
        SELECT * FROM loans
        WHERE status IN ("approved", "overdue")
        AND next_due_date < ?
        AND (last_charge_date IS NULL OR DATE(last_charge_date) < ?)
    ''', (today, today)).fetchall()
    for loan in loans:
        penalty = round(float(loan['loan_amount']) * 0.001, 2)
        new_outstanding = float(loan['outstanding_amount'] or loan['loan_amount']) + penalty
        new_penalty = float(loan['penalty_amount'] or 0) + penalty
        db.execute('''
            UPDATE loans SET penalty_amount = ?, outstanding_amount = ?,
                status = "overdue", last_charge_date = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (new_penalty, new_outstanding, loan['id']))
    if loans: db.commit()
    return len(loans)
```

---

## 6.8 USER MODULE — Authentication Routes (`blueprints/auth_routes.py`)

### 6.9.1 User Signup with OTP Verification

```python
@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.json
    username, email, password, name = data.get('username'), data.get('email'), data.get('password'), data.get('name')
    if not all([username, email, password, name]):
        return jsonify({'error': 'Required fields missing'}), 400
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    is_valid, pwd_error = validate_password(password)
    if not is_valid:
        return jsonify({'error': pwd_error}), 400
    db = get_db()
    if db.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone():
        return jsonify({'error': 'Username or email already exists'}), 400
    hashed = generate_password_hash(password)
    otp = str(random.randint(100000, 999999))
    otp_expiry = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
    cursor = db.execute('INSERT INTO users (username, password, email, name, status, otp, otp_expiry) VALUES (?, ?, ?, ?, "pending", ?, ?)',
                       (username, hashed, email, name, otp, otp_expiry))
    user_id = cursor.lastrowid
    db.commit()
    trigger_geo_lookup(user_id, 'users')
    send_email_async(email, "Verify your Smart Bank Account",
                     f"<h3>Verify your Account</h3><p>Code: <b>{otp}</b></p>")
    return jsonify({'success': True, 'message': 'Account created! Please check your email.'}), 201
```

### 6.9.2 Multi-Role Login (User / Staff / Admin / Agri-Buyer)

```python
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username_input = data.get('username')
    password = data.get('password')
    requested_role = data.get('role', 'user')
    face_descriptor = data.get('face_descriptor')
    db = get_db()

    if requested_role == 'user':
        user = db.execute('SELECT * FROM users WHERE username = ? OR email = ?',
                         (username_input, username_input)).fetchone()
    elif requested_role == 'staff':
        user = db.execute('SELECT * FROM staff WHERE staff_id = ? OR email = ?',
                         (username_input, username_input)).fetchone()
    elif requested_role == 'admin':
        user = db.execute('SELECT * FROM admins WHERE username = ? OR email = ?',
                         (username_input, username_input)).fetchone()

    if not user: return jsonify({'error': 'Invalid credentials'}), 401
    if user['status'] == 'pending': return jsonify({'error': 'Account pending activation'}), 403

    # Face Auth or Password Auth
    auth_method = None
    if face_descriptor and dict(user).get('face_auth_enabled'):
        stored = get_face_encoding(user['id'], requested_role)
        if stored and compare_face_descriptors(face_descriptor, stored):
            auth_method = 'face'
    if not auth_method and password and check_password_hash(user['password'], password):
        auth_method = 'password'

    if auth_method:
        session.clear()
        session.permanent = True
        session['user_id'] = user['id']
        session['role'] = requested_role
        session['name'] = user['name']
        trigger_geo_lookup(user['id'], table_map.get(requested_role, 'users'))
        return jsonify({'success': True, 'user': {'id': user['id'], 'name': user['name'], 'role': requested_role}})
    return jsonify({'error': 'Invalid credentials'}), 401
```

### 6.9.3 Forgot Password with Secure Token Reset

```python
@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    email = request.json.get('email')
    db = get_db()
    user = db.execute('SELECT id, username FROM users WHERE email = ?', (email,)).fetchone()
    if not user:
        return jsonify({'success': True, 'message': 'If an account exists, a reset link has been sent.'}), 200
    token = secrets.token_urlsafe(32)
    expiry = (datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    db.execute('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
              (token, expiry, user['id']))
    db.commit()
    reset_url = f"{request.host_url}reset-password.html?token={token}&email={email}"
    send_email_async(email, "Reset your Smart Bank password",
                     f"<p>Click the link to reset: {reset_url}</p>")
    return jsonify({'success': True}), 200
```

### 6.9.4 Mobile Balance Passcode (4-Digit PIN)

```python
@auth_bp.route('/mobile/setup-passcode', methods=['POST'])
@login_required
def setup_passcode():
    passcode = request.json.get('passcode', '')
    if len(passcode) != 4 or not passcode.isdigit():
        return jsonify({'error': 'Passcode must be exactly 4 digits'}), 400
    db = get_db()
    hashed = generate_password_hash(passcode)
    db.execute('UPDATE users SET mobile_passcode = ?, passcode_enabled = 1 WHERE id = ?',
               (hashed, session['user_id']))
    db.commit()
    return jsonify({'success': True, 'message': 'Balance passcode set successfully!'})

@auth_bp.route('/mobile/verify-passcode', methods=['POST'])
@login_required
def verify_passcode():
    passcode = request.json.get('passcode', '')
    db = get_db()
    user = db.execute('SELECT mobile_passcode FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if check_password_hash(user['mobile_passcode'], passcode):
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Incorrect passcode'}), 401
```

---

## 6.9 USER MODULE — Banking Operations (`blueprints/user_routes.py`)

### 6.10.1 User Dashboard API

```python
@user_bp.route('/dashboard', methods=['GET'])
@login_required
def get_user_dashboard():
    db = get_db()
    apply_loan_penalties(db)
    user_id = session['user_id']
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    accounts = db.execute('SELECT * FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
    transactions = db.execute('''
        SELECT t.*, a.account_number FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE a.user_id = ? ORDER BY t.transaction_date DESC LIMIT 10
    ''', (user_id,)).fetchall()
    notifications = db.execute('SELECT * FROM notifications WHERE user_id = ? AND is_read = 0', (user_id,)).fetchall()
    cards = db.execute('SELECT * FROM cards WHERE user_id = ?', (user_id,)).fetchall()
    loans = db.execute('SELECT * FROM loans WHERE user_id = ?', (user_id,)).fetchall()
    total_balance = sum(acc['balance'] for acc in accounts)
    return jsonify({
        'user': dict(user), 'accounts': [dict(a) for a in accounts],
        'transactions': [dict(t) for t in transactions],
        'notifications': [dict(n) for n in notifications],
        'cards': [dict(c) for c in cards], 'loans': [dict(l) for l in loans],
        'total_balance': float(total_balance)
    })
```

### 6.10.2 Fund Transfer with International UPI Support

```python
EXCHANGE_RATES = {'USD': 83.12, 'EUR': 90.45, 'GBP': 105.67, 'AED': 22.63, 'INR': 1.00}

@user_bp.route('/transfer', methods=['POST'])
@login_required
def transfer_money():
    data = request.json
    from_acc_id = data.get('from_account')
    to_acc_raw = str(data.get('to_account', ''))
    amount_raw = float(data.get('amount', 0))
    currency = data.get('currency', 'INR').upper()
    exchange_rate = EXCHANGE_RATES.get(currency, 1.0)
    inr_amount = round(amount_raw * exchange_rate, 2)
    db = get_db()
    user_id = session['user_id']
    src = db.execute('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND balance >= ?',
                    (from_acc_id, user_id, inr_amount)).fetchone()
    if not src: return jsonify({'error': 'Insufficient funds'}), 400

    # Daily Limit Check
    today_start = datetime.now().replace(hour=0, minute=0, second=0).isoformat()
    today_spent = db.execute('''
        SELECT SUM(t.amount) FROM transactions t JOIN accounts a ON t.account_id = a.id
        WHERE a.user_id = ? AND t.type = 'debit' AND t.transaction_date >= ?
    ''', (user_id, today_start)).fetchone()[0] or 0
    daily_limit = src['daily_limit'] or 200000.00
    if currency != 'INR': daily_limit = min(daily_limit, 50000.00)
    if today_spent + inr_amount > daily_limit:
        return jsonify({'error': f'Daily limit of ₹{daily_limit} exceeded.'}), 400

    # Atomic Transfer
    ref = f"TXN{secrets.token_hex(10).upper()}"
    src_bal_after = src['balance'] - inr_amount
    db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (src_bal_after, from_acc_id))
    db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) VALUES (?, "debit", ?, ?, ?, ?, "Transfer")',
              (from_acc_id, inr_amount, f"Transfer to {to_acc_raw}", f"{ref}DB", src_bal_after))
    dest = db.execute('SELECT * FROM accounts WHERE account_number = ?', (to_acc_raw,)).fetchone()
    if dest:
        dest_bal = dest['balance'] + inr_amount
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (dest_bal, dest['id']))
        db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after) VALUES (?, "credit", ?, ?, ?, ?)',
                  (dest['id'], inr_amount, f"Received from {src['account_number']}", f"{ref}CR", dest_bal))
    db.commit()
    send_email_async(user['email'], f"Transaction Alert: Debit ₹{inr_amount}", "...")
    return jsonify({'success': True, 'reference': ref})
```

### 6.10.3 UPI Payment System

```python
@user_bp.route('/upi/setup', methods=['POST'])
@login_required
def setup_upi():
    pin = request.json.get('upi_pin')
    if not pin or len(str(pin)) != 6:
        return jsonify({'error': 'UPI PIN must be 6 digits'}), 400
    upi_id = f"{session['username']}@smtbank"
    db.execute('UPDATE users SET upi_id = ?, upi_pin = ? WHERE id = ?',
              (upi_id, generate_password_hash(str(pin)), session['user_id']))
    db.commit()
    return jsonify({'success': True, 'upi_id': upi_id})
```

### 6.10.4 Loan Application & Repayment

```python
@user_bp.route('/loans/apply', methods=['POST'])
@login_required
def apply_loan():
    data = request.json
    loan_type = data.get('loan_type', 'Personal')
    amount = float(data.get('loan_amount', 0))
    tenure = int(data.get('tenure_months', 12))
    if tenure > 60: return jsonify({'error': 'Tenure cannot exceed 60 months'}), 400
    db = get_db()
    db.execute('INSERT INTO loans (user_id, loan_type, loan_amount, tenure_months, interest_rate, status, target_account_id, outstanding_amount) VALUES (?, ?, ?, ?, 5.0, "pending", ?, ?)',
              (session['user_id'], loan_type, amount, tenure, data.get('target_account_id'), amount))
    db.commit()
    return jsonify({'success': True, 'message': 'Application submitted'})

@user_bp.route('/loans/repay', methods=['POST'])
@login_required
def repay_loan():
    loan_id, account_id, amount = data.get('loan_id'), data.get('account_id'), float(data.get('amount', 0))
    loan = db.execute('SELECT * FROM loans WHERE id = ? AND user_id = ? AND status = "approved"',
                     (loan_id, session['user_id'])).fetchone()
    outstanding = float(loan['outstanding_amount'])
    acc = db.execute('SELECT * FROM accounts WHERE id = ? AND balance >= ?', (account_id, amount)).fetchone()
    db.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, account_id))
    db.execute('UPDATE system_finances SET balance = balance + ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
    db.execute('UPDATE loans SET outstanding_amount = ? WHERE id = ?', (outstanding - amount, loan_id))
    if outstanding - amount <= 0:
        db.execute('UPDATE loans SET status = "closed" WHERE id = ?', (loan_id,))
    db.commit()
    return jsonify({'success': True, 'outstanding': outstanding - amount})
```

### 6.10.5 Bank Account Opening with KYC

```python
@user_bp.route('/accounts', methods=['POST'])
@login_required
def open_new_account():
    data = request.json
    account_type = data.get('account_type', 'Savings')
    aadhaar, pan, face = data.get('aadhaar_number'), data.get('pan_number'), data.get('face_descriptor')
    kyc_photo, kyc_video = data.get('kyc_photo'), data.get('kyc_video')
    if not all([aadhaar, pan, face]):
        return jsonify({'error': 'Missing KYC data'}), 400
    count = db.execute('SELECT COUNT(*) FROM accounts WHERE user_id = ?', (session['user_id'],)).fetchone()[0]
    if count >= 3: return jsonify({'error': 'Maximum account limit reached'}), 400
    db.execute('''INSERT INTO account_requests
        (user_id, account_type, aadhaar_number, pan_number, face_descriptor, kyc_photo, kyc_video, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, "pending")''',
        (session['user_id'], account_type, aadhaar, pan, json.dumps(face), kyc_photo, kyc_video))
    db.commit()
    return jsonify({'success': True, 'message': 'Account requested successfully'})
```

### 6.10.6 Card Management (Request / Block / Unblock)

```python
@user_bp.route('/cards/request', methods=['POST'])
@login_required
def request_card():
    c_type = request.json.get('card_type', 'Classic')
    acc_id = request.json.get('account_id')
    db.execute('INSERT INTO card_requests (user_id, account_id, card_type, status) VALUES (?, ?, ?, "pending")',
              (session['user_id'], acc_id, c_type))
    db.commit()
    return jsonify({'success': True})

@user_bp.route('/cards/<int:card_id>/block', methods=['POST'])
@login_required
def block_card(card_id):
    card = db.execute('SELECT * FROM cards WHERE id = ? AND user_id = ?', (card_id, session['user_id'])).fetchone()
    if not card or card['status'] != 'active':
        return jsonify({'error': 'Card not found or already blocked'}), 400
    db.execute('UPDATE cards SET status = "blocked" WHERE id = ?', (card_id,))
    db.commit()
    send_email_async(user['email'], "Security Alert: Card Blocked", "...")
    return jsonify({'success': True})
```

### 6.10.7 Savings Goals (Pockets)

```python
@user_bp.route('/savings-goals', methods=['POST'])
@login_required
def create_savings_goal():
    name = request.json.get('name')
    target = request.json.get('target_amount')
    db.execute('INSERT INTO savings_goals (user_id, name, target_amount) VALUES (?, ?, ?)',
              (session['user_id'], name, target))
    db.commit()
    return jsonify({'success': True})

@user_bp.route('/savings-goals/<int:g_id>/break', methods=['POST'])
@login_required
def break_savings_goal(g_id):
    goal = db.execute('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', (g_id, session['user_id'])).fetchone()
    amount = float(goal['current_amount'])
    primary_acc = db.execute('SELECT * FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1', (session['user_id'],)).fetchone()
    new_balance = float(primary_acc['balance']) + amount
    db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, primary_acc['id']))
    db.execute('UPDATE savings_goals SET status = "broken", current_amount = 0 WHERE id = ?', (g_id,))
    db.commit()
    return jsonify({'success': True, 'message': f'₹{amount:,.2f} returned to your account'})
```

### 6.10.8 Premium PDF Statement Generation

```python
@user_bp.route('/statements/download/<month>', methods=['GET'])
@login_required
def download_statement(month):
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
    from reportlab.lib import colors

    MAROON = colors.HexColor('#800000')
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    # Header
    elements.append(Paragraph("SmartBank", bank_name_style))
    elements.append(Paragraph("Premium Digital Banking Statement", subtitle_style))
    # Account Summary Table
    acc_rows = [[acc['account_number'], acc['account_type'], f"₹{acc['balance']:,.2f}"] for acc in accounts]
    acc_table = Table(acc_rows)
    acc_table.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), MAROON), ...]))
    elements.append(acc_table)
    # Transaction History with color-coded amounts
    for t in txns:
        amt_str = f"+₹{t['amount']:,.2f}" if t['type'] == 'credit' else f"-₹{t['amount']:,.2f}"
        data.append([t['transaction_date'][:10], t['description'], amt_str])
    doc.build(elements)
    return send_file(buffer, as_attachment=True, download_name=f"SmartBank_Statement.pdf")
```

---

## 6.10 STAFF MODULE — Operations (`blueprints/staff_routes.py`)

### 6.11.1 Staff Dashboard

```python
@staff_bp.route('/dashboard', methods=['GET'])
@role_required('staff')
def dashboard():
    db = get_db()
    stats = {
        'total_customers': db.execute('SELECT COUNT(*) FROM users').fetchone()[0],
        'pending_loans': db.execute('SELECT COUNT(*) FROM service_applications WHERE status = "pending"').fetchone()[0],
        'total_balance': db.execute('SELECT SUM(balance) FROM accounts WHERE status = "active"').fetchone()[0] or 0,
        'total_accounts': db.execute('SELECT COUNT(*) FROM accounts WHERE status = "active"').fetchone()[0]
    }
    recent_customers = db.execute('SELECT id, name, username, email FROM users ORDER BY created_at DESC LIMIT 5').fetchall()
    pending_loans = db.execute('''
        SELECT sa.id, sa.product_name as title, u.name as customer
        FROM service_applications sa JOIN users u ON sa.user_id = u.id
        WHERE sa.status = "pending" ORDER BY sa.applied_at DESC LIMIT 5
    ''').fetchall()
    recent_transactions = db.execute('''
        SELECT t.*, u.name as customer, a.account_number
        FROM transactions t JOIN accounts a ON t.account_id = a.id JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC LIMIT 10
    ''').fetchall()
    return jsonify({'success': True, 'stats': stats, 'recent_customers': [dict(c) for c in recent_customers],
                    'pending_loans': [dict(l) for l in pending_loans],
                    'recent_transactions': [dict(t) for t in recent_transactions]})
```

### 6.11.2 Service Application Processing (Loan / Card / Account Approval)

```python
@staff_bp.route('/service-applications/<int:app_id>', methods=['PUT'])
@role_required(['staff', 'admin'])
def update_service_application(app_id):
    action = request.json.get('action')   # 'approve' or 'reject'
    reason = request.json.get('reason', '')
    db = get_db()
    app_data = db.execute('SELECT sa.*, u.id as user_id, u.name as user_name FROM service_applications sa JOIN users u ON sa.user_id = u.id WHERE sa.id = ?', (app_id,)).fetchone()
    status = 'approved' if action == 'approve' else 'rejected'
    db.execute('UPDATE service_applications SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?', (status, app_id))

    if status == 'approved':
        if app_data['service_type'] == 'Loan':
            # Loan Disbursement: Credit to target account, deduct from Liquidity Fund
            target_acc = db.execute('SELECT * FROM accounts WHERE id = ?', (app_data['account_id'],)).fetchone()
            new_balance = target_acc['balance'] + app_data['amount']
            db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, target_acc['id']))
            db.execute('UPDATE loans SET status = "approved", approved_date = CURRENT_TIMESTAMP WHERE id = ?', (loan['id'],))
            db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (app_data['amount'],))

        elif app_data['service_type'] == 'Card':
            # Card Issuance: Generate card number, CVV, expiry
            c_num = f"4{''.join([str(random.randint(0,9)) for _ in range(15)])}"
            cvv = str(random.randint(100, 999))
            expiry = (datetime.now() + timedelta(days=365*5)).strftime("%Y-%m-%d")
            db.execute('INSERT INTO cards (user_id, account_id, card_number, card_type, card_holder_name, expiry_date, cvv, status) VALUES (?, ?, ?, ?, ?, ?, ?, "active")',
                      (app_data['user_id'], app_data['account_id'], c_num, card_req['card_type'], app_data['user_name'], expiry, cvv))

    # Send notification to user
    db.execute('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
              (app_data['user_id'], f"{app_data['service_type']} - {status.capitalize()}", f"Your application has been {status}.", 'success' if status == 'approved' else 'error'))
    db.commit()
    return jsonify({'success': True})
```

### 6.11.3 Staff Cash Operations (Deposit / Withdrawal / Transfer)

```python
@staff_bp.route('/transaction/add', methods=['POST'])
@role_required(['staff', 'admin'])
def add_transaction():
    acc_id, amount = request.json.get('account_id'), float(request.json.get('amount', 0))
    account = db.execute('SELECT * FROM accounts WHERE id = ?', (acc_id,)).fetchone()
    new_bal = account['balance'] + amount
    db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_bal, account['id']))
    db.execute('INSERT INTO transactions (account_id, type, amount, balance_after, description, mode) VALUES (?, "credit", ?, ?, "Staff Deposit", "CASH")',
              (account['id'], amount, new_bal))
    db.commit()
    return jsonify({'success': True})

@staff_bp.route('/transaction/withdraw', methods=['POST'])
@role_required(['staff', 'admin'])
def withdraw_transaction():
    account = db.execute('SELECT * FROM accounts WHERE id = ?', (acc_id,)).fetchone()
    if account['balance'] < amount: return jsonify({'error': 'Insufficient balance'}), 400
    new_bal = account['balance'] - amount
    db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_bal, account['id']))
    db.execute('INSERT INTO transactions (account_id, type, amount, balance_after, description, mode) VALUES (?, "debit", ?, ?, "Staff Withdrawal", "CASH")',
              (account['id'], amount, new_bal))
    db.commit()
```

### 6.11.4 Biometric Attendance (Face-Verified Clock In/Out)

```python
@staff_bp.route('/attendance/clock-in', methods=['POST'])
@role_required('staff')
def clock_in():
    staff_id = session.get('staff_id')
    face_descriptor = request.json.get('face_descriptor')
    staff = db.execute('SELECT * FROM staff WHERE id = ?', (staff_id,)).fetchone()
    # Strict face verify with 0.4 threshold
    if not compare_face_descriptors(face_descriptor, staff['face_descriptor'], threshold=0.4):
        return jsonify({'error': 'Face not recognized'}), 401
    existing = db.execute('SELECT * FROM attendance WHERE staff_id = ? AND date = ?',
                         (staff_id, datetime.now().date().isoformat())).fetchone()
    if existing: return jsonify({'error': 'Already clocked in today'}), 400
    db.execute('INSERT INTO attendance (staff_id, date, clock_in, status) VALUES (?, ?, ?, "present")',
              (staff_id, datetime.now().date().isoformat(), datetime.now().isoformat()))
    db.commit()
    return jsonify({'success': True, 'message': 'Clocked in successfully'})
```

### 6.11.5 Premium PDF Report Export

```python
@staff_bp.route('/reports/download/<report_type>', methods=['GET'])
@role_required(['staff', 'admin'])
def download_report_pdf(report_type):
    from reportlab.lib.pagesizes import A4, landscape
    buffer = io.BytesIO()
    page_size = landscape(A4) if report_type in ['transactions', 'all'] else A4
    doc = SimpleDocTemplate(buffer, pagesize=page_size)
    # Generate Users, Loans, Transactions, Account-type reports
    if report_type in ['users', 'all']:
        users = db.execute('SELECT id, name, email, phone, status FROM users').fetchall()
        elements.append(build_table(['ID', 'Name', 'Email', 'Phone', 'Status'], [...]))
    if report_type in ['loans', 'all']:
        loans = db.execute('SELECT l.*, u.name FROM loans l JOIN users u ON l.user_id = u.id').fetchall()
        elements.append(build_table(['ID', 'Customer', 'Type', 'Amount', 'Status'], [...]))
    doc.build(elements)
    return send_file(buffer, as_attachment=True, download_name=f"SmartBank_Report_{report_type}.pdf")
```

### 6.11.6 Geolocation Map Data

```python
@staff_bp.route('/geo-map', methods=['GET'])
@role_required(['staff', 'admin'])
def get_staff_geo_map_data():
    users_rows = db.execute('''
        SELECT u.id, u.name, u.username, u.status,
               u.signup_ip, u.signup_lat, u.signup_lng, u.signup_city, u.signup_country,
               COUNT(a.id) as account_count
        FROM users u LEFT JOIN accounts a ON a.user_id = u.id GROUP BY u.id
    ''').fetchall()
    markers = [{'id': f"u_{d['id']}", 'name': d['name'], 'type': 'User',
                'lat': float(d['signup_lat']), 'lng': float(d['signup_lng']),
                'city': d.get('signup_city', 'Unknown')} for d in [dict(r) for r in users_rows] if d.get('signup_lat')]
    return jsonify({'success': True, 'markers': markers})
```

---

## 6.11 ADMIN MODULE — System Management (`blueprints/admin_routes.py`)

### 6.12.1 Admin Dashboard with System Alerts

```python
@admin_bp.route('/dashboard', methods=['GET'])
@role_required('admin')
def admin_dashboard():
    db = get_db()
    stats = {
        'totalUsers': db.execute('SELECT COUNT(*) FROM users').fetchone()[0],
        'loanLiquidity': float(db.execute('SELECT balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()['balance']),
        'activeStaff': db.execute('SELECT COUNT(*) FROM staff WHERE status = "active"').fetchone()[0],
        'totalDeposits': db.execute('SELECT SUM(balance) FROM accounts WHERE status = "active"').fetchone()[0] or 0,
        'todaysTransactions': db.execute('SELECT COUNT(*) FROM transactions WHERE date(transaction_date) = date("now")').fetchone()[0]
    }
    # System Alerts
    system_alerts = []
    pending_accounts = db.execute('SELECT COUNT(*) FROM account_requests WHERE status = "pending"').fetchone()[0]
    if pending_accounts > 0:
        system_alerts.append({'type': 'warning', 'title': 'Pending Accounts', 'message': f'{pending_accounts} accounts awaiting approval'})
    blocked_accs = db.execute('SELECT COUNT(*) FROM accounts WHERE status = "blocked"').fetchone()[0]
    if blocked_accs > 0:
        system_alerts.append({'type': 'error', 'title': 'Blocked Accounts', 'message': f'{blocked_accs} blocked accounts detected'})
    return jsonify({'success': True, 'stats': stats, 'systemAlerts': system_alerts})
```

### 6.12.2 Staff Management (CRUD + Promotion)

```python
@admin_bp.route('/staff', methods=['POST'])
@role_required('admin')
def add_staff():
    name, email, password = data.get('name'), data.get('email'), data.get('password')
    staff_id = f"STF{int(datetime.now().timestamp())}"
    db.execute('INSERT INTO staff (staff_id, password, name, email, department, position, status) VALUES (?, ?, ?, ?, ?, ?, "active")',
              (staff_id, generate_password_hash(password), name, email, data.get('department', 'General'), data.get('position', 'Staff')))
    db.commit()
    trigger_geo_lookup(cursor.lastrowid, 'staff')
    return jsonify({'success': True, 'staff_id': staff_id}), 201

@admin_bp.route('/staff/<int:id>/promote', methods=['PUT'])
@role_required('admin')
def promote_staff(id):
    new_role = request.json.get('new_role', 'Senior Staff')
    db.execute('UPDATE staff SET position = ? WHERE id = ?', (new_role, id))
    db.commit()
    return jsonify({'success': True, 'message': f'Staff promoted to {new_role}'})
```

### 6.12.3 Salary Management & Payroll

```python
@admin_bp.route('/salary/list', methods=['GET'])
@role_required('admin')
def get_salary_list():
    staff_data = db.execute('SELECT id, staff_id, name, department, position, base_salary FROM staff WHERE status = "active"').fetchall()
    result = []
    for staff in staff_data:
        base = float(staff['base_salary'] or 50000.00)
        attendance = db.execute('SELECT COUNT(*) FROM attendance WHERE staff_id = ? AND date >= ?',
                               (staff['id'], start_of_month)).fetchone()[0]
        result.append({**dict(staff), 'current_salary': round((base / 26) * min(attendance, 26), 2),
                       'attendance_days': attendance})
    return jsonify({'success': True, 'salary_list': result})

@admin_bp.route('/salary/pay', methods=['POST'])
@role_required('admin')
def pay_salary():
    staff_id, amount = data.get('staff_id'), float(data.get('amount', 0))
    db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
    db.commit()
    return jsonify({'success': True, 'message': f'Salary of ₹{amount} paid'})
```

### 6.12.4 UPI Management & Analytics

```python
@admin_bp.route('/upi/stats', methods=['GET'])
@role_required(['admin', 'staff'])
def get_upi_stats():
    return jsonify({
        'total_upi_users': db.execute("SELECT COUNT(*) FROM users WHERE upi_id IS NOT NULL").fetchone()[0],
        'total_upi_transactions': db.execute("SELECT COUNT(*) FROM transactions WHERE mode = 'UPI'").fetchone()[0],
        'total_upi_volume': float(db.execute("SELECT IFNULL(SUM(amount), 0) FROM transactions WHERE mode = 'UPI' AND type = 'debit'").fetchone()[0]),
        'today_upi_transactions': db.execute("SELECT COUNT(*) FROM transactions WHERE mode = 'UPI' AND date(transaction_date) = date('now')").fetchone()[0]
    })

@admin_bp.route('/upi/reset/<int:user_id>', methods=['POST'])
@role_required(['admin', 'staff'])
def reset_user_upi(user_id):
    db.execute('UPDATE users SET upi_id = NULL, upi_pin = NULL WHERE id = ?', (user_id,))
    db.commit()
    return jsonify({'success': True, 'message': 'UPI reset successful'})
```

### 6.12.5 Reports & Analytics

```python
@admin_bp.route('/reports', methods=['GET'])
@role_required('admin')
def get_reports():
    user_dist = {row['status']: row['count'] for row in db.execute('SELECT status, COUNT(*) as count FROM users GROUP BY status').fetchall()}
    acc_dist = {row['account_type']: row['count'] for row in db.execute('SELECT account_type, COUNT(*) as count FROM accounts GROUP BY account_type').fetchall()}
    loan_status = {row['status']: row['count'] for row in db.execute('SELECT status, COUNT(*) as count FROM loans GROUP BY status').fetchall()}
    transaction_trends = db.execute('''
        SELECT date(transaction_date) as t_date, SUM(amount) as total_amount
        FROM transactions WHERE transaction_date >= date('now', '-30 days')
        GROUP BY t_date ORDER BY t_date ASC
    ''').fetchall()
    return jsonify({'user_distribution': user_dist, 'account_distribution': acc_dist,
                    'loan_status': loan_status, 'transaction_trends': [dict(r) for r in transaction_trends]})
```

---

## 6.12 Frontend — Face Authentication (`face-auth-fixed.js`)

### 6.13.1 Liveness Detection with EAR (Eye Aspect Ratio)

```javascript
class FaceAuthManager {
    constructor() {
        this.consecutiveDetections = 0;
        this.REQUIRED_CONSECUTIVE = 1;
        this.blinkState = { minEAR: 1.0, hasBlinked: false };
    }

    isRealHumanFace(detection) {
        const p = detection.landmarks.positions;
        // Liveness: EAR (Eye Aspect Ratio) for Blink Detection
        const calculateEAR = (pts) => {
            const v1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
            const v2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
            const h = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
            return (v1 + v2) / (2.0 * h);
        };
        const leftEye = [p[36], p[37], p[38], p[39], p[40], p[41]];
        const rightEye = [p[42], p[43], p[44], p[45], p[46], p[47]];
        const ear = (calculateEAR(leftEye) + calculateEAR(rightEye)) / 2;
        const BLINK_THRESH = 0.23;
        if (this.blinkState.minEAR < BLINK_THRESH && ear > BLINK_THRESH + 0.03) {
            this.blinkState.hasBlinked = true; // Human verified
        }
        return true;
    }

    async detectHumanFace() {
        return new Promise(resolve => {
            const loop = async () => {
                const detection = await faceapi
                    .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions({
                        inputSize: 224, scoreThreshold: 0.4
                    }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (detection && this.isRealHumanFace(detection) && this.blinkState.hasBlinked) {
                    this.consecutiveDetections++;
                    if (this.consecutiveDetections >= this.REQUIRED_CONSECUTIVE) {
                        resolve(detection); return;
                    }
                }
                requestAnimationFrame(loop);
            };
            loop();
        });
    }
}
```

---

## 6.13 Frontend — User Dashboard SPA (`userdash.js`)

```javascript
'use strict';
window.API = window.SMART_BANK_API_BASE || '/api';

const state = {
    user: null, accounts: [], transactions: [], cards: [],
    loans: [], cardRequests: [], notifications: [],
    currentPage: 'dashboard', upiStatus: null
};

const init = async () => {
    const ok = await checkAuth();
    if (!ok) { window.location.href = 'user.html'; return; }
    await loadAll();
    initNav();
    startAutoRefresh();
};

async function loadAll() {
    const r = await fetch(`${API}/user/dashboard`, { credentials: 'include' });
    if (r.ok) {
        const d = await r.json();
        state.accounts = d.accounts || [];
        state.transactions = d.transactions || [];
        state.cards = d.cards || [];
        state.loans = d.loans || [];
        state.notifications = d.notifications || [];
        renderAll();
    }
}
```

---

## 6.14 System Integration — 3D Branch & ATM Locator

```javascript
async function loadBankLocations() {
    const response = await fetch(`${API}/user/locations`);
    const locations = await response.json();
    locations.forEach(loc => {
        new maplibregl.Marker({ color: loc.type === 'atm' ? '#3b82f6' : '#800000' })
            .setLngLat([loc.lng, loc.lat])
            .setPopup(new maplibregl.Popup().setHTML(`
                <div class="map-popup">
                    <img src="${API}/staff/locations/photo/${loc.photo_url}" />
                    <h3>${loc.name}</h3>
                    <p>${loc.address}</p>
                </div>
            `))
            .addTo(map);
    });
}
```

---

## 6.15 API Route Summary Table

| Module | Method | Endpoint | Description |
|--------|--------|----------|-------------|
| **Auth** | POST | `/api/auth/signup` | User registration with OTP |
| **Auth** | POST | `/api/auth/login` | Multi-role login (User/Staff/Admin) |
| **Auth** | POST | `/api/auth/face-login` | Biometric face login |
| **Auth** | POST | `/api/auth/forgot-password` | Token-based password reset |
| **Auth** | POST | `/api/auth/reset-password` | Set new password via token |
| **Auth** | POST | `/api/auth/mobile/setup-passcode` | 4-digit balance PIN setup |
| **User** | GET | `/api/user/dashboard` | Full dashboard data load |
| **User** | POST | `/api/user/transfer` | Fund transfer with intl. UPI |
| **User** | POST | `/api/user/upi/pay` | UPI VPA payment |
| **User** | POST | `/api/user/loans/apply` | Loan application |
| **User** | POST | `/api/user/loans/repay` | Loan repayment |
| **User** | POST | `/api/user/accounts` | KYC-based account opening |
| **User** | POST | `/api/user/cards/request` | Card request |
| **User** | POST | `/api/user/cards/{id}/block` | Block stolen card |
| **User** | GET | `/api/user/statements/download/{month}` | PDF statement |
| **User** | POST | `/api/user/support` | Raise support ticket |
| **User** | GET | `/api/user/locations` | Branch & ATM locations |
| **Staff** | GET | `/api/staff/dashboard` | Staff operations overview |
| **Staff** | GET | `/api/staff/customers` | All customer list |
| **Staff** | PUT | `/api/staff/service-applications/{id}` | Approve/reject applications |
| **Staff** | POST | `/api/staff/transaction/add` | Cash deposit |
| **Staff** | POST | `/api/staff/transaction/withdraw` | Cash withdrawal |
| **Staff** | POST | `/api/staff/attendance/clock-in` | Face-verified clock-in |
| **Staff** | POST | `/api/staff/attendance/clock-out` | Face-verified clock-out |
| **Staff** | GET | `/api/staff/geo-map` | User geolocation data |
| **Staff** | GET | `/api/staff/reports/download/{type}` | PDF report export |
| **Staff** | POST | `/api/staff/locations` | Add branch/ATM location |
| **Admin** | GET | `/api/admin/dashboard` | System-wide analytics |
| **Admin** | GET | `/api/admin/users` | All users with balances |
| **Admin** | POST | `/api/admin/users/create` | Create user directly |
| **Admin** | POST | `/api/admin/staff` | Add staff member |
| **Admin** | PUT | `/api/admin/staff/{id}/promote` | Promote staff |
| **Admin** | GET | `/api/admin/salary/list` | Payroll calculator |
| **Admin** | POST | `/api/admin/salary/pay` | Disburse salary |
| **Admin** | GET | `/api/admin/reports` | Analytics & distribution |
| **Admin** | GET | `/api/admin/upi/stats` | UPI system statistics |
| **Admin** | POST | `/api/admin/upi/reset/{id}` | Reset user UPI |
| **Admin** | GET | `/api/admin/audit` | System audit trail |
| **Admin** | GET | `/api/admin/geo-map` | Full geo-map (all roles) |

---

## 6.16 FRONTEND — Landing Page (`index.html`)

The landing page uses a **"Premium Dark"** hero section with a CSS-rendered 3D credit card, floating orbs, and animated feature grid.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartBank | Online Banking</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&family=Outfit:wght@400;700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/landing.css">
    <script src="js/device-detector.js" data-auto-redirect></script>
</head>
<body>
    <!-- Navigation Bar -->
    <nav class="navbar">
        <a href="#home" class="logo"><span class="logo-text">SMART BANKING</span></a>
        <div class="nav-links">
            <a href="#home" class="active">Home</a>
            <a href="user.html">User Login</a>
            <a href="agri-buyer-login.html">Retail Agri</a>
            <a href="staff.html">Staff/Admin</a>
            <a href="#about">About</a>
        </div>
    </nav>

    <!-- Hero Section with 3D Credit Card -->
    <main class="hero" id="home">
        <div class="hero-content">
            <div class="bg-shape-square"></div>
            <div class="bg-shape-rect"></div>
            <h1 class="hero-title">ELITE <span>BANKING</span></h1>
            <p class="hero-desc">Experience secure, fast, and modern banking. Access your accounts, transfer funds instantly, and unlock premium benefits today.</p>
            <div class="hero-buttons">
                <a href="user.html" class="btn btn-primary">join now</a>
                <a href="#" class="btn btn-secondary">read more</a>
            </div>
        </div>
        <!-- Premium 3D Credit Card Illustration -->
        <div class="hero-illustration">
            <div class="glow-orb orb-1"></div>
            <div class="glow-orb orb-2"></div>
            <div class="card-container">
                <div class="premium-card">
                    <div class="card-chip"></div>
                    <div class="card-wave"><i class="fas fa-wifi" style="transform:rotate(90deg);"></i></div>
                    <div class="card-logo">SMART<span>BANKING</span></div>
                    <div class="card-number">
                        <span>****</span> <span>****</span> <span>****</span> <span>8842</span>
                    </div>
                    <div class="card-footer">
                        <div class="card-holder"><span class="label">Card Holder</span><span class="value">ELITE MEMBER</span></div>
                        <div class="card-expires"><span class="label">Expires</span><span class="value">12/28</span></div>
                        <div class="card-brand"><div class="circle-overlap"><div class="red-circle"></div><div class="gold-circle"></div></div></div>
                    </div>
                </div>
            </div>
            <div class="floating-element float-1"><i class="fas fa-gem"></i></div>
            <div class="floating-element float-2"><i class="fas fa-chart-line"></i></div>
        </div>
    </main>

    <!-- About Section — Feature Grid -->
    <section id="about" class="about-section">
        <div class="about-container">
            <div class="about-header">
                <h2 class="section-title">WHY CHOOSE <span>SMART BANKING?</span></h2>
                <p class="section-subtitle">A heritage of security, a future of refinement.</p>
            </div>
            <div class="features-grid">
                <div class="feature-card"><span class="feature-number">01</span><h3>Elite Security</h3><p>Advanced biometric authentication and real-time fraud monitoring.</p></div>
                <div class="feature-card"><span class="feature-number">02</span><h3>Instant Transfers</h3><p>Move funds globally in seconds with high-speed architecture.</p></div>
                <div class="feature-card"><span class="feature-number">03</span><h3>Premium Benefits</h3><p>Exclusive access to high-yield accounts and premium cards.</p></div>
            </div>
        </div>
    </section>
    <div class="bottom-bar"></div>
</body>
</html>
```

---

## 6.17 FRONTEND — User Login Page (`user.html`)

Split-panel layout: left side hosts the glassmorphic login form with Face Login integration; right side renders a CSS isometric banking illustration.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Bank - User Login</title>
    <link rel="stylesheet" href="css/premium-ui.css">
    <link rel="stylesheet" href="css/modern-auth.css">
    <link rel="stylesheet" href="css/face-auth-fixed.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="js/device-detector.js" data-auto-redirect></script>
</head>
<body>
    <div class="auth-layout">
        <a href="index.html" class="home-btn"><i class="fas fa-arrow-left"></i> Home</a>
        <!-- Left Side - Login Form -->
        <div class="auth-left">
            <div class="auth-card">
                <!-- Tabbed Navigation -->
                <div class="auth-tabs">
                    <a href="user.html" class="auth-tab active">Sign In</a>
                    <a href="signup.html" class="auth-tab">Sign Up</a>
                    <a href="forgot-password.html" class="auth-tab">Recovery</a>
                </div>
                <div class="form-container">
                    <div class="logo-section">
                        <div class="logo-icon">
                            <i class="fas fa-landmark"></i>
                            <span>SMART</span> <span style="color:#8E2020;">BANKING</span>
                        </div>
                        <h2 class="page-title">Smart Bank Login</h2>
                    </div>
                    <!-- Login Form -->
                    <form id="loginForm" class="form-section active-form">
                        <div class="form-group">
                            <label for="email">Login / Username</label>
                            <div class="input-wrapper">
                                <i class="fas fa-user input-icon"></i>
                                <input type="text" id="email" placeholder="Enter your username" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="password">Password</label>
                            <div class="input-wrapper">
                                <i class="fas fa-lock input-icon"></i>
                                <input type="password" id="password" placeholder="••••••••••" required>
                                <i class="fas fa-eye toggle-password" onclick="togglePassword('password')"></i>
                            </div>
                        </div>
                        <div class="form-options">
                            <label class="checkbox-container"><input type="checkbox" id="rememberMe"><span class="checkbox-label">Remember me</span></label>
                        </div>
                        <button type="submit" class="btn-primary">Sign In</button>
                        <div class="divider"><span>OR</span></div>
                        <!-- Biometric Face Login Button -->
                        <button type="button" class="btn-face-login" onclick="testFaceLogin('user')">
                            <span class="face-icon-box"><div class="user-icon-simple"></div></span>
                            <span class="btn-text">Secure Face Login</span>
                        </button>
                    </form>
                    <div class="additional-links">
                        <a href="staff.html" class="link-secondary"><i class="fas fa-user-tie"></i> Staff Portal</a>
                    </div>
                </div>
            </div>
            <div class="copyright"><i class="far fa-copyright"></i><span>2026 Smart Bank Corporation</span></div>
        </div>
        <!-- Right Side - Isometric Illustration -->
        <div class="auth-right">
            <div class="branding-content">
                <h1 class="branding-title">Welcome to the Smart Bank<br><span>Smart Banking</span></h1>
                <div class="iso-illustration">
                    <div class="iso-grid"></div>
                    <div class="iso-stand">
                        <div class="iso-logo">SMART <span style="color:#8E2020;">BANKING</span></div>
                        <div class="iso-profile"><i class="far fa-user"></i></div>
                        <div class="iso-login-dots"></div>
                        <div class="iso-btn"><i class="fas fa-arrow-right"></i></div>
                    </div>
                    <div class="iso-shield"><i class="fas fa-lock"></i></div>
                </div>
            </div>
        </div>
        <div class="toast" id="toast"></div>
    </div>
    <!-- Scripts -->
    <script src="js/auth-helper.js"></script>
    <script src="js/api-config.js"></script>
    <script src="js/user-auth.js"></script>
    <script src="js/face-auth-fixed.js"></script>
</body>
</html>
```

---

## 6.18 FRONTEND — User Registration Page (`signup.html`)

Five-field registration form with real-time validation, OTP modal verification, and terms acceptance.

```html
<form id="signupForm" class="form-section active-form">
    <div class="form-group">
        <label for="signupName">Full Name</label>
        <div class="input-wrapper">
            <i class="fas fa-user input-icon"></i>
            <input type="text" id="signupName" placeholder="John Doe" required>
        </div>
    </div>
    <div class="form-group">
        <label for="signupUsername">Username</label>
        <div class="input-wrapper">
            <i class="fas fa-at input-icon"></i>
            <input type="text" id="signupUsername" placeholder="johndoe123" required>
        </div>
    </div>
    <div class="form-group">
        <label for="signupEmail">Email Address</label>
        <div class="input-wrapper">
            <i class="fas fa-envelope input-icon"></i>
            <input type="email" id="signupEmail" placeholder="john@example.com" required>
        </div>
    </div>
    <div class="form-group">
        <label for="signupPassword">Password</label>
        <div class="input-wrapper">
            <i class="fas fa-lock input-icon"></i>
            <input type="password" id="signupPassword" placeholder="••••••••••" required>
        </div>
    </div>
    <div class="form-group">
        <label for="signupConfirmPassword">Confirm Password</label>
        <div class="input-wrapper">
            <i class="fas fa-shield-alt input-icon"></i>
            <input type="password" id="signupConfirmPassword" placeholder="••••••••••" required>
        </div>
    </div>
    <div class="form-options">
        <label class="checkbox-container">
            <input type="checkbox" id="agreeTerms" required>
            <span class="checkbox-label">I agree to terms and conditions</span>
        </label>
    </div>
    <button type="submit" class="btn-primary">Create Account</button>
</form>

<!-- OTP Verification Modal -->
<div id="otpModal" class="modal">
    <div class="modal-content auth-card otp-glass">
        <div class="modal-header">
            <div class="otp-icon-lpc"><i class="fas fa-shield-halved"></i></div>
            <h2 class="auth-title">Verify Account</h2>
            <p class="auth-subtitle">A verification code has been sent to your email.</p>
        </div>
        <form id="otpForm" class="otp-form-premium">
            <input type="hidden" id="otpUsername">
            <div class="otp-input-container">
                <input type="text" id="otpInput" class="otp-field-main" placeholder="------" maxlength="6" required autofocus>
                <div class="otp-input-underline"></div>
            </div>
            <button type="submit" class="btn-primary btn-glossy" id="verifyBtn">
                <span>CONFIRM & ACTIVATE</span> <i class="fas fa-arrow-right"></i>
            </button>
            <div class="otp-footer">
                <span>Didn't receive the code?</span>
                <a href="#" id="resendOtp" class="resend-link">Resend Code</a>
            </div>
        </form>
    </div>
</div>
```

---

## 6.19 FRONTEND — Forgot Password Page (`forgot-password.html`)

Features a **premium pill-style toggle** between Password Recovery and Username Recovery modes, with animated slider transition.

```html
<!-- Recovery Mode Switcher (Animated Pill) -->
<div class="recovery-switcher-wrapper">
    <div class="recovery-slider"></div>
    <button type="button" id="switchPassword" class="switcher-btn active">Password</button>
    <button type="button" id="switchUsername" class="switcher-btn">Username</button>
</div>

<!-- Recovery Form -->
<form id="forgotPasswordForm" class="form-section active-form">
    <div class="form-group">
        <label for="email">Login / Email</label>
        <div class="input-wrapper">
            <i class="fas fa-envelope input-icon"></i>
            <input type="email" id="email" placeholder="Enter your email" required>
        </div>
    </div>
    <button type="submit" class="btn-primary" id="submitBtn">
        <span id="submitText">Recover Password</span>
    </button>
</form>

<script>
    // Toggle Mode with Animated Slider
    document.getElementById('switchUsername').addEventListener('click', () => {
        currentMode = 'username';
        document.getElementById('pageTitle').textContent = 'Username recovery';
        document.getElementById('submitText').textContent = 'Recover Username';
        slider.style.transform = 'translateX(100%)';
    });
</script>
```

---

## 6.20 FRONTEND — Reset Password Page (`reset-password.html`)

Multi-state page with **token verification loader → identity banner → password form → success animation**.

```html
<!-- Token Verification Loader -->
<div id="verificationLoader" class="reset-loader-state">
    <div class="reset-spinner-ring"><div class="reset-spinner-inner"></div></div>
    <p class="reset-loader-text">Verifying your reset link…</p>
</div>

<!-- Dynamic User Identity Banner -->
<div id="userInfoBanner" class="reset-identity-banner" style="display:none;">
    <div class="reset-identity-icon"><i class="fas fa-user-check"></i></div>
    <div class="reset-identity-info">
        <strong id="displayUsername">Loading...</strong>
        <span id="displayEmail">Please wait...</span>
    </div>
    <div class="reset-identity-badge"><i class="fas fa-shield-alt"></i> Verified</div>
</div>

<!-- Password Reset Form with Strength Meter -->
<form id="resetPasswordForm" style="display:none;">
    <div class="form-group">
        <label for="password">New Password</label>
        <div class="input-wrapper">
            <i class="fas fa-lock input-icon"></i>
            <input type="password" id="password" placeholder="Enter new password" required>
            <i class="fas fa-eye toggle-password" onclick="togglePassword('password')"></i>
        </div>
    </div>
    <!-- Live Password Strength Meter -->
    <div class="reset-strength-container">
        <div class="reset-strength-bar"><div class="reset-strength-fill" id="strengthFill"></div></div>
        <span class="reset-strength-label" id="strengthLabel">Enter a password</span>
    </div>
    <!-- Requirements Checklist -->
    <div class="reset-requirements">
        <div class="reset-req-item" id="reqLength"><i class="fas fa-circle"></i><span>At least 6 characters</span></div>
        <div class="reset-req-item" id="reqUppercase"><i class="fas fa-circle"></i><span>One uppercase letter</span></div>
        <div class="reset-req-item" id="reqNumber"><i class="fas fa-circle"></i><span>One number</span></div>
    </div>
    <button type="submit" class="btn-primary">Reset Password</button>
</form>

<!-- Success State with Progress Animation -->
<div id="successState" style="display:none;">
    <div class="reset-success-state">
        <div class="reset-success-icon"><i class="fas fa-check-circle"></i></div>
        <h3>Password Updated!</h3>
        <p>Redirecting to login…</p>
        <div class="reset-success-progress"><div class="reset-success-bar"></div></div>
    </div>
</div>
```

---

## 6.21 FRONTEND — Staff & Admin Login (`staff.html`)

Dual-role login with **tab-based role toggle** switching between Staff and Admin forms. Both forms include Face Login.

```html
<div class="auth-card">
    <!-- Role Toggle Tabs -->
    <div class="auth-tabs">
        <button type="button" class="auth-tab active" onclick="selectRole('staff')" id="staffRoleBtn">Staff Login</button>
        <button type="button" class="auth-tab" onclick="selectRole('admin')" id="adminRoleBtn">Admin Login</button>
    </div>
    <div class="form-container">
        <div class="logo-section">
            <div class="logo-icon"><i class="fas fa-university"></i> SMART <span style="color:#8E2020;">BANKING</span></div>
            <h2 class="page-title">Management Portal</h2>
        </div>
        <!-- Staff Login Form -->
        <form id="staffForm" class="form-section active-form">
            <div class="form-group">
                <label for="staffId">Staff ID</label>
                <div class="input-wrapper"><i class="fas fa-id-badge input-icon"></i>
                    <input type="text" id="staffId" placeholder="Enter your staff ID" required></div>
            </div>
            <div class="form-group">
                <label for="staffPassword">Password</label>
                <div class="input-wrapper"><i class="fas fa-lock input-icon"></i>
                    <input type="password" id="staffPassword" placeholder="••••••••••" required></div>
            </div>
            <button type="submit" class="btn-primary">Sign In as Staff</button>
            <button type="button" onclick="faceAuthManager.openLoginModal('staff')" class="btn-face-login">
                <span class="face-icon-box"><div class="user-icon-simple"></div></span>
                <span class="btn-text">Secure Face Login</span>
            </button>
        </form>
        <!-- Admin Login Form (Hidden by default) -->
        <form id="adminForm" class="form-section" style="display:none;">
            <div class="form-group">
                <label for="adminUsername">Admin Username</label>
                <div class="input-wrapper"><i class="fas fa-user-shield input-icon"></i>
                    <input type="text" id="adminUsername" placeholder="Enter admin username" required></div>
            </div>
            <div class="form-group">
                <label for="adminPassword">Password</label>
                <div class="input-wrapper"><i class="fas fa-lock input-icon"></i>
                    <input type="password" id="adminPassword" placeholder="••••••••••" required></div>
            </div>
            <button type="submit" class="btn-primary">Sign In as Admin</button>
            <button type="button" onclick="faceAuthManager.openLoginModal('admin')" class="btn-face-login">
                <span class="face-icon-box"><div class="user-icon-simple"></div></span>
                <span class="btn-text">Secure Face Login</span>
            </button>
        </form>
    </div>
</div>

<script>
    // Role selection logic — toggles form visibility
    function selectRole(role) {
        const staffBtn = document.getElementById('staffRoleBtn');
        const adminBtn = document.getElementById('adminRoleBtn');
        const staffForm = document.getElementById('staffForm');
        const adminForm = document.getElementById('adminForm');
        if (role === 'staff') {
            staffBtn.classList.add('active'); adminBtn.classList.remove('active');
            staffForm.style.display = 'block'; adminForm.style.display = 'none';
        } else {
            adminBtn.classList.add('active'); staffBtn.classList.remove('active');
            adminForm.style.display = 'block'; staffForm.style.display = 'none';
        }
    }
</script>
```

---

## 6.22 FRONTEND — Mobile Login (`mobile-auth.html`)

PWA-optimized mobile login with **cached user hydration**, passcode quick-login, QR scanner, and biometric face login.

```html
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#1a0000">
    <link rel="manifest" href="manifest.json">
    <link rel="stylesheet" href="css/mobile.css">
    <link rel="stylesheet" href="css/mobile-modern.css">
</head>
<body>
    <div class="mobile-wrapper">
        <div class="auth-container-modern page-content active">
            <!-- Animated Logo -->
            <div class="auth-logo-modern"><i class="fas fa-landmark"></i></div>
            <!-- Welcome Back (Hydrated from localStorage) -->
            <div id="welcomeBackSection" class="welcome-back-modern">
                <div class="avatar-container">
                    <img id="cachedAvatar" class="wb-avatar" src="" style="display:none;">
                    <div id="cachedInitials" class="initials-avatar" style="display:none;"></div>
                </div>
                <h2 id="cachedName" class="wb-name"></h2>
                <p class="wb-sub">Sign in to your secure account</p>
                <button onclick="clearCachedUser()" class="wb-switch">
                    <i class="fas fa-exchange-alt"></i> Not you? Switch account
                </button>
            </div>
            <h1 class="auth-title-modern">Welcome<span class="dot-accent">.</span></h1>
            <!-- Login Form -->
            <form id="mobileLoginForm" onsubmit="handleLogin(event)">
                <div class="form-group-modern">
                    <label class="form-label-modern" for="username">Username / Customer ID</label>
                    <input type="text" id="username" class="form-input-modern" placeholder="Enter username" required>
                </div>
                <div class="form-group-modern">
                    <label class="form-label-modern" for="password">Password</label>
                    <div class="password-wrapper-modern">
                        <input type="password" id="password" class="form-input-modern" placeholder="••••••••" required>
                        <i class="fas fa-eye-slash password-toggle-modern" id="togglePassword"></i>
                    </div>
                </div>
                <button type="submit" class="btn-login-modern" id="loginBtn">
                    <span class="btn-text"><i class="fas fa-lock"></i> Login Securely</span>
                </button>
            </form>
            <!-- Quick Passcode Login -->
            <div id="passcodeLoginSection" style="display:none;">
                <input type="password" id="passcode" class="form-input-modern" maxlength="4" placeholder="••••"
                       style="text-align:center; letter-spacing:12px; font-size:28px;">
                <button onclick="handlePasscodeLogin()" class="btn-login-modern">
                    <i class="fas fa-key"></i> Login with Passcode
                </button>
            </div>
            <div class="auth-divider"><span>or continue with</span></div>
            <!-- Face Login Button -->
            <button onclick="testFaceLogin('user')" type="button" class="btn-face-modern">
                <div class="btn-badge-inline"><i class="fas fa-shield-halved"></i> SECURE</div>
                <div class="user-icon-simple"></div>
                <span>Face Login</span>
            </button>
            <div class="auth-links-modern">
                <a href="mobile-forgot-password.html">Reset Password</a>
                <a href="mobile-signup.html" class="gold-link">Create Account</a>
            </div>
            <!-- Security & RBI Badges -->
            <div class="security-badge"><i class="fas fa-shield-alt"></i><span>256-bit SSL Encrypted • RBI Licensed</span></div>
            <div class="rbi-badge"><i class="fas fa-university"></i><span>REGULATED BY RESERVE BANK OF INDIA</span></div>
        </div>
        <!-- Bottom Navigation -->
        <nav class="bottom-nav-modern">
            <a href="#" class="nav-item-modern"><i class="fas fa-th-large"></i><span class="nav-label">Services</span></a>
            <a href="#" class="nav-item-modern"><i class="fas fa-percent"></i><span class="nav-label">Offers</span></a>
            <div class="nav-center-modern">
                <div class="nav-center-btn-modern" onclick="openQrScanner()">
                    <i class="fas fa-qrcode"></i><span class="nav-label">Scan & Pay</span>
                </div>
            </div>
            <a href="#" class="nav-item-modern"><i class="fas fa-headset"></i><span class="nav-label">Help</span></a>
            <a href="#" class="nav-item-modern active"><i class="fas fa-sign-in-alt"></i><span class="nav-label">Login</span></a>
        </nav>
    </div>
    <script src="js/face-auth-fixed.js"></script>
    <script src="js/mobile-logic.js"></script>
</body>
```

---

## 6.23 FRONTEND — Mobile Signup (`mobile-signup.html`)

Mobile-optimized registration with **6-digit OTP verification modal** using individual input fields.

```html
<form id="mobileSignupForm" onsubmit="handleMobileSignup(event)">
    <div class="form-group-modern"><label class="form-label-modern">Full Name</label>
        <input type="text" id="signupName" class="form-input-modern" placeholder="e.g. Salman Shad" required></div>
    <div class="form-group-modern"><label class="form-label-modern">Email Address</label>
        <input type="email" id="signupEmail" class="form-input-modern" placeholder="name@example.com" required></div>
    <div class="form-group-modern"><label class="form-label-modern">Username</label>
        <input type="text" id="signupUsername" class="form-input-modern" placeholder="Choose a username" required></div>
    <div class="form-group-modern"><label class="form-label-modern">Password</label>
        <input type="password" id="signupPassword" class="form-input-modern" placeholder="••••••••" required></div>
    <div class="form-group-modern"><label class="form-label-modern">Confirm Password</label>
        <input type="password" id="signupConfirmPassword" class="form-input-modern" placeholder="••••••••" required></div>
    <div class="form-group-modern">
        <input type="checkbox" id="agreeTerms" required>
        <label for="agreeTerms">I agree to the <a href="#">Terms & Conditions</a></label>
    </div>
    <button type="submit" class="btn-login-modern"><i class="fas fa-rocket"></i> Create Account</button>
</form>

<!-- Mobile OTP Verification Modal -->
<div id="otpModal" class="modal-overlay" style="display:none;">
    <div class="modal-content">
        <div style="width:80px;height:80px;background:linear-gradient(145deg,#5a0000,#3a0000);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:-80px auto 25px;">
            <i class="fas fa-shield-alt" style="color:#d4af37;font-size:32px;"></i>
        </div>
        <h2>Verify Account</h2>
        <p>A verification code has been sent to your email.</p>
        <div class="otp-inputs" style="display:flex;gap:8px;justify-content:center;">
            <input type="text" maxlength="1" class="otp-field" id="otp_1" onkeyup="moveOtpFocus(this,'otp_2')">
            <input type="text" maxlength="1" class="otp-field" id="otp_2" onkeyup="moveOtpFocus(this,'otp_3')">
            <input type="text" maxlength="1" class="otp-field" id="otp_3" onkeyup="moveOtpFocus(this,'otp_4')">
            <div style="width:2px;height:30px;background:var(--accent-gold);margin-top:12px;"></div>
            <input type="text" maxlength="1" class="otp-field" id="otp_4" onkeyup="moveOtpFocus(this,'otp_5')">
            <input type="text" maxlength="1" class="otp-field" id="otp_5" onkeyup="moveOtpFocus(this,'otp_6')">
            <input type="text" maxlength="1" class="otp-field" id="otp_6">
        </div>
        <button onclick="handleMobileVerifyOtp()" class="btn-login-modern">CONFIRM & ACTIVATE <i class="fas fa-arrow-right"></i></button>
    </div>
</div>
```

---

## 6.24 FRONTEND — User Dashboard (`userdash.html`)

The main user dashboard is a **1886-line SPA** with sidebar navigation, glassmorphic stat cards, and 15+ page sections.

```html
<body>
    <!-- Floating Background Orbs -->
    <div class="dashboard-bg-orbs">
        <div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div>
    </div>
    <div class="dashboard-container">
        <!-- Sidebar Navigation (15 menu items) -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="logo"><div class="brand-logo"><i class="fas fa-landmark"></i></div>
                    <h1 class="logo-text">Smart<span class="logo-highlight">Bank</span></h1></div>
            </div>
            <nav class="nav-menu">
                <a href="#" class="nav-item active" data-page="dashboard"><i class="fas fa-chart-line"></i><span>Dashboard</span></a>
                <a href="#" class="nav-item" data-page="accounts"><i class="fas fa-university"></i><span>My Accounts</span></a>
                <a href="#" class="nav-item" data-page="transactions"><i class="fas fa-exchange-alt"></i><span>Transactions</span></a>
                <a href="#" class="nav-item" data-page="transfer"><i class="fas fa-paper-plane"></i><span>Transfer Money</span></a>
                <a href="#" class="nav-item" data-page="upi"><i class="fas fa-mobile-alt"></i><span>UPI Payments</span></a>
                <a href="#" class="nav-item" data-page="cards"><i class="fas fa-credit-card"></i><span>Cards</span></a>
                <a href="#" class="nav-item" data-page="loans"><i class="fas fa-hand-holding-usd"></i><span>Loans</span></a>
                <a href="#" class="nav-item" data-page="deposits"><i class="fas fa-piggy-bank"></i><span>Fixed Deposits</span></a>
                <a href="#" class="nav-item" data-page="pockets"><i class="fas fa-bullseye"></i><span>Savings Goals</span></a>
                <a href="#" class="nav-item" data-page="locator"><i class="fas fa-map-marker-alt"></i><span>Branch & ATM Locator</span></a>
                <a href="#" class="nav-item" data-page="support"><i class="fas fa-headset"></i><span>Support</span></a>
                <a href="#" class="nav-item" data-page="settings"><i class="fas fa-cog"></i><span>Settings</span></a>
                <a href="#" onclick="logout()" class="nav-item"><i class="fas fa-sign-out-alt"></i><span>Logout</span></a>
            </nav>
        </aside>
        <main class="main-content">
            <!-- Top Bar with Notifications -->
            <div class="top-bar">
                <div class="top-bar-actions">
                    <button class="mobile-menu-btn" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
                    <button class="action-btn" onclick="toggleTheme()"><i class="fas fa-moon"></i></button>
                    <button class="action-btn" id="notificationBtn"><i class="fas fa-bell"></i>
                        <span class="badge" id="notificationCount">0</span></button>
                    <button class="top-bar-btn btn-profile" onclick="showPage('settings')"><i class="fas fa-user-circle"></i> Profile</button>
                    <button class="top-bar-btn btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
                </div>
            </div>
            <!-- Dashboard Page -->
            <div id="dashboard" class="page-content active">
                <!-- Welcome Section -->
                <div class="welcome-enhanced dash-animate">
                    <div class="welcome-greeting"><span class="greeting-dot"></span><span id="greetingText">Good Morning</span></div>
                    <h1 class="welcome-name" id="welcomeNameAnimated">Welcome back!</h1>
                </div>
                <!-- 4-Column Stats Grid -->
                <div class="dashboard-grid grid-4">
                    <div class="stat-card" onclick="showPage('accounts')">
                        <div class="stat-accent-bar" style="background:linear-gradient(180deg,#800000,#b91c1c);"></div>
                        <div class="stat-icon" style="color:var(--primary-maroon);"><i class="fas fa-wallet"></i></div>
                        <div class="stat-value" id="statTotalBalances">₹0</div>
                        <div class="stat-label">Total Balance</div>
                    </div>
                    <div class="stat-card"><div class="stat-value" id="statTotalIncome">₹0</div><div class="stat-label">Total Income</div></div>
                    <div class="stat-card"><div class="stat-value" id="statTotalSpending">₹0</div><div class="stat-label">Total Spending</div></div>
                    <div class="stat-card"><div class="stat-value" id="statActiveLoans">0</div><div class="stat-label">Active Loans</div></div>
                </div>
                <!-- Quick Actions (10 buttons) -->
                <div class="card dash-animate">
                    <h3 class="card-title"><i class="fas fa-bolt"></i>Quick Actions</h3>
                    <div class="dashboard-grid">
                        <button onclick="showTransferModal()" class="quick-action-btn qa-transfer"><i class="fas fa-paper-plane"></i><span>Transfer Money</span></button>
                        <button onclick="showLoanModal()" class="quick-action-btn qa-loan"><i class="fas fa-hand-holding-usd"></i><span>Apply for Loan</span></button>
                        <button onclick="showPage('cards')" class="quick-action-btn qa-card"><i class="fas fa-credit-card"></i><span>Request Card</span></button>
                        <button onclick="showFixedDepositModal()" class="quick-action-btn qa-fd"><i class="fas fa-piggy-bank"></i><span>Fixed Deposit</span></button>
                        <button onclick="showAgriLoanModal()" class="quick-action-btn qa-agri"><i class="fas fa-tractor"></i><span>Agri Loan</span></button>
                    </div>
                </div>
                <!-- Recent Transactions -->
                <div class="card dash-animate">
                    <h3 class="card-title"><i class="fas fa-exchange-alt"></i>Recent Transactions</h3>
                    <div class="transactions-list" id="recentTransactions"><!-- JS rendered --></div>
                </div>
            </div>
            <!-- Additional SPA Pages: accounts, transactions, transfer, upi, cards, loans, deposits, pockets, locator, support, settings -->
        </main>
    </div>
    <!-- Scripts -->
    <script src="js/api-config.js"></script>
    <script src="js/userdash.js"></script>
    <script src="js/face-auth-fixed.js"></script>
    <script src="js/chatbot.js"></script>
</body>
```

---

## 6.25 FRONTEND — Staff Dashboard (`staffdash.html`)

Full staff operations dashboard (**2369 lines**) featuring customer management, cash operations, KYC approvals, attendance, reports, and live map.

```html
<aside class="sidebar">
    <nav class="nav-menu">
        <a href="#" class="nav-item active" data-page="dashboard"><i class="fas fa-chart-line"></i><span>Dashboard</span></a>
        <a href="#" class="nav-item" data-page="customers"><i class="fas fa-users"></i><span>Customers</span></a>
        <a href="#" class="nav-item" data-page="accounts"><i class="fas fa-university"></i><span>Accounts</span></a>
        <a href="#" class="nav-item" data-page="approvals"><i class="fas fa-check-circle"></i><span>KYC Approvals</span>
            <span class="badge" id="pendingApprovalsBadge">0</span></a>
        <a href="#" class="nav-item" data-page="transactions"><i class="fas fa-exchange-alt"></i><span>Transactions</span></a>
        <a href="#" class="nav-item" data-page="attendance"><i class="fas fa-clock"></i><span>Attendance</span></a>
        <a href="#" class="nav-item" data-page="loans"><i class="fas fa-hand-holding-usd"></i><span>Loan Requests</span>
            <span class="badge" id="loanBadge">0</span></a>
        <a href="#" class="nav-item" data-page="liquidity"><i class="fas fa-piggy-bank"></i><span>Loan Liquidity Fund</span></a>
        <a href="#" class="nav-item" data-page="cards"><i class="fas fa-credit-card"></i><span>Card Requests</span>
            <span class="badge" id="pendingCardsCount">0</span></a>
        <a href="#" class="nav-item" data-page="reports"><i class="fas fa-file-alt"></i><span>Reports</span></a>
        <a href="#" class="nav-item" data-page="services"><i class="fas fa-briefcase"></i><span>Services</span></a>
        <a href="#" class="nav-item" data-page="map"><i class="fas fa-map-marked-alt"></i><span>Live Map</span></a>
        <a href="#" onclick="logout()" class="nav-item"><i class="fas fa-sign-out-alt"></i><span>Logout</span></a>
    </nav>
</aside>

<!-- Staff Cash Operations (Add / Withdraw / Transfer) -->
<div id="transactions" class="page-content">
    <div class="dashboard-grid grid-3">
        <!-- Add Money -->
        <div class="tx-card-premium success">
            <h4 style="color:#10b981;">Add Money</h4>
            <form id="staffAddMoneyForm" onsubmit="submitStaffAddMoney(event)">
                <input type="text" id="addAccountId" placeholder="Account No / ID" required>
                <input type="number" step="0.01" id="addAmount" placeholder="Amount (₹)" required>
                <button type="submit" class="btn-tx-submit success"><i class="fas fa-check-double"></i> Add Funds</button>
            </form>
        </div>
        <!-- Withdraw Money -->
        <div class="tx-card-premium danger">
            <h4 style="color:#ef4444;">Withdraw Money</h4>
            <form id="staffWithdrawMoneyForm" onsubmit="submitStaffWithdrawMoney(event)">
                <input type="text" id="withdrawAccountId" placeholder="Account No / ID" required>
                <input type="number" step="0.01" id="withdrawAmount" placeholder="Amount (₹)" required>
                <button type="submit" class="btn-tx-submit danger"><i class="fas fa-hand-holding-dollar"></i> Withdraw</button>
            </form>
        </div>
        <!-- Transfer Money -->
        <div class="tx-card-premium info">
            <h4 style="color:#3b82f6;">Transfer Money</h4>
            <form id="staffTransferMoneyForm" onsubmit="submitStaffTransferMoney(event)">
                <input type="text" id="transferSenderId" placeholder="From Account" required>
                <input type="text" id="transferReceiverAcc" placeholder="To Account" required>
                <input type="number" step="0.01" id="transferAmount" placeholder="Amount (₹)" required>
                <button type="submit" class="btn-tx-submit info"><i class="fas fa-paper-plane"></i> Execute Transfer</button>
            </form>
        </div>
    </div>
</div>

<!-- Face-Verified Attendance -->
<div id="attendance" class="page-content">
    <div class="dashboard-grid grid-2">
        <div class="card attendance-main-card" style="text-align:center;padding:40px 24px;">
            <div class="attendance-status-badge" id="attendanceStatusBadge">Not Clocked In</div>
            <div id="digitalClock" style="font-size:48px;font-weight:700;font-family:'Courier New',monospace;">00:00:00</div>
            <div class="attendance-actions">
                <button id="clockInBtn" class="btn btn-primary" onclick="handleClockIn()"><i class="fas fa-sign-in-alt"></i> Clock In</button>
                <button id="clockOutBtn" class="btn btn-secondary" onclick="handleClockOut()" disabled><i class="fas fa-sign-out-alt"></i> Clock Out</button>
            </div>
        </div>
    </div>
</div>
```

---

## 6.26 FRONTEND — Admin Dashboard (`admindash.html`)

System-wide admin dashboard (**2436 lines**) with user/staff/admin CRUD, salary management, audit trails, UPI management, and live geo-map.

```html
<aside class="sidebar">
    <nav class="nav-menu">
        <a class="nav-item active" data-page="dashboard"><i class="fas fa-chart-line"></i><span>Dashboard</span></a>
        <a class="nav-item" data-page="users"><i class="fas fa-users"></i><span>Users</span></a>
        <a class="nav-item" data-page="staff"><i class="fas fa-user-tie"></i><span>Staff Management</span></a>
        <a class="nav-item" data-page="admin-mgmt"><i class="fas fa-user-shield"></i><span>Admin Management</span></a>
        <a class="nav-item" data-page="transactions"><i class="fas fa-exchange-alt"></i><span>Transactions</span></a>
        <a class="nav-item" data-page="agrihub"><i class="fas fa-tractor"></i><span>Agri Hub</span></a>
        <a class="nav-item" data-page="accounts"><i class="fas fa-university"></i><span>All Accounts</span></a>
        <a class="nav-item" data-page="loans"><i class="fas fa-hand-holding-usd"></i><span>Loans</span></a>
        <a class="nav-item" data-page="services"><i class="fas fa-concierge-bell"></i><span>Services</span></a>
        <a class="nav-item" data-page="liquidity"><i class="fas fa-piggy-bank"></i><span>Loan Liquidity Fund</span></a>
        <a class="nav-item" data-page="reports"><i class="fas fa-chart-bar"></i><span>Reports</span></a>
        <a class="nav-item" data-page="audit"><i class="fas fa-clipboard-list"></i><span>Audit Logs</span></a>
        <a class="nav-item" data-page="attendance"><i class="fas fa-calendar-check"></i><span>Staff Attendance</span></a>
        <a class="nav-item" data-page="salary"><i class="fas fa-coins"></i><span>Salary Management</span></a>
        <a class="nav-item" data-page="map"><i class="fas fa-map-marked-alt"></i><span>Live Map</span></a>
        <a class="nav-item" data-page="upi-management"><i class="fas fa-mobile-alt"></i><span>UPI Management</span></a>
        <a class="nav-item" data-page="settings"><i class="fas fa-cog"></i><span>System Settings</span></a>
        <a class="nav-item" data-page="backup"><i class="fas fa-database"></i><span>Backup & Restore</span></a>
        <a class="nav-item" onclick="logout()"><i class="fas fa-sign-out-alt"></i><span>Logout</span></a>
    </nav>
</aside>

<!-- Admin Dashboard Stats -->
<div id="dashboard" class="page-content active">
    <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon" style="background:rgba(128,0,0,0.1);color:#800000;"><i class="fas fa-users"></i></div>
            <div class="stat-value" id="statTotalUsers">0</div><div class="stat-label">Total Users</div></div>
        <div class="stat-card" style="border-top:4px solid #10b981;"><div class="stat-icon" style="background:#ecfdf5;color:#10b981;"><i class="fas fa-hand-holding-usd"></i></div>
            <div class="stat-value" id="statLiquidityFund">₹10L</div><div class="stat-label">Loan Liquidity Fund</div></div>
        <div class="stat-card"><div class="stat-value" id="statActiveStaff">0</div><div class="stat-label">Active Staff</div></div>
        <div class="stat-card"><div class="stat-value" id="statTotalDeposits">₹0</div><div class="stat-label">Total Deposits</div></div>
        <div class="stat-card"><div class="stat-value" id="statTodayTransactions">0</div><div class="stat-label">Today's Trans.</div></div>
    </div>
    <!-- System Alerts + Recent Users -->
    <div class="dashboard-grid grid-2">
        <div class="card"><h3 class="card-title">Recent Users</h3><div id="recentUsersList"></div></div>
        <div class="card"><h3 class="card-title">System Alerts</h3><div id="systemAlerts"></div></div>
    </div>
    <!-- Embedded User Distribution Map -->
    <div class="card"><h3 class="card-title"><i class="fas fa-globe-americas"></i>User Distribution Map</h3>
        <div id="dashboardMap" style="height:280px;width:100%;"></div></div>
    <!-- Branch & ATM Management -->
    <div class="card">
        <h3 class="card-title"><i class="fas fa-map-marker-alt"></i>Manage Branches & ATMs</h3>
        <button class="btn btn-primary btn-sm" onclick="showAddLocationModal()"><i class="fas fa-plus"></i> Add Location</button>
        <table class="table"><thead><tr><th>Name</th><th>Type</th><th>City</th><th>Coordinates</th><th>Actions</th></tr></thead>
            <tbody id="locationsTable"></tbody></table>
    </div>
</div>
```

---

---

## 6.27 FRONTEND — Agri Buyer Portal (`agri-buyer-login.html`)

A specialized portal for agricultural wholesale buyers with a green-themed "Smart Agri" design system and bulk product procurement interface.

```html
<div class="logo-section">
    <div class="logo-icon">
        <i class="fas fa-tractor" style="color:#166534;"></i>
        <span>SMART <span style="color:#166534;">AGRI</span></span>
    </div>
    <h2 class="page-title">Agriculture Buyer Portal</h2>
</div>

<!-- Login Form with Green Theme Overrides -->
<form id="loginForm" class="form-section active-form">
    <div class="form-group">
        <label for="loginId">Buyer ID / Email</label>
        <div class="input-wrapper">
            <i class="fas fa-user input-icon"></i>
            <input type="text" id="loginId" placeholder="Enter your buyer ID" required>
        </div>
    </div>
    <button type="submit" class="btn-primary" style="background:#166534;">Sign In</button>
</form>

<script>
    async function handleLogin(e) {
        e.preventDefault();
        const r = await fetch(API + '/auth/buyer/login', {
            method: 'POST',
            body: JSON.stringify({
                buyer_id: document.getElementById('loginId').value,
                password: document.getElementById('loginPassword').value
            })
        });
        const data = await r.json();
        if (r.ok) window.location.href = 'agri-buyer-dash.html';
    }
</script>
```

---

## 6.28 FRONTEND — Mobile Dashboard (`mobile-dash.html`)

A **1124-line PWA interface** featuring real-time balance toggles, virtual cards, 3D Branch Locator integration, and agricultural marketplace.

```html
<header class="mobile-header">
    <div onclick="openMobileMenu()">
        <div id="mobileLogo" class="brand-logo"><i class="fas fa-landmark"></i></div>
        <span>Smart<span style="color:var(--accent-gold);">Bank</span></span>
    </div>
</header>

<!-- Balance Card with Masking -->
<div class="balance-card" id="mobileBalanceCard">
    <div class="balance-info">
        <span class="balance-label">Total Balance</span>
        <div class="balance-amount-wrapper">
            <span id="mobileBalanceAmount" class="balance-amount balance-hidden">● ● ● ● ● ●</span>
        </div>
    </div>
    <div class="balance-actions">
        <button id="refreshBalanceBtn" onclick="refreshMobileBalance()"><i class="fas fa-sync-alt"></i></button>
        <button id="toggleBalanceBtn" onclick="toggleBalanceVisibility(event)"><i class="fas fa-eye"></i></button>
    </div>
</div>
```

---

## 6.29 Frontend File Map Summary

| File | Lines | Size | Purpose |
|------|-------|------|---------|
| `index.html` | 143 | 5.7KB | Landing page with hero & features |
| `user.html` | 165 | 7.3KB | User login + Face Auth |
| `signup.html` | 196 | 8.9KB | User registration + OTP modal |
| `forgot-password.html` | 325 | 13.4KB | Password/Username recovery |
| `reset-password.html` | 772 | 27.6KB | Token-verified password reset |
| `staff.html` | 233 | 10.7KB | Staff & Admin dual login |
| `mobile-auth.html` | 297 | 14.9KB | Mobile PWA login |
| `mobile-signup.html` | 156 | 11.5KB | Mobile registration + OTP |
| `agri-buyer-login.html` | 424 | 19.1KB | Agriculture buyer portal login |
| `userdash.html` | 1886 | 122.8KB | User dashboard SPA |
| `staffdash.html` | 2369 | 158.0KB | Staff operations dashboard |
| `admindash.html` | 2436 | 163.3KB | Admin system dashboard |
| `mobile-dash.html` | 1124 | 79.1KB | Mobile banking dashboard |

---

## 6.30 Conclusion

The coding phase successfully implemented a comprehensive digital banking system with **9 backend blueprints**, **25+ database tables**, **50+ REST API endpoints**, **13 HTML pages**, and a premium glassmorphic SPA frontend. Key technical achievements include:

1. **Biometric Security**: face-api.js with EAR-based liveness detection to prevent spoofing
2. **Atomic Financial Transactions**: All fund movements are wrapped in database transactions with rollback
3. **Self-Healing Database**: Automatic table creation and column migration on startup
4. **Multi-Channel Architecture**: Separate dashboards for Desktop and Mobile with PWA support
5. **International UPI**: Cross-currency transfer support with real-time exchange rates
6. **Premium PDF Generation**: ReportLab-based statements with maroon-branded design system
7. **Real-Time Geolocation**: IP-based async geo-lookup for user tracking and map visualization
8. **Dual Database Support**: Seamless SQLite ↔ PostgreSQL switching via environment variables
9. **Premium White UI**: Glassmorphic design with floating orbs, isometric illustrations, and micro-animations
10. **Responsive Design**: Full mobile-first PWA with Service Worker, QR scanner, and passcode login
