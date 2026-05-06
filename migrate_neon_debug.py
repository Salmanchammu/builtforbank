import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from backend.core.db import get_db, migrate_db
from flask import Flask

app = Flask(__name__)
with app.app_context():
    db = get_db()
    migrations = [
        ('users', 'password_hash', 'VARCHAR(255)'),
        ('staff', 'last_login', 'TIMESTAMP'),
        ('admins', 'last_login', 'TIMESTAMP'),
        ('accounts', 'foreign_currency', 'DECIMAL(15, 2) DEFAULT 0.00'),
        ('accounts', 'currency', 'VARCHAR(3) DEFAULT "INR"'),
        ('transactions', 'foreign_currency', 'DECIMAL(15, 2)'),
        ('transactions', 'foreign_amount', 'DECIMAL(15, 2)'),
        ('transactions', 'exchange_rate', 'DECIMAL(10, 4)'),
        ('cards', 'pin_hash', 'VARCHAR(255)'),
        ('cards', 'contactless_enabled', 'INTEGER DEFAULT 1'),
        ('cards', 'international_enabled', 'INTEGER DEFAULT 0'),
        ('cards', 'online_txn_enabled', 'INTEGER DEFAULT 1'),
        ('service_applications', 'processed_by', 'INTEGER'),
        ('users', 'signup_ip', 'VARCHAR(45)'),
        ('users', 'signup_lat', 'DECIMAL(10, 7)'),
        ('users', 'signup_lng', 'DECIMAL(10, 7)'),
        ('users', 'signup_city', 'VARCHAR(100)'),
        ('users', 'signup_country', 'VARCHAR(100)'),
        ('account_requests', 'pan_proof', 'TEXT'),
        ('account_requests', 'kyc_photo', 'TEXT'),
        ('account_requests', 'kyc_video', 'TEXT'),
        ('account_requests', 'signup_ip', 'VARCHAR(45)'),
        ('account_requests', 'signup_lat', 'DECIMAL(10,7)'),
        ('account_requests', 'signup_lng', 'DECIMAL(10,7)'),
        ('account_requests', 'agri_address', 'TEXT'),
        ('account_requests', 'agri_proof', 'TEXT'),
        ('account_requests', 'salary_proof', 'TEXT'),
        ('account_requests', 'current_proof', 'TEXT'),
        ('users', 'face_auth_enabled', 'INTEGER DEFAULT 0'),
        ('users', 'face_descriptor', 'TEXT'),
        ('agri_buyers', 'face_auth_enabled', 'INTEGER DEFAULT 0'),
        ('agri_buyers', 'face_descriptor', 'TEXT'),
        ('agri_buyers', 'associated_account_id', 'INTEGER'),
        ('accounts', 'daily_limit', 'DECIMAL(15, 2) DEFAULT 200000.00'),
        ('users', 'aadhaar_number', 'VARCHAR(20)'),
        ('users', 'pan_number', 'VARCHAR(20)'),
        ('staff', 'aadhaar_number', 'VARCHAR(20)'),
        ('staff', 'pan_number', 'VARCHAR(20)'),
        ('card_requests', 'account_id', 'INTEGER'),
        ('staff', 'signup_ip', 'VARCHAR(45)'),
        ('staff', 'signup_lat', 'DECIMAL(10, 7)'),
        ('staff', 'signup_lng', 'DECIMAL(10, 7)'),
        ('staff', 'signup_city', 'VARCHAR(100)'),
        ('staff', 'signup_country', 'VARCHAR(100)'),
        ('admins', 'signup_ip', 'VARCHAR(45)'),
        ('admins', 'signup_lat', 'DECIMAL(10, 7)'),
        ('admins', 'signup_lng', 'DECIMAL(10, 7)'),
        ('admins', 'signup_city', 'VARCHAR(100)'),
        ('admins', 'signup_country', 'VARCHAR(100)'),
        ('agri_buyers', 'signup_ip', 'VARCHAR(45)'),
        ('agri_buyers', 'signup_lat', 'DECIMAL(10, 7)'),
        ('agri_buyers', 'signup_lng', 'DECIMAL(10, 7)'),
        ('agri_buyers', 'signup_city', 'VARCHAR(100)'),
        ('agri_buyers', 'signup_country', 'VARCHAR(100)'),
        ('users', 'otp', 'VARCHAR(10)'),
        ('users', 'phone_otp', 'VARCHAR(10)'),
        ('users', 'otp_expiry', 'TIMESTAMP'),
        ('staff', 'otp', 'VARCHAR(10)'),
        ('staff', 'phone_otp', 'VARCHAR(10)'),
        ('staff', 'otp_expiry', 'TIMESTAMP'),
        ('agri_buyers', 'otp', 'VARCHAR(10)'),
        ('agri_buyers', 'phone_otp', 'VARCHAR(10)'),
        ('agri_buyers', 'otp_expiry', 'TIMESTAMP'),
        ('admins', 'otp', 'VARCHAR(10)'),
        ('admins', 'phone_otp', 'VARCHAR(10)'),
        ('admins', 'otp_expiry', 'TIMESTAMP'),
    ]

    for table, col, col_type in migrations:
        try:
            db.execute(f"SELECT {col} FROM {table} LIMIT 1")
        except Exception as e:
            print(f"Adding {col} to {table}...")
            try:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                print(f"SUCCESS added {col}")
            except Exception as e2:
                print(f"FAILED adding {col}: {e2}")
