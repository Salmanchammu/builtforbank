from flask import Flask, request, jsonify, session, send_from_directory, g, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from functools import wraps
from datetime import datetime, timedelta
import sqlite3
import secrets
import os
import re
import json
import logging
import random
import socket
import smtplib
import time
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ============================================================
# CONFIGURATION & SETUP
# ============================================================

import mimetypes
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

# Import email config if exists
try:
    from config import email_config
except ImportError:
    email_config = None

# SMS Logic
try:
    from config.sms_config import send_sms
except ImportError:
    def send_sms(p, m): print(f"[MOCK SMS] To: {p}, Msg: {m}"); return True

def send_sms_async(phone, message):
    """Send SMS in a separate thread."""
    if not phone: return
    threading.Thread(target=send_sms, args=(phone, message)).start()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('smart_bank')

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

local_ip = get_local_ip()
app = Flask(__name__)

# Enable CORS with broad support but VALID for credentials (no wildcard '*')
# We allow any localhost port, common dev ports, and private IP patterns
CORS(app, resources={r"/*": {
    "origins": [
        re.compile(r"http://localhost:.*"),
        re.compile(r"http://127\.0\.0\.1:.*"),
        re.compile(r"http://192\.168\..*"),
        re.compile(r"http://10\..*"),
        re.compile(r"http://172\..*"),
        re.compile(r"https://.*\.loca\.lt"),
        re.compile(r"http://.*:3000"),
        re.compile(r"http://.*:5000"),
        re.compile(r"http://.*:5500"),
        re.compile(r"http://.*:8000"),
        re.compile(r"https://.*\.onrender\.com"),  # Render deployment
        re.compile(r"https://.*\.railway\.app"),   # Railway deployment
    ],
    "supports_credentials": True,
    "allow_headers": ["Content-Type", "Bypass-Tunnel-Reminder", "Authorization", "Accept", "X-Requested-With"]
}})

from flask_cors import cross_origin

@app.route('/')
def home():
    # Serve index.html or user.html as fallback
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    if os.path.exists(os.path.join(frontend_dir, 'user.html')):
        return send_file(os.path.join(frontend_dir, 'user.html'))
    return "✅ Smart Bank Backend is RUNNING!"

@app.route('/models/<path:filename>')
def serve_models(filename):
    # Standardize path for Windows - strip any query params Flask might pass
    normalized = filename.split('?')[0].replace('\\', '/').strip('/')
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    model_path = os.path.join(frontend_dir, 'models', normalized)
    
    if os.path.exists(model_path) and os.path.isfile(model_path):
        response = send_file(model_path)
        # Prevent browser from caching stale versions of model shards/manifests
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        return response
    
    logger.error(f"Model file not found: {model_path}")
    return jsonify({'error': 'Model not found', 'path': normalized}), 404

@app.route('/debug')
def debug_paths():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.abspath(os.path.join(base_dir, '..', 'frontend'))
    files = []
    if os.path.exists(frontend_dir):
        files = os.listdir(frontend_dir)
    return jsonify({
        'base_dir': base_dir,
        'frontend_dir': frontend_dir,
        'frontend_exists': os.path.exists(frontend_dir),
        'files': sorted(files),
        'cwd': os.getcwd()
    })

@app.route('/<path:path>')
def serve_static(path):
    # The 'path' parameter from Flask routing does NOT include query parameters like ?v=1
    # However, sometimes Flask routing sends requests with query params directly in the path if they came in strangely
    # The most robust way is to strip anything after '?' just in case
    clean_path = path.split('?')[0].replace('\\', '/')
    
    # Ensure we use an absolute path for the frontend directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.abspath(os.path.join(base_dir, '..', 'frontend'))
    
    file_path = os.path.join(frontend_dir, clean_path)
    
    # Log the request for debugging
    # logger.info(f"Serve static request: {path} -> {file_path}")
    
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(frontend_dir, clean_path)
    
    # Do not serve fallback for assets
    is_asset = any(clean_path.lower().endswith(ext) for ext in 
                  ['.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.map', '.ico'])
    
    if is_asset or clean_path.startswith('models/'):
        logger.error(f"Asset NOT FOUND: {file_path}")
        return jsonify({'error': f'Asset not found: {clean_path}'}), 404
        
    # SPA Fallback for navigation routes
    user_html = os.path.join(frontend_dir, 'user.html')
    if os.path.exists(user_html):
        return send_from_directory(frontend_dir, 'user.html')
    
    return jsonify({'error': 'Not found'}), 404

app.secret_key = 'stable_secret_key_fixed_123' 
app.config['SESSION_COOKIE_NAME'] = 'smart_bank_session'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax' 
app.config['SESSION_COOKIE_SECURE'] = any(os.environ.get(k) for k in ['RENDER', 'RAILWAY_ENVIRONMENT', 'PORT']) or os.environ.get('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)


# Database setup
# Use absolute path to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.abspath(os.path.join(BASE_DIR, '..', 'storage', 'database', 'smart_bank.db'))
FACE_DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'storage', 'face_data'))
os.makedirs(FACE_DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(FACE_DATA_DIR, 'admin'), exist_ok=True)
os.makedirs(os.path.join(FACE_DATA_DIR, 'staff'), exist_ok=True)

# Profile Uploads configuration
UPLOAD_FOLDER = os.path.abspath(os.path.join(BASE_DIR, '..', 'storage', 'uploads'))
PROFILE_PICS_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
os.makedirs(PROFILE_PICS_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db_url = os.environ.get('DATABASE_URL')
        if db_url and db_url.startswith('postgres'):
            # PostgreSQL support for Render
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            # Render provides postgres:// but psycopg2 prefers postgresql://
            if db_url.startswith('postgres://'):
                db_url = db_url.replace('postgres://', 'postgresql://', 1)
            
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            
            # Add a wrapper to make it behave more like sqlite3's shortcut methods
            class PostgresWrapper:
                def __init__(self, conn):
                    self.conn = conn
                def execute(self, sql, params=None):
                    cur = self.conn.cursor(cursor_factory=RealDictCursor)
                    # Convert ? to %s for Postgres
                    sql = sql.replace('?', '%s')
                    # Convert INSERT OR IGNORE to ON CONFLICT DO NOTHING (Postgres style)
                    if 'INSERT OR IGNORE' in sql.upper():
                        sql = sql.upper().replace('INSERT OR IGNORE', 'INSERT') + ' ON CONFLICT DO NOTHING'
                    cur.execute(sql, params)
                    return cur
                def commit(self): pass # autocommit is ON
                def rollback(self): self.conn.rollback()
                def close(self): self.conn.close()
                def fetchone(self): return None # Not used directly on connection
            
            db = g._database = PostgresWrapper(conn)
        else:
            # Standard SQLite
            db = g._database = sqlite3.connect(DATABASE, timeout=30.0)
            db.row_factory = sqlite3.Row
            # Enable WAL (Write Ahead Logging) for better concurrency on Render
            db.execute('PRAGMA journal_mode = WAL')
            # Enable foreign key constraints for cascading deletes
            db.execute('PRAGMA foreign_keys = ON')
    return db

def init_db():
    """Initialize database with schema (Destructive)"""
    with app.app_context():
        db = get_db()
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        if os.path.exists(schema_path):
            logger.info("Initializing database from schema.sql")
            with open(schema_path, 'r') as f:
                schema_sql = f.read()
            
            # Use executescript for SQLite, or manual split for others
            if hasattr(db, 'executescript'):
                db.executescript(schema_sql)
            else:
                # Basic split for Postgres (assumes no complex strings with ;)
                # In production, a proper migration tool is better
                commands = [c.strip() for c in schema_sql.split(';') if c.strip()]
                for cmd in commands:
                    try:
                        db.execute(cmd)
                    except Exception as e:
                        logger.warning(f"Schema init cmd failed: {e}")
            db.commit()
        
        # Run migrations as well to ensure everything is up to date
        migrate_db()

def migrate_db():
    """Apply incremental migrations to existing database (Non-destructive)"""
    with app.app_context():
        db = get_db()
        logger.info("Checking for database migrations...")
        
        # Explicit migration for existing databases
        try:
            db.execute('SELECT 1 FROM service_applications LIMIT 1')
        except sqlite3.OperationalError:
            logger.info("Migrating database: Creating service_applications table")
            db.execute('''
                CREATE TABLE IF NOT EXISTS service_applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    account_id INTEGER,
                    service_type VARCHAR(50) NOT NULL,
                    product_name VARCHAR(100) NOT NULL,
                    amount DECIMAL(15, 2),
                    tenure VARCHAR(50),
                    status VARCHAR(20) DEFAULT 'pending',
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP,
                    rejection_reason TEXT,
                    aadhaar_number VARCHAR(20),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
                )
            ''')
            db.commit()

        # Explicit migration for profile_image column
        try:
            db.execute('SELECT profile_image FROM users LIMIT 1')
        except sqlite3.OperationalError:
            logger.info("Migrating database: Adding profile_image column to users table")
            db.execute('ALTER TABLE users ADD COLUMN profile_image VARCHAR(255)')
            db.commit()

        # Migrate device_type to users, staff, admins
        for table in ['users', 'staff', 'admins']:
            try:
                db.execute(f'SELECT device_type FROM {table} LIMIT 1')
            except sqlite3.OperationalError:
                logger.info(f"Migrating database: Adding device_type column to {table} table")
                db.execute(f'ALTER TABLE {table} ADD COLUMN device_type VARCHAR(50) DEFAULT "unknown"')
                db.commit()

        # Migrate daily_limit to users
        try:
            db.execute('SELECT daily_limit FROM users LIMIT 1')
        except sqlite3.OperationalError:
            logger.info("Migrating database: Adding daily_limit column to users table")
            db.execute('ALTER TABLE users ADD COLUMN daily_limit DECIMAL(15, 2) DEFAULT 200000.00')
            db.commit()

        # Migrate aadhaar_number to service_applications
        try:
            db.execute('SELECT aadhaar_number FROM service_applications LIMIT 1')
        except sqlite3.OperationalError:
            logger.info("Migrating database: Adding aadhaar_number column to service_applications table")
            db.execute('ALTER TABLE service_applications ADD COLUMN aadhaar_number VARCHAR(20)')
            db.commit()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# ============================================================
# MIDDLEWARE & UTILITIES
# ============================================================

@app.before_request
def log_request():
    """Log incoming requests"""
    logger.info(f"{request.method} {request.path} - {request.remote_addr}")

@app.after_request
def log_response(response):
    """Log outgoing responses"""
    logger.info(f"{request.path} - Status: {response.status_code}")
    return response

def log_audit(user_id, user_type, action, details):
    """Log system audit action"""
    try:
        db = get_db()
        ip = request.remote_addr
        db.execute('INSERT INTO system_audit (user_id, user_type, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
                  (user_id, user_type, action, details, ip))
        db.commit()
    except Exception as e:
        logger.error(f"Audit log failed: {e}")

@app.route('/api/health', methods=['GET'])
def health_check():
    """Comprehensive health check endpoint"""
    try:
        db = get_db()
        db.execute('SELECT 1').fetchone()
        db_status = 'connected'
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        db_status = f'error: {str(e)}'
    
    return jsonify({
        'status': 'healthy' if db_status == 'connected' else 'unhealthy',
        'timestamp': datetime.now().isoformat(),
        'database': db_status,
        'version': '2.0'
    })

# Error Handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found', 'path': request.path}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 Internal Error: {str(error)}")
    return jsonify({'error': 'Internal server error', 'message': str(error)}), 500

# Authentication decorators
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
            user_id = session.get('user_id') or session.get('staff_id') or session.get('admin_id')
            
            logger.info(f"Role Check: path={request.path}, session_role={current_role}, user_id={user_id}, expected={role}")
            
            if not current_role or not user_id:
                logger.warning(f"Unauthorized access attempt to {request.path} (No valid session)")
                return jsonify({'error': 'Unauthorized'}), 401
            
            # Convert single role to list for uniform check
            allowed_roles = [role] if isinstance(role, str) else role
            
            if current_role not in allowed_roles:
                logger.warning(f"Forbidden access: role mismatch for {request.path}. Got {current_role}, expected {allowed_roles}")
                return jsonify({'error': 'Forbidden'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def send_email_async(to_email, subject, body_html):
    """Send email in a separate thread to avoid blocking the main request.
    On Render (cloud): Uses Resend API (set RESEND_API_KEY env var) to bypass SMTP restrictions.
    Locally: Falls back to Gmail SMTP.
    """
    def send_task():
        if not email_config or email_config.SENDER_EMAIL == "your-email@gmail.com":
            print(f"\n[DEBUG EMAIL - NOT CONFIGURED]\nTo: {to_email}\nSubject: {subject}\nBody: {body_html[:200]}...\n")
            return

        # Try Resend HTTP API first (works on Render/cloud servers)
        resend_api_key = os.environ.get("RESEND_API_KEY")
        if resend_api_key:
            try:
                import urllib.request as urllib_req
                import json as json_lib
                
                # Use dedicated RESEND_FROM if available, fallback to default SENDER_EMAIL
                resend_sender = getattr(email_config, 'RESEND_FROM', f"Smart Bank <{email_config.SENDER_EMAIL}>")
                
                payload = json_lib.dumps({
                    "from": resend_sender,
                    "to": [to_email],
                    "subject": subject,
                    "html": body_html
                }).encode('utf-8')
                
                req = urllib_req.Request(
                    "https://api.resend.com/emails",
                    data=payload,
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json"
                    }
                )
                
                with urllib_req.urlopen(req, timeout=15) as response:
                    res_body = response.read().decode('utf-8')
                    logger.info(f"Email sent via Resend to {to_email}. Response: {res_body}")
                return
            except Exception as e:
                # Capture and log detailed error from Resend
                error_msg = str(e)
                if hasattr(e, 'read'):
                    try:
                        error_msg += f" - Response: {e.read().decode('utf-8')}"
                    except: pass
                logger.error(f"Resend API failed: {error_msg}. Trying SMTP fallback...")

        # SMTP fallback (works locally, often blocked on cloud servers)
        try:
            msg = MIMEMultipart()
            msg['From'] = email_config.SENDER_EMAIL
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body_html, 'html'))

            use_ssl = getattr(email_config, 'SMTP_USE_SSL', False)
            if use_ssl:
                import ssl
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(email_config.SMTP_SERVER, email_config.SMTP_PORT, context=context) as server:
                    server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(email_config.SMTP_SERVER, email_config.SMTP_PORT) as server:
                    server.starttls()
                    server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                    server.send_message(msg)
            logger.info(f"Email sent via SMTP to {to_email}")
        except Exception as e:
            logger.error(f"SMTP also failed for {to_email}: {str(e)}")
            print(f"\n[EMAIL FAILED]\nError: {str(e)}\nTo: {to_email}\nSubject: {subject}\n")

    threading.Thread(target=send_task).start()

def send_email_diagnostic(to_email, subject, body_html):
    """Synchronous version of send_email for diagnostics. Returns detailed results."""
    results = {"success": False, "resend": None, "smtp": None, "config": None}
    
    if not email_config or email_config.SENDER_EMAIL == "your-email@gmail.com":
        results["config"] = "Email not configured (using default placeholders)"
        return results

    # Try Resend
    resend_api_key = os.environ.get("RESEND_API_KEY")
    if resend_api_key:
        try:
            import urllib.request as urllib_req
            import json as json_lib
            resend_sender = getattr(email_config, 'RESEND_FROM', f"Smart Bank <{email_config.SENDER_EMAIL}>")
            payload = json_lib.dumps({
                "from": resend_sender, 
                "to": [to_email], 
                "subject": subject, 
                "html": body_html
            }).encode('utf-8')
            
            req = urllib_req.Request(
                "https://api.resend.com/emails", 
                data=payload, 
                headers={
                    "Authorization": f"Bearer {resend_api_key}", 
                    "Content-Type": "application/json"
                }
            )
            with urllib_req.urlopen(req, timeout=15) as response:
                res_body = response.read().decode('utf-8')
                results["resend"] = f"Success: {res_body}"
                results["success"] = True
                return results
        except Exception as e:
            error_msg = str(e)
            if hasattr(e, 'read'):
                try: error_msg += f" - Response: {e.read().decode('utf-8')}"
                except: pass
            results["resend"] = f"Error: {error_msg}"

    # Try SMTP
    try:
        msg = MIMEMultipart()
        msg['From'] = email_config.SENDER_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_html, 'html'))
        
        use_ssl = getattr(email_config, 'SMTP_USE_SSL', False)
        if use_ssl:
            import ssl
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(email_config.SMTP_SERVER, email_config.SMTP_PORT, context=context) as server:
                server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(email_config.SMTP_SERVER, email_config.SMTP_PORT) as server:
                server.starttls()
                server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                server.send_message(msg)
        results["smtp"] = "Success"
        results["success"] = True
    except Exception as e:
        results["smtp"] = f"Error: {str(e)}"
        
    return results




# Validation functions
def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, ""

def validate_phone(phone):
    if not phone: return True
    pattern = r'^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$'
    return re.match(pattern, phone) is not None

# ============================================================
# CHATBOT SERVICE (Integrated)
# ============================================================

class BankingChatbot:
    def __init__(self):
        self.intents = {
            'greeting': {'patterns': ['hello', 'hi', 'hey'], 'responses': ["Hello! I'm your Smart Bank AI assistant. How can I help you today?"]},
            'balance': {'patterns': ['balance', 'how much'], 'responses': ["I'll fetch your current account balance."], 'requires_auth': True},
            'transfer': {'patterns': ['transfer', 'send money'], 'responses': ["I can help you transfer money. Proceed to the transfer section?"], 'requires_auth': True},
            'loan': {'patterns': ['loan', 'apply'], 'responses': ["We offer Personal, Home, and Car loans. Would you like to see options?"], 'requires_auth': True},
            'card': {'patterns': ['card', 'credit', 'debit'], 'responses': ["I can help you request a new card. Gold or Platinum?"], 'requires_auth': True},
            'help': {'patterns': ['help', 'support'], 'responses': ["I can help with balance, transfers, loans, and cards. Just ask!"]},
            'thanks': {'patterns': ['thanks', 'thank you'], 'responses': ["You're welcome! Happy to help."]}
        }
    
    def get_response(self, message, user_id=None):
        msg = message.lower()
        for intent, data in self.intents.items():
            for p in data['patterns']:
                if p in msg:
                    if data.get('requires_auth') and not user_id:
                        return "Please log in to access your account details.", intent
                    return random.choice(data['responses']), intent
        return "I'm not sure I understand. Try asking about your balance or loans.", "unknown"

chatbot = BankingChatbot()

# ============================================================
# FACE AUTH HELPER (ADMIN/STAFF ONLY)
# ============================================================

def get_face_encoding(user_id, role):
    try:
        db = get_db()
        table = 'staff' if role == 'staff' else 'admins'
        user = db.execute(f'SELECT face_descriptor FROM {table} WHERE id = ?', (user_id,)).fetchone()
        if user and user['face_descriptor']:
            return json.loads(user['face_descriptor'])
    except Exception as e:
        logger.error(f"Error fetching face encoding from DB: {e}")
    return None

def compare_face_descriptors(d1, d2, threshold=0.5):
    """
    Compare two 128-d face descriptors using Euclidean distance.
    Threshold tightened to 0.5 (was 0.6) for stricter identity matching.
    Also validates descriptor value range to reject non-human inputs.
    """
    try:
        if not d1 or not d2: return False

        # Ensure both are lists
        if isinstance(d1, str): d1 = json.loads(d1)
        if isinstance(d2, str): d2 = json.loads(d2)

        # Both must be 128-dimensional vectors (face-api.js standard)
        if not isinstance(d1, list) or not isinstance(d2, list) or len(d1) != 128 or len(d2) != 128:
            logger.warning("Rejecting invalid face descriptor dimensions")
            return False

        # Sanity check: face-api.js descriptors have values in roughly [-1, 1].
        # Wild outliers suggest the input was not a real face detection.
        for val in d1 + d2:
            if not isinstance(val, (int, float)) or abs(val) > 5.0:
                logger.warning("Rejecting descriptor with out-of-range values (likely non-human input)")
                return False

        # Euclidean distance — lower = more similar
        dist = sum((a - b) ** 2 for a, b in zip(d1, d2)) ** 0.5
        logger.info(f"Face descriptor distance: {dist:.4f} (threshold: {threshold})")
        return dist < threshold
    except Exception as e:
        logger.error(f"Error comparing face descriptors: {e}")
        return False

@app.route('/api/staff/service-applications', methods=['GET'])
@login_required
def get_service_applications():
    """Fetch all service applications for staff/admin dashboard"""
    db = get_db()
    try:
        apps = db.execute('''
            SELECT sa.*, u.name as user_name, u.email as user_email, a.account_number
            FROM service_applications sa
            JOIN users u ON sa.user_id = u.id
            LEFT JOIN accounts a ON sa.account_id = a.id
            ORDER BY sa.applied_at DESC
        ''').fetchall()
        return jsonify({'success': True, 'applications': [dict(row) for row in apps]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/service-applications/<int:app_id>', methods=['PUT'])
@login_required
def update_service_application(app_id):
    """Approve or reject a service application"""
    data = request.json
    action = data.get('action')
    reason = data.get('reason', '').strip()
    
    if action not in ['approve', 'reject']:
        return jsonify({'error': 'Invalid action'}), 400
    
    db = get_db()
    try:
        # Get application details for notification
        app_data = db.execute('''
            SELECT sa.*, u.id as user_id, u.name as user_name 
            FROM service_applications sa
            JOIN users u ON sa.user_id = u.id
            WHERE sa.id = ?
        ''', (app_id,)).fetchone()
        
        if not app_data:
            return jsonify({'error': 'Application not found'}), 404
            
        status = 'approved' if action == 'approve' else 'rejected'
        db.execute('''
            UPDATE service_applications 
            SET status = ?, processed_at = CURRENT_TIMESTAMP, rejection_reason = ? 
            WHERE id = ?
        ''', (status, reason if status == 'rejected' else None, app_id))
        
        # Send Notification to User
        msg_title = f"{app_data['service_type']} Application - {status.capitalize()}"
        if status == 'approved':
            msg_body = f"Congratulations! Your application for {app_data['product_name']} (Ref: #{app_id}) has been approved."
        else:
            msg_body = f"Your application for {app_data['product_name']} (Ref: #{app_id}) was rejected."
            if reason:
                msg_body += f"\nReason: {reason}"
        
        db.execute('''
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, ?)
        ''', (app_data['user_id'], msg_title, msg_body, 'success' if status == 'approved' else 'error'))
        
        db.commit()
        return jsonify({'success': True, 'message': f'Application {status} successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# Face Auth Endpoints removed from here and consolidated below

# ============================================================
# MOBILE INVESTMENT APPLICATION
# ============================================================

@app.route('/api/mobile/apply-investment', methods=['POST'])
@login_required
def mobile_apply_investment():
    """Handle investment/service applications from the mobile dashboard."""
    data = request.json
    user_id = session['user_id']

    product_name = data.get('product_name', '').strip()
    account_number = data.get('account_number', '').strip()
    amount = data.get('amount')
    aadhaar_number = data.get('aadhaar_number', '').strip()

    if not product_name:
        return jsonify({'error': 'Product name is required'}), 400
    if not amount or float(amount) <= 0:
        return jsonify({'error': 'Invalid amount'}), 400
    aadhaar_clean = ''.join(filter(str.isdigit, aadhaar_number))
    if len(aadhaar_clean) != 12:
        return jsonify({'error': 'Invalid Aadhaar number (must be 12 digits)'}), 400

    amount = float(amount)
    tenure = data.get('tenure')

    # Determine service_type from product name
    product_lower = product_name.lower()
    if any(k in product_lower for k in ['fund', 'wealth', 'flexi', 'growth', 'sip']):
        service_type = 'Mutual Fund'
    elif any(k in product_lower for k in ['insurance', 'protect', 'health', 'saver', 'retire', 'term', 'child']):
        service_type = 'Life Insurance'
    elif any(k in product_lower for k in ['gold', 'loan']):
        service_type = 'Gold Loan'
    elif any(k in product_lower for k in ['fd', 'fixed', 'deposit']):
        service_type = 'Fixed Deposit'
    else:
        service_type = 'Investment'

    db = get_db()
    try:
        # Resolve account
        account = db.execute(
            'SELECT * FROM accounts WHERE account_number = ? AND user_id = ?',
            (account_number, user_id)
        ).fetchone()
        if not account:
            return jsonify({'error': 'Account not found or does not belong to you'}), 404

        account_id = account['id']

        # Generate reference
        ref = f"SVC{secrets.token_hex(5).upper()}"

        # Log service application
        db.execute('''
            INSERT INTO service_applications (user_id, service_type, product_name, amount, account_id, status, tenure, aadhaar_number)
            VALUES (?, ?, ?, ?, ?, "pending", ?, ?)
        ''', (user_id, service_type, product_name, amount, account_id, tenure, aadhaar_clean))

        db.commit()

        # Send email notification
        user = db.execute('SELECT name, email FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            subject = f"{service_type} Application Received - Smart Bank"
            body = f"""
            <h3>Smart Bank - {service_type} Application</h3>
            <p>Dear {user['name']},</p>
            <p>We have received your application for <strong>{product_name}</strong>.</p>
            <p><strong>Amount:</strong> ₹{amount:,.2f}</p>
            <p><strong>Reference:</strong> {ref}</p>
            <p>Our team will review and process your application. You will be notified once it is approved.</p>
            """
            send_email_async(user['email'], subject, body)

        return jsonify({
            'success': True,
            'message': f'Your application for {product_name} has been submitted successfully!',
            'reference': ref
        })

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



# ============================================================
# AUTHENTICATION ROUTES
# ============================================================

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    username, email, password, name = data.get('username'), data.get('email'), data.get('password'), data.get('name')
    device_type = data.get('device_type', 'unknown')
    if not all([username, email, password, name]):
        return jsonify({'error': 'Required fields missing'}), 400
    
    db = get_db()
    if db.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone():
        return jsonify({'error': 'Username or email already exists'}), 400
    
    try:
        hashed = generate_password_hash(password)
        # Generate a 6-digit OTP
        otp = str(random.randint(100000, 999999))
        otp_expiry = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor = db.execute('INSERT INTO users (username, password, email, name, status, otp, otp_expiry, device_type) VALUES (?, ?, ?, ?, "pending", ?, ?, ?)',
                           (username, hashed, email, name, otp, otp_expiry, device_type))
        user_id = cursor.lastrowid
        # Removed automatic account creation to support zero initial accounts
        db.commit()

        # Send Welcome Email
        welcome_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #8b0000; text-align: center;">Welcome to Smart Bank!</h2>
                <p>Hello {name},</p>
                <p>Thank you for choosing Smart Bank. Your account has been created, but you need to verify your email to activate it.</p>
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #4b5563;">Your Verification Code:</p>
                    <h1 style="margin: 10px 0; font-size: 32px; color: #8b0000; letter-spacing: 5px;">{otp}</h1>
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">Valid for 10 minutes</p>
                </div>
                <p><strong>Your Username:</strong> {username}</p>
                <p>Once verified, you can log in to access your dashboard and manage your finances securely.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation</p>
            </div>
        </body>
        </html>
        """
        send_email_async(email, "Verify your Smart Bank Account", welcome_body)

        return jsonify({'success': True, 'message': 'Account created! Please check your email for the verification code.', 'username': username}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    username, otp = data.get('username'), data.get('otp')
    
    if not username or not otp:
        return jsonify({'error': 'Username and OTP are required'}), 400
    
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user['status'] == 'active':
        return jsonify({'success': True, 'message': 'Account is already active'}), 200
    
    # Check OTP and Expiry
    if user['otp'] != otp:
        return jsonify({'error': 'Invalid verification code'}), 400
    
    expiry = datetime.strptime(user['otp_expiry'], '%Y-%m-%d %H:%M:%S')
    if datetime.now() > expiry:
        return jsonify({'error': 'Verification code has expired'}), 400
    
    try:
        db.execute('UPDATE users SET status = "active", otp = NULL, otp_expiry = NULL WHERE id = ?', (user['id'],))
        db.commit()
        return jsonify({'success': True, 'message': 'Account activated successfully!'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/resend-otp', methods=['POST'])
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
        return jsonify({'error': 'Account is already active'}), 400
    
    try:
        # Generate a new 6-digit OTP
        otp = str(random.randint(100000, 999999))
        otp_expiry = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
        
        db.execute('UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?', (otp, otp_expiry, user['id']))
        db.commit()

        # Send New OTP Email
        resend_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #8b0000; text-align: center;">New Verification Code</h2>
                <p>Hello {user['name']},</p>
                <p>You requested a new verification code for your Smart Bank account.</p>
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #4b5563;">Your New Verification Code:</p>
                    <h1 style="margin: 10px 0; font-size: 32px; color: #8b0000; letter-spacing: 5px;">{otp}</h1>
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">Valid for 10 minutes</p>
                </div>
                <p>If you didn't request this, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation</p>
            </div>
        </body>
        </html>
        """
        send_email_async(user['email'], "New Verification Code - Smart Bank", resend_body)

        return jsonify({'success': True, 'message': 'New verification code sent!'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username_input = data.get('username')
    password = data.get('password')
    requested_role = data.get('role', 'user')
    face_descriptor = data.get('face_descriptor')
    
    db = get_db()
    logger.info(f"Login attempt: user={username_input}, role={requested_role}")
    user = None
    role = requested_role

    if requested_role == 'user':
        user = db.execute('SELECT * FROM users WHERE username = ? OR email = ?', (username_input, username_input)).fetchone()
        if not user:
            user = db.execute('SELECT * FROM admins WHERE username = ? OR email = ?', (username_input, username_input)).fetchone()
            if user: role = 'admin'
        if not user:
            user = db.execute('SELECT * FROM staff WHERE staff_id = ? OR email = ?', (username_input, username_input)).fetchone()
            if user: role = 'staff'
    elif requested_role == 'staff':
        user = db.execute('SELECT * FROM staff WHERE staff_id = ? OR email = ?', (username_input, username_input)).fetchone()
    elif requested_role == 'admin':
        user = db.execute('SELECT * FROM admins WHERE username = ? OR email = ?', (username_input, username_input)).fetchone()
    else: 
        return jsonify({'error': 'Invalid role'}), 400

    if not user: 
        logger.warning(f"Login failed: user '{username_input}' not found in role '{role}'")
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if user['status'] == 'pending':
        return jsonify({'error': 'Your email is not verified. Please check your email for the verification code.', 'unverified': True, 'username': user['username']}), 403
    
    auth_method = None
    if face_descriptor and role != 'user' and dict(user).get('face_auth_enabled'):
        stored_descriptor = get_face_encoding(user['id'], role)
        if stored_descriptor and compare_face_descriptors(face_descriptor, stored_descriptor):
            auth_method = 'face'
    
    if not auth_method and password and check_password_hash(user['password'], password):
        auth_method = 'password'
        
    if auth_method:
        # Update device_type on login if provided
        device_type = data.get('device_type')
        if device_type:
            try:
                table = 'users' if role == 'user' else ('staff' if role == 'staff' else 'admins')
                db.execute(f'UPDATE {table} SET device_type = ? WHERE id = ?', (device_type, user['id']))
                db.commit()
            except Exception as e:
                logger.error(f"Failed to update device_type on login: {e}")

        session.clear()
        session['user_id'] = user['id']
        actual_username = user['username'] if 'username' in user.keys() else user['staff_id']
        session['username'] = actual_username
        session['role'] = role
        session['name'] = user['name']
        if role == 'staff': session['staff_id'] = user['id']
        if role == 'admin': session['admin_id'] = user['id']
        
        logger.info(f"Login Success: user={actual_username}, role={role}, session_id={session.get('_id', 'N/A')}")
        return jsonify({'success': True, 'user': {'id': user['id'], 'username': actual_username, 'name': user['name'], 'role': role}})
    
    logger.warning(f"Login failed: password mismatch for user '{username_input}' (role: {role})")
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/check', methods=['GET'])
@app.route('/api/check-session', methods=['GET'])
def check_auth():
    logger.info(f"Check Auth Request: cookies={request.cookies.keys()}, session={dict(session)}")
    
    user_id = session.get('user_id')
    staff_id = session.get('staff_id')
    admin_id = session.get('admin_id')
    role = session.get('role')
    
    if (user_id or staff_id or admin_id) and role:
        # Determine which ID to use based on role
        effective_id = admin_id if role == 'admin' else (staff_id if role == 'staff' else user_id)
        
        return jsonify({
            'authenticated': True,
            'user': {
                'id': effective_id,
                'username': session.get('username'),
                'name': session.get('name'),
                'role': role
            }
        })
        
    logger.warning("Check Auth Failed: Missing required session variables")
    return jsonify({'authenticated': False}), 401

@app.route('/api/auth/mobile/setup-passcode', methods=['POST'])
@login_required
def setup_mobile_passcode():
    data = request.json
    passcode = data.get('passcode')
    if not passcode or len(str(passcode)) != 4:
        return jsonify({'error': 'Invalid passcode format'}), 400
    
    db = get_db()
    if session.get('role') != 'user':
        return jsonify({'error': 'Mobile passcode only for customers'}), 403
        
    user_id = session['user_id']
    hashed = generate_password_hash(str(passcode))
    db.execute('UPDATE users SET mobile_passcode = ?, passcode_enabled = 1 WHERE id = ?', (hashed, user_id))
    db.commit()
    return jsonify({'success': True, 'message': 'Passcode set successfully'})

@app.route('/api/auth/mobile/login-passcode', methods=['POST'])
def login_mobile_passcode():
    data = request.json
    username, passcode = data.get('username'), data.get('passcode')
    
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    
    if not user or not user['passcode_enabled']:
        return jsonify({'error': 'Passcode not enabled for this user'}), 401
    
    if check_password_hash(user['mobile_passcode'], str(passcode)):
        session.clear()
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = 'user'
        session['name'] = user['name']
        return jsonify({'success': True, 'user': {'id': user['id'], 'username': user['username'], 'name': user['name'], 'role': 'user'}})
    
    return jsonify({'error': 'Invalid passcode'}), 401

# ============================================================
# USER ROUTES
# ============================================================

@app.route('/api/user/dashboard', methods=['GET'])
@login_required
def get_user_dashboard():
    db = get_db()
    
    # Automatically apply penalties for all overdue loans on dashboard load
    try:
        apply_loan_penalties(db)
    except Exception as e:
        logger.error(f"Error applying penalties during dashboard load: {e}")
        
    user_id = session['user_id']
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    accounts = db.execute('SELECT * FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
    account_requests = db.execute('SELECT * FROM account_requests WHERE user_id = ? AND status = "pending"', (user_id,)).fetchall()
    transactions = db.execute('SELECT t.*, a.account_number FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE a.user_id = ? ORDER BY t.transaction_date DESC LIMIT 10', (user_id,)).fetchall()
    notifications = db.execute('SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC', (user_id,)).fetchall()
    cards = db.execute('SELECT * FROM cards WHERE user_id = ?', (user_id,)).fetchall()
    card_requests = db.execute('SELECT * FROM card_requests WHERE user_id = ?', (user_id,)).fetchall()
    loans = db.execute('SELECT * FROM loans WHERE user_id = ?', (user_id,)).fetchall()
    total_balance = sum(acc['balance'] for acc in accounts)
    
    user_dict = dict(user)
    profile_img = user_dict.get('profile_image')
    
    return jsonify({
        'user': user_dict,
        'accounts': [dict(a) for a in accounts],
        'account_requests': [dict(ar) for ar in account_requests],
        'transactions': [dict(t) for t in transactions],
        'notifications': [dict(n) for n in notifications],
        'cards': [dict(c) for c in cards],
        'card_requests': [dict(cr) for cr in card_requests],
        'loans': [dict(l) for l in loans],
        'total_balance': float(total_balance),
        'profile_image_url': f"/api/user/profile-image/{profile_img}" if profile_img else None
    })

@app.route('/api/user/transactions', methods=['GET'])
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
    
    return jsonify({
        'transactions': [dict(t) for t in transactions]
    })

@app.route('/api/user/notifications/mark_read/<int:notif_id>', methods=['POST'])
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

@app.route('/api/user/balance', methods=['GET'])
@login_required
def get_user_balance():
    db = get_db()
    accounts = db.execute('SELECT balance FROM accounts WHERE user_id = ?', (session['user_id'],)).fetchall()
    total = sum(float(a['balance']) for a in accounts)
    return jsonify({'total_balance': total, 'timestamp': datetime.now().isoformat()})

@app.route('/api/user/support', methods=['GET', 'POST'])
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
            db.execute('''
                INSERT INTO support_tickets (user_id, subject, message, priority, status)
                VALUES (?, ?, ?, ?, 'pending')
            ''', (user_id, subject, message, priority))
            db.commit()
            return jsonify({'success': True, 'message': 'Support ticket submitted successfully'}), 201
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
            
    # GET method
    tickets = db.execute('''
        SELECT id, subject, priority, status, created_at, resolved_at 
        FROM support_tickets 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    ''', (user_id,)).fetchall()
    
    return jsonify({'tickets': [dict(t) for t in tickets]})

# ============================================================
# CHATBOT ENDPOINTS
# ============================================================

@app.route('/api/chat/suggestions', methods=['GET'])
@login_required
def get_chat_suggestions():
    suggestions = [
        {'text': 'Account Balance', 'action': 'balance'},
        {'text': 'Recent Transactions', 'action': 'transactions'},
        {'text': 'Transfer Money', 'action': 'transfer'},
        {'text': 'Loan Information', 'action': 'loan'},
        {'text': 'Customer Support', 'action': 'support'}
    ]
    return jsonify({'success': True, 'suggestions': suggestions})

@app.route('/api/chat/message', methods=['POST'])
@login_required
def process_chat_message():
    data = request.json
    user_message = data.get('message', '').strip().lower()
    user_id = session['user_id']
    
    if not user_message:
        return jsonify({'success': False, 'error': 'Message is empty'}), 400
        
    db = get_db()
    response_text = ""
    intent = "general"
    
    # Simple Intent Detection
    if "balance" in user_message:
        intent = "balance_inquiry"
        accounts = db.execute('SELECT account_number, balance, account_type FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
        if not accounts:
            response_text = "You don't have any active accounts yet."
        else:
            total = sum(float(a['balance']) for a in accounts)
            details = "\n".join([f"• {a['account_type']} (...{a['account_number'][-4:]}): ₹{float(a['balance']):,.2f}" for a in accounts])
            response_text = f"Your total balance across all accounts is **₹{total:,.2f}**.\n\nDetails:\n{details}"
            
    elif "transaction" in user_message or "history" in user_message:
        intent = "transaction_history"
        response_text = "I've pulled up your transaction history for you. You can see all your recent activity in the Transactions tab."
        
    elif "transfer" in user_message or "send money" in user_message:
        intent = "transfer_money"
        response_text = "You can transfer money to other Smart Bank accounts or via UPI. Would you like me to take you to the Transfer page?"
        
    elif "loan" in user_message:
        intent = "loan_inquiry"
        response_text = "We offer Personal, Gold, and Home loans with competitive interest rates. You can view and apply for loans in the Loans section."
        
    elif "card" in user_message:
        intent = "card_inquiry"
        response_text = "You can manage your Debit and Credit cards, or request a new one, in the Cards section."
        
    elif "support" in user_message or "help" in user_message or "ticket" in user_message:
        intent = "support_request"
        response_text = "If you're having trouble, you can raise a support ticket and our team will get back to you within 24 hours. Would you like to open the Support form?"
        
    else:
        # Generic helpful responses
        responses = [
            "I'm here to help with your banking needs! You can ask about your balance, transactions, or how to transfer money.",
            "I can help you manage your accounts. Try asking 'What's my balance?' or 'Show my transactions'.",
            "Smart Bank AI is at your service. How can I assist you with your finances today?"
        ]
        response_text = random.choice(responses)
        
    try:
        # Save to chat history
        db.execute('''
            INSERT INTO chat_history (user_id, message, response, intent)
            VALUES (?, ?, ?, ?)
        ''', (user_id, data.get('message'), response_text, intent))
        db.commit()
        
        return jsonify({
            'success': True,
            'response': response_text,
            'intent': intent
        })
    except Exception as e:
        db.rollback()
        logger.error(f"Chat storage error: {e}")
        return jsonify({
            'success': True,
            'response': response_text,
            'intent': intent,
            'storage_error': True
        })

@app.route('/api/user/profile', methods=['PUT'])
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
             db.execute('''
                 UPDATE users 
                 SET name = ?, phone = ?, address = ?, date_of_birth = ?, daily_limit = ?
                 WHERE id = ?
             ''', (name, phone, address, dob, daily_limit, user_id))
        else:
             db.execute('''
                 UPDATE users 
                 SET name = ?, phone = ?, address = ?, date_of_birth = ?
                 WHERE id = ?
             ''', (name, phone, address, dob, user_id))
             
        db.commit()
        return jsonify({'success': True, 'message': 'Profile updated successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile-image', methods=['POST'])
@login_required
def upload_profile_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        user_id = session['user_id']
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"user_{user_id}_{int(time.time())}.{ext}"
        filepath = os.path.join(PROFILE_PICS_FOLDER, filename)
        file.save(filepath)

        db = get_db()
        try:
            # Delete old image if exists
            old_user = db.execute('SELECT profile_image FROM users WHERE id = ?', (user_id,)).fetchone()
            if old_user and dict(old_user).get('profile_image'):
                old_path = os.path.join(PROFILE_PICS_FOLDER, dict(old_user).get('profile_image'))
                if os.path.exists(old_path):
                    try: os.remove(old_path)
                    except: pass

            db.execute('UPDATE users SET profile_image = ? WHERE id = ?', (filename, user_id))
            db.commit()
            return jsonify({
                'success': True,
                'message': 'Profile image uploaded successfully',
                'profile_image_url': f"/api/user/profile-image/{filename}"
            })
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/user/profile-image/<filename>')
def serve_profile_image(filename):
    return send_from_directory(PROFILE_PICS_FOLDER, filename)

@app.route('/api/user/transfer', methods=['POST'])
@login_required
def transfer_money():
    data = request.json
    from_acc_id, to_acc_raw, amount = data.get('from_account'), str(data.get('to_account', '')), float(data.get('amount', 0))
    if amount <= 0: return jsonify({'error': 'Invalid amount'}), 400
    
    db = get_db()
    user_id = session['user_id']
    try:
        src = db.execute('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND balance >= ?', (from_acc_id, user_id, amount)).fetchone()
        if not src: return jsonify({'error': 'Insufficient funds or invalid account'}), 400
        
        user = db.execute('SELECT email, name, phone, daily_limit FROM users WHERE id = ?', (user_id,)).fetchone()
        daily_limit = user['daily_limit'] if user and user['daily_limit'] is not None else 200000.00
        
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_spent_row = db.execute('''
            SELECT SUM(t.amount) as total 
            FROM transactions t 
            JOIN accounts a ON t.account_id = a.id 
            WHERE a.user_id = ? AND t.type = 'debit' AND t.transaction_date >= ?
        ''', (user_id, today_start)).fetchone()
        
        today_spent = float(today_spent_row['total'] or 0)
        if today_spent + amount > daily_limit:
            return jsonify({'error': f'Daily limit of ₹{daily_limit} exceeded. You have already spent ₹{today_spent} today.'}), 400
            
        dest = db.execute('SELECT * FROM accounts WHERE account_number = ? OR id = ?', (to_acc_raw, to_acc_raw)).fetchone()
        
        # Use high-entropy ref + unique DB/CR suffix per row to satisfy UNIQUE constraint on reference_number
        ref = f"TXN{secrets.token_hex(10).upper()}"
        ref_db = f"{ref}DB"   # Debit leg (sender)
        ref_cr = f"{ref}CR"   # Credit leg (receiver)
        src_bal_after = src['balance'] - amount
        
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (src_bal_after, from_acc_id))
        db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) VALUES (?, "debit", ?, ?, ?, ?, "Transfer")',
                  (from_acc_id, amount, f"Transfer to {to_acc_raw}", ref_db, src_bal_after))
        
        if dest:
            dest_bal_after = dest['balance'] + amount
            db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (dest_bal_after, dest['id']))
            db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after) VALUES (?, "credit", ?, ?, ?, ?)',
                      (dest['id'], amount, f"Received from {src['account_number']}", ref_cr, dest_bal_after))
        
        db.commit()

        # Send Debit Alert to Sender
        debit_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #8b0000; text-align: center;">Transaction Alert - Debit</h2>
                <p>Hello {user['name']},</p>
                <p>Your account <strong>{src['account_number']}</strong> has been debited with <strong>₹{amount:,.2f}</strong>.</p>
                <p><strong>Details:</strong> Transfer to {to_acc_raw}</p>
                <p><strong>Reference:</strong> {ref}</p>
                <p><strong>New Balance:</strong> ₹{src_bal_after:,.2f}</p>
                <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">If you did not authorize this transaction, please contact us immediately.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation</p>
            </div>
        </body>
        </html>
        """
        send_email_async(user['email'], f"Transaction Alert: Debit ₹{amount}", debit_body)
        
        if user and user['phone']:
            send_sms_async(user['phone'], f"SmartBank: Account {src['account_number'][-4:]} debited INR {amount:,.2f} to {to_acc_raw}. Ref: {ref}")

        # Send Credit Alert to Receiver (if internal)
        if dest:
            receiver_user = db.execute('SELECT name, email, phone FROM users WHERE id = ?', (dest['user_id'],)).fetchone()
            if receiver_user:
                if receiver_user['email']:
                    # ... email logic ... (already there, just adding SMS)
                    pass
                if receiver_user['phone']:
                    send_sms_async(receiver_user['phone'], f"SmartBank: Account {dest['account_number'][-4:]} credited INR {amount:,.2f} from {src['account_number'][-4:]}. Ref: {ref}")
                credit_body = f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                        <h2 style="color: #065f46; text-align: center;">Transaction Alert - Credit</h2>
                        <p>Hello {receiver_user['name']},</p>
                        <p>Your account <strong>{dest['account_number']}</strong> has been credited with <strong>₹{amount:,.2f}</strong>.</p>
                        <p><strong>Details:</strong> Received from {src['account_number']}</p>
                        <p><strong>Reference:</strong> {ref}</p>
                        <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">Thank you for banking with Smart Bank!</p>
                        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation</p>
                    </div>
                </body>
                </html>
                """
                send_email_async(receiver_user['email'], f"Transaction Alert: Credit ₹{amount}", credit_body)

        return jsonify({'success': True, 'message': 'Transfer successful', 'reference': ref})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================================
# MOBILE SUITE - INDIAN STYLE FUNCTIONAL ENDPOINTS
# ============================================================

@app.route('/api/mobile/billpay', methods=['POST'])
@login_required
def mobile_billpay():
    """Mock BBPS Bill Payment Simulator"""
    data = request.json
    biller = data.get('biller')
    consumer_id = data.get('consumer_id')
    amount = float(data.get('amount', 0))
    category = data.get('category', 'Utility')
    
    if not biller or not consumer_id or amount <= 0:
        return jsonify({'error': 'Invalid biller, consumer ID or amount'}), 400
        
    db = get_db()
    user_id = session['user_id']
    
    # Check balance
    account = db.execute('SELECT * FROM accounts WHERE user_id = ? AND balance >= ?', (user_id, amount)).fetchone()
    if not account:
        return jsonify({'error': 'Insufficient balance'}), 400
        
    # Deduct amount
    db.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, account['id']))
    
    # Log transaction
    ref = f"BBPS{secrets.token_hex(4).upper()}"
    db.execute('''
        INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status)
        VALUES (?, 'debit', ?, ?, ?, 'Bill Pay', 'completed')
    ''', (account['id'], amount, f"BBPS: {category} - {biller} ({consumer_id})", ref))
    
    log_audit(user_id, 'user', 'bill_payment', f"Paid {category} bill to {biller}: {amount}")
    db.commit()
    
    # Send Email Notification for Bill Payment
    user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
    if user and user['email']:
        subject = f"Bill Payment Successful - {biller}"
        body = f"""
        <h3>Smart Bank Bill Payment</h3>
        <p>Dear {user['name']},</p>
        <p>Your payment for <strong>{category}</strong> to <strong>{biller}</strong> of <strong>₹{amount:,.2f}</strong> was successful.</p>
        <p><strong>Reference Number:</strong> {ref}</p>
        <p><strong>Date:</strong> {datetime.now().strftime('%d %b %Y, %H:%M:%S')}</p>
        <p>Thank you for using Smart Bank Mobile Services.</p>
        """
        send_email_async(user['email'], subject, body)
    
    return jsonify({'success': True, 'message': f'Payment to {biller} successful!', 'reference': ref})

@app.route('/api/mobile/apply-fd', methods=['POST'])
@login_required
def apply_fixed_deposit():
    """Simulate Fixed Deposit/Investment Application"""
    data = request.json
    amount = float(data.get('amount', 0))
    tenure = data.get('tenure', '1 Year')
    
    if amount < 5000:
        return jsonify({'error': 'Minimum FD amount is ₹5,000'}), 400
        
    db = get_db()
    user_id = session['user_id']
    
    # Check balance
    account = db.execute('SELECT * FROM accounts WHERE user_id = ? AND balance >= ?', (user_id, amount)).fetchone()
    if not account:
        return jsonify({'error': 'Insufficient balance to open FD'}), 400
        
    # Deduct amount
    db.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, account['id']))
    
    # Log transaction
    ref = f"FD{secrets.token_hex(4).upper()}"
    db.execute('''
        INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status)
        VALUES (?, 'debit', ?, ?, ?, 'Investment', 'completed')
    ''', (account['id'], amount, f"Fixed Deposit Booked: {tenure}", ref))
    
    # Track as service application
    db.execute('''
        INSERT INTO service_applications (user_id, service_type, product_name, amount, tenure, account_id, status)
        VALUES (?, 'Investment', 'Fixed Deposit', ?, ?, ?, 'pending')
    ''', (user_id, amount, str(tenure), account['id']))
    
    log_audit(user_id, 'user', 'fd_creation', f"Booked FD of {amount} for {tenure}")
    db.commit()
    
    # Send Email Notification for FD Booking
    user = db.execute('SELECT email, name, phone FROM users WHERE id = ?', (user_id,)).fetchone()
    if user and user['email']:
        subject = "Fixed Deposit Booked Successfully"
        body = f"""
        <h3>Smart Bank Investment</h3>
        <p>Dear {user['name']},</p>
        <p>A Fixed Deposit of <strong>₹{amount:,.2f}</strong> has been successfully booked for a tenure of <strong>{tenure}</strong>.</p>
        <p><strong>Reference Number:</strong> {ref}</p>
        <p>Your funds have been securely invested with Smart Bank.</p>
        """
        send_email_async(user['email'], subject, body)
        
    if user and user['phone']:
        send_sms_async(user['phone'], f"SmartBank: Fixed Deposit of INR {amount:,.2f} booked for {tenure} successful. Ref: {ref}")
        
    return jsonify({'success': True, 'message': f'Fixed Deposit of ₹{amount} booked successfully!', 'reference': ref})

@app.route('/api/mobile/apply-investment', methods=['POST'])
@login_required
def apply_mobile_investment():
    """Handle Mutual Fund, Life Insurance, and Gold Loan applications from mobile"""
    data = request.json
    product = data.get('product_name')
    amount = float(data.get('amount', 0))
    account_number = data.get('account_number')
    
    if not product or amount <= 0 or not account_number:
        return jsonify({'error': 'Product name, valid amount, and source account are required'}), 400
        
    db = get_db()
    user_id = session['user_id']
    
    # Check balance and account ownership
    account = db.execute('SELECT * FROM accounts WHERE user_id = ? AND account_number = ?', (user_id, account_number)).fetchone()
    if not account:
        return jsonify({'error': 'Source account not found or unauthorized'}), 404
        
    is_loan = 'Loan' in product
    ref = f"{('LN' if is_loan else 'INV')}{secrets.token_hex(4).upper()}"
    tenure = int(data.get('tenure', 12))
    
    if is_loan and tenure > 60:
        return jsonify({'error': 'Loan tenure cannot exceed 60 months (5 years)'}), 400
    
    if not is_loan:
        if account['balance'] < amount:
            return jsonify({'error': 'Insufficient balance in the selected account'}), 400
            
        # Deduct amount for investments
        db.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, account['id']))
        
        # Log transaction
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status)
            VALUES (?, 'debit', ?, ?, ?, 'Investment', 'completed')
        ''', (account['id'], amount, f"App Fee/Invest: {product}", ref))
    else:
        # Create specific record if it's a Gold Loan
        db.execute('''
            INSERT INTO loans (user_id, loan_type, loan_amount, tenure_months, interest_rate, status, target_account_id, outstanding_amount)
            VALUES (?, ?, ?, ?, 8.5, 'pending', ?, ?)
        ''', (user_id, product, amount, int(tenure), account['id'], amount))
    
    # Track as service application
    db.execute('''
        INSERT INTO service_applications (user_id, service_type, product_name, amount, tenure, account_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
    ''', (user_id, 'Loan' if is_loan else 'Investment', product, amount, str(tenure) if tenure else None, account['id']))
        
    log_audit(user_id, 'user', 'mobile_investment_app', f"Applied for {product} with ₹{amount} (Ref: {ref})")
    db.commit()
    
    # Email Notification
    user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
    if user and user['email']:
        subject = f"Application Received: {product}"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #8b0000; text-align: center;">Smart Bank</h2>
                <h3 style="border-bottom: 2px solid #8b0000; padding-bottom: 10px;">Application Acknowledgement</h3>
                <p>Dear {user['name']},</p>
                <p>We have successfully received your application for <strong>{product}</strong> via Smart Bank Mobile.</p>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Product:</strong> {product}</p>
                    <p style="margin: 5px 0;"><strong>Initial Amount:</strong> \u20b9{amount:,.2f}</p>
                    <p style="margin: 5px 0;"><strong>Account Used:</strong> XXXX-{account_number[-4:]}</p>
                    <p style="margin: 5px 0;"><strong>Reference ID:</strong> {ref}</p>
                </div>
                <p>Our executive will review your documents and contact you within 2-3 business days.</p>
                <p>If you did not initiate this application, please call our 24/7 helpline immediately.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation | Mobile Banking Division</p>
            </div>
        </body>
        </html>
        """
        send_email_async(user['email'], subject, body)
        
    return jsonify({
        'success': True, 
        'message': f'Your application for {product} has been submitted successfully!',
        'reference': ref
    })

@app.route('/api/user/loans/apply', methods=['POST'])
@login_required
def apply_loan():
    data = request.json
    user_id = session['user_id']
    loan_type = data.get('loan_type', data.get('loanType', 'Personal'))
    amount = float(data.get('loan_amount', data.get('amount', 0)))
    tenure = int(data.get('tenure_months', data.get('tenure', 12)))
    target_account_id = data.get('target_account_id')
    
    if tenure > 60:
        return jsonify({'error': 'Loan tenure cannot exceed 60 months (5 years)'}), 400

    db = get_db()
    try:
        cursor = db.execute('INSERT INTO loans (user_id, loan_type, loan_amount, tenure_months, interest_rate, status, target_account_id, outstanding_amount) VALUES (?, ?, ?, ?, ?, "pending", ?, ?)',
                  (user_id, loan_type, amount, tenure, 5.0, target_account_id, amount))
        loan_id = cursor.lastrowid

        # Track as service application
        db.execute('''
            INSERT INTO service_applications (user_id, service_type, product_name, amount, tenure, status)
            VALUES (?, "Loan", ?, ?, ?, "pending")
        ''', (user_id, loan_type, amount, tenure))
        
        db.commit()
        
        # Email Notification for Loan Application
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            subject = "Loan Application Received"
            body = f"""
            <h3>Smart Bank Loan Application</h3>
            <p>Dear {user['name']},</p>
            <p>We have received your application for a <strong>{loan_type}</strong> loan of <strong>\u20b9{amount:,.2f}</strong> for a tenure of {tenure} months.</p>
            <p>Your application is currently under review by our staff. You will be notified once it is processed.</p>
            """
            send_email_async(user['email'], subject, body)
            
        return jsonify({'success': True, 'message': 'Application submitted'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/loans/repay', methods=['POST'])
@login_required
def repay_loan():
    data = request.json
    user_id = session['user_id']
    loan_id = data.get('loan_id')
    account_id = data.get('account_id')
    amount = float(data.get('amount', 0))
    mode = data.get('mode', 'account') # account, upi, scanner
    
    if amount <= 0: return jsonify({'error': 'Invalid amount'}), 400
    
    db = get_db()
    try:
        # Check loan
        loan = db.execute('SELECT * FROM loans WHERE id = ? AND user_id = ? AND status = "approved"', (loan_id, user_id)).fetchone()
        if not loan: return jsonify({'error': 'Loan not found or not approved'}), 404
        
        # Determine outstanding amount
        loan_amount = float(loan['loan_amount'])
        outstanding = float(loan['outstanding_amount']) if loan['outstanding_amount'] is not None else loan_amount
        
        if amount > outstanding: amount = outstanding # Don't overpay
        
        acc = None
        if mode == 'account':
            # Check account
            acc = db.execute('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND balance >= ?', (account_id, user_id, amount)).fetchone()
            if not acc: return jsonify({'error': 'Insufficient funds or invalid account'}), 400
            new_acc_bal = acc['balance'] - amount
            db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_acc_bal, account_id))
        else:
            # Mock UPI/Scanner verification
            new_acc_bal = None
            
        new_loan_outstanding = outstanding - amount
        
        # Credit back to Liquidity Fund
        db.execute('UPDATE system_finances SET balance = balance + ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
        
        db.execute('UPDATE loans SET outstanding_amount = ? WHERE id = ?', (new_loan_outstanding, loan_id))
        
        # If fully paid, change status
        if new_loan_outstanding <= 0:
            db.execute('UPDATE loans SET status = "closed" WHERE id = ?', (loan_id,))
            
        ref = f"LRP{secrets.token_hex(4).upper()}"
        trans_mode = f"Loan Repay ({mode.upper()})"
        
        if mode == 'account' and acc:
            db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) VALUES (?, "debit", ?, ?, ?, ?, ?)',
                      (account_id, amount, f"Repayment for Loan #{loan_id}", ref, new_acc_bal, trans_mode))
        
        db.commit()
        
        # Email Notification
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        loan_info = dict(loan)
        
        if user and user['email']:
            if new_loan_outstanding <= 0:
                # ===== LOAN CLOSURE LETTER =====
                subject = "🎉 Loan Closure Confirmation - Smart Bank"
                body = f"""
                <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8fafc; padding: 32px;">
                  <div style="background: linear-gradient(135deg, #10b981, #065f46); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 28px;">🎉 Loan Fully Paid Off!</h1>
                    <p style="opacity:.85; margin: 8px 0 0;">Smart Bank - Official Loan Closure Letter</p>
                  </div>
                  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 24px rgba(0,0,0,.08);">
                    <p style="font-size:16px;">Dear <strong>{user['name']}</strong>,</p>
                    <p>We are pleased to inform you that your loan has been <strong style="color:#10b981;">fully repaid and closed</strong> as of {datetime.now().strftime('%d %B %Y')}.</p>

                    <div style="background:#f0fdf4;border:2px solid #10b981;border-radius:8px;padding:20px;margin:24px 0;">
                      <h3 style="color:#065f46;margin:0 0 16px;">Loan Closure Summary</h3>
                      <table style="width:100%;border-collapse:collapse;">
                        <tr><td style="padding:6px 0;color:#374151;">Loan ID</td><td style="padding:6px 0;font-weight:600;">#{loan_id}</td></tr>
                        <tr><td style="padding:6px 0;color:#374151;">Loan Type</td><td style="padding:6px 0;font-weight:600;">{loan_info.get('loan_type','—')}</td></tr>
                        <tr><td style="padding:6px 0;color:#374151;">Original Amount</td><td style="padding:6px 0;font-weight:600;">₹{loan_amount:,.2f}</td></tr>
                        <tr><td style="padding:6px 0;color:#374151;">Final Payment</td><td style="padding:6px 0;font-weight:600;">₹{amount:,.2f}</td></tr>
                        <tr><td style="padding:6px 0;color:#374151;">Closure Date</td><td style="padding:6px 0;font-weight:600;">{datetime.now().strftime('%d %b %Y')}</td></tr>
                        <tr><td style="padding:6px 0;color:#374151;">Status</td><td style="padding:6px 0;"><span style="background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px;font-size:13px;">✅ CLOSED</span></td></tr>
                      </table>
                    </div>

                    <div style="background:#eff6ff;border-left:4px solid #6366f1;padding:16px;border-radius:4px;margin-bottom:24px;">
                      <p style="margin:0;color:#1e40af;">This letter serves as an <strong>official confirmation</strong> that your loan account is now clear of any outstanding dues. No further payments are required.</p>
                    </div>

                    <p>If you financed collateral (e.g., gold), please visit your nearest Smart Bank branch to collect it at your earliest convenience.</p>
                    <p style="margin-top:24px;">Thank you for your consistent repayments. We look forward to serving you again!</p>
                    <p>Warm regards,<br><strong>Smart Bank Team</strong></p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
                    <p style="font-size:12px;color:#9ca3af;text-align:center;">This is an automated system-generated letter. Smart Bank Ltd.</p>
                  </div>
                </div>
                """
            else:
                # ===== PAYMENT CONFIRMATION RECEIPT =====
                subject = f"Loan Repayment Confirmation - ₹{amount:,.2f} Received"
                body = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
                  <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 22px;">💳 Payment Confirmation</h1>
                    <p style="opacity:.85; margin: 6px 0 0;">Smart Bank - Loan Repayment Receipt</p>
                  </div>
                  <div style="background: white; padding: 28px; border-radius: 0 0 12px 12px;">
                    <p>Dear <strong>{user['name']}</strong>,</p>
                    <p>We have received your loan repayment. Here are the details:</p>

                    <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
                      <table style="width:100%;border-collapse:collapse;">
                        <tr><td style="padding:6px 0;color:#64748b;">Loan ID</td><td style="padding:6px 0;font-weight:600;">#{loan_id}</td></tr>
                        <tr><td style="padding:6px 0;color:#64748b;">Amount Paid</td><td style="padding:6px 0;font-weight:600;color:#10b981;">₹{amount:,.2f}</td></tr>
                        <tr><td style="padding:6px 0;color:#64748b;">Payment Mode</td><td style="padding:6px 0;font-weight:600;">{mode.upper()}</td></tr>
                        <tr><td style="padding:6px 0;color:#64748b;">Reference</td><td style="padding:6px 0;font-family:monospace;">{ref}</td></tr>
                        <tr><td style="padding:6px 0;color:#64748b;">Remaining Outstanding</td><td style="padding:6px 0;font-weight:600;color:#ef4444;">₹{new_loan_outstanding:,.2f}</td></tr>
                        <tr><td style="padding:6px 0;color:#64748b;">Date & Time</td><td style="padding:6px 0;">{datetime.now().strftime('%d %b %Y, %I:%M %p')}</td></tr>
                      </table>
                    </div>
                    <p style="font-size:13px;color:#64748b;">Keep making regular payments to close your loan early and avoid penalties.</p>
                    <p>Thank you,<br><strong>Smart Bank Team</strong></p>
                  </div>
                </div>
                """
            send_email_async(user['email'], subject, body)
            
        # SMS Notification for Loan Repayment
        if user and user['phone']:
            if new_loan_outstanding <= 0:
                sms_message = f"SmartBank: Your Loan #{loan_id} of Rs.{loan_amount:,.2f} has been fully repaid and closed. Ref: {ref}"
            else:
                sms_message = f"SmartBank: Loan #{loan_id} repayment of Rs.{amount:,.2f} received. Outstanding: Rs.{new_loan_outstanding:,.2f}. Ref: {ref}"
            send_sms_async(user['phone'], sms_message)
            
        return jsonify({'success': True, 'message': 'Repayment successful', 'outstanding': new_loan_outstanding, 'closed': new_loan_outstanding <= 0})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

def apply_loan_penalties(db):
    """Core logic to apply daily penalty of 0.1% for overdue loans"""
    today = datetime.now().date()
    # Find loans where next_due_date has passed and haven't been charged today
    loans = db.execute('''
        SELECT * FROM loans 
        WHERE status = "approved" 
        AND next_due_date < ? 
        AND (last_charge_date IS NULL OR DATE(last_charge_date) < ?)
    ''', (today, today)).fetchall()
    
    count = 0
    for loan in loans:
        # Penalty: 0.1% of monthly_payment per day
        monthly = float(loan['monthly_payment'] or 1000)
        penalty = round(monthly * 0.001, 2)
        
        new_penalty = float(loan['penalty_amount'] or 0) + penalty
        new_outstanding = float(loan['outstanding_amount'] or loan['loan_amount']) + penalty
        
        db.execute('''
            UPDATE loans 
            SET penalty_amount = ?, 
                outstanding_amount = ?, 
                last_charge_date = CURRENT_TIMESTAMP 
            WHERE id = ?
        ''', (new_penalty, new_outstanding, loan['id']))
        count += 1
        
    if count > 0:
        db.commit()
    return count

@app.route('/api/system/update-penalties', methods=['POST'])
def update_loan_penalties():
    """Apply daily penalty of 0.1% for overdue loans via endpoint"""
    db = get_db()
    try:
        count = apply_loan_penalties(db)
        return jsonify({'success': True, 'penalties_applied': count})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/liquidity-fund', methods=['GET'])
@login_required
def get_liquidity_fund():
    """Get current Loan Liquidity Fund balance (accessible to all logged-in users)"""
    db = get_db()
    try:
        fund = db.execute('SELECT * FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
        if fund:
            return jsonify({'success': True, 'balance': fund['balance'], 'fund_name': fund['fund_name']})
        else:
            # Fund not yet created, return default
            return jsonify({'success': True, 'balance': 1000000.00, 'fund_name': 'Loan Liquidity Fund'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/accounts', methods=['POST'])
@login_required
def open_new_account():
    db = get_db()
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Robust user ID retrieval
        user_id = session.get('user_id') or session.get('staff_id') or session.get('admin_id')
        if not user_id:
            return jsonify({'error': 'User session expired or invalid'}), 401
            
        account_type = data.get('account_type', 'Savings').capitalize()
        aadhaar_number = data.get('aadhaar_number')
        pan_number = data.get('pan_number')
        tax_id = data.get('tax_id')
        face_descriptor = data.get('face_descriptor')
        kyc_photo = data.get('kyc_photo')

        kyc_video = data.get('kyc_video')

        if account_type not in ['Savings', 'Current', 'Salary']:
            return jsonify({'error': f'Invalid account type: {account_type}'}), 400

        if account_type == 'Current' and not tax_id:
            return jsonify({'error': 'Tax ID is required for Current Accounts'}), 400

        import re
        pan_regex = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
        if not re.match(pan_regex, pan_number):
            return jsonify({'error': 'Invalid PAN format. Correct format: ABCDE1234F'}), 400

        if not aadhaar_number or not pan_number or not face_descriptor:
            return jsonify({'error': 'Missing KYC data: Aadhaar, PAN, and Face verification are mandatory.'}), 400

        # Check existing accounts (max 3)
        user_accounts = db.execute('SELECT COUNT(*) FROM accounts WHERE user_id = ?', (user_id,)).fetchone()[0]
        if user_accounts >= 3:
            return jsonify({'error': 'Maximum account limit reached (3 accounts)'}), 400

        # Check duplicate type
        existing = db.execute('SELECT id FROM accounts WHERE user_id = ? AND account_type = ?', (user_id, account_type)).fetchone()
        if existing:
            return jsonify({'error': f'You already have a {account_type} account'}), 400

        # Check pending requests
        pending = db.execute('SELECT id FROM account_requests WHERE user_id = ? AND account_type = ? AND status = "pending"', (user_id, account_type)).fetchone()
        if pending:
            return jsonify({'error': f'You already have a pending request for a {account_type} account'}), 400

        # Save the request
        import json
        fs_str = json.dumps(face_descriptor)
        
        aadhaar_proof = data.get('aadhaar_proof')
        pan_proof = data.get('pan_proof')

        logger.info(f"Saving account request: user={user_id}, type={account_type}")
        
        db.execute(
            'INSERT INTO account_requests (user_id, account_type, aadhaar_number, pan_number, tax_id, face_descriptor, kyc_photo, kyc_video, aadhaar_proof, pan_proof, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending")',
            (user_id, account_type, aadhaar_number, pan_number, tax_id, fs_str, kyc_photo, kyc_video, aadhaar_proof, pan_proof)
        )
        db.commit()
        
        # Notify
        user_info = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user_info and user_info['email']:
            send_email_async(
                user_info['email'], 
                "Account Request Received", 
                f"<h3>Request Received</h3><p>Hello {user_info['name']}, your {account_type} account request is being processed.</p>"
            )
            
        return jsonify({'success': True, 'message': f'{account_type} account requested! Staff will review it soon.'}), 201
        
    except Exception as e:
        import traceback
        error_msg = f"Account request error: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        if db: db.rollback()
        return jsonify({'error': error_msg}), 500

@app.route('/api/user/accounts/<int:account_id>/convert', methods=['POST'])
@login_required
def convert_account(account_id):
    data = request.json
    new_type = data.get('new_type')
    user_id = session['user_id']
    
    if new_type not in ['Savings', 'Current', 'Salary']:
        return jsonify({'error': 'Invalid target account type'}), 400
        
    db = get_db()
    
    try:
        acc = db.execute('SELECT * FROM accounts WHERE id = ? AND user_id = ?', (account_id, user_id)).fetchone()
        if not acc:
            return jsonify({'error': 'Account not found or unauthorized'}), 404
            
        if acc['account_type'] == new_type:
            return jsonify({'error': f'Account is already a {new_type} account'}), 400

        if new_type == 'Current':
            # For Current accounts, require Tax ID and Staff Approval
            tax_id = data.get('tax_id')
            if not tax_id:
                return jsonify({'error': 'Tax ID is required to convert to a Current account'}), 400
                
            # Create a request in account_requests table (simulate conversion request)
            # Find the user's details for the request
            user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
            
            # Check if pending request exists
            pending = db.execute('SELECT id FROM account_requests WHERE user_id = ? AND account_type = ? AND status = "pending"', (user_id, 'Current')).fetchone()
            if pending:
                return jsonify({'error': 'You already have a pending request for a Current account'}), 400
                
            # In a real app we'd link the conversion to the specific account id, but let's insert a standard account request 
            # Note: We pass 'None' for face descriptor for a conversion if we don't strictly re-verify here, or require it
            db.execute('''
                INSERT INTO account_requests 
                (user_id, account_type, tax_id, status, original_account_id) 
                VALUES (?, ?, ?, "pending", ?)
            ''', (user_id, new_type, tax_id, account_id))
            
            # Delete the old account to "convert" or just leave it and let staff approve the new one.
            # To actually convert, the staff approval logic would need to know it's a conversion.
            # Simplest approach for now: just update the request to note it's a conversion, or 
            # for this mock, just change the type directly if it was just a mock, but user requested staff approval.
            # Let's add an extra note or just create a new account request. The prompt asks to "ask tax id and approvel in staff".
            db.commit()
            return jsonify({'success': True, 'message': f'Conversion to {new_type} requested. Pending staff approval!'})
            
        else:
            # For Savings / Salary, instant conversion
            db.execute('UPDATE accounts SET account_type = ? WHERE id = ?', (new_type, account_id))
            db.commit()
            return jsonify({'success': True, 'message': f'Account successfully converted to {new_type}'})
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================================
# UPI & NPCI SANDBOX ROUTES
# ============================================================

@app.route('/api/user/upi/status', methods=['GET'])
@login_required
def get_upi_status():
    db = get_db()
    user_id = session['user_id']
    user = db.execute('SELECT upi_id FROM users WHERE id = ?', (user_id,)).fetchone()
    
    if user and user['upi_id']:
        return jsonify({
            'enabled': True,
            'upi_id': user['upi_id']
        })
    else:
        return jsonify({
            'enabled': False,
            'message': 'UPI not set up'
        })

@app.route('/api/user/upi/setup', methods=['POST'])
@login_required
def setup_upi():
    data = request.json
    upi_pin = data.get('upi_pin')
    user_id = session['user_id']
    username = session['username']
    
    if not upi_pin or len(str(upi_pin)) != 6 or not str(upi_pin).isdigit():
        return jsonify({'error': 'UPI PIN must be 6 digits'}), 400
    
    db = get_db()
    upi_id = f"{username}@smtbank"
    
    try:
        # Check if upi_id already exists for someone else
        existing = db.execute('SELECT id FROM users WHERE upi_id = ? AND id != ?', (upi_id, user_id)).fetchone()
        if existing:
            return jsonify({'error': 'UPI ID already in use'}), 400
            
        hashed_pin = generate_password_hash(upi_pin)
        db.execute('UPDATE users SET upi_id = ?, upi_pin = ? WHERE id = ?', (upi_id, hashed_pin, user_id))
        db.commit()
        return jsonify({'success': True, 'upi_id': upi_id, 'message': 'UPI setup successful'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/transfer/upi', methods=['POST'])
@login_required
def upi_transfer():
    data = request.json
    target_vpa = data.get('target_vpa')
    amount = float(data.get('amount', 0))
    upi_pin = data.get('upi_pin')
    user_id = session['user_id']
    
    if amount <= 0: return jsonify({'error': 'Invalid amount'}), 400
    if not target_vpa: return jsonify({'error': 'Target UPI ID required'}), 400
    
    db = get_db()
    try:
        # Verify sender's UPI setup and PIN
        sender = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not sender or not sender['upi_id']:
            return jsonify({'error': 'UPI not set up'}), 400
            
        if not check_password_hash(sender['upi_pin'], str(upi_pin)):
            return jsonify({'error': 'Invalid UPI PIN'}), 401
            
        daily_limit = sender['daily_limit'] if sender['daily_limit'] is not None else 200000.00
        
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_spent_row = db.execute('''
            SELECT SUM(t.amount) as total 
            FROM transactions t 
            JOIN accounts a ON t.account_id = a.id 
            WHERE a.user_id = ? AND t.type = 'debit' AND t.transaction_date >= ?
        ''', (user_id, today_start)).fetchone()
        
        today_spent = float(today_spent_row['total'] or 0)
        if today_spent + amount > daily_limit:
            return jsonify({'error': f'Daily limit of ₹{daily_limit} exceeded. You have already spent ₹{today_spent} today via your accounts.'}), 400

        # Get sender's primary account
        src_acc = db.execute('SELECT * FROM accounts WHERE user_id = ? AND balance >= ? ORDER BY id ASC LIMIT 1', (user_id, amount)).fetchone()
        if not src_acc:
            return jsonify({'error': 'Insufficient funds in primary account'}), 400
            
        # NPCI SANDBOX MOCK LOGIC: Resolve VPA
        receiver = None
        if target_vpa.endswith('@smtbank'):
            receiver = db.execute('SELECT * FROM users WHERE upi_id = ?', (target_vpa,)).fetchone()
            if not receiver:
                return jsonify({'error': 'Receiver UPI ID not found (NPCI Sandbox)'}), 404
        else:
            # Simulate external VPA validation
            if not any(target_vpa.endswith(suffix) for suffix in ['@axis', '@okicici', '@upi', '@paytm']):
                return jsonify({'error': 'Invalid VPA or NPCI Sandbox Timeout'}), 400
        
        # Process Transfer
        ref = f"UPI{secrets.token_hex(8).upper()}"
        src_bal_after = src_acc['balance'] - amount
        
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (src_bal_after, src_acc['id']))
        db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) VALUES (?, "debit", ?, ?, ?, ?, "UPI")',
                  (src_acc['id'], amount, f"UPI Transfer to {target_vpa}", f"{ref}DB", src_bal_after))
        
        if receiver:
            dest_acc = db.execute('SELECT * FROM accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1', (receiver['id'],)).fetchone()
            if dest_acc:
                dest_bal_after = dest_acc['balance'] + amount
                db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (dest_bal_after, dest_acc['id']))
                db.execute('INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode) VALUES (?, "credit", ?, ?, ?, ?, "UPI")',
                          (dest_acc['id'], amount, f"UPI Received from {sender['upi_id']}", f"{ref}CR", dest_bal_after))
        
        db.commit()

        # Send Debit Alert to Sender
        debit_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #8b0000; text-align: center;">UPI Transaction Alert - Debit</h2>
                <p>Hello {sender['name']},</p>
                <p>Your account <strong>{src_acc['account_number']}</strong> has been debited via UPI with <strong>₹{amount:,.2f}</strong>.</p>
                <p><strong>To VPA:</strong> {target_vpa}</p>
                <p><strong>Reference:</strong> {ref}</p>
                <p><strong>New Balance:</strong> ₹{src_bal_after:,.2f}</p>
                <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">If you did not authorize this transaction, please contact us immediately.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation</p>
            </div>
        </body>
        </html>
        """
        send_email_async(sender['email'], f"UPI Debit Alert: ₹{amount}", debit_body)
        
        if sender and sender.get('phone'):
            send_sms_async(sender['phone'], f"SmartBank: UPI Debit INR {amount:,.2f} to {target_vpa}. Ref: {ref}")

        # Send Credit Alert to Receiver (if internal)
        if receiver:
            if receiver.get('phone'):
                send_sms_async(receiver['phone'], f"SmartBank: UPI Credit INR {amount:,.2f} from {sender['upi_id']}. Ref: {ref}")
                
            credit_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #065f46; text-align: center;">UPI Transaction Alert - Credit</h2>
                    <p>Hello {receiver['name']},</p>
                    <p>Your account has been credited via UPI with <strong>₹{amount:,.2f}</strong>.</p>
                    <p><strong>From VPA:</strong> {sender['upi_id']}</p>
                    <p><strong>Reference:</strong> {ref}</p>
                    <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">Thank you for banking with Smart Bank!</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation</p>
                </div>
            </body>
            </html>
            """
            send_email_async(receiver['email'], f"UPI Credit Alert: ₹{amount}", credit_body)

        return jsonify({
            'success': True, 
            'message': 'UPI Transfer Successful', 
            'reference': ref,
            'details': f"Transferred ₹{amount} to {target_vpa}"
        })
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================================
# CARD & SUPPORT ROUTES
# ============================================================

@app.route('/api/user/cards/request', methods=['POST'])
@login_required
def request_card():
    data = request.json
    user_id = session['user_id']
    card_type = data.get('card_type', 'Classic')
    account_id = data.get('account_id')
    requested_limit = data.get('requested_credit_limit')
    address = data.get('delivery_address', '')
    
    db = get_db()
    try:
        # Normalize card_type - if credit limit is requested, always store as 'Credit'
        if requested_limit:
            card_type = 'Credit'

        # Check for duplicate - only block if there's already a pending request of the SAME category
        # (credit vs debit are tracked independently)
        is_credit_request = card_type.lower() == 'credit' or (requested_limit and requested_limit > 0)
        if is_credit_request:
            existing = db.execute(
                'SELECT id FROM card_requests WHERE user_id = ? AND card_type = "Credit" AND status = "pending"',
                (user_id,)
            ).fetchone()
        else:
            existing = db.execute(
                'SELECT id FROM card_requests WHERE user_id = ? AND (card_type != "Credit" OR card_type IS NULL) AND status = "pending"',
                (user_id,)
            ).fetchone()
        if existing:
            error_label = 'credit card' if is_credit_request else 'debit card'
            return jsonify({'error': f'You already have a pending {error_label} request'}), 400

        db.execute('INSERT INTO card_requests (user_id, account_id, card_type, requested_credit_limit, status) VALUES (?, ?, ?, ?, "pending")',
                  (user_id, account_id, card_type, requested_limit))
        db.commit()
        
        # Send Email Notification for Card Request
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            subject = "New Card Request Received"
            body = f"""
            <h3>Smart Bank Card Request</h3>
            <p>Dear {user['name']},</p>
            <p>We have received your request for a new <strong>{card_type}</strong> card.</p>
            <p><strong>Current Status:</strong> Pending Staff Review</p>
            <p>Once approved, your card will be dispatched to the provided delivery address.</p>
            """
            send_email_async(user['email'], subject, body)
            
        return jsonify({'success': True, 'message': 'Card request submitted'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/mobile/apply-fd', methods=['POST'])
@login_required
def handle_mobile_fd():
    """Handle Fixed Deposit applications from mobile"""
    data = request.json
    user_id = session['user_id']
    amount = data.get('amount')
    tenure = data.get('tenure')
    
    if not amount or amount < 5000:
        return jsonify({'error': 'Minimum FD amount is ₹5,000'}), 400
        
    db = get_db()
    try:
        # Get primary account for the user
        acc = db.execute('SELECT id FROM accounts WHERE user_id = ? AND status = "active" LIMIT 1', (user_id,)).fetchone()
        if not acc:
            return jsonify({'error': 'No active bank account found'}), 400
            
        db.execute('''
            INSERT INTO service_applications (user_id, account_id, service_type, product_name, amount, tenure, status)
            VALUES (?, ?, "Fixed Deposit", "Standard FD", ?, ?, "pending")
        ''', (user_id, acc['id'], amount, tenure))
        db.commit()
        
        return jsonify({
            'success': True, 
            'message': 'FD application submitted successfully!',
            'reference': f"FD-{secrets.token_hex(4).upper()}"
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/mobile/apply-investment', methods=['POST'])
@login_required
def handle_mobile_investment():
    """Handle Mutual Fund and Insurance applications from mobile"""
    data = request.json
    user_id = session['user_id']
    product_name = data.get('product_name')
    account_num = data.get('account_number')
    amount = data.get('amount')
    aadhaar = data.get('aadhaar_number')
    
    if not product_name or not amount:
        return jsonify({'error': 'Product and amount are required'}), 400
        
    db = get_db()
    try:
        # Resolve account number to account ID
        acc = db.execute('SELECT id FROM accounts WHERE account_number = ? AND user_id = ?', (account_num, user_id)).fetchone()
        if not acc:
            return jsonify({'error': 'Invalid linked account selected'}), 400
            
        # Determine service type based on product name
        service_type = 'Mutual Fund'
        if any(x in product_name.lower() for x in ['insurance', 'protect', 'health', 'saver', 'retire']):
            service_type = 'Insurance'
        elif 'gold loan' in product_name.lower():
            service_type = 'Loan'

        db.execute('''
            INSERT INTO service_applications (user_id, account_id, service_type, product_name, amount, status)
            VALUES (?, ?, ?, ?, ?, "pending")
        ''', (user_id, acc['id'], service_type, product_name, amount))
        db.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Application for {product_name} submitted!',
            'reference': f"APP-{secrets.token_hex(4).upper()}"
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/cards/requests', methods=['GET'])
@login_required
def get_card_requests():
    db = get_db()
    user_id = session['user_id']
    try:
        requests = db.execute('''
            SELECT * FROM card_requests
            WHERE user_id = ?
            ORDER BY request_date DESC
        ''', (user_id,)).fetchall()
        return jsonify([dict(r) for r in requests])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/cards/<int:card_id>/block', methods=['POST'])
@login_required
def block_card(card_id):
    db = get_db()
    user_id = session['user_id']
    try:
        card = db.execute('SELECT * FROM cards WHERE id = ? AND user_id = ?', (card_id, user_id)).fetchone()
        if not card: return jsonify({'error': 'Card not found or unauthorized'}), 404
        if card['status'] == 'blocked': return jsonify({'error': 'Card is already blocked'}), 400
        
        db.execute('UPDATE cards SET status = "blocked" WHERE id = ?', (card_id,))
        db.commit()
        
        # Send Email Notification for Card Blocking
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,)).fetchone()
        if user and user['email']:
            subject = "Security Alert: Card Blocked"
            body = f"""
            <h3>Smart Bank Security Notification</h3>
            <p>Dear {user['name']},</p>
            <p>Your card ending in <strong>{card['card_number'][-4:]}</strong> has been successfully <strong>BLOCKED</strong> as per your request.</p>
            <p>If you did not perform this action, please contact our emergency helpline immediately.</p>
            """
            send_email_async(user['email'], subject, body)
            
        return jsonify({'success': True, 'message': f'Card ending in {card["card_number"][-4:]} has been blocked'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/support', methods=['GET', 'POST'])
@login_required
def user_support():
    db = get_db()
    user_id = session['user_id']
    
    if request.method == 'GET':
        tickets = db.execute('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
        return jsonify({'tickets': [dict(t) for t in tickets]})
    
    if request.method == 'POST':
        data = request.json
        subject, message, priority = data.get('subject'), data.get('message'), data.get('priority', 'normal')
        
        try:
            db.execute('INSERT INTO support_tickets (user_id, subject, message, priority, status) VALUES (?, ?, ?, ?, "pending")',
                      (user_id, subject, message, priority))
            db.commit()
            return jsonify({'success': True, 'message': 'Ticket created'})
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500

# ============================================================
# STAFF ROUTES
# ============================================================

@app.route('/api/staff/customers', methods=['GET'])
@role_required(['admin', 'staff'])
def staff_get_customers():
    db = get_db()
    customers = db.execute('''
        SELECT u.id, u.name, u.username, u.email, u.phone, u.status, u.created_at,
               COUNT(DISTINCT a.id) AS account_count,
               COALESCE(SUM(a.balance), 0) AS total_balance
        FROM users u
        LEFT JOIN accounts a ON a.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ''').fetchall()
    return jsonify({'customers': [dict(c) for c in customers]})

@app.route('/api/staff/dashboard', methods=['GET'])
@role_required('staff')
def staff_dashboard():
    db = get_db()
    now = datetime.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    last_month_start = (now.replace(day=1) - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # 1. Stats and Trends
    total_customers = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    prev_customers = db.execute('SELECT COUNT(*) FROM users WHERE created_at < ?', (this_month_start,)).fetchone()[0]
    cust_growth = ((total_customers - prev_customers) / prev_customers * 100) if prev_customers > 0 else 0
    
    total_accounts = db.execute('SELECT COUNT(*) FROM accounts WHERE status = "active"').fetchone()[0]
    prev_accounts = db.execute('SELECT COUNT(*) FROM accounts WHERE status = "active" AND created_at < ?', (this_month_start,)).fetchone()[0]
    acc_growth = ((total_accounts - prev_accounts) / prev_accounts * 100) if prev_accounts > 0 else 0
    
    stats = {
        'total_customers': total_customers,
        'customer_trend': f"{'+' if cust_growth >= 0 else ''}{cust_growth:.1f}%",
        'pending_loans': db.execute('SELECT COUNT(*) FROM loans WHERE status = "pending"').fetchone()[0],
        'loan_trend': "No change", # Simplified for now
        'total_balance': db.execute('SELECT SUM(balance) FROM accounts').fetchone()[0] or 0,
        'balance_trend': "15%", # Mocking balance trend for now as it needs historical balance snapshots
        'total_accounts': total_accounts,
        'account_trend': f"{'+' if acc_growth >= 0 else ''}{acc_growth:.1f}%"
    }
    
    recent_customers_cur = db.execute('SELECT id, name, username, email FROM users ORDER BY created_at DESC LIMIT 5').fetchall()
    recent_customers = [dict(c) for c in recent_customers_cur]
    
    pending_loans_cur = db.execute('''
        SELECT l.id, l.loan_type as title, u.name as customer, "high" as priority 
        FROM loans l JOIN users u ON l.user_id = u.id 
        WHERE l.status = "pending" ORDER BY l.application_date DESC LIMIT 5
    ''').fetchall()
    pending_loans = [dict(l) for l in pending_loans_cur]
    
    recent_transactions_cur = db.execute('''
        SELECT t.id, t.reference_number, u.name as customer, a.account_number as account, t.type, t.amount, t.transaction_date as date, "completed" as status
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC LIMIT 5
    ''').fetchall()
    recent_transactions = [dict(t) for t in recent_transactions_cur]
    
    return jsonify({
        'success': True, 
        'stats': stats,
        'recent_customers': recent_customers,
        'pending_loans': pending_loans,
        'recent_transactions': recent_transactions
    })

@app.route('/api/staff/analytics', methods=['GET'])
@role_required('staff')
def staff_analytics():
    db = get_db()
    
    # 1. Accounts by Type
    account_types_cur = db.execute('''
        SELECT account_type, COUNT(*) as count 
        FROM accounts 
        GROUP BY account_type
    ''').fetchall()
    account_types = {row['account_type']: row['count'] for row in account_types_cur}
    
    # 2. Loans by Status
    loan_status_cur = db.execute('''
        SELECT status, COUNT(*) as count
        FROM loans
        GROUP BY status
    ''').fetchall()
    loan_status = {row['status']: row['count'] for row in loan_status_cur}
    
    # 3. Recent Transaction Volume (Last 7 Days)
    # Using simple SQLite strftime to group by date
    daily_volume_cur = db.execute('''
        SELECT date(transaction_date) as t_date, SUM(amount) as total_amount
        FROM transactions
        GROUP BY date(transaction_date)
        ORDER BY t_date DESC
        LIMIT 7
    ''').fetchall()
    
    # Reverse to have oldest->newest for the chart
    daily_volume = [{'date': row['t_date'], 'amount': row['total_amount']} for row in reversed(daily_volume_cur)]

    return jsonify({
        'success': True,
        'account_types': account_types,
        'loan_status': loan_status,
        'daily_volume': daily_volume
    })

@app.route('/api/staff/accounts', methods=['GET'])
@role_required('staff')
def get_staff_accounts():
    db = get_db()
    accounts = db.execute('''
        SELECT a.*, u.name as user_name 
        FROM accounts a 
        JOIN users u ON a.user_id = u.id 
        ORDER BY a.created_at DESC
    ''').fetchall()
    return jsonify({'accounts': [dict(a) for a in accounts]})

@app.route('/api/staff/accounts/<int:account_id>/details', methods=['GET'])
@role_required('staff')
def get_staff_account_details(account_id):
    db = get_db()
    
    # 1. Fetch Account Info
    account = db.execute('''
        SELECT a.*, u.name as user_name, u.email as user_email, u.phone as user_phone
        FROM accounts a 
        JOIN users u ON a.user_id = u.id 
        WHERE a.id = ?
    ''', (account_id,)).fetchone()
    
    if not account:
        return jsonify({'error': 'Account not found'}), 404
        
    # 2. Fetch Recent Transactions for this account
    transactions = db.execute('''
        SELECT * FROM transactions 
        WHERE account_id = ? 
        ORDER BY transaction_date DESC LIMIT 20
    ''', (account_id,)).fetchall()
    
    return jsonify({
        'account': dict(account),
        'transactions': [dict(t) for t in transactions]
    })


@app.route('/api/staff/lookup', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_lookup():
    query = request.args.get('q', '').strip()
    lookup_type = request.args.get('type', 'account') # 'account' or 'user'
    
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
        
    db = get_db()
    
    if lookup_type == 'account':
        # Lookup account by number
        account = db.execute('''
            SELECT a.*, u.name as user_name, u.email as user_email
            FROM accounts a
            JOIN users u ON a.user_id = u.id
            WHERE a.account_number = ? OR a.id = ?
        ''', (query, query)).fetchone()
        
        if account:
            return jsonify({'success': True, 'data': dict(account)})
        return jsonify({'success': False, 'error': 'Account not found'}), 404
        
    elif lookup_type == 'user':
        # Search users by name, username, or phone
        search_q = f"%{query}%"
        users = db.execute('''
            SELECT id, name, username, email, phone, status
            FROM users
            WHERE name LIKE ? OR username LIKE ? OR phone LIKE ? OR id = ?
            LIMIT 10
        ''', (search_q, search_q, search_q, query if query.isdigit() else -1)).fetchall()
        
        return jsonify({'success': True, 'data': [dict(u) for u in users]})
        
    return jsonify({'error': 'Invalid lookup type'}), 400


@app.route('/api/staff/support', methods=['GET'])
@role_required('staff')
def get_all_support_tickets():
    db = get_db()
    tickets = db.execute('''
        SELECT s.id, s.subject, s.message, s.priority, s.status, s.created_at, s.resolved_at,
               u.name as user_name, u.email as user_email
        FROM support_tickets s
        JOIN users u ON s.user_id = u.id
        ORDER BY 
            CASE WHEN s.status = 'pending' THEN 0 ELSE 1 END,
            s.created_at DESC
    ''').fetchall()
    return jsonify({'tickets': [dict(t) for t in tickets]})

@app.route('/api/staff/support/<int:ticket_id>/resolve', methods=['PUT'])
@role_required('staff')
def resolve_support_ticket(ticket_id):
    db = get_db()
    staff_id = session.get('staff_id') or session.get('user_id')
    
    try:
        db.execute('''
            UPDATE support_tickets 
            SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
            WHERE id = ? AND status = 'pending'
        ''', (staff_id, ticket_id))
        db.commit()
        return jsonify({'success': True, 'message': 'Ticket marked as resolved'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/add_customer', methods=['POST'])
@role_required('staff')
def staff_add_customer():
    data = request.json
    db = get_db()
    try:
        from werkzeug.security import generate_password_hash
        hashed_pw = generate_password_hash(data['password'])
        cursor = db.execute(
            'INSERT INTO users (name, email, username, password, phone, address, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (data['name'], data['email'], data['username'], hashed_pw, data.get('phone', ''), data.get('address', ''), data.get('status', 'active'))
        )
        db.commit()
        return jsonify({'success': True, 'message': 'Customer added successfully', 'id': cursor.lastrowid})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/staff/customers/<int:customer_id>', methods=['PUT'])
@role_required(['admin', 'staff'])
def staff_edit_customer(customer_id):
    data = request.json
    db = get_db()
    
    try:
        db.execute('''
            UPDATE users 
            SET name = ?, email = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (data.get('name'), data.get('email'), data.get('phone'), data.get('kyc_details') or data.get('address'), customer_id))
        db.commit()
        return jsonify({'success': True, 'message': 'Customer details updated successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

import random
@app.route('/api/staff/add_account', methods=['POST'])
@role_required('staff')
def staff_add_account():
    data = request.json
    db = get_db()
    try:
        account_number = ''.join([str(random.randint(0, 9)) for _ in range(12)])
        initial_balance = float(data.get('balance', 0))
        cursor = db.execute(
            'INSERT INTO accounts (user_id, account_number, account_type, balance, status) VALUES (?, ?, ?, ?, ?)',
            (data['user_id'], account_number, data['account_type'], initial_balance, data.get('status', 'active'))
        )
        db.commit()
        return jsonify({'success': True, 'message': 'Account created successfully', 'account_number': account_number})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/staff/account_requests', methods=['GET'])
@role_required('staff')
def get_staff_account_requests():
    db = get_db()
    requests = db.execute('''
        SELECT ar.*, u.name as user_name, u.email as user_email
        FROM account_requests ar
        JOIN users u ON ar.user_id = u.id
        ORDER BY ar.request_date DESC
    ''').fetchall()
    return jsonify({'requests': [dict(r) for r in requests]})

@app.route('/api/staff/account_requests/<int:req_id>', methods=['PUT'])
@role_required('staff')
def approve_account_request(req_id):
    data = request.json
    action = data.get('action') # 'approve' or 'reject'
    staff_id = session.get('staff_id')
    db = get_db()
    
    req = db.execute('SELECT * FROM account_requests WHERE id = ?', (req_id,)).fetchone()
    if not req:
        return jsonify({'error': 'Request not found'}), 404
        
    if req['status'] != 'pending':
        return jsonify({'error': 'Request already processed'}), 400
        
    try:
        user = db.execute('SELECT email, name FROM users WHERE id = ?', (req['user_id'],)).fetchone()
        
        if action == 'approve':
            import random
            random_digits = ''.join([str(random.randint(0, 9)) for _ in range(12)])
            acc_num = f"SB{random_digits}"
            
            # Check if this is an account conversion
            req_dict = dict(req)
            original_acc_id = req_dict.get('original_account_id')
            if original_acc_id:
                # Update existing account's type and tax_id
                db.execute('UPDATE accounts SET account_type = ?, tax_id = ? WHERE id = ?',
                           (req['account_type'], req['tax_id'], original_acc_id))
                msg = 'Account successfully converted'
                if user and user['email']:
                    subject = "Account Conversion Approved"
                    body = f"""
                    <h3>Account Conversion Approved!</h3>
                    <p>Dear {user['name']},</p>
                    <p>Your request to convert account {original_acc_id} to a <strong>{req['account_type']}</strong> account has been approved.</p>
                    <p>Thank you for banking with Smart Bank.</p>
                    """
                    send_email_async(user['email'], subject, body)
            else:
                # Create a new account
                db.execute('INSERT INTO accounts (user_id, account_number, account_type, tax_id, balance, status) VALUES (?, ?, ?, ?, 0.00, "active")',
                          (req['user_id'], acc_num, req['account_type'], req['tax_id']))
                msg = 'Account approved and created'
                if user and user['email']:
                    subject = "New Account Request Approved"
                    body = f"""
                    <h3>New Account Approved!</h3>
                    <p>Dear {user['name']},</p>
                    <p>Your request for a new <strong>{req['account_type']}</strong> account has been approved.</p>
                    <p><strong>Account Number:</strong> {acc_num}</p>
                    <p>Thank you for banking with Smart Bank.</p>
                    """
                    send_email_async(user['email'], subject, body)
                
            db.execute('UPDATE account_requests SET status = "approved", processed_date = CURRENT_TIMESTAMP, processed_by = ? WHERE id = ?', (staff_id, req_id))
        elif action == 'reject':
            db.execute('UPDATE account_requests SET status = "rejected", processed_date = CURRENT_TIMESTAMP, processed_by = ? WHERE id = ?', (staff_id, req_id))
            if user and user['email']:
                subject = "Account Request Rejected"
                body = f"""
                <h3>Account Request Update</h3>
                <p>Dear {user['name']},</p>
                <p>Your request for a new <strong>{req['account_type']}</strong> account/conversion has been rejected.</p>
                <p>Please contact support for more details.</p>
                <p>Thank you for choosing Smart Bank.</p>
                """
                send_email_async(user['email'], subject, body)
            msg = 'Account request/conversion rejected'
            if user and user['email']:
                subject = "Account Request/Conversion Rejected"
                body = f"""
                <h3>Account Request/Conversion Update</h3>
                <p>Dear {user['name']},</p>
                <p>Your recent request for an account ({req['account_type']}) has been rejected.</p>
                <p>Please contact support for more details if needed.</p>
                """
                send_email_async(user['email'], subject, body)
        else:
            return jsonify({'error': 'Invalid action'}), 400
            
        db.commit()
        return jsonify({'success': True, 'message': msg})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/staff/notifications/send', methods=['POST'])
@role_required(['staff', 'admin'])
def staff_send_notification():
    data = request.json
    db = get_db()
    
    user_id = data.get('user_id')
    title = data.get('title')
    message = data.get('message')
    notif_type = data.get('type', 'info')
    
    if not title or not message:
        return jsonify({'error': 'Title and message are required'}), 400
        
    try:
        if user_id and user_id != 'ALL':
            db.execute(
                'INSERT INTO notifications (user_id, sender_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
                (user_id, session.get('user_id'), title, message, notif_type)
            )
        else:
            # Send to all users
            users = db.execute("SELECT id FROM users WHERE role = 'user'").fetchall()
            for user in users:
                db.execute(
                    'INSERT INTO notifications (user_id, sender_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
                    (user['id'], session.get('user_id'), title, message, notif_type)
                )
                
        db.commit()
        return jsonify({'success': True, 'message': 'Notification(s) sent successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/staff/transactions', methods=['GET'])
@role_required('staff')
def get_staff_transactions():
    db = get_db()
    transactions = db.execute('''
        SELECT t.*, a.account_number, u.name as user_name 
        FROM transactions t 
        JOIN accounts a ON t.account_id = a.id 
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC LIMIT 50
    ''').fetchall()
    return jsonify({'transactions': [dict(t) for t in transactions]})

@app.route('/api/staff/transaction/add', methods=['POST'])
@role_required(['staff', 'admin'])
def staff_transaction_add():
    data = request.json
    account_id = data.get('account_id')
    amount_str = data.get('amount')

    if not account_id or not amount_str:
        return jsonify({'error': 'Account ID and Amount are required'}), 400

    try:
        amount = float(amount_str)
        if amount <= 0:
            return jsonify({'error': 'Amount must be a positive number'}), 400

        db = get_db()
        account = db.execute('SELECT * FROM accounts WHERE id = ? OR account_number = ?', (account_id, account_id)).fetchone()
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404

        resolved_id = account['id']
        new_balance = account['balance'] + amount
        
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, resolved_id))
        
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, balance_after, status, description, mode)
            VALUES (?, 'credit', ?, ?, 'completed', 'Staff Deposit', 'CASH')
        ''', (resolved_id, amount, new_balance))
        
        db.commit()
        
        # Send Email Notification for Staff Deposit
        user = db.execute('SELECT email, name, phone FROM users WHERE id = ?', (account['user_id'],)).fetchone()
        if user and user['email']:
            subject = "Credit Alert: Funds Deposited"
            body = f"""
            <h3>Smart Bank Transaction Alert</h3>
            <p>Dear {user['name']},</p>
            <p>A deposit of <strong>₹{amount:,.2f}</strong> has been credited to your account ending in {account['account_number'][-4:]} by our branch staff.</p>
            <p><strong>New Balance:</strong> ₹{new_balance:,.2f}</p>
            """
            send_email_async(user['email'], subject, body)
            
        if user and user['phone']:
            send_sms_async(user['phone'], f"SmartBank: Account {account['account_number'][-4:]} credited with INR {amount:,.2f} by branch staff. New Balance: INR {new_balance:,.2f}")
            
        return jsonify({'success': True, 'message': 'Funds added successfully'})
    except ValueError:
        return jsonify({'error': 'Invalid amount format'}), 400
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/transaction/withdraw', methods=['POST'])
@role_required(['staff', 'admin'])
def staff_transaction_withdraw():
    data = request.json
    account_id = data.get('account_id')
    amount_str = data.get('amount')

    if not account_id or not amount_str:
        return jsonify({'error': 'Account ID and Amount are required'}), 400

    try:
        amount = float(amount_str)
        if amount <= 0:
            return jsonify({'error': 'Amount must be a positive number'}), 400

        db = get_db()
        account = db.execute('SELECT * FROM accounts WHERE id = ? OR account_number = ?', (account_id, account_id)).fetchone()
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404

        resolved_id = account['id']
        if account['balance'] < amount:
            return jsonify({'error': 'Insufficient account balance'}), 400

        new_balance = account['balance'] - amount
        
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_balance, resolved_id))
        
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, balance_after, status, description, mode)
            VALUES (?, 'debit', ?, ?, 'completed', 'Staff Withdrawal', 'CASH')
        ''', (resolved_id, amount, new_balance))
        
        db.commit()
        
        # Send Email Notification for Staff Withdrawal
        user = db.execute('SELECT email, name, phone FROM users WHERE id = ?', (account['user_id'],)).fetchone()
        if user and user['email']:
            subject = "Debit Alert: Funds Withdrawn"
            body = f"""
            <h3>Smart Bank Transaction Alert</h3>
            <p>Dear {user['name']},</p>
            <p>A withdrawal of <strong>₹{amount:,.2f}</strong> has been processed on your account ending in {account['account_number'][-4:]} by our branch staff.</p>
            <p><strong>New Balance:</strong> ₹{new_balance:,.2f}</p>
            <p>If this was not authorized by you, please report to a branch immediately.</p>
            """
            send_email_async(user['email'], subject, body)
            
        if user and user['phone']:
            send_sms_async(user['phone'], f"SmartBank: Account {account['account_number'][-4:]} debited with INR {amount:,.2f} by branch staff. New Balance: INR {new_balance:,.2f}")
            
        return jsonify({'success': True, 'message': 'Funds withdrawn successfully'})
    except ValueError:
        return jsonify({'error': 'Invalid amount format'}), 400
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/transaction/transfer', methods=['POST'])
@role_required(['staff', 'admin'])
def staff_transaction_transfer():
    data = request.json
    sender_id = data.get('sender_account_id')
    receiver_acc_num = data.get('receiver_account_number')
    amount_str = data.get('amount')

    if not sender_id or not receiver_acc_num or not amount_str:
        return jsonify({'error': 'Sender ID, Receiver Account Number, and Amount are required'}), 400

    try:
        amount = float(amount_str)
        if amount <= 0:
            return jsonify({'error': 'Amount must be a positive number'}), 400

        db = get_db()
        sender_acc = db.execute('SELECT * FROM accounts WHERE id = ? OR account_number = ?', (sender_id, sender_id)).fetchone()
        receiver_acc = db.execute('SELECT * FROM accounts WHERE account_number = ? OR id = ?', (receiver_acc_num, receiver_acc_num)).fetchone()
        
        if not sender_acc:
            return jsonify({'error': 'Sender account not found'}), 404
            
        if not receiver_acc:
            return jsonify({'error': 'Receiver account not found'}), 404
            
        if sender_acc['id'] == receiver_acc['id']:
            return jsonify({'error': 'Cannot transfer to the same account'}), 400
            
        if sender_acc['balance'] < amount:
            return jsonify({'error': 'Insufficient sender balance'}), 400

        sender_new_balance = sender_acc['balance'] - amount
        receiver_new_balance = receiver_acc['balance'] + amount
        
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (sender_new_balance, sender_acc['id']))
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (receiver_new_balance, receiver_acc['id']))
        
        # Log sender tx
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, status, description, related_account)
            VALUES (?, 'Transfer', ?, 'Completed', 'Staff Transfer To ' || ?, ?)
        ''', (sender_acc['id'], amount, receiver_acc_num, receiver_acc_num))
        
        # Log receiver tx
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, status, description, related_account)
            VALUES (?, 'Deposit', ?, 'Completed', 'Staff Transfer From ' || ?, ?)
        ''', (receiver_acc['id'], amount, sender_acc['account_number'], sender_acc['account_number']))
        
        db.commit()
        
        # Send Email Notification to Sender
        sender_user = db.execute('SELECT email, name, phone FROM users WHERE id = ?', (sender_acc['user_id'],)).fetchone()
        if sender_user and sender_user['email']:
            subject = "Debit Alert: Transfer Processed"
            body = f"""
            <h3>Smart Bank Transaction Alert</h3>
            <p>Dear {sender_user['name']},</p>
            <p>A transfer of <strong>₹{amount:,.2f}</strong> from your account ending in {sender_acc['account_number'][-4:]} to account <strong>{receiver_acc_num}</strong> has been processed by our office staff.</p>
            <p><strong>New Balance:</strong> ₹{sender_new_balance:,.2f}</p>
            """
            send_email_async(sender_user['email'], subject, body)
            
        if sender_user and sender_user['phone']:
            send_sms_async(sender_user['phone'], f"SmartBank: Staff Transfer of INR {amount:,.2f} to {receiver_acc_num} processed. New Balance: INR {sender_new_balance:,.2f}")
            
        # Send Email Notification to Receiver
        receiver_user = db.execute('SELECT email, name, phone FROM users WHERE id = ?', (receiver_acc['user_id'],)).fetchone()
        if receiver_user and receiver_user['email']:
            subject = "Credit Alert: Funds Received"
            body = f"""
            <h3>Smart Bank Transaction Alert</h3>
            <p>Dear {receiver_user['name']},</p>
            <p>An amount of <strong>₹{amount:,.2f}</strong> has been credited to your account ending in {receiver_acc['account_number'][-4:]} from account <strong>{sender_acc['account_number']}</strong> via staff transfer.</p>
            <p><strong>New Balance:</strong> ₹{receiver_new_balance:,.2f}</p>
            """
            send_email_async(receiver_user['email'], subject, body)
            
        if receiver_user and receiver_user['phone']:
            send_sms_async(receiver_user['phone'], f"SmartBank: Account {receiver_acc['account_number'][-4:]} credited INR {amount:,.2f} from {sender_acc['account_number'][-4:]} via Staff Transfer. New Balance: INR {receiver_new_balance:,.2f}")
            
        return jsonify({'success': True, 'message': 'Transfer completed successfully'})
    except ValueError:
        return jsonify({'error': 'Invalid amount format'}), 400
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================================
# STAFF MANAGEMENT ROUTES
# ============================================================

@app.route('/api/staff/loans', methods=['GET'])
@role_required('staff')
def get_staff_loans():
    db = get_db()
    loans = db.execute('''
        SELECT l.*, u.name as user_name 
        FROM loans l 
        JOIN users u ON l.user_id = u.id 
        ORDER BY l.application_date DESC
    ''').fetchall()
    return jsonify({'loans': [dict(l) for l in loans]})

@app.route('/api/staff/loans/<int:loan_id>', methods=['PUT'])
@role_required('staff')
def update_loan_status(loan_id):
    data = request.json
    status = data.get('status')
    reason = data.get('reason')
    staff_id = session['staff_id']
    
    db = get_db()
    try:
        loan = db.execute('SELECT * FROM loans WHERE id = ?', (loan_id,)).fetchone()
        if not loan:
            return jsonify({'error': 'Loan not found'}), 404
            
        if status == 'approved':
            # Check availability in Loan Liquidity Fund
            fund = db.execute('SELECT * FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
            if not fund or fund['balance'] < loan['loan_amount']:
                return jsonify({'error': 'Insufficient funds in Loan Liquidity Fund'}), 400
                
            # 1. Distribute loan to target account
            target_account_id = loan['target_account_id']
            if target_account_id:
                amount = loan['loan_amount']
                db.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, target_account_id))
                
                # 2. Deduct from Liquidity Fund
                db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
                
                # 3. Log transaction
                ref = f"LN{secrets.token_hex(4).upper()}"
                db.execute('''
                    INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status)
                    VALUES (?, 'credit', ?, ?, ?, 'Loan Disbursed', 'completed')
                ''', (target_account_id, amount, f"Disbursement of {loan['loan_type']}", ref))
                
                db.execute('UPDATE loans SET status = ?, approved_by = ?, approved_date = CURRENT_TIMESTAMP, disbursement_date = CURRENT_TIMESTAMP, next_due_date = date("now", "+30 days") WHERE id = ?',
                          (status, staff_id, loan_id))
            else:
                # Fallback if no target account (older records)
                amount = loan['loan_amount']
                # Deduct from Liquidity Fund
                db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
                
                db.execute('UPDATE loans SET status = ?, approved_by = ?, approved_date = CURRENT_TIMESTAMP, next_due_date = date("now", "+30 days") WHERE id = ?',
                          (status, staff_id, loan_id))
        else:
            db.execute('UPDATE loans SET status = ? WHERE id = ?', (status, loan_id))
            
        db.commit()
        
        # Email Notification & Formal Receipt
        user = db.execute('SELECT email, name, phone FROM users WHERE id = ?', (loan['user_id'],)).fetchone()
        if user and user['email']:
            # ... email logic ... (already there)
            pass
            
        if user and user['phone']:
            send_sms_async(user['phone'], f"SmartBank: Your Loan Application for {loan['loan_type']} has been {status.upper()}.{' Disbursement processed.' if status == 'approved' else ''}")
            subject = f"Loan Application {status.capitalize()} - Smart Bank"
            
            if status == 'approved':
                body = f"""
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #2c3e50;">Loan Approval Receipt</h2>
                    <p>Dear {user['name']},</p>
                    <p>We are pleased to inform you that your loan application has been <strong>approved</strong> and the funds have been disbursed to your account.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Loan Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{loan['loan_type']}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Loan Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">INR {loan['loan_amount']:,.2f}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Interest Rate:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{loan['interest_rate']}% p.a.</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tenure:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{loan['tenure_months']} Months</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Disbursement Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{datetime.now().strftime('%Y-%m-%d')}</td></tr>
                    </table>
                    
                    <p style="margin-top: 20px;">Please visit your dashboard to manage your repayments. Thank you for choosing Smart Bank.</p>
                    <hr>
                    <p style="font-size: 12px; color: #7f8c8d;">This is an automated receipt. No signature required.</p>
                </div>
                """
            else:
                body = f"""
                <h3>Loan Status Update</h3>
                <p>Dear {user['name']},</p>
                <p>Your loan application status has been updated to: <strong>{status}</strong>.</p>
                <p>{f'<strong>Staff Remark:</strong> {reason}' if reason else ''}</p>
                <p>Thank you for choosing Smart Bank.</p>
                """
            send_email_async(user['email'], subject, body)
            
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/support', methods=['GET'])
@role_required('staff')
def get_staff_support():
    db = get_db()
    tickets = db.execute('''
        SELECT t.*, u.name as user_name, s.name as resolved_by_name
        FROM support_tickets t 
        JOIN users u ON t.user_id = u.id 
        LEFT JOIN staff s ON t.resolved_by = s.id
        ORDER BY t.created_at DESC
    ''').fetchall()
    return jsonify({'tickets': [dict(t) for t in tickets]})

@app.route('/api/staff/support/<int:ticket_id>/status', methods=['PUT'])
@role_required('staff')
def update_ticket_status(ticket_id):
    data = request.json
    status = data.get('status')
    staff_id = session['staff_id']
    
    db = get_db()
    try:
        db.execute('UPDATE support_tickets SET status = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
                  (status, staff_id, ticket_id))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        # Retry without resolved_by if it fails (in case schema mismatch)
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/card-requests', methods=['GET'])
@role_required('staff')
def get_staff_card_requests():
    db = get_db()
    requests = db.execute('''
        SELECT cr.*, u.name as user_name, a.account_number 
        FROM card_requests cr
        JOIN users u ON cr.user_id = u.id
        LEFT JOIN accounts a ON cr.account_id = a.id
        ORDER BY cr.request_date DESC
    ''').fetchall()
    return jsonify({'requests': [dict(r) for r in requests]})

@app.route('/api/staff/card-requests/<int:card_id>', methods=['PUT'])
@role_required('staff')
def update_card_request_status(card_id):
    data = request.json
    status = data.get('status')
    if status not in ['approved', 'rejected']:
        return jsonify({'error': 'Invalid status'}), 400
        
    db = get_db()
    try:
        db.execute('UPDATE card_requests SET status = ? WHERE id = ?', (status, card_id))
        db.commit()
        
        # Send Email Notification for Card Request Update
        req = db.execute('SELECT * FROM card_requests WHERE id = ?', (card_id,)).fetchone()
        if req:
            user = db.execute('SELECT email, name FROM users WHERE id = ?', (req['user_id'],)).fetchone()
            if user and user['email']:
                subject = f"Card Request {status.capitalize()}"
                body = f"""
                <h3>Smart Bank Card Request Update</h3>
                <p>Dear {user['name']},</p>
                <p>Your request for a <strong>{req['card_type']}</strong> card has been <strong>{status.upper()}</strong>.</p>
                { '<p>Your card has been dispatched and will reach you shortly.</p>' if status == 'approved' else '<p>Please contact support or visit your nearest branch for more details.</p>' }
                """
                send_email_async(user['email'], subject, body)
                
        return jsonify({'success': True, 'message': f'Card request {status} successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# ADMIN ROUTES
# ============================================================


@app.route('/api/admin/users', methods=['GET'])
@role_required('admin')
def admin_get_users():
    db = get_db()
    # Left join to get account counts and total balance
    users = db.execute('''
        SELECT u.id, u.name, u.username, u.email, u.phone, u.status, 
               COUNT(a.id) as account_count, 
               SUM(IFNULL(a.balance, 0)) as total_balance
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        GROUP BY u.id
    ''').fetchall()
    return jsonify([dict(u) for u in users])

@app.route('/api/admin/users/create', methods=['POST'])
@role_required(['admin', 'staff'])
def admin_create_user():
    """Admin or Staff creates a new user account directly."""
    data = request.json
    name     = data.get('name', '').strip()
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip()
    phone    = data.get('phone', '').strip()
    password = data.get('password', '')
    dob      = data.get('dob')

    if not name or not username or not email or not password:
        return jsonify({'error': 'Name, username, email and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    db = get_db()
    try:
        # Check duplicates
        existing = db.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone()
        if existing:
            return jsonify({'error': 'Username or email already exists'}), 409

        hashed_pw = generate_password_hash(password)
        db.execute(
            'INSERT INTO users (name, username, email, phone, password, date_of_birth, status) VALUES (?, ?, ?, ?, ?, ?, "active")',
            (name, username, email, phone or None, hashed_pw, dob or None)
        )
        db.commit()

        # Send welcome email
        if email:
            subject = "Welcome to Smart Bank!"
            body = f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px;">
              <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px;border-radius:12px 12px 0 0;text-align:center;color:white;">
                <h1 style="margin:0;font-size:24px;">🏦 Welcome to Smart Bank!</h1>
              </div>
              <div style="background:white;padding:28px;border-radius:0 0 12px 12px;">
                <p>Dear <strong>{name}</strong>,</p>
                <p>Your Smart Bank account has been created by our administrator. Here are your login credentials:</p>
                <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0;">
                  <p style="margin:4px 0;"><strong>Username:</strong> {username}</p>
                  <p style="margin:4px 0;"><strong>Password:</strong> {password}</p>
                  <p style="margin:4px 0;color:#6b7280;font-size:13px;">Please change your password after first login.</p>
                </div>
                <p><a href="http://localhost:5000" style="background:#4f46e5;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Login Now →</a></p>
                <p style="margin-top:24px;">Regards,<br><strong>Smart Bank Team</strong></p>
              </div>
            </div>"""
            send_email_async(email, subject, body)

        log_audit('Admin', f'Created new user: {username} ({name})')
        return jsonify({'success': True, 'message': f'User {name} created successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/user/<int:user_id>', methods=['DELETE'])
@role_required(['admin', 'staff'])
def admin_delete_user(user_id):
    db = get_db()
    try:
        # Check if user exists
        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        db.execute('DELETE FROM users WHERE id = ?', (user_id,))
        db.commit()
        
        # Log audit
        log_audit(session.get('admin_id') or session.get('staff_id'), 
                  session.get('role'), 
                  'DELETE_USER', f'Deleted user ID {user_id}: {user["name"]}')
                  
        return jsonify({'success': True, 'message': 'User and all associated data deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/log-activity', methods=['POST'])
@role_required(['user'])
def log_user_activity():
    data = request.json
    action = data.get('action')
    details = data.get('details', '')
    
    if not action:
        return jsonify({'error': 'Action is required'}), 400
        
    try:
        db = get_db()
        db.execute('''
            INSERT INTO user_activity_logs (user_id, action, details, ip_address)
            VALUES (?, ?, ?, ?)
        ''', (session['user_id'], action, details, request.remote_addr))
        db.commit()
        return jsonify({'success': True, 'message': 'Activity logged'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/user/<int:user_id>/activity', methods=['GET'])
@role_required(['admin', 'staff'])
def get_user_activity(user_id):
    try:
        db = get_db()
        user = db.execute('SELECT id, name, email, phone, status, username, date_of_birth, address, created_at FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        accounts = db.execute('''
            SELECT id, account_number, account_type, balance, status, ifsc, branch
            FROM accounts WHERE user_id = ?
        ''', (user_id,)).fetchall()

        transactions = db.execute('''
            SELECT t.id, t.type, t.amount, t.description, t.transaction_date, t.reference_number, t.mode, a.account_number
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ?
            ORDER BY t.transaction_date DESC LIMIT 50
        ''', (user_id,)).fetchall()

        cards = db.execute('SELECT id, card_type, card_number, status, expiry_date FROM cards WHERE user_id = ?', (user_id,)).fetchall()
        loans = db.execute('SELECT id, loan_type, loan_amount, status, interest_rate, tenure_months, application_date FROM loans WHERE user_id = ?', (user_id,)).fetchall()
        
        activity_logs = db.execute('''
            SELECT id, action, details, ip_address, created_at
            FROM user_activity_logs
            WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 50
        ''', (user_id,)).fetchall()

        return jsonify({
            'user': dict(user),
            'accounts': [dict(a) for a in accounts],
            'transactions': [dict(t) for t in transactions],
            'cards': [dict(c) for c in cards],
            'loans': [dict(l) for l in loans],
            'activity_logs': [dict(act) for act in activity_logs]
        })
    except Exception as e:
        print(f"DEBUG: Error in get_user_activity for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/staff', methods=['GET'])
@role_required('admin')
def admin_get_staff():
    db = get_db()
    staff = db.execute('SELECT id, staff_id, name, email, department, position, status, created_at FROM staff ORDER BY created_at DESC').fetchall()
    return jsonify([dict(s) for s in staff])

@app.route('/api/admin/staff', methods=['POST'])
@role_required('admin')
def admin_add_staff():
    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    department = data.get('department', 'General').strip()
    position = data.get('position', 'Staff').strip()
    phone = data.get('phone', '').strip()

    if not all([name, email, password]):
        return jsonify({'error': 'Name, email and password are required'}), 400

    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    db = get_db()
    if db.execute('SELECT id FROM staff WHERE email = ?', (email,)).fetchone():
        return jsonify({'error': 'A staff member with this email already exists'}), 400

    try:
        # Auto-generate staff_id: STF + timestamp
        import time
        staff_id = f"STF{int(time.time())}"
        hashed_pw = generate_password_hash(password)
        cursor = db.execute(
            'INSERT INTO staff (staff_id, password, name, email, phone, department, position, status, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, "active", 50000.00)',
            (staff_id, hashed_pw, name, email, phone, department, position)
        )
        db.commit()
        return jsonify({
            'success': True,
            'message': f'Staff member {name} added successfully!',
            'staff_id': staff_id,
            'id': cursor.lastrowid
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/staff/<int:staff_id_db>', methods=['DELETE'])
@role_required('admin')
def delete_staff(staff_id_db):
    db = get_db()
    try:
        # We pass staff's db ID, not their 'STF...' string staff_id
        db.execute('DELETE FROM staff WHERE id = ?', (staff_id_db,))
        db.commit()
        return jsonify({'success': True, 'message': 'Staff member deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/staff/<int:staff_id_db>/promote', methods=['PUT'])
@role_required('admin')
def promote_staff(staff_id_db):
    db = get_db()
    
    data = request.json or {}
    new_role = data.get('new_role', 'System Admin')
    
    staff_member = db.execute('SELECT * FROM staff WHERE id = ?', (staff_id_db,)).fetchone()
    if not staff_member:
        return jsonify({'error': 'Staff member not found'}), 404
        
    try:
        # Define roles that move staff to the admins table
        admin_roles = {
            'System Admin': 'System Admin',
            'Senior Manager': 'Senior Manager',
            'Junior Manager': 'Junior Manager'
        }
        
        if new_role in admin_roles:
            level = admin_roles[new_role]
            # 1. Insert into admins, map staff_id to username
            db.execute('''
                INSERT INTO admins (username, password, email, name, level)
                VALUES (?, ?, ?, ?, ?)
            ''', (staff_member['staff_id'], staff_member['password'], staff_member['email'], staff_member['name'], level))
            
            # 2. Delete from staff
            db.execute('DELETE FROM staff WHERE id = ?', (staff_id_db,))
            db.commit()
            return jsonify({'success': True, 'message': f'{staff_member["name"]} promoted to {new_role} successfully!'})
        elif new_role in ['Senior Staff', 'Manager']:
            # Update the role in the staff table
            db.execute('UPDATE staff SET position = ? WHERE id = ?', (new_role, staff_id_db))
            db.commit()
            return jsonify({'success': True, 'message': f'{staff_member["name"]} promoted to {new_role} successfully!'})
        else:
            return jsonify({'error': 'Invalid promotion role specified.'}), 400
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# --- NEW ADMIN MANAGEMENT ENDPOINTS ---

@app.route('/api/admin/admins', methods=['GET'])
@role_required('admin')
def get_admins():
    db = get_db()
    admins = db.execute('SELECT id, username, name, email, level, status, created_at FROM admins').fetchall()
    return jsonify([dict(admin) for admin in admins])

@app.route('/api/admin/admins', methods=['POST'])
@role_required('admin')
def add_admin():
    db = get_db()
    data = request.json
    
    if not all(k in data for k in ('username', 'password', 'name', 'email')):
        return jsonify({'error': 'Missing required fields'}), 400
        
    level = data.get('level', 'Junior Manager')
    
    try:
        db.execute('''
            INSERT INTO admins (username, password, name, email, level)
            VALUES (?, ?, ?, ?, ?)
        ''', (data['username'], data['password'], data['name'], data['email'], level))
        db.commit()
        return jsonify({'success': True, 'message': f'Admin {data["name"]} created successfully!'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or Email already exists'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/admins/<int:admin_id>/promote', methods=['PUT'])
@role_required('admin')
def promote_admin(admin_id):
    db = get_db()
    data = request.json or {}
    new_level = data.get('new_level')
    
    if not new_level or new_level not in ['System Admin', 'Senior Manager', 'Junior Manager']:
        return jsonify({'error': 'Invalid level specified'}), 400
        
    try:
        db.execute('UPDATE admins SET level = ? WHERE id = ?', (new_level, admin_id))
        db.commit()
        return jsonify({'success': True, 'message': f'Admin level updated to {new_level}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/admins/<int:admin_id>', methods=['DELETE'])
@role_required('admin')
def delete_admin(admin_id):
    db = get_db()
    
    # Check if this is the last admin
    admin_count = db.execute('SELECT COUNT(*) as count FROM admins').fetchone()['count']
    if admin_count <= 1:
        return jsonify({'error': 'Cannot delete the last administrator'}), 400
        
    try:
        db.execute('DELETE FROM admins WHERE id = ?', (admin_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Admin account deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/staff/<int:staff_id_db>/department', methods=['PUT'])
@role_required('admin')
def update_staff_department(staff_id_db):
    db = get_db()
    
    data = request.json or {}
    new_department = data.get('new_department')
    
    if not new_department:
        return jsonify({'error': 'New department is required'}), 400

    staff_member = db.execute('SELECT * FROM staff WHERE id = ?', (staff_id_db,)).fetchone()
    if not staff_member:
        return jsonify({'error': 'Staff member not found'}), 404
        
    try:
        db.execute('UPDATE staff SET department = ? WHERE id = ?', (new_department, staff_id_db))
        db.commit()
        return jsonify({'success': True, 'message': f'Department updated to {new_department} successfully!'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/accounts', methods=['GET'])
@role_required(['admin', 'staff'])
def get_admin_accounts():
    db = get_db()
    accounts = db.execute('''
        SELECT a.*, u.name as user_name, u.email as user_email
        FROM accounts a 
        JOIN users u ON a.user_id = u.id 
        ORDER BY a.created_at DESC
    ''').fetchall()
    return jsonify({'accounts': [dict(a) for a in accounts]})

@app.route('/api/admin/account/<int:account_id>', methods=['DELETE'])
@role_required(['admin', 'staff'])
def admin_delete_account(account_id):
    db = get_db()
    try:
        # Check if account exists
        acc = db.execute('SELECT * FROM accounts WHERE id = ?', (account_id,)).fetchone()
        if not acc:
            return jsonify({'error': 'Account not found'}), 404
            
        db.execute('DELETE FROM accounts WHERE id = ?', (account_id,))
        db.commit()
        
        # Log audit
        log_audit(session.get('admin_id') or session.get('staff_id'), 
                  session.get('role'), 
                  'DELETE_ACCOUNT', f'Deleted account ID {account_id}, Number: {acc["account_number"]}')
                  
        return jsonify({'success': True, 'message': 'Account and associated transactions deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/loans', methods=['GET'])
@role_required('admin')
def get_admin_loans():
    db = get_db()
    loans = db.execute('''
        SELECT l.*, u.name as user_name, u.email as user_email
        FROM loans l 
        JOIN users u ON l.user_id = u.id 
        ORDER BY l.application_date DESC
    ''').fetchall()
    return jsonify({'loans': [dict(l) for l in loans]})

@app.route('/api/admin/liquidity-fund', methods=['GET'])
@role_required('admin')
def get_admin_liquidity_fund():
    """Get Loan Liquidity Fund summary and all loans with repayment details."""
    db = get_db()
    try:
        # Fund balance
        fund = db.execute('SELECT balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
        fund_balance = float(fund['balance']) if fund else 1000000.00

        # Count stats
        status_filter = request.args.get('status', '')
        base_q = 'SELECT l.*, u.name as user_name, u.email as user_email FROM loans l JOIN users u ON l.user_id = u.id'
        if status_filter:
            loans = db.execute(base_q + ' WHERE l.status = ? ORDER BY l.application_date DESC', (status_filter,)).fetchall()
        else:
            loans = db.execute(base_q + ' ORDER BY l.application_date DESC').fetchall()

        closed_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "closed"').fetchone()[0]
        active_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "approved"').fetchone()[0]
        today = datetime.now().date().isoformat()
        overdue_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "approved" AND next_due_date < ?', (today,)).fetchone()[0]

        return jsonify({
            'success': True,
            'fund_balance': fund_balance,
            'closed_count': closed_count,
            'active_count': active_count,
            'overdue_count': overdue_count,
            'loans': [dict(l) for l in loans]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/loans/<int:loan_id>/closure-letter', methods=['POST'])
@role_required('admin')
def send_closure_letter(loan_id):
    """Re-send loan closure letter to user."""
    db = get_db()
    try:
        loan = db.execute('SELECT l.*, u.name, u.email FROM loans l JOIN users u ON l.user_id = u.id WHERE l.id = ?', (loan_id,)).fetchone()
        if not loan:
            return jsonify({'error': 'Loan not found'}), 404
        if not loan['email']:
            return jsonify({'error': 'User has no email address'}), 400

        subject = "🎉 Loan Closure Confirmation - Smart Bank"
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8fafc; padding: 32px;">
          <div style="background: linear-gradient(135deg, #10b981, #065f46); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Loan Fully Paid Off!</h1>
            <p style="opacity:.85; margin: 8px 0 0;">Smart Bank - Official Loan Closure Letter</p>
          </div>
          <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 24px rgba(0,0,0,.08);">
            <p style="font-size:16px;">Dear <strong>{loan['name']}</strong>,</p>
            <p>This is to formally confirm that your loan <strong>#{loan_id}</strong> ({loan['loan_type']}) has been <strong style="color:#10b981;">fully settled</strong>.</p>
            <div style="background:#f0fdf4;border:2px solid #10b981;border-radius:8px;padding:20px;margin:24px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;">Loan ID</td><td style="font-weight:600;">#{loan_id}</td></tr>
                <tr><td style="padding:6px 0;">Loan Type</td><td style="font-weight:600;">{loan['loan_type']}</td></tr>
                <tr><td style="padding:6px 0;">Original Amount</td><td style="font-weight:600;">₹{float(loan['loan_amount']):,.2f}</td></tr>
                <tr><td style="padding:6px 0;">Status</td><td><span style="background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px;">✅ CLOSED</span></td></tr>
              </table>
            </div>
            <p>No further payments are required. Thank you for banking with Smart Bank!</p>
            <p>Regards,<br><strong>Smart Bank Team</strong></p>
          </div>
        </div>
        """
        send_email_async(loan['email'], subject, body)
        return jsonify({'success': True, 'message': 'Closure letter sent!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/loans/<int:loan_id>/reminder', methods=['POST'])
@role_required('admin')
def send_loan_reminder(loan_id):
    """Send overdue payment reminder to user."""
    db = get_db()
    try:
        loan = db.execute('SELECT l.*, u.name, u.email FROM loans l JOIN users u ON l.user_id = u.id WHERE l.id = ?', (loan_id,)).fetchone()
        if not loan or not loan['email']:
            return jsonify({'error': 'Loan or user not found'}), 404

        outstanding = float(loan['outstanding_amount'] or loan['loan_amount'])
        penalty = float(loan['penalty_amount'] or 0)

        subject = f"⚠️ Loan Payment Reminder - Loan #{loan_id}"
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
            <h1 style="margin:0;font-size:22px;">⚠️ Payment Reminder</h1>
            <p style="opacity:.85;margin:6px 0 0;">Smart Bank - Loan Payment Due</p>
          </div>
          <div style="background: white; padding: 28px; border-radius: 0 0 12px 12px;">
            <p>Dear <strong>{loan['name']}</strong>,</p>
            <p>This is a friendly reminder that your loan payment is <strong style="color:#ef4444;">overdue</strong>.</p>
            <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;">Loan ID</td><td style="font-weight:600;">#{loan_id}</td></tr>
                <tr><td style="padding:6px 0;">Outstanding Amount</td><td style="font-weight:600;color:#ef4444;">₹{outstanding:,.2f}</td></tr>
                {'<tr><td style="padding:6px 0;">Accrued Penalty</td><td style="font-weight:600;color:#f59e0b;">₹' + f"{penalty:,.2f}" + '</td></tr>' if penalty > 0 else ''}
                <tr><td style="padding:6px 0;">Due Date</td><td style="font-weight:600;">{loan['next_due_date'] or 'N/A'}</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:13px;">Please make your payment immediately to avoid further daily penalties of 0.1% of your monthly installment.</p>
            <p>Log in to Smart Bank to pay now: <a href="http://localhost:5000/frontend/userdash.html" style="color:#4f46e5;font-weight:600;">Pay Now →</a></p>
            <p>Regards,<br><strong>Smart Bank Team</strong></p>
          </div>
        </div>
        """
        send_email_async(loan['email'], subject, body)
        return jsonify({'success': True, 'message': 'Reminder sent!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reports', methods=['GET'])
@role_required('admin')
def get_admin_reports():
    db = get_db()
    
    # 1. User Distribution
    user_dist = db.execute('SELECT status, COUNT(*) as count FROM users GROUP BY status').fetchall()
    
    # 2. Account Distribution
    acc_dist = db.execute('SELECT account_type, COUNT(*) as count FROM accounts GROUP BY account_type').fetchall()
    
    # 3. Loan Status Overview
    loan_status = db.execute('SELECT status, COUNT(*) as count FROM loans GROUP BY status').fetchall()
    
    # 4. Total Liquidity
    total_liquidity = db.execute('SELECT SUM(balance) FROM accounts').fetchone()[0] or 0
    
    # 5. Transaction Volume Trends (Last 30 Days)
    daily_volume = db.execute('''
        SELECT date(transaction_date) as t_date, SUM(amount) as total_amount
        FROM transactions
        WHERE transaction_date >= date('now', '-30 days')
        GROUP BY date(transaction_date)
        ORDER BY t_date ASC
    ''').fetchall()
    
    return jsonify({
        'success': True,
        'user_distribution': {row['status']: row['count'] for row in user_dist},
        'account_distribution': {row['account_type']: row['count'] for row in acc_dist},
        'loan_status': {row['status']: row['count'] for row in loan_status},
        'total_liquidity': total_liquidity,
        'transaction_trends': [dict(row) for row in daily_volume]
    })

import io
import csv

@app.route('/api/admin/reports/download', methods=['GET'])
@role_required('admin')
def download_admin_report():
    report_type = request.args.get('type')
    db = get_db()
    
    si = io.StringIO()
    cw = csv.writer(si)
    
    if report_type == 'users':
        users = db.execute('''
            SELECT u.id, u.username, u.email, u.name, u.phone, u.status, u.created_at,
                   COUNT(a.id) as ac_count
            FROM users u
            LEFT JOIN accounts a ON u.id = a.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        ''').fetchall()
        cw.writerow(['ID', 'Username', 'Email', 'Name', 'Phone', 'Accounts', 'Status', 'Registration Date'])
        for u in users:
            cw.writerow([u['id'], u['username'], u['email'], u['name'], u['phone'], u['ac_count'], u['status'], u['created_at']])
        filename = "users_report.csv"
        
    elif report_type == 'transactions':
        transactions = db.execute('''
            SELECT t.id, t.type, t.amount, t.status, t.transaction_date, t.mode, t.description,
                   u.name as user_name, a.account_number
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN users u ON a.user_id = u.id
            ORDER BY t.transaction_date DESC
        ''').fetchall()
        cw.writerow(['Txn ID', 'Type', 'Amount (INR)', 'Status', 'Date/Time', 'User', 'Account Number', 'Payment Mode', 'Description'])
        for t in transactions:
            cw.writerow([t['id'], t['type'], f"{t['amount']:,.2f}", t['status'], t['transaction_date'], t['user_name'], t['account_number'], t.get('mode', 'N/A'), t.get('description', 'N/A')])
        filename = "transactions_report.csv"
        
    elif report_type == 'summary':
        cw.writerow(['SMART BANK - COMPREHENSIVE FINANCIAL SUMMARY'])
        cw.writerow(['Export Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        cw.writerow([])
        
        # Monthly Summary
        monthly = db.execute('''
            SELECT strftime('%Y-%m', transaction_date) as month, COUNT(*) as tx_count, SUM(amount) as total_volume
            FROM transactions
            GROUP BY month
            ORDER BY month DESC
        ''').fetchall()
        
        cw.writerow(['MONTHLY PERFORMANCE'])
        cw.writerow(['Month', 'Trans. Count', 'Volume (INR)'])
        for m in monthly:
            vol = m['total_volume'] if m['total_volume'] is not None else 0
            cw.writerow([m['month'], m['tx_count'], f"{vol:,.2f}"])
            
        cw.writerow([])
        
        # Yearly Summary
        yearly = db.execute('''
            SELECT strftime('%Y', transaction_date) as year, COUNT(*) as tx_count, SUM(amount) as total_volume
            FROM transactions
            GROUP BY year
            ORDER BY year DESC
        ''').fetchall()
        cw.writerow(['YEARLY PERFORMANCE'])
        cw.writerow(['Year', 'Trans. Count', 'Volume (INR)'])
        for y in yearly:
            vol = y['total_volume'] if y['total_volume'] is not None else 0
            cw.writerow([y['year'], y['tx_count'], f"{vol:,.2f}"])
            
        cw.writerow([])
        
        # Additional Insights: Liquidity and Users
        cw.writerow(['SYSTEM SNAPSHOT'])
        total_balance = db.execute('SELECT SUM(balance) FROM accounts').fetchone()[0] or 0
        user_count = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        staff_count = db.execute('SELECT COUNT(*) FROM staff').fetchone()[0]
        
        cw.writerow(['Metric', 'Value'])
        cw.writerow(['Total System Deposits', f"{total_balance:,.2f}"])
        cw.writerow(['Registered Customers', user_count])
        cw.writerow(['Active Staff Members', staff_count])
        
        filename = f"financial_summary_{datetime.now().strftime('%Y%m%d')}.csv"
    else:
        return jsonify({'error': 'Invalid report type'}), 400

    from flask import Response
    output = si.getvalue()
    si.close()
    
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )


@app.route('/api/admin/transactions', methods=['GET'])
@role_required('admin')
def get_admin_transactions():
    db = get_db()
    limit = request.args.get('limit', 100)
    transactions = db.execute('''
        SELECT t.*, u.name as user_name, u.email as user_email, a.account_number
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.transaction_date DESC LIMIT ?
    ''', (limit,)).fetchall()
    return jsonify({'transactions': [dict(t) for t in transactions]})

@app.route('/api/admin/audit', methods=['GET'])
@role_required('admin')
def get_admin_audit():
    db = get_db()
    limit = request.args.get('limit', 50)
    audit = db.execute('''
        SELECT a.*, 
               CASE WHEN a.user_type = 'admin' THEN adm.name ELSE stf.name END as user_name
        FROM system_audit a
        LEFT JOIN admins adm ON a.user_id = adm.id AND a.user_type = 'admin'
        LEFT JOIN staff stf ON a.user_id = stf.id AND a.user_type = 'staff'
        ORDER BY a.timestamp DESC LIMIT ?
    ''', (limit,)).fetchall()
    return jsonify({'logs': [dict(row) for row in audit]})

@app.route('/api/admin/settings', methods=['GET', 'POST'])
@role_required('admin')
def admin_settings():
    # In a real app, this would use a 'settings' table. 
    # For this demo, we use a local JSON or just mock the persistence.
    settings_file = os.path.join(BASE_DIR, 'config', 'system_settings.json')
    
    if request.method == 'POST':
        data = request.json
        with open(settings_file, 'w') as f:
            json.dump(data, f)
        log_audit(session['admin_id'], 'admin', 'UPDATE_SETTINGS', 'System settings updated')
        return jsonify({'success': True, 'message': 'Settings saved successfully'})
    
    if os.path.exists(settings_file):
        with open(settings_file, 'r') as f:
            return jsonify(json.load(f))
    
    # Default settings
    return jsonify({
        'bankName': 'Smart Bank',
        'maintenanceMode': False,
        'allowNewSignups': True,
        'dailyTransferLimit': 100000,
        'loanInterestRate': 12.5
    })

@app.route('/api/admin/backup', methods=['POST'])
@role_required('admin')
def admin_backup():
    try:
        import shutil
        backup_dir = os.path.join(BASE_DIR, '..', 'backups')
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(backup_dir, f'smart_bank_backup_{timestamp}.db')
        
        shutil.copy2(DATABASE, backup_file)
        
        log_audit(session['admin_id'], 'admin', 'CREATE_BACKUP', f"Database backup created: {os.path.basename(backup_file)}")
        
        return jsonify({
            'success': True, 
            'message': 'Database backup created successfully',
            'filename': os.path.basename(backup_file)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dashboard', methods=['GET'])
@cross_origin(supports_credentials=True)
@role_required('admin')
def get_admin_dashboard():
    try:
        db = get_db()
        
        logger.info("Calculating Admin Dashboard stats...")
        
        # 1. Stats
        total_users = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        active_staff = db.execute('SELECT COUNT(*) FROM staff WHERE status = "active"').fetchone()[0]
        total_deposits = db.execute('SELECT SUM(balance) FROM accounts').fetchone()[0] or 0
        today_transactions = db.execute('''
            SELECT COUNT(*) FROM transactions 
            WHERE date(transaction_date) = date('now')
        ''').fetchone()[0]
        
        # Calculate Growths
        users_last_month = db.execute("SELECT COUNT(*) FROM users WHERE date(created_at) < date('now', 'start of month')").fetchone()[0]
        users_growth = round(((total_users - users_last_month) / users_last_month * 100), 1) if users_last_month > 0 else (100.0 if total_users > 0 else 0.0)

        staff_last_month = db.execute("SELECT COUNT(*) FROM staff WHERE status = 'active' AND date(created_at) < date('now', 'start of month')").fetchone()[0]
        staff_growth = round(((active_staff - staff_last_month) / staff_last_month * 100), 1) if staff_last_month > 0 else (100.0 if active_staff > 0 else 0.0)

        deposits_this_month = db.execute("SELECT SUM(amount) FROM transactions WHERE type='Deposit' AND date(transaction_date) >= date('now', 'start of month')").fetchone()[0] or 0
        deposits_last_month = db.execute("SELECT SUM(amount) FROM transactions WHERE type='Deposit' AND date(transaction_date) >= date('now', 'start of month', '-1 month') AND date(transaction_date) < date('now', 'start of month')").fetchone()[0] or 0
        deposits_growth = round(((deposits_this_month - deposits_last_month) / deposits_last_month * 100), 1) if deposits_last_month > 0 else (100.0 if deposits_this_month > 0 else 0.0)

        yesterday_transactions = db.execute("SELECT COUNT(*) FROM transactions WHERE date(transaction_date) = date('now', '-1 day')").fetchone()[0]
        transactions_growth = round(((today_transactions - yesterday_transactions) / yesterday_transactions * 100), 1) if yesterday_transactions > 0 else (100.0 if today_transactions > 0 else 0.0)

        # Liquidity Fund
        liquidity_fund = db.execute('SELECT balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
        fund_balance = liquidity_fund[0] if liquidity_fund else 1000000.00

        # Calculate Loan Stats (Sync with Liquidity Fund Page)
        closed_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "closed"').fetchone()[0]
        active_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "approved"').fetchone()[0]
        today_date = datetime.now().date().isoformat()
        overdue_count = db.execute('SELECT COUNT(*) FROM loans WHERE status = "approved" AND next_due_date < ?', (today_date,)).fetchone()[0]

        stats = {
            'totalUsers': total_users,
            'user_trend': f"{'+' if users_growth >= 0 else ''}{users_growth}%",
            'activeStaff': active_staff,
            'staff_trend': f"{'+' if staff_growth >= 0 else ''}{staff_growth}%",
            'totalDeposits': total_deposits,
            'deposit_trend': f"{'+' if deposits_growth >= 0 else ''}{deposits_growth}%",
            'todayTransactions': today_transactions,
            'transaction_trend': f"{'+' if transactions_growth >= 0 else ''}{transactions_growth}%",
            'liquidityFund': fund_balance,
            'loan_stats': {
                'active': active_count,
                'overdue': overdue_count,
                'closed': closed_count
            }
        }
        
        logger.info(f"Admin Dashboard Stats: {stats}")
        
        # 2. Recent Users
        recent_users_cur = db.execute('''
            SELECT id, name, username, email FROM users 
            ORDER BY created_at DESC LIMIT 5
        ''').fetchall()
        recent_users = [dict(u) for u in recent_users_cur]
        
        # 3. System Alerts (from audit logs)
        alerts_cur = db.execute('''
            SELECT action as title, timestamp as time, 
            CASE 
                WHEN action LIKE '%Failed%' THEN 'danger'
                WHEN action LIKE '%Login%' THEN 'info'
                WHEN action LIKE '%Create%' THEN 'success'
                WHEN action LIKE '%Update%' THEN 'info'
                WHEN action LIKE '%Delete%' THEN 'warning'
                ELSE 'info'
            END as type
            FROM system_audit ORDER BY timestamp DESC LIMIT 5
        ''').fetchall()
        system_alerts = [dict(a) for a in alerts_cur]
        
        # 4. Recent Transactions
        recent_txns_cur = db.execute('''
            SELECT t.*, u.name as user_name, a.account_number
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN users u ON a.user_id = u.id
            ORDER BY t.transaction_date DESC LIMIT 5
        ''').fetchall()
        recent_transactions = [dict(t) for t in recent_txns_cur]
        
        return jsonify({
            'success': True,
            'stats': stats,
            'recentUsers': recent_users,
            'systemAlerts': system_alerts,
            'recentTransactions': recent_transactions
        })
    except Exception as e:
        logger.error(f"Error in get_admin_dashboard: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================
# PASSWORD RESET
# ============================================================

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    email = request.json.get('email', '').lower()
    db = get_db()
    user = db.execute('SELECT id, username FROM users WHERE email = ?', (email,)).fetchone()
    
    if user:
        token = secrets.token_urlsafe(32)
        expiry = (datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
        
        db.execute('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', 
                   (token, expiry, user['id']))
        db.commit()
        
        # Determine the base URL for the reset link
        base_url = request.host_url
        if 'localhost' in base_url or '127.0.0.1' in base_url:
            base_url = base_url.replace(':5001', ':8000')
        
        reset_link = f"{base_url}reset-password.html?token={token}"

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #8b0000; text-align: center;">Smart Bank</h2>
                <p>Hello {user['username']},</p>
                <p>We received a request to reset your password. Click the button below to choose a new one:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #8b0000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                </div>
                <p style="font-size: 13px; color: #6b7280;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="font-size: 11px; color: #9ca3af; text-align: center;">&copy; 2026 Smart Bank Corporation</p>
            </div>
        </body>
        </html>
        """
        send_email_async(email, "Reset Your Smart Bank Password", body)
        
        print(f"\n[DEBUG] Password Reset Link (Logged for Testing): {reset_link}\n")
        return jsonify({'success': True, 'message': 'If an account matches, a reset link has been sent.'})
        
    return jsonify({'success': True, 'message': 'If an account matches, a reset link has been sent.'})

@app.route('/api/auth/verify-reset-token', methods=['POST'])
def verify_reset_token():
    token = request.json.get('token')
    if not token:
        return jsonify({'error': 'Token required'}), 400
        
    db = get_db()
    user = db.execute('SELECT username, email, reset_token_expiry FROM users WHERE reset_token = ?', (token,)).fetchone()
    
    if not user:
        return jsonify({'error': 'Invalid token'}), 404
        
    expiry = datetime.strptime(user['reset_token_expiry'], '%Y-%m-%d %H:%M:%S')
    if datetime.now() > expiry:
        return jsonify({'error': 'Token has expired'}), 400
        
    return jsonify({
        'username': user['username'],
        'email': user['email']
    })

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    token = request.json.get('token')
    password = request.json.get('password')
    
    if not token or not password:
        return jsonify({'error': 'Token and Password required'}), 400
        
    db = get_db()
    user = db.execute('SELECT id, reset_token_expiry FROM users WHERE reset_token = ?', (token,)).fetchone()
    
    if not user:
        return jsonify({'error': 'Invalid token'}), 404
        
    expiry = datetime.strptime(user['reset_token_expiry'], '%Y-%m-%d %H:%M:%S')
    if datetime.now() > expiry:
        return jsonify({'error': 'Token has expired'}), 400
        
    hashed_pw = generate_password_hash(password)
    db.execute('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', 
               (hashed_pw, user['id']))
    db.commit()
    
    return jsonify({'success': True, 'message': 'Password has been reset successfully.'})


# (Chatbot endpoints removed to avoid duplication - handled elsewhere in the file)

# ============================================================
# FACE AUTHENTICATION SUITE
# ============================================================

def get_euclidean_distance(d1, d2):
    """Calculate Euclidean distance between two 128D face descriptors"""
    if not d1 or not d2 or len(d1) != 128 or len(d2) != 128:
        return 999.0 # Fail safe
    return sum((a - b) ** 2 for a, b in zip(d1, d2)) ** 0.5

@app.route('/api/face/status', methods=['GET'])
def face_status():
    """Check if face authentication is enabled for current session (Staff or Admin)"""
    role = session.get('role')
    user_id = session.get('user_id')
    
    if not role or not user_id:
        return jsonify({'enabled': False, 'error': 'Unauthorized'}), 401
        
    db = get_db()
    table = 'staff' if role == 'staff' else 'admins'
    user = db.execute(f'SELECT face_auth_enabled FROM {table} WHERE id = ?', (user_id,)).fetchone()
    
    return jsonify({
        'enabled': bool(user and user['face_auth_enabled']),
        'role': role
    })

@app.route('/api/face/register', methods=['POST'])
@login_required
def face_register():
    data = request.json
    descriptor = data.get('face_descriptor')
    
    if not descriptor or len(descriptor) != 128:
        return jsonify({'error': 'Invalid face descriptor'}), 400
        
    role = session.get('role')
    user_id = session.get('user_id')
    
    if role not in ['staff', 'admin']:
        return jsonify({'error': 'Face registration only available for Staff/Admin'}), 403
        
    db = get_db()
    table = 'staff' if role == 'staff' else 'admins'
    
    # Save descriptor to database
    db.execute(f'UPDATE {table} SET face_descriptor = ?, face_auth_enabled = 1 WHERE id = ?', 
               (json.dumps(descriptor), user_id))
    db.commit()
    
    return jsonify({'success': True, 'message': 'Face data registered in database successfully'})

@app.route('/api/face/delete', methods=['DELETE'])
@login_required
def face_delete():
    role = session.get('role')
    user_id = session.get('user_id')
    
    db = get_db()
    table = 'staff' if role == 'staff' else 'admins'
    
    # Clear in DB
    db.execute(f'UPDATE {table} SET face_descriptor = NULL, face_auth_enabled = 0 WHERE id = ?', (user_id,))
    db.commit()
    
    return jsonify({'success': True, 'message': 'Face data removed from database'})

@app.route('/api/staff/face-login', methods=['POST'])
def staff_face_login():
    data = request.json
    descriptor = data.get('face_descriptor')
    if not descriptor or not isinstance(descriptor, list) or len(descriptor) != 128:
        return jsonify({'error': 'Invalid face data provided'}), 400
        
    db = get_db()
    # Find all staff with face auth enabled
    users = db.execute('SELECT * FROM staff WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    
    for user in users:
        saved_descriptor_str = user['face_descriptor']
        if saved_descriptor_str:
            try:
                saved_descriptor = json.loads(saved_descriptor_str)
                distance = get_euclidean_distance(descriptor, saved_descriptor)
                if distance < 0.6:
                    # Success!
                    session.clear()
                    session['user_id'] = user['id']
                    session['staff_id'] = user['id'] # Changed from user['staff_id'] to match normal login
                    session['role'] = 'staff'
                    session['user_name'] = user['name']
                    session.permanent = True
                    
                    log_audit(user['id'], 'staff', 'face_login', 'Successful staff face login (DB Verified)')
                    
                    return jsonify({
                        'success': True,
                        'role': 'staff',
                        'name': user['name'],
                        'staff': dict(user),
                        'token': secrets.token_hex(16)
                    })
            except Exception as e:
                logger.error(f"Error parsing face data for staff {user['id']}: {e}")
                
    return jsonify({'error': 'Face not recognized or authentication not enabled'}), 410

@app.route('/api/admin/face-login', methods=['POST'])
def admin_face_login():
    data = request.json
    descriptor = data.get('face_descriptor')
    
    if not descriptor or not isinstance(descriptor, list) or len(descriptor) != 128:
        return jsonify({'error': 'Invalid face data provided'}), 400
        
    db = get_db()
    admins = db.execute('SELECT * FROM admins WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    
    for admin in admins:
        saved_descriptor_str = admin['face_descriptor']
        if saved_descriptor_str:
            try:
                saved_descriptor = json.loads(saved_descriptor_str)
                distance = get_euclidean_distance(descriptor, saved_descriptor)
                if distance < 0.6:
                    session.clear()
                    session['user_id'] = admin['id']
                    session['admin_id'] = admin['id'] # Changed from admin['username'] to match normal login
                    session['role'] = 'admin'
                    session['user_name'] = admin['name']
                    session.permanent = True
                    
                    log_audit(admin['id'], 'admin', 'face_login', 'Successful admin face login (DB Verified)')
                    
                    return jsonify({
                        'success': True,
                        'role': 'admin',
                        'name': admin['name'],
                        'admin': dict(admin),
                        'token': secrets.token_hex(16)
                    })
            except Exception as e:
                logger.error(f"Error parsing face data for admin {admin['id']}: {e}")
                
    return jsonify({'error': 'Face not recognized or authentication not enabled'}), 410



# ============================================================
# ATTENDANCE SYSTEM ENDPOINTS
# ============================================================

@app.route('/api/staff/attendance/status', methods=['GET'])
@role_required('staff')
def get_attendance_status():
    staff_id = session.get('staff_id')
    today = datetime.now().date().isoformat()
    
    db = get_db()
    attendance = db.execute('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', (staff_id, today)).fetchone()
    
    status = {
        'clocked_in': False,
        'clocked_out': False,
        'clock_in_time': None,
        'clock_out_time': None,
        'total_hours': 0
    }
    
    if attendance:
        status['clocked_in'] = bool(attendance['clock_in'])
        status['clocked_out'] = bool(attendance['clock_out'])
        status['clock_in_time'] = attendance['clock_in']
        status['clock_out_time'] = attendance['clock_out']
        status['total_hours'] = float(attendance['total_hours'] or 0)
        
    return jsonify({'success': True, 'status': status})

@app.route('/api/staff/attendance/clock-in', methods=['POST'])
def staff_attendance_clock_in():
    data = request.json
    descriptor = data.get('face_descriptor')
    
    if not descriptor:
        return jsonify({'error': 'Face verification required for attendance'}), 400
        
    db = get_db()
    # Verify face first
    # For simplicity in this endpoint, we'll try to find any active staff matching this face
    staff_members = db.execute('SELECT * FROM staff WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    
    matched_staff = None
    for staff in staff_members:
        saved_descriptor = staff['face_descriptor']
        if saved_descriptor:
            try:
                distance = get_euclidean_distance(descriptor, json.loads(saved_descriptor))
                if distance < 0.6:
                    matched_staff = staff
                    break
            except Exception as e:
                logger.error(f"Error parsing face data for attendance: {e}")
                
    if not matched_staff:
        return jsonify({'error': 'Face not recognized. Attendance not recorded.'}), 401
        
    staff_id = matched_staff['id']
    today = datetime.now().date().isoformat()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Check if already clocked in for today
    existing = db.execute('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', (staff_id, today)).fetchone()
    
    if existing and existing['clock_in']:
        return jsonify({'error': 'Already clocked in for today'}), 400
        
    try:
        if not existing:
            db.execute('INSERT INTO attendance (staff_id, date, clock_in) VALUES (?, ?, ?)', (staff_id, today, now))
        else:
            db.execute('UPDATE attendance SET clock_in = ? WHERE id = ?', (now, existing['id']))
            
        db.commit()
        log_audit(staff_id, 'staff', 'clock_in', f"Staff {matched_staff['name']} clocked in via face.")
        
        return jsonify({
            'success': True, 
            'message': 'Clock-in successful', 
            'time': now,
            'staff_name': matched_staff['name']
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/attendance/clock-out', methods=['POST'])
def staff_attendance_clock_out():
    data = request.json
    descriptor = data.get('face_descriptor')
    
    if not descriptor:
        return jsonify({'error': 'Face verification required for attendance'}), 400
        
    db = get_db()
    # Verify face
    staff_members = db.execute('SELECT * FROM staff WHERE face_auth_enabled = 1 AND status = "active"').fetchall()
    
    matched_staff = None
    for staff in staff_members:
        saved_descriptor = staff['face_descriptor']
        if saved_descriptor:
            try:
                distance = get_euclidean_distance(descriptor, json.loads(saved_descriptor))
                if distance < 0.6:
                    matched_staff = staff
                    break
            except Exception as e:
                logger.error(f"Error parsing face data for attendance: {e}")
                
    if not matched_staff:
        return jsonify({'error': 'Face not recognized. Attendance not recorded.'}), 401
        
    staff_id = matched_staff['id']
    today = datetime.now().date().isoformat()
    now_dt = datetime.now()
    now_str = now_dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # Check if clocked in
    attendance = db.execute('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', (staff_id, today)).fetchone()
    
    if not attendance or not attendance['clock_in']:
        return jsonify({'error': 'No clock-in record found for today'}), 400
        
    if attendance['clock_out']:
        return jsonify({'error': 'Already clocked out for today'}), 400
        
    try:
        # Calculate hours
        clock_in_dt = datetime.strptime(attendance['clock_in'], '%Y-%m-%d %H:%M:%S')
        diff = now_dt - clock_in_dt
        total_hours = round(diff.total_seconds() / 3600, 2)
        
        db.execute('UPDATE attendance SET clock_out = ?, total_hours = ? WHERE id = ?', 
                   (now_str, total_hours, attendance['id']))
            
        db.commit()
        log_audit(staff_id, 'staff', 'clock_out', f"Staff {matched_staff['name']} clocked out via face. Total hours: {total_hours}")
        
        return jsonify({
            'success': True, 
            'message': 'Clock-out successful', 
            'time': now_str,
            'total_hours': total_hours,
            'staff_name': matched_staff['name']
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/attendance/history', methods=['GET'])
@role_required('staff')
def get_staff_attendance_history():
    staff_id = session.get('staff_id')
    db = get_db()
    history = db.execute('SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 30', (staff_id,)).fetchall()
    return jsonify({'success': True, 'history': [dict(h) for h in history]})

@app.route('/api/admin/attendance/tracking', methods=['GET'])
@role_required('admin')
def get_admin_attendance_tracking():
    print("DEBUG: Fetching admin attendance tracking data")
    try:
        db = get_db()
        # Get all attendance records joined with staff names
        records = db.execute('''
            SELECT a.*, s.name as staff_name, s.staff_id as staff_code
            FROM attendance a
            JOIN staff s ON a.staff_id = s.id
            ORDER BY a.date DESC, a.clock_in DESC
        ''').fetchall()
        print(f"DEBUG: Found {len(records)} attendance records")
        
        # Statistics
        today_present = db.execute('SELECT COUNT(*) FROM attendance WHERE date = date("now")').fetchone()[0]
        total_staff = db.execute('SELECT COUNT(*) FROM staff').fetchone()[0]
        avg_hours = db.execute('SELECT AVG(total_hours) FROM attendance WHERE total_hours IS NOT NULL').fetchone()[0]
        
        print(f"DEBUG: Stats -> Today: {today_present}, Total Staff: {total_staff}, Avg Hours: {avg_hours}")
        
        stats = {
            'today_present': today_present,
            'total_staff': total_staff,
            'avg_hours': avg_hours or 0
        }
        
        return jsonify({
            'success': True, 
            'records': [dict(r) for r in records],
            'stats': stats
        })
    except Exception as e:
        print(f"ERROR in get_admin_attendance_tracking: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================
# SALARY MANAGEMENT ENDPOINTS
# ============================================================

@app.route('/api/admin/salary/list', methods=['GET'])
@role_required('admin')
def get_admin_salary_list():
    try:
        db = get_db()
        # Current month and year
        now = datetime.now()
        # Get start of current month
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime('%Y-%m-%d')
        
        # Get staff with base salary and attendance count for current month
        staff_data = db.execute('''
            SELECT 
                s.id, s.staff_id as staff_code, s.name, s.department, s.position, s.base_salary,
                (SELECT COUNT(*) FROM attendance a WHERE a.staff_id = s.id AND a.date >= ?) as attendance_days
            FROM staff s
            WHERE s.status = 'active'
        ''', (start_of_month,)).fetchall()
        
        result = []
        # Get days in current month for more accurate daily rate
        import calendar
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        
        # Calculation: (base_salary / working_days_in_month) * adjusted_attendance
        # Working days exclude Sundays
        working_days = 0
        for d in range(1, days_in_month + 1):
            if datetime(now.year, now.month, d).weekday() != 6: # 6 is Sunday
                working_days += 1
        
        for staff in staff_data:
            base_salary = float(staff['base_salary'] or 50000.00)
            
            # Count attendance excluding Sundays for this staff
            staff_id_val = staff['id']
            attendance_records = db.execute('''
                SELECT date FROM attendance 
                WHERE staff_id = ? AND date >= ?
            ''', (staff_id_val, start_of_month)).fetchall()
            
            valid_attendance_count = 0
            for rec in attendance_records:
                # Assuming date is in 'YYYY-MM-DD' format
                try:
                    date_obj = datetime.strptime(rec['date'], '%Y-%m-%d')
                    if date_obj.weekday() != 6: # Not Sunday
                        valid_attendance_count += 1
                except:
                    continue
            
            # Final salary: (Base / Working Days) * Present Working Days
            if working_days > 0:
                current_salary = round((base_salary / working_days) * valid_attendance_count, 2)
            else:
                current_salary = 0
            
            staff_dict = dict(staff)
            staff_dict['base_salary'] = base_salary
            staff_dict['attendance_days'] = valid_attendance_count # Update to valid working days only
            staff_dict['current_salary'] = current_salary
            result.append(staff_dict)
            
        return jsonify({
            'success': True, 
            'salary_list': result,
            'month': now.strftime('%B %Y'),
            'days_in_month': days_in_month
        })
    except Exception as e:
        logger.error(f"Error in get_admin_salary_list: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/salary/update', methods=['POST'])
@role_required('admin')
def update_staff_base_salary():
    try:
        data = request.json
        staff_id = data.get('staff_id')
        new_salary = data.get('base_salary')
        
        if staff_id is None or new_salary is None:
            return jsonify({'success': False, 'error': 'Missing staff_id or base_salary'}), 400
            
        db = get_db()
        db.execute('UPDATE staff SET base_salary = ? WHERE id = ?', (new_salary, staff_id))
        db.commit()
        
        admin_id = session.get('admin_id') or session.get('user_id')
        log_audit(admin_id, 'admin', 'update_salary', f"Updated base salary for staff ID {staff_id} to {new_salary}")
        
        return jsonify({'success': True, 'message': 'Salary updated successfully'})
    except Exception as e:
        logger.error(f"Error in update_staff_base_salary: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/salary/pay', methods=['POST'])
@role_required('admin')
def pay_staff_salary():
    """Pay salary to a single staff member — deducts from Loan Liquidity Fund and credits their bank account."""
    try:
        data = request.json
        staff_id = data.get('staff_id')
        amount = float(data.get('amount', 0))

        if not staff_id or amount <= 0:
            return jsonify({'success': False, 'error': 'Invalid staff_id or amount'}), 400

        db = get_db()

        # Get staff info
        staff = db.execute('SELECT * FROM staff WHERE id = ?', (staff_id,)).fetchone()
        if not staff:
            return jsonify({'success': False, 'error': 'Staff member not found'}), 404

        # Check liquidity fund balance
        fund = db.execute('SELECT id, balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
        if not fund:
            return jsonify({'success': False, 'error': 'Liquidity fund not configured'}), 500
        fund_balance = float(fund['balance'])
        if fund_balance < amount:
            return jsonify({'success': False, 'error': f'Insufficient liquidity fund balance (₹{fund_balance:,.2f} available)'}), 400

        # Find staff's bank account (prefer Salary account, fallback to first Savings/Current)
        account = db.execute('''
            SELECT a.id, a.account_number, a.balance FROM accounts a
            JOIN users u ON a.user_id = u.id
            WHERE u.email = ? AND a.status = "active"
            ORDER BY CASE a.account_type WHEN "Salary" THEN 0 WHEN "Savings" THEN 1 ELSE 2 END
            LIMIT 1
        ''', (staff['email'],)).fetchone()

        now_str = datetime.now().strftime('%Y-%m')
        month_label = datetime.now().strftime('%B %Y')

        if not account:
            # No bank account linked — still log the salary record but cannot credit automatically
            db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))
            db.commit()
            log_audit(session.get('admin_id'), 'admin', 'salary_paid_no_account',
                      f"Salary ₹{amount} paid to {staff['name']} (ID {staff_id}) — no bank account linked")
            return jsonify({
                'success': True,
                'message': f'Salary ₹{amount:,.2f} recorded for {staff["name"]} but no linked bank account found to credit.',
                'no_account': True
            })

        # Deduct from Liquidity Fund
        db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (amount,))

        # Credit to staff's bank account
        db.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, account['id']))

        # Record the salary transaction
        db.execute('''
            INSERT INTO transactions (account_id, type, amount, description, transaction_date, reference_number)
            VALUES (?, "Salary Credit", ?, ?, CURRENT_TIMESTAMP, ?)
        ''', (account['id'], amount, f'Salary for {month_label}', f'SAL-{now_str}-{staff_id}'))

        db.commit()

        # Send notification and email
        db.execute('''
            INSERT INTO notifications (user_id, title, message, type, created_at)
            SELECT u.id, "Salary Credited 💰", ?, "success", CURRENT_TIMESTAMP
            FROM users u WHERE u.email = ?
        ''', (f'Your salary of ₹{amount:,.2f} for {month_label} has been credited to account {account["account_number"]}.', staff['email']))
        db.commit()

        # Email notification
        send_email_async(staff['email'], f'Salary Credited – {month_label}', f'''
            <h3>Smart Bank – Salary Credit</h3>
            <p>Dear {staff["name"]},</p>
            <p>Your salary of <strong>₹{amount:,.2f}</strong> for <strong>{month_label}</strong> has been credited to your account <strong>{account["account_number"]}</strong>.</p>
            <p>Thank you for your service!</p>
        ''')

        log_audit(session.get('admin_id'), 'admin', 'salary_paid',
                  f"Salary ₹{amount} paid to {staff['name']} (ID {staff_id}) → Account {account['account_number']}")

        return jsonify({
            'success': True,
            'message': f'Salary ₹{amount:,.2f} credited to {staff["name"]} ({account["account_number"]})',
            'account_number': account['account_number'],
            'new_fund_balance': float(fund_balance - amount)
        })

    except Exception as e:
        logger.error(f"Error in pay_staff_salary: {str(e)}")
        try: db.rollback()
        except: pass
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/salary/pay-all', methods=['POST'])
@role_required('admin')
def pay_all_salaries():
    """Pay all active staff salaries at once from the Liquidity Fund."""
    try:
        db = get_db()
        import calendar
        now = datetime.now()
        start_of_month = now.replace(day=1).strftime('%Y-%m-%d')
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        working_days = sum(1 for d in range(1, days_in_month + 1) if datetime(now.year, now.month, d).weekday() != 6)
        month_label = now.strftime('%B %Y')
        now_str = now.strftime('%Y-%m')

        # Get all active staff with attendance
        staff_list = db.execute('''
            SELECT s.id, s.name, s.email, s.department, COALESCE(s.base_salary, 50000.00) as base_salary,
                (SELECT COUNT(*) FROM attendance a WHERE a.staff_id = s.id AND a.date >= ? 
                 AND (a.clock_in IS NOT NULL AND a.clock_out IS NOT NULL) AND a.status != "absent") as valid_days
            FROM staff s WHERE s.status = "active"
        ''', (start_of_month,)).fetchall()

        # Total payroll needed
        total_payroll = 0
        pay_items = []
        for s in staff_list:
            base = float(s['base_salary'])
            days = int(s['valid_days'] or 0)
            pay = round((base / working_days) * days, 2) if working_days > 0 and days > 0 else 0
            if pay > 0:
                total_payroll += pay
                pay_items.append({'staff': dict(s), 'amount': pay})

        if total_payroll == 0:
            return jsonify({'success': False, 'error': 'No salary to pay (check attendance records)'}), 400

        # Check fund
        fund = db.execute('SELECT balance FROM system_finances WHERE fund_name = "Loan Liquidity Fund"').fetchone()
        fund_balance = float(fund['balance']) if fund else 0
        if fund_balance < total_payroll:
            return jsonify({'success': False, 'error': f'Insufficient liquidity fund. Need ₹{total_payroll:,.2f}, available ₹{fund_balance:,.2f}'}), 400

        paid = []
        skipped = []
        for item in pay_items:
            s = item['staff']
            amt = item['amount']
            account = db.execute('''
                SELECT a.id, a.account_number FROM accounts a
                JOIN users u ON a.user_id = u.id
                WHERE u.email = ? AND a.status = "active"
                ORDER BY CASE a.account_type WHEN "Salary" THEN 0 WHEN "Savings" THEN 1 ELSE 2 END LIMIT 1
            ''', (s['email'],)).fetchone()

            db.execute('UPDATE system_finances SET balance = balance - ? WHERE fund_name = "Loan Liquidity Fund"', (amt,))

            if account:
                db.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amt, account['id']))
                db.execute('''
                    INSERT INTO transactions (account_id, type, amount, description, transaction_date, reference_number)
                    VALUES (?, "Salary Credit", ?, ?, CURRENT_TIMESTAMP, ?)
                ''', (account['id'], amt, f'Salary for {month_label}', f'SAL-{now_str}-{s["id"]}'))
                db.execute('''
                    INSERT INTO notifications (user_id, title, message, type, created_at)
                    SELECT u.id, "Salary Credited 💰", ?, "success", CURRENT_TIMESTAMP FROM users u WHERE u.email = ?
                ''', (f'Salary ₹{amt:,.2f} for {month_label} credited to {account["account_number"]}.', s['email']))
                send_email_async(s['email'], f'Salary Credited – {month_label}',
                    f'<h3>Smart Bank Salary</h3><p>Dear {s["name"]}, your salary of <strong>₹{amt:,.2f}</strong> for {month_label} has been credited to account {account["account_number"]}.</p>')
                paid.append({'name': s['name'], 'amount': amt, 'account': account['account_number']})
            else:
                skipped.append({'name': s['name'], 'amount': amt})

        db.commit()
        log_audit(session.get('admin_id'), 'admin', 'salary_pay_all',
                  f"Bulk salary disbursement: ₹{total_payroll:,.2f} for {len(paid)} staff")

        return jsonify({
            'success': True,
            'paid': paid,
            'skipped': skipped,
            'total_paid': total_payroll,
            'message': f'Salary disbursed for {len(paid)} staff. Total: ₹{total_payroll:,.2f}'
        })

    except Exception as e:
        logger.error(f"Error in pay_all_salaries: {str(e)}")
        try: db.rollback()
        except: pass
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        print(f"âš ï¸  Database not found at {DATABASE}. Creating new one...")
        init_db()
    else:
        print(f"✅  Database found at: {DATABASE}")
        
    print(f"Smart Bank API starting on http://0.0.0.0:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
@app.route('/api/admin/test-email', methods=['POST'])
@role_required('admin')
def admin_test_email():
    """Diagnostic endpoint for admins to test email sending."""
    try:
        data = request.json
        target_email = data.get('email', 'salmanchamumu@gmail.com')
        subject = "Diagnostic Test Email - Smart Bank"
        
        from datetime import datetime
        body = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
            <h2 style="color: #8b0000; text-align: center;">Smart Bank Diagnostic</h2>
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                <p style="color: #065f46; margin: 0;"><strong>Success!</strong> Your email configuration is working.</p>
            </div>
            <p>This is a test email triggered from the Admin Dashboard on <strong>{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</strong>.</p>
            <p>If you are seeing this, your email configuration (Resend or SMTP) is <strong>correctly delivering messages</strong> to your inbox.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">Server ID: {os.environ.get('RAILWAY_STATIC_URL', 'Local')} | {datetime.now().isoformat()}</p>
        </div>
        """
        
        results = send_email_diagnostic(target_email, subject, body)
        return jsonify(results)
    except Exception as e:
        logger.error(f"Test email endpoint error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
