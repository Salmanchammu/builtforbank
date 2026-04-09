from flask import Blueprint, request, jsonify, session
import json
import logging
from core.db import get_db
from core.auth import login_required, log_audit

face_bp = Blueprint('face', __name__)
logger = logging.getLogger('smart_bank.face')

@face_bp.route('/status', methods=['GET'])
@login_required
def get_face_status():
    """Check if face authentication is enabled for the current user/staff/admin"""
    db = get_db()
    role = session.get('role')
    user_id = session.get('user_id') or session.get('staff_id') or session.get('admin_id')
    
    if not role or not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    # Secure table name selection
    allowed_tables = {'user': 'users', 'staff': 'staff', 'admin': 'admins', 'agri_buyer': 'agri_buyers'}
    if role not in allowed_tables:
        return jsonify({'error': 'Invalid role'}), 400
    table = allowed_tables[role]
    
    try:
        user = db.execute(f'SELECT face_auth_enabled, created_at FROM {table} WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({
            'enabled': bool(user['face_auth_enabled']),
            'registered_date': user['created_at'] if user['face_auth_enabled'] else None
        })
    except Exception as e:
        logger.error(f"Error fetching face status: {e}")
        return jsonify({'error': 'Failed to fetch face status'}), 500

@face_bp.route('/register', methods=['POST'])
@login_required
def register_face():
    """Register/Update face descriptor for the current user"""
    data = request.json
    descriptor = data.get('face_descriptor')
    
    if not descriptor:
        return jsonify({'error': 'Missing face descriptor'}), 400
        
    db = get_db()
    role = session.get('role')
    user_id = session.get('user_id') or session.get('staff_id') or session.get('admin_id')
    
    if not role or not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    # Secure table name selection
    allowed_tables = {'user': 'users', 'staff': 'staff', 'admin': 'admins', 'agri_buyer': 'agri_buyers'}
    if role not in allowed_tables:
        return jsonify({'error': 'Invalid role'}), 400
    table = allowed_tables[role]
    
    try:
        # Descriptor is stored as JSON string
        descriptor_json = json.dumps(descriptor)
        db.execute(f'UPDATE {table} SET face_auth_enabled = 1, face_descriptor = ? WHERE id = ?', 
                  (descriptor_json, user_id))
        db.commit()
        
        log_audit(user_id, role, 'face_registration', 'Enabled face authentication')
        logger.info(f"Face Registered: role={role}, id={user_id}")
        
        return jsonify({
            'success': True, 
            'message': 'Face registered successfully'
        })
    except Exception as e:
        db.rollback()
        logger.error(f"Error registering face: {e}")
        return jsonify({'error': str(e)}), 500

@face_bp.route('/delete', methods=['DELETE'])
@login_required
def delete_face():
    """Disable face authentication and clear descriptor"""
    db = get_db()
    role = session.get('role')
    user_id = session.get('user_id') or session.get('staff_id') or session.get('admin_id')
    
    if not role or not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    # Secure table name selection
    allowed_tables = {'user': 'users', 'staff': 'staff', 'admin': 'admins', 'agri_buyer': 'agri_buyers'}
    if role not in allowed_tables:
        return jsonify({'error': 'Invalid role'}), 400
    table = allowed_tables[role]
    
    try:
        db.execute(f'UPDATE {table} SET face_auth_enabled = 0, face_descriptor = NULL WHERE id = ?', (user_id,))
        db.commit()
        
        log_audit(user_id, role, 'face_deletion', 'Disabled face authentication')
        logger.info(f"Face Deleted: role={role}, id={user_id}")
        
        return jsonify({
            'success': True, 
            'message': 'Face authentication disabled'
        })
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting face: {e}")
        return jsonify({'error': str(e)}), 500
