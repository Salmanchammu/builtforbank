from flask import Flask, request, jsonify, session, send_from_directory, g, send_file
from flask_cors import CORS
from datetime import timedelta
import os
import logging
import mimetypes

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

# MIME types for modern web
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

# Initialize App
app = Flask(__name__)

# System Configurations
# In production, ALWAYS set SECRET_KEY in environment variables
app.secret_key = os.environ.get('SECRET_KEY', 'default_dev_key_change_in_production_99881122')
app.config['SESSION_COOKIE_NAME'] = 'smart_bank_session'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = any(os.environ.get(k) for k in ['RENDER', 'PORT', 'HTTPS'])
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30) # Increased for better UX, but keeping it reasonable

# CORS Configuration - Restrict to known origins in production
# For now, we allow the request's own origin if it matches a reasonable pattern or just use a more sensible default
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5000", "http://127.0.0.1:5000", 
    "http://localhost:5001", "http://127.0.0.1:5001", 
    "http://0.0.0.0:5000", "http://0.0.0.0:5001",
    "https://*.render.com"
])

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api/user')
app.register_blueprint(staff_bp, url_prefix='/api/staff')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(mobile_bp, url_prefix='/api/mobile')
app.register_blueprint(face_bp, url_prefix='/api/face')
app.register_blueprint(chat_bp, url_prefix='/api/chat')
app.register_blueprint(agri_bp, url_prefix='/api/agri')
app.register_blueprint(marketplace_bp, url_prefix='/api/marketplace')

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('smart_bank')

# Static and SPA Routes
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))



@app.route('/')
def home():
    if os.path.exists(os.path.join(FRONTEND_DIR, 'user.html')):
        return send_file(os.path.join(FRONTEND_DIR, 'user.html'))
    return "✅ Smart Bank Backend is RUNNING!"

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'version': '2.0.modular'})

@app.route('/api/diag/logs', methods=['GET'])
def diag_logs():
    # Only for local debugging as identified by host
    if request.remote_addr not in ['127.0.0.1', 'localhost']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Return last 100 lines of console output if possible, 
    # but for simplicity let's just return a confirmation for now
    return jsonify({'message': 'Diag endpoint active', 'cwd': os.getcwd()})

@app.route('/<path:path>')
def serve_static(path):
    # Security: Prevent path traversal by normalizing the path and checking the base directory
    clean_path = path.split('?')[0]
    
    # Ensure the path doesn't try to go outside FRONTEND_DIR
    requested_path = os.path.normpath(os.path.join(FRONTEND_DIR, clean_path))
    if not requested_path.startswith(FRONTEND_DIR):
        return jsonify({'error': 'Forbidden'}), 403

    if os.path.exists(requested_path) and os.path.isfile(requested_path):
        # Use safe send_from_directory which handles path normalization internally too
        # but we already did a strict check above.
        directory = os.path.dirname(requested_path)
        filename = os.path.basename(requested_path)
        return send_from_directory(directory, filename)
        
    # SPA Fallback for routes that should be handled by the frontend
    user_html = os.path.join(FRONTEND_DIR, 'user.html')
    if os.path.exists(user_html):
        return send_from_directory(FRONTEND_DIR, 'user.html')
    return jsonify({'error': 'Not found'}), 404

@app.after_request
def add_header(response):
    """
    Control caching: API = No Cache, Static/Models = Cached.
    """
    # API endpoints: MUST NOT CACHE for security and data freshness
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response
    
    # Models and Face-API Library: CACHE for performance (large files)
    if 'models' in request.path or 'face-api' in request.path:
        response.headers['Cache-Control'] = 'public, max-age=31536000' # 1 year for these static immutable assets
        # Remove no-cache headers if present
        response.headers.pop('Pragma', None)
        response.headers.pop('Expires', None)
        return response

    # Other static files (CSS, JS, Images): Cache for a short duration
    if not response.headers.get('Cache-Control'):
        response.headers['Cache-Control'] = 'public, max-age=3600'
        
    return response

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

@app.before_request
def log_request_info():
    origin = request.headers.get('Origin')
    logger.info(f"Incoming Request: {request.method} {request.url} | Origin: {origin}")

if __name__ == '__main__':
    from core.constants import DATABASE
    with app.app_context():
        if not os.path.exists(DATABASE):
            init_db()
        else:
            migrate_db()
    
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
else:
    # Production Auto-Initialization (Render/Other Cloud)
    # This runs when imported by Gunicorn
    if os.environ.get('RENDER') or os.environ.get('FLASK_ENV') == 'production':
        from core.constants import DATABASE
        from core.db import init_db, migrate_db
        try:
            with app.app_context():
                # Ensure directory exists for SQLite
                os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
                
                if not os.path.exists(DATABASE) or os.path.getsize(DATABASE) == 0:
                    print(f"✅ Production Boot: Initializing fresh database at {DATABASE}")
                    init_db()
                else:
                    print(f"✅ Production Boot: Verifying database migrations at {DATABASE}")
                    migrate_db()
        except Exception as e:
            print(f"⚠️ Production Boot Warning: Database initialization skipped/failed: {e}")
