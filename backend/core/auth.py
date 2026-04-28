from functools import wraps
from flask import session, jsonify, request
import logging
import threading
import os
import requests as http_requests
import sqlite3
from .db import get_db
from .constants import DATABASE

logger = logging.getLogger('smart_bank.auth')

# ── Geo-lookup helper ────────────────────────────────────────────────────────
def geo_lookup_async(user_id, table_name, ip_address):
    """Background thread to update user location based on IP for different tables."""
    try:
        # 1. Standardize IP fallback for local dev
        if not ip_address or ip_address in ['127.0.0.1', '::1', 'localhost']:
            city, country, lat, lng = 'Local Development', 'India', 20.5937, 78.9629
        else:
            # External Geo API lookup
            response = http_requests.get(f"http://ip-api.com/json/{ip_address}?fields=status,message,country,city,lat,lon", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'success':
                    city, country, lat, lng = data.get('city', 'Unknown'), data.get('country', 'Unknown'), data.get('lat'), data.get('lon')
                else: 
                    logger.warning(f"Geo lookup failed for IP {ip_address}: {data.get('message', 'Unknown error')}")
                    city, country, lat, lng = 'Unknown', 'Unknown', None, None
            else: 
                city, country, lat, lng = 'Unknown', 'Unknown', None, None

        # 2. Update DB ensuring signup_ip is also preserved
        # Map table_name to safe values to prevent potential injection 
        valid_tables = ['users', 'staff', 'admins', 'agri_buyers']
        if table_name not in valid_tables:
            logger.error(f"Invalid table_name for geo-lookup: {table_name}")
            return

        db_url = os.environ.get('DATABASE_URL')
        if db_url and db_url.startswith('postgres'):
            # Production: Use PostgreSQL
            import psycopg2
            if db_url.startswith('postgres://'):
                db_url = db_url.replace('postgres://', 'postgresql://', 1)
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE {table_name} SET 
                    signup_ip=%s, signup_city=%s, signup_country=%s, signup_lat=%s, signup_lng=%s 
                WHERE id=%s
            """, (ip_address, city, country, lat, lng, user_id))
            conn.commit()
            cursor.close()
            conn.close()
        else:
            # Local dev: Use SQLite
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE {table_name} SET 
                    signup_ip=?, signup_city=?, signup_country=?, signup_lat=?, signup_lng=? 
                WHERE id=?
            """, (ip_address, city, country, lat, lng, user_id))
            conn.commit()
            conn.close()
        logger.info(f"Updated geo/ip for {table_name} ID {user_id}: {city}, {country} (IP: {ip_address})")
    except Exception as e:
        logger.error(f"Geo lookup error: {e}")

def trigger_geo_lookup(user_id, table_name='users'):
    """Helper to be called from any route to capture current request IP and trigger async geo lookup."""
    try:
        # Standard IP extraction from request
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()
        
        threading.Thread(target=geo_lookup_async, args=(user_id, table_name, client_ip), daemon=True).start()
        return client_ip
    except Exception as e:
        logger.error(f"Trigger geo lookup failed: {e}")
        return None

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

import json

def get_face_encoding(id, role='user'):
    """Fetch face descriptor for a specific user/staff/admin."""
    db = get_db()
    # Security: Use a whitelist/mapping for table names to prevent injection
    table_map = {
        'user': 'users',
        'staff': 'staff',
        'admin': 'admins'
    }
    table = table_map.get(role, 'users')
    
    row = db.execute(f'SELECT face_descriptor FROM {table} WHERE id = ?', (id,)).fetchone()
    if row and row['face_descriptor']:
        try:
            return json.loads(row['face_descriptor'])
        except json.JSONDecodeError as e:
            logger.error(f"Error decoding face descriptor for {role} ID {id}: {e}")
            return None
    return None

def compare_face_descriptors(d1, d2, threshold=0.5):
    """
    Compare two 128-d face descriptors using Euclidean distance.
    Threshold tightened to 0.5 for stricter identity matching.
    """
    try:
        if not d1 or not d2: return False

        # Ensure both are lists
        if isinstance(d1, str): d1 = json.loads(d1)
        if isinstance(d2, str): d2 = json.loads(d2)

        # Both must be 128-dimensional vectors
        if not isinstance(d1, list) or not isinstance(d2, list) or len(d1) != 128 or len(d2) != 128:
            logger.warning("Rejecting invalid face descriptor dimensions")
            return False

        # Sanity check: face-api.js descriptors have values in roughly [-1, 1].
        for val in d1 + d2:
            if not isinstance(val, (int, float)) or abs(val) > 5.0:
                logger.warning("Rejecting descriptor with out-of-range values")
                return False

        # Euclidean distance — lower = more similar
        dist = sum((a - b) ** 2 for a, b in zip(d1, d2)) ** 0.5
        logger.info(f"Face descriptor distance: {dist:.4f} (threshold: {threshold})")
        return dist < threshold
    except Exception as e:
        logger.error(f"Error comparing face descriptors: {e}")
        return False
