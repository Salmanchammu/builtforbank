import sqlite3
import os
import logging
from flask import g, current_app

logger = logging.getLogger('smart_bank.db')

CORE_DIR = os.path.dirname(os.path.abspath(__file__))

from core.constants import DATABASE

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
                    self._cursor = None
                def execute(self, sql, params=None):
                    if self._cursor is None:
                        self._cursor = self.conn.cursor(cursor_factory=RealDictCursor)
                    # Convert ? to %s for Postgres
                    sql = sql.replace('?', '%s')
                    # Convert INSERT OR IGNORE to ON CONFLICT DO NOTHING (Postgres style)
                    if 'INSERT OR IGNORE' in sql.upper():
                        sql = sql.upper().replace('INSERT OR IGNORE', 'INSERT') + ' ON CONFLICT DO NOTHING'
                    self._cursor.execute(sql, params)
                    return self._cursor
                def commit(self): self.conn.commit()
                def rollback(self): self.conn.rollback()
                def close(self):
                    if self._cursor: self._cursor.close()
                    self.conn.close()
                def fetchone(self):
                    return self._cursor.fetchone() if self._cursor else None
                def fetchall(self):
                    return self._cursor.fetchall() if self._cursor else []
            
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
    db = get_db()
    # Path to schema.sql relative to backend/ (assuming it stays in backend/)
    # Actually, let's keep it in backend/ or move to core/
    schema_path = os.path.join(CORE_DIR, '..', 'schema.sql')
    if os.path.exists(schema_path):
        logger.info("Initializing database from schema.sql")
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        if hasattr(db, 'executescript'):
            db.executescript(schema_sql)
        else:
            commands = [c.strip() for c in schema_sql.split(';') if c.strip()]
            for cmd in commands:
                try:
                    db.execute(cmd)
                except Exception as e:
                    logger.warning(f"Schema init cmd failed: {e}")
        db.commit()
    
    migrate_db()

def migrate_db():
    """Apply incremental migrations and ensure all tables exist (Non-destructive)"""
    db = get_db()
    logger.info("Checking for database migrations and table integrity...")
    
    # 1. Ensure all core tables from schema.sql exist
    core_tables = {
        'users': '''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20),
            address TEXT,
            date_of_birth DATE,
            status VARCHAR(20) DEFAULT 'active',
            reset_token VARCHAR(100),
            reset_token_expiry TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            upi_id VARCHAR(50) UNIQUE,
            upi_pin VARCHAR(255),
            mobile_passcode VARCHAR(255),
            passcode_enabled INTEGER DEFAULT 0,
            otp VARCHAR(10),
            otp_expiry TIMESTAMP,
            profile_image VARCHAR(255),
            device_type VARCHAR(50) DEFAULT 'unknown',
            daily_limit DECIMAL(15, 2) DEFAULT 200000.00
        )''',
        'staff': '''CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            phone VARCHAR(20),
            department VARCHAR(50),
            position VARCHAR(50),
            status VARCHAR(20) DEFAULT 'active',
            face_auth_enabled INTEGER DEFAULT 0,
            face_descriptor TEXT,
            base_salary DECIMAL(15, 2) DEFAULT 50000.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            device_type VARCHAR(50) DEFAULT 'unknown'
        )''',
        'admins': '''CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            level VARCHAR(50) DEFAULT 'admin',
            status VARCHAR(20) DEFAULT 'active',
            face_auth_enabled INTEGER DEFAULT 0,
            face_descriptor TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            device_type VARCHAR(50) DEFAULT 'unknown'
        )''',
        'accounts': '''CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_number VARCHAR(20) UNIQUE NOT NULL,
            account_type VARCHAR(50) NOT NULL,
            balance DECIMAL(15, 2) DEFAULT 0.00,
            currency VARCHAR(3) DEFAULT 'INR',
            status VARCHAR(20) DEFAULT 'active',
            interest_rate DECIMAL(5, 2) DEFAULT 0.00,
            ifsc VARCHAR(20) DEFAULT 'SMTB0000001',
            branch VARCHAR(100) DEFAULT 'Main Branch',
            tax_id VARCHAR(50),
            daily_limit DECIMAL(15, 2) DEFAULT 200000.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )''',
        'transactions': '''CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            type VARCHAR(20) NOT NULL,
            amount DECIMAL(15, 2) NOT NULL,
            description TEXT,
            reference_number VARCHAR(50) UNIQUE,
            balance_after DECIMAL(15, 2),
            transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            mode VARCHAR(20) DEFAULT 'NEFT',
            status VARCHAR(20) DEFAULT 'completed',
            related_account VARCHAR(20),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        )''',
        'cards': '''CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_id INTEGER,
            card_number VARCHAR(20) UNIQUE NOT NULL,
            card_type VARCHAR(20) NOT NULL,
            card_holder_name VARCHAR(100) NOT NULL,
            expiry_date DATE NOT NULL,
            cvv VARCHAR(4) NOT NULL,
            credit_limit DECIMAL(15, 2),
            available_credit DECIMAL(15, 2),
            status VARCHAR(20) DEFAULT 'active',
            issued_date DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
        )''',
        'loans': '''CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            loan_type VARCHAR(50) NOT NULL,
            loan_amount DECIMAL(15, 2) NOT NULL,
            interest_rate DECIMAL(5, 2) NOT NULL,
            tenure_months INTEGER NOT NULL,
            monthly_payment DECIMAL(15, 2),
            outstanding_amount DECIMAL(15, 2),
            status VARCHAR(20) DEFAULT 'pending',
            application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            approved_date TIMESTAMP,
            approved_by INTEGER,
            disbursement_date TIMESTAMP,
            target_account_id INTEGER,
            penalty_amount DECIMAL(15, 2) DEFAULT 0.00,
            last_charge_date TIMESTAMP,
            next_due_date DATE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL,
            FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE SET NULL
        )''',
        'card_requests': '''CREATE TABLE IF NOT EXISTS card_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_id INTEGER,
            card_type VARCHAR(20) NOT NULL,
            requested_credit_limit DECIMAL(15, 2),
            reason TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            staff_notes TEXT,
            request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_date TIMESTAMP,
            processed_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
            FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL
        )''',
        'account_requests': '''CREATE TABLE IF NOT EXISTS account_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_type VARCHAR(50) NOT NULL,
            aadhaar_number VARCHAR(20),
            pan_number VARCHAR(20),
            tax_id VARCHAR(50),
            face_descriptor TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_date TIMESTAMP,
            processed_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL
        )''',
        'system_audit': '''CREATE TABLE IF NOT EXISTS system_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_type VARCHAR(20),
            action VARCHAR(100) NOT NULL,
            details TEXT,
            ip_address VARCHAR(45),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'staff_activity_logs': '''CREATE TABLE IF NOT EXISTS staff_activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER NOT NULL,
            action VARCHAR(100) NOT NULL,
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'support_tickets': '''CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            priority VARCHAR(20) DEFAULT 'normal',
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            resolved_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (resolved_by) REFERENCES staff(id) ON DELETE SET NULL
        )''',
        'notifications': '''CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sender_id INTEGER,
            title VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(20) DEFAULT 'info',
            is_read BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )''',
        'attendance': '''CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER NOT NULL,
            date DATE NOT NULL,
            clock_in TIMESTAMP,
            clock_out TIMESTAMP,
            total_hours DECIMAL(5, 2),
            status VARCHAR(20) DEFAULT 'present',
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
        )''',
        'beneficiaries': '''CREATE TABLE IF NOT EXISTS beneficiaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            account_number VARCHAR(20) NOT NULL,
            ifsc VARCHAR(20),
            bank_name VARCHAR(100),
            nickname VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )''',
        'savings_goals': '''CREATE TABLE IF NOT EXISTS savings_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            target_amount DECIMAL(15, 2) NOT NULL,
            current_amount DECIMAL(15, 2) DEFAULT 0.00,
            deadline DATE,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )''',
        'agriculture_loans': '''CREATE TABLE IF NOT EXISTS agriculture_loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            farm_coordinates VARCHAR(100) NOT NULL,
            land_size_acres DECIMAL(10, 2) NOT NULL,
            crop_type VARCHAR(100) NOT NULL,
            requested_amount DECIMAL(15, 2) NOT NULL,
            ai_health_score INTEGER,
            ai_recommendation VARCHAR(50),
            soil_moisture DECIMAL(5, 2),
            status VARCHAR(20) DEFAULT 'pending',
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            processed_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL
        )''',
        'service_applications': '''CREATE TABLE IF NOT EXISTS service_applications (
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
        )''',
        'user_activity_logs': '''CREATE TABLE IF NOT EXISTS user_activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )''',
        'agri_buyers': '''CREATE TABLE IF NOT EXISTS agri_buyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer_id VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            phone VARCHAR(20),
            business_name VARCHAR(150),
            gst_number VARCHAR(20),
            status VARCHAR(20) DEFAULT 'active',
            profile_image VARCHAR(255),
            associated_account_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'crop_listings': '''CREATE TABLE IF NOT EXISTS crop_listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farmer_user_id INTEGER NOT NULL,
            farmer_account_id INTEGER NOT NULL,
            crop_name VARCHAR(100) NOT NULL,
            category VARCHAR(50) DEFAULT 'General',
            quantity_kg DECIMAL(12, 2) NOT NULL,
            price_per_kg DECIMAL(10, 2) NOT NULL,
            min_order_kg DECIMAL(12, 2) DEFAULT 1.00,
            description TEXT,
            harvest_date DATE,
            location VARCHAR(200),
            image_url VARCHAR(255),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (farmer_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (farmer_account_id) REFERENCES accounts(id) ON DELETE CASCADE
        )''',
        'crop_orders': '''CREATE TABLE IF NOT EXISTS crop_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            buyer_id INTEGER NOT NULL,
            farmer_user_id INTEGER NOT NULL,
            farmer_account_id INTEGER NOT NULL,
            quantity_kg DECIMAL(12, 2) NOT NULL,
            price_per_kg DECIMAL(10, 2) NOT NULL,
            total_amount DECIMAL(15, 2) NOT NULL,
            commission_amount DECIMAL(15, 2) DEFAULT 0.00,
            farmer_credit DECIMAL(15, 2) DEFAULT 0.00,
            status VARCHAR(30) DEFAULT 'pending',
            negotiated_price DECIMAL(10, 2),
            negotiation_note TEXT,
            delivery_date DATE,
            inspection_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES crop_listings(id),
            FOREIGN KEY (buyer_id) REFERENCES agri_buyers(id),
            FOREIGN KEY (farmer_user_id) REFERENCES users(id)
        )''',
        'escrow_transactions': '''CREATE TABLE IF NOT EXISTS escrow_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            amount DECIMAL(15, 2) NOT NULL,
            type VARCHAR(20) NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES crop_orders(id)
        )''',
        'deposit_requests': '''CREATE TABLE IF NOT EXISTS deposit_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            amount DECIMAL(15, 2) NOT NULL,
            proof_image VARCHAR(255),
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            processed_by INTEGER,
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL
        )''',
        'system_finances': '''CREATE TABLE IF NOT EXISTS system_finances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fund_name VARCHAR(100) UNIQUE NOT NULL,
            balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'marketplace_chats': '''CREATE TABLE IF NOT EXISTS marketplace_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            sender_type VARCHAR(20) NOT NULL,
            sender_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES crop_orders(id) ON DELETE CASCADE
        )'''
    }

    for table_name, create_sql in core_tables.items():
        try:
            db.execute(f"SELECT 1 FROM {table_name} LIMIT 1")
        except Exception:
            logger.info(f"Self-healing: Creating missing table {table_name}")
            db.execute(create_sql)
            db.commit()

    # 2. Sequential Column Migrations
    migrations = [
        ('users', 'profile_image', 'VARCHAR(255)'),
        ('users', 'device_type', 'VARCHAR(50) DEFAULT "unknown"'),
        ('staff', 'device_type', 'VARCHAR(50) DEFAULT "unknown"'),
        ('admins', 'device_type', 'VARCHAR(50) DEFAULT "unknown"'),
        ('users', 'daily_limit', 'DECIMAL(15, 2) DEFAULT 200000.00'),
        ('staff', 'profile_image', 'VARCHAR(255)'),
        ('admins', 'profile_image', 'VARCHAR(255)'),
        ('users', 'transact_restricted', 'INTEGER DEFAULT 0'),
        ('account_requests', 'rejection_reason', 'TEXT'),
        ('users', 'signup_ip', 'VARCHAR(45)'),
        ('users', 'signup_lat', 'DECIMAL(10, 7)'),
        ('users', 'signup_lng', 'DECIMAL(10, 7)'),
        ('users', 'signup_city', 'VARCHAR(100)'),
        ('users', 'signup_country', 'VARCHAR(100)'),
        ('account_requests', 'aadhaar_proof', 'TEXT'),
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
        ('users', 'otp_expiry', 'TIMESTAMP'),
    ]

    for table, col, col_type in migrations:
        try:
            db.execute(f"SELECT {col} FROM {table} LIMIT 1")
        except Exception:
            logger.info(f"Migrating: Adding {col} to {table}")
            try:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                db.commit()
            except Exception as e:
                logger.error(f"Failed to add {col} to {table}: {e}")

    # 3. Seed system_finances if empty
    try:
        count = db.execute("SELECT COUNT(*) FROM system_finances").fetchone()[0]
        if count == 0:
            logger.info("Seeding system_finances with default Loan Liquidity Fund")
            db.execute("INSERT INTO system_finances (fund_name, balance) VALUES (?, ?)", ("Loan Liquidity Fund", 1000000.00))
            db.commit()
    except Exception as e:
        logger.error(f"Failed to seed system_finances: {e}")

    logger.info("Database migrations complete.")
