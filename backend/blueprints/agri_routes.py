from flask import Blueprint, request, jsonify, session
from core.db import get_db
import traceback
import logging
import urllib.request
import json
import sqlite3
import os
import random
import secrets
from werkzeug.security import generate_password_hash
from core.auth import trigger_geo_lookup
from core.constants import PROFILE_PICS_FOLDER, allowed_file

logger = logging.getLogger('smart_bank.agri')

agri_bp = Blueprint('agri', __name__)

def get_open_meteo_soil_data(lat, lng):
    """Fetches real soil moisture data from Open-Meteo API"""
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&hourly=soil_moisture_0_to_7cm"
        
        req = urllib.request.Request(url, headers={'User-Agent': 'SmartBankApp'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            # Get the current or most recent soil moisture reading
            if 'hourly' in data and 'soil_moisture_0_to_7cm' in data['hourly']:
                moisture_list = data['hourly']['soil_moisture_0_to_7cm']
                # Filter out None values
                valid_moisture = [m for m in moisture_list if m is not None]
                if valid_moisture:
                    return sum(valid_moisture) / len(valid_moisture) # Average
        return None
    except Exception as e:
        logger.error(f"Failed to fetch Open-Meteo data: {e}")
        return None

def calculate_ai_score(moisture, crop_type, land_size):
    """Simulates an AI model calculating health and risk"""
    base_score = 60
    
    # Analyze soil moisture (optimal is usually 0.2 to 0.4 m³/m³)
    if moisture:
        if 0.2 <= moisture <= 0.4:
            base_score += 25
        elif moisture > 0.4:
            base_score += 15 # Overwatered but ok
        else:
            base_score -= 10 # Dry
    else:
        # Fallback if API fails
        base_score += 15 
        moisture = 0.25 # Mock realistic value
        
    # Some crops are hardier
    hardy_crops = ['wheat', 'corn', 'soybean', 'millet']
    if any(c in str(crop_type).lower() for c in hardy_crops):
        base_score += 10
        
    # Cap size risk
    if float(land_size) > 50:
        base_score -= 5 # Higher risk for massive uncharted requests
        
    score = min(max(int(base_score), 10), 99)
    
    rec = "Approved" if score >= 75 else ("Manual Review" if score >= 50 else "High Risk - Reject")
    return score, rec, round(moisture, 3)

@agri_bp.route('/apply', methods=['POST'])
def apply_loan():
    if 'user_id' not in session or session.get('role') != 'user':
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json
        user_id = session['user_id']
        coords = data.get('coordinates', '')
        size = float(data.get('size_acres', 0))
        crop = data.get('crop_type', '')
        amt = float(data.get('amount', 0))

        if not coords or size <= 0 or not crop or amt <= 0:
            return jsonify({'error': 'Missing or invalid fields'}), 400

        # Try to parse Lat Lng if provided directly, otherwise use a fallback for the AI mock
        try:
            # Check if it looks like lat,lng (2 numbers)
            parts = [p.strip() for p in str(coords).split(',')]
            if len(parts) == 2:
                lat, lng = float(parts[0]), float(parts[1])
            else:
                lat, lng = 28.6139, 77.2090 # Default Delhi
        except Exception:
            lat, lng = 28.6139, 77.2090 # Default Delhi if text address

        # Call Open-Meteo
        moisture = get_open_meteo_soil_data(lat, lng)
        
        # Calculate AI Score
        score, rec, final_moisture = calculate_ai_score(moisture, crop, size)

        # Save to DB
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('''
            INSERT INTO agriculture_loans 
            (user_id, farm_coordinates, land_size_acres, crop_type, requested_amount, 
             ai_health_score, ai_recommendation, soil_moisture)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, coords, size, crop, amt, score, rec, final_moisture))
        
        db.commit()
        
        return jsonify({
            'message': 'Analysis complete',
            'score': score,
            'recommendation': rec,
            'soil_moisture': final_moisture
        })

    except Exception as e:
        logger.error(f'/agri/apply Error: {traceback.format_exc()}')
        return jsonify({'error': 'Server error processing application'}), 500

@agri_bp.route('/user', methods=['GET'])
def get_user_loans():
    if 'user_id' not in session or session.get('role') != 'user':
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            SELECT id, farm_coordinates, land_size_acres, crop_type, requested_amount, 
                   ai_health_score, ai_recommendation, soil_moisture, status, applied_at
            FROM agriculture_loans
            WHERE user_id = ?
            ORDER BY applied_at DESC
        ''', (session['user_id'],))
        
        loans = [dict(row) for row in cursor.fetchall()]
        return jsonify({'loans': loans})

    except Exception as e:
        logger.error(f'/agri/user Error: {traceback.format_exc()}')
        return jsonify({'error': 'Server error'}), 500

@agri_bp.route('/staff/create_customer', methods=['POST'])
def create_agri_customer():
    if 'user_id' not in session or session.get('role') not in ['staff', 'admin']:
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        # 1. Parse Form Fields
        name = request.form.get('name')
        email = request.form.get('email')
        phone = request.form.get('phone')
        username = request.form.get('username')
        password = request.form.get('password')
        dob = request.form.get('dob')
        
        aadhaar = request.form.get('aadhaar')
        pan = request.form.get('pan')
        farm_address = request.form.get('farm_address')
        land_size = request.form.get('land_size', 0)
        
        if not all([name, email, phone, username, password, aadhaar, pan]):
            return jsonify({'error': 'Missing required fields (Name, Email, Phone, Username, Password, Aadhaar, PAN are required)'}), 400
            
        # 2. Handle Passport Size Photo Upload
        photo_filename = None
        if 'passport_photo' in request.files:
            file = request.files['passport_photo']
            if file and file.filename and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                photo_filename = f"agri_{username}_{secrets.token_hex(4)}.{ext}"
                filepath = os.path.join(PROFILE_PICS_FOLDER, photo_filename)
                os.makedirs(PROFILE_PICS_FOLDER, exist_ok=True)
                file.save(filepath)
                
        db = get_db()
        cursor = db.cursor()
        
        # 3. Create User Profile
        hashed_pw = generate_password_hash(password)
        try:
            cursor.execute('''
                INSERT INTO users (name, email, phone, username, password, date_of_birth, profile_image, address, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ''', (name, email, phone, username, hashed_pw, dob, photo_filename, farm_address))
            new_user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Username or Email already exists in the system'}), 400
            
        # 4. Create Agriculture Account
        acc_num = f"AGR{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
        cursor.execute('''
            INSERT INTO accounts (user_id, account_number, account_type, tax_id, status, balance)
            VALUES (?, ?, 'Agriculture', ?, 'active', 0.00)
        ''', (new_user_id, acc_num, pan))
        
        # 5. Archive KYC Details
        cursor.execute('''
            INSERT INTO account_requests 
            (user_id, account_type, aadhaar_number, pan_number, agri_address, status, processed_date, processed_by)
            VALUES (?, 'Agriculture', ?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?)
        ''', (new_user_id, aadhaar, pan, f"{farm_address} | {land_size} Acres", session['user_id']))
        
        # Log staff action
        cursor.execute('INSERT INTO staff_activity_logs (staff_id, action, details) VALUES (?, ?, ?)',
                  (session['user_id'], 'Create Agri Customer', f'Created agriculture account {acc_num} for user {username}'))
        
        db.commit()
        trigger_geo_lookup(new_user_id)
        
        return jsonify({'success': True, 'message': 'Agriculture Customer & Account created successfully!', 'account_number': acc_num})
        
    except Exception as e:
        logger.error(f'/agri/staff/create_customer Error: {traceback.format_exc()}')
        return jsonify({'error': 'Server error processing agricultural request'}), 500

@agri_bp.route('/staff/all', methods=['GET'])
def get_all_loans():
    if 'user_id' not in session or session.get('role') not in ['staff', 'admin']:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            SELECT a.id, a.user_id, a.farm_coordinates, a.land_size_acres, a.crop_type, a.requested_amount, 
                   a.ai_health_score, a.ai_recommendation, a.status, a.applied_at,
                   u.name as user_name, u.email as user_email
            FROM agriculture_loans a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.applied_at DESC
        ''')
        
        loans = [dict(row) for row in cursor.fetchall()]
        return jsonify({'loans': loans})

    except Exception as e:
        logger.error(f'/agri/staff/all Error: {traceback.format_exc()}')
        return jsonify({'error': 'Server error'}), 500

@agri_bp.route('/staff/process/<int:loan_id>', methods=['POST'])
def process_loan(loan_id):
    if 'user_id' not in session or session.get('role') not in ['staff', 'admin']:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json
        status = data.get('status')
        
        if status not in ['approved', 'rejected']:
            return jsonify({'error': 'Invalid status'}), 400

        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            UPDATE agriculture_loans 
            SET status = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
            WHERE id = ?
        ''', (status, session['user_id'], loan_id))
        
        db.commit()
        return jsonify({'message': f'Loan {status} successfully'})

    except Exception as e:
        logger.error(f'/agri/staff/process Error: {traceback.format_exc()}')
        return jsonify({'error': 'Server error'}), 500
