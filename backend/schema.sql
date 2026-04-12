-- Smart Bank Database Schema with Face Authentication
-- SQLite Database

-- Smart Bank Database Schema
-- SQLite Database

-- Core Tables (Using IF NOT EXISTS for resilience)
CREATE TABLE IF NOT EXISTS users (
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
    phone_otp VARCHAR(10),
    otp_expiry TIMESTAMP,
    profile_image VARCHAR(255),
    device_type VARCHAR(50) DEFAULT 'unknown',
    daily_limit DECIMAL(15, 2) DEFAULT 200000.00
);

-- Staff table (WITH face authentication)
CREATE TABLE IF NOT EXISTS staff (
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
);

-- Admins table (WITH face authentication)
CREATE TABLE IF NOT EXISTS admins (
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
);

-- System Audit table
CREATE TABLE IF NOT EXISTS system_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- Admin or Staff ID
    user_type VARCHAR(20), -- 'admin' or 'staff'
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
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
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
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
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
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
);

-- Card Requests table
CREATE TABLE IF NOT EXISTS card_requests (
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
);

-- Account Requests table
CREATE TABLE IF NOT EXISTS account_requests (
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
);

-- Loans table
CREATE TABLE IF NOT EXISTS loans (
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
);

-- System Finances table for Liquidity Fund
CREATE TABLE IF NOT EXISTS system_finances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_name VARCHAR(100) UNIQUE NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat History table
CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    intent VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Support Tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
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
);

-- Support Messages table for real-time chat
CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL, -- 'user', 'staff', or 'admin'
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_cards_user ON cards(user_id);
CREATE INDEX idx_card_requests_user ON card_requests(user_id);
CREATE INDEX idx_card_requests_status ON card_requests(status);
CREATE INDEX idx_loans_user ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_chat_user ON chat_history(user_id);
CREATE INDEX idx_chat_timestamp ON chat_history(timestamp);
CREATE INDEX idx_support_user ON support_tickets(user_id);
CREATE INDEX idx_support_status ON support_tickets(status);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sender_id INTEGER,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info',
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(is_read);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    date DATE NOT NULL,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    total_hours DECIMAL(5, 2),
    status VARCHAR(20) DEFAULT 'present',
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_staff ON attendance(staff_id);
CREATE INDEX idx_attendance_date ON attendance(date);

CREATE INDEX idx_audit_timestamp ON system_audit(timestamp);
CREATE INDEX idx_audit_user ON system_audit(user_id);
CREATE INDEX idx_account_requests_user ON account_requests(user_id);
CREATE INDEX idx_account_requests_status ON account_requests(status);

-- Database is now ready
-- Use the backend to create admin/staff/user accounts through signup/registration

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

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
);

-- Agriculture Loans table
CREATE TABLE IF NOT EXISTS agriculture_loans (
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
);

-- Bank Branches and ATMs table
CREATE TABLE IF NOT EXISTS bank_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'branch' or 'atm'
    address TEXT,
    city VARCHAR(100),
    lat DECIMAL(10, 6) NOT NULL,
    lng DECIMAL(10, 6) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    photo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
