from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch

def build():
    doc = SimpleDocTemplate("SmartBank_Complete_Handbook.pdf", pagesize=A4,
        rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=40)
    styles = getSampleStyleSheet()

    T = ParagraphStyle('T', parent=styles['Heading1'], fontSize=28, spaceAfter=8, textColor=HexColor("#1a365d"))
    S = ParagraphStyle('S', parent=styles['Normal'], fontSize=13, leading=18, spaceAfter=15, textColor=HexColor("#4a5568"))
    H = ParagraphStyle('H', parent=styles['Heading2'], fontSize=18, spaceBefore=25, spaceAfter=10, textColor=HexColor("#2b6cb0"))
    H3 = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=14, spaceBefore=15, spaceAfter=8, textColor=HexColor("#2c5282"))
    B = ParagraphStyle('B', parent=styles['Normal'], fontSize=11, leading=17, spaceAfter=10, textColor=HexColor("#333"))
    BL = ParagraphStyle('BL', parent=styles['Normal'], fontSize=11, leading=17, spaceAfter=6, leftIndent=20, bulletIndent=10)
    CO = ParagraphStyle('CO', parent=styles['Normal'], fontSize=10, leading=14, spaceAfter=10, leftIndent=15,
        fontName='Courier', textColor=HexColor("#2d3748"), backColor=HexColor("#edf2f7"))
    QH = ParagraphStyle('QH', parent=styles['Normal'], fontSize=12, leading=17, spaceAfter=4, textColor=HexColor("#c53030"), fontName='Helvetica-Bold')
    QA = ParagraphStyle('QA', parent=styles['Normal'], fontSize=11, leading=17, spaceAfter=14, leftIndent=15, textColor=HexColor("#333"))

    s = []

    # COVER
    s.append(Spacer(1, 120))
    s.append(Paragraph("SmartBank v2", T))
    s.append(Paragraph("Complete Project Handbook", ParagraphStyle('sub', parent=T, fontSize=20, textColor=HexColor("#3182ce"))))
    s.append(Spacer(1, 20))
    s.append(Paragraph("A production-grade digital banking platform built with Flask, vanilla HTML/CSS/JS, SQLite/PostgreSQL, and deployed on Render.", S))
    s.append(Spacer(1, 30))
    s.append(Paragraph("Features: Multi-Role Auth &bull; 2FA &bull; Face Recognition &bull; AI Chatbot &bull; UPI Payments &bull; Crop Marketplace &bull; Encrypted Chat &bull; PDF Statements &bull; Branch Locator", B))
    s.append(PageBreak())

    # 1. OVERVIEW
    s.append(Paragraph("1. Project Overview", H))
    s.append(Paragraph("SmartBank is a full-stack internet banking system supporting 4 user roles (Customer, Staff, Admin, Agri-Buyer), each with dedicated dashboards. The platform simulates real-world banking operations including account management, fund transfers (NEFT/IMPS/RTGS), card issuance, loan processing, UPI payments, and an agriculture crop marketplace with escrow.", B))
    s.append(Paragraph("The system is designed with professional software engineering principles: modular Flask Blueprints for separation of concerns, self-healing database migrations for zero-downtime schema evolution, and a triple-fallback email delivery system for reliability.", B))

    features = [
        ["Feature", "Description"],
        ["Multi-Role Auth", "Users, Staff, Admins, Agri-Buyers with dedicated dashboards"],
        ["2FA Login", "Email OTP verification on every login (10min expiry)"],
        ["Face Authentication", "Browser-based face recognition via face-api.js (128-d descriptors)"],
        ["Core Banking", "Accounts, Transactions (NEFT/IMPS/RTGS), Cards, Loans"],
        ["UPI Payments", "Virtual UPI ID creation, UPI PIN, instant transfers"],
        ["AI Chatbot", "Intent-based NLP with 18+ intents and live DB queries"],
        ["Crop Marketplace", "Agriculture marketplace with escrow payments"],
        ["Staff Portal", "KYC verification, loan approvals, card issuance, attendance"],
        ["Admin Dashboard", "System control, user management, audit logs, finances"],
        ["Mobile Banking", "Responsive mobile UI with 4-digit passcode lock"],
        ["Branch/ATM Locator", "Interactive map with 10 seeded Indian branches"],
        ["Encrypted Chat", "AES-128-CBC (Fernet) encrypted live chat"],
        ["PDF Statements", "ReportLab-powered downloadable account statements"],
    ]
    t = Table(features, colWidths=[140, 340])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#2b6cb0")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f7fafc")]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    s.append(t)
    s.append(PageBreak())

    # 2. TECH STACK
    s.append(Paragraph("2. Technology Stack", H))
    tech = [
        ["Layer", "Technology"],
        ["Backend", "Python 3.11, Flask >=3.0, Gunicorn"],
        ["Database", "SQLite (dev) / PostgreSQL via Neon (prod)"],
        ["Frontend", "Vanilla HTML5, CSS3, JavaScript ES6+"],
        ["Face Auth", "face-api.js (TensorFlow.js models)"],
        ["Encryption", "Fernet (AES-128-CBC) via cryptography lib"],
        ["PDF Engine", "ReportLab >=4.2"],
        ["Email", "Brevo API / Resend API / SMTP fallback"],
        ["Deployment", "Render (Web Service + Persistent Disk)"],
        ["CORS", "Flask-CORS >=4.0"],
    ]
    t2 = Table(tech, colWidths=[120, 360])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#2b6cb0")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f7fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    s.append(t2)

    # 3. ARCHITECTURE
    s.append(Paragraph("3. System Architecture", H))
    s.append(Paragraph("The application follows a classic 3-tier architecture:", B))
    s.append(Paragraph("&bull; <b>Presentation Layer (Frontend)</b>: Static HTML/CSS/JS served by Flask. Device detection auto-routes mobile users to the mobile dashboard.", BL))
    s.append(Paragraph("&bull; <b>Application Layer (Backend)</b>: Flask app with 9 Blueprints handling all business logic. Core modules provide shared utilities for auth, DB, encryption, and email.", BL))
    s.append(Paragraph("&bull; <b>Data Layer (Database)</b>: SQLite locally with WAL mode for concurrency; PostgreSQL in production via DATABASE_URL environment variable.", BL))
    s.append(Spacer(1, 10))
    s.append(Paragraph("<b>9 Flask Blueprints:</b>", B))
    bps = [
        ["Blueprint", "URL Prefix", "Purpose"],
        ["auth_bp", "/api/auth", "Signup, Login, 2FA, Face-login, Password reset"],
        ["user_bp", "/api/user", "Accounts, Transactions, Cards, Loans, UPI"],
        ["staff_bp", "/api/staff", "KYC approvals, Loan mgmt, Attendance"],
        ["admin_bp", "/api/admin", "System admin, User mgmt, Audit"],
        ["mobile_bp", "/api/mobile", "Mobile-specific endpoints"],
        ["face_bp", "/api/face", "Face registration and verification"],
        ["chat_bp", "/api/chat", "AI chatbot conversations"],
        ["agri_bp", "/api/agri", "Agriculture loan applications"],
        ["marketplace_bp", "/api/marketplace", "Crop listings, Orders, Escrow"],
    ]
    t3 = Table(bps, colWidths=[110, 110, 260])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#2b6cb0")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f7fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    s.append(t3)
    s.append(PageBreak())

    # 4. DATABASE
    s.append(Paragraph("4. Database Schema (25+ Tables)", H))
    s.append(Paragraph("The database uses 25+ tables organized into 4 groups. All tables use IF NOT EXISTS for resilience. Foreign keys with ON DELETE CASCADE ensure referential integrity.", B))

    s.append(Paragraph("Core Tables", H3))
    core_tables = [
        ["Table", "Purpose", "Key Columns"],
        ["users", "Customer accounts", "username, email, password, upi_id, face_descriptor"],
        ["staff", "Bank employees", "staff_id, department, position, base_salary"],
        ["admins", "System administrators", "username, level, face_descriptor"],
        ["agri_buyers", "Marketplace buyers", "buyer_id, business_name, gst_number"],
        ["accounts", "Bank accounts", "account_number, balance, currency, ifsc"],
        ["transactions", "Transaction log", "type, amount, reference_number, mode"],
        ["cards", "Debit/Credit cards", "card_number, cvv, credit_limit, status"],
        ["loans", "Loan applications", "loan_type, interest_rate, tenure_months"],
    ]
    t4 = Table(core_tables, colWidths=[90, 140, 250])
    t4.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#2b6cb0")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f7fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    s.append(t4)

    s.append(Paragraph("Workflow, Support, Marketplace & Audit Tables", H3))
    s.append(Paragraph("&bull; <b>card_requests</b> / <b>account_requests</b> / <b>deposit_requests</b> / <b>service_applications</b> &mdash; Pending approval workflows", BL))
    s.append(Paragraph("&bull; <b>support_tickets</b> / <b>support_messages</b> / <b>live_chat_sessions</b> / <b>live_chat_messages</b> &mdash; Customer support with encrypted chat", BL))
    s.append(Paragraph("&bull; <b>crop_listings</b> / <b>crop_orders</b> / <b>escrow_transactions</b> / <b>marketplace_chats</b> &mdash; Agriculture marketplace", BL))
    s.append(Paragraph("&bull; <b>system_audit</b> / <b>user_activity_logs</b> / <b>staff_activity_logs</b> / <b>attendance</b> &mdash; Audit and tracking", BL))
    s.append(Paragraph("&bull; <b>system_finances</b> &mdash; Bank liquidity fund (seeded at 5 Crore INR)", BL))
    s.append(Paragraph("&bull; <b>bank_locations</b> &mdash; 10 Indian branch/ATM coordinates", BL))
    s.append(Paragraph("&bull; <b>notifications</b> / <b>beneficiaries</b> / <b>savings_goals</b> / <b>chat_history</b> &mdash; User features", BL))
    s.append(PageBreak())

    # 5. SECURITY
    s.append(Paragraph("5. Security Architecture", H))
    s.append(Paragraph("SmartBank implements defense-in-depth with multiple security layers:", B))

    sec = [
        ["Feature", "Implementation"],
        ["Password Policy", "Min 9 chars, uppercase start, digit + special char"],
        ["Password Hashing", "Werkzeug PBKDF2-SHA256"],
        ["2FA", "Email OTP on every login (10min expiry, CSPRNG)"],
        ["Brute-Force Protection", "5 failed attempts = 15-minute IP lockout"],
        ["Session Security", "HttpOnly, SameSite=Lax, Secure, 30min TTL"],
        ["Face Recognition", "128-d descriptor, Euclidean distance < 0.5"],
        ["RBAC", "@login_required + @role_required decorators"],
        ["Chat Encryption", "Fernet AES-128-CBC from SECRET_KEY"],
        ["Path Traversal", "os.path.normpath + base directory check"],
        ["Audit Logging", "All admin/staff actions logged with IP"],
        ["CORS", "Restricted to localhost + *.render.com"],
        ["Geo-tracking", "IP to city/country via ip-api.com"],
    ]
    t5 = Table(sec, colWidths=[140, 340])
    t5.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#c53030")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#fff5f5")]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    s.append(t5)

    s.append(Paragraph("Authentication Flow Explained", H3))
    s.append(Paragraph("1. User enters username + password on the login page.", BL))
    s.append(Paragraph("2. Backend checks IP against brute-force lockout table (5 attempts = 15min ban).", BL))
    s.append(Paragraph("3. Password is verified against the PBKDF2-SHA256 hash stored in the database.", BL))
    s.append(Paragraph("4. If valid, a cryptographically secure 6-digit OTP is generated using secrets.randbelow().", BL))
    s.append(Paragraph("5. OTP is emailed via triple-fallback: Brevo API -> Resend API -> SMTP -> Console log.", BL))
    s.append(Paragraph("6. User submits OTP. Backend verifies it matches and hasn't expired (10min window).", BL))
    s.append(Paragraph("7. Session is created with HttpOnly + SameSite=Lax cookies. TTL is 30 minutes.", BL))
    s.append(PageBreak())

    # 6. FACE AUTH DEEP DIVE
    s.append(Paragraph("6. Face Authentication Deep Dive", H))
    s.append(Paragraph("SmartBank uses a privacy-preserving approach to face authentication:", B))
    s.append(Paragraph("<b>Step 1 - Client-Side Detection:</b> The browser loads face-api.js (TensorFlow.js). The user's webcam captures video frames. The library detects the face and extracts a 128-dimensional numerical descriptor (a mathematical fingerprint of facial features). No images are ever sent to the server.", B))
    s.append(Paragraph("<b>Step 2 - Transmission:</b> Only the 128-element floating-point array is sent via POST to /api/auth/face-login.", B))
    s.append(Paragraph("<b>Step 3 - Server Comparison:</b> The backend fetches all stored descriptors from the database and calculates the Euclidean distance between the submitted descriptor and each stored one.", B))
    s.append(Paragraph("<b>Step 4 - Thresholding:</b> If the Euclidean distance is less than 0.5 (strict threshold), the face is considered a match. Values closer to 0 mean higher similarity.", B))
    s.append(Paragraph("<b>Privacy Benefit:</b> Even if the database is breached, attackers cannot reconstruct the user's face from the 128-d vector. This makes the system GDPR-friendly.", B))

    # 7. AI CHATBOT
    s.append(Paragraph("7. AI Chatbot Engine", H))
    s.append(Paragraph("The chatbot (core/chatbot.py) uses an intent-based NLP approach with 18 intents:", B))
    s.append(Paragraph("&bull; <b>Pattern Matching:</b> Each intent has a list of trigger words. The user's message is lowercased and checked against all patterns.", BL))
    s.append(Paragraph("&bull; <b>Dynamic Responses:</b> For balance_inquiry and transaction_history, the bot queries the live database and returns real account data.", BL))
    s.append(Paragraph("&bull; <b>Auth-Gated Intents:</b> Sensitive intents (balance, transfers, cards) require the user to be logged in.", BL))
    s.append(Paragraph("&bull; <b>Why not LLM?</b> Banking systems must be deterministic. An LLM could hallucinate incorrect balances or interest rates. Pattern-matching guarantees accurate, predictable responses.", BL))
    s.append(Paragraph("Supported intents: greeting, balance_inquiry, transaction_history, transfer_money, loan_inquiry, card_inquiry, support_request, upi_inquiry, fd_inquiry, mutual_fund, insurance, kyc, security, account_opening, branch_atm, offers, crop_marketplace, jokes, who_are_you, thanks, goodbye.", B))
    s.append(PageBreak())

    # 8. AGRICULTURE ECOSYSTEM
    s.append(Paragraph("8. Agriculture Ecosystem", H))
    s.append(Paragraph("<b>GPS-Verified Loans:</b> Farmers apply for agriculture loans by submitting their farm's GPS coordinates (lat/lng), land size in acres, and crop type. The system stores soil moisture and AI health scores to assist staff in risk assessment. In a production scenario, this would integrate with satellite APIs like ISRO Bhuvan or Sentinel.", B))
    s.append(Paragraph("<b>Crop Marketplace:</b> A B2B platform connecting farmers (SmartBank account holders) directly with registered agri_buyers. Farmers can list crops with prices, photos, and minimum order quantities. Buyers browse listings and place orders.", B))
    s.append(Paragraph("<b>Escrow Payments:</b> When a buyer places an order, the payment amount is held in escrow (escrow_transactions table). Funds are only released to the farmer's account once the buyer confirms delivery and quality. This protects both parties from fraud.", B))
    s.append(Paragraph("<b>Marketplace Chat:</b> Buyers and farmers can communicate about orders through an integrated chat system (marketplace_chats table), enabling price negotiation and delivery coordination.", B))

    # 9. EMAIL SYSTEM
    s.append(Paragraph("9. Email Delivery System", H))
    s.append(Paragraph("SmartBank uses a resilient triple-fallback async email system (core/email_utils.py):", B))
    s.append(Paragraph("1. <b>Brevo API</b> (formerly Sendinblue) - HTTP POST to api.brevo.com/v3/smtp/email", BL))
    s.append(Paragraph("2. <b>Resend API</b> - HTTP POST to api.resend.com/emails", BL))
    s.append(Paragraph("3. <b>SMTP Fallback</b> - Direct Gmail/custom SMTP with SSL/STARTTLS", BL))
    s.append(Paragraph("4. <b>Console Fallback</b> - If ALL methods fail, the OTP is printed to server logs so the user is never locked out during development.", BL))
    s.append(Paragraph("All emails are sent in background threads (threading.Thread with daemon=True) to avoid blocking the HTTP response.", B))
    s.append(PageBreak())

    # 10. FRONTEND
    s.append(Paragraph("10. Frontend Architecture", H))
    pages = [
        ["Role", "Login Page", "Dashboard", "Size"],
        ["User", "user.html", "userdash.html", "136KB"],
        ["Staff", "staff.html", "staffdash.html", "164KB"],
        ["Admin", "(via staff)", "admindash.html", "162KB"],
        ["Agri-Buyer", "agri-buyer-login.html", "agri-buyer-dash.html", "35KB"],
        ["Mobile", "mobile-auth.html", "mobile-dash.html", "87KB"],
    ]
    t6 = Table(pages, colWidths=[80, 130, 140, 50])
    t6.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#2b6cb0")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f7fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    s.append(t6)
    s.append(Paragraph("<b>Key JS Files:</b> userdash.js (308KB), staffdash.js (295KB), admindash.js (245KB), mobile-logic.js (234KB), face-api.min.js (664KB), chatbot.js (26KB), signup.js (10KB), api-config.js (7KB).", B))
    s.append(Paragraph("<b>Device Detection:</b> The system auto-detects mobile vs desktop via device-detector.js and serves the appropriate UI.", B))

    # 11. DEPLOYMENT
    s.append(Paragraph("11. Deployment on Render", H))
    s.append(Paragraph("<b>Build:</b> pip install -r requirements.txt", B))
    s.append(Paragraph("<b>Start:</b> gunicorn backend.main:app --workers 1 --timeout 120", B))
    s.append(Paragraph("<b>Environment Variables:</b> SECRET_KEY, DATABASE_URL, PYTHON_VERSION=3.11.9, FLASK_ENV=production, RENDER=true", B))
    s.append(Paragraph("<b>Boot Sequence:</b> Gunicorn imports app -> detects RENDER=true -> connects to PostgreSQL via DATABASE_URL -> runs init_db() + migrate_db() -> loads smart_seed.json -> app is live.", B))

    # 12. VIVA Q&A
    s.append(Paragraph("12. Viva Q&A Cheat Sheet", H))

    s.append(Paragraph("Q: Why Flask instead of Django?", QH))
    s.append(Paragraph("Flask is a micro-framework giving complete architectural control. I used 9 Flask Blueprints to modularize routes. Django's monolithic approach would have brought unnecessary overhead. Flask allowed me to build custom RBAC middleware and face auth integration exactly as needed.", QA))

    s.append(Paragraph("Q: How is the database secured?", QH))
    s.append(Paragraph("All passwords use PBKDF2-SHA256 hashing. Face data is stored as mathematical descriptors, not images. SQL injection is prevented via parameterized queries (? in SQLite, %s in Postgres). No raw user input is ever interpolated into SQL strings.", QA))

    s.append(Paragraph("Q: How does Face Authentication work?", QH))
    s.append(Paragraph("The browser uses face-api.js (TensorFlow.js) to extract a 128-dimensional facial descriptor from the webcam. Only this numerical array is sent to the server. The backend compares it against stored descriptors using Euclidean distance. A distance < 0.5 means a match. No images are stored, making it GDPR-friendly.", QA))

    s.append(Paragraph("Q: What happens if two people transfer money simultaneously?", QH))
    s.append(Paragraph("SQLite uses WAL (Write-Ahead Logging) mode for concurrent access. In production, PostgreSQL handles strict ACID concurrency with row-level locking. This ensures money is never duplicated or lost during simultaneous writes.", QA))

    s.append(Paragraph("Q: Why not use an LLM for the chatbot?", QH))
    s.append(Paragraph("Banking systems must be deterministic. An LLM could hallucinate incorrect balances or interest rates. Our pattern-matching approach guarantees accurate, predictable responses every time. The chatbot still provides dynamic, live data by querying the database directly.", QA))

    s.append(Paragraph("Q: How does the Agriculture Loan feature work?", QH))
    s.append(Paragraph("Farmers submit GPS coordinates, land size, and crop type. The system stores this with an AI health score for staff-assisted risk assessment. In production, this would integrate with satellite APIs (like ISRO Bhuvan) for soil moisture verification.", QA))

    s.append(Paragraph("Q: Why use external APIs for email instead of just SMTP?", QH))
    s.append(Paragraph("Gmail SMTP is unreliable in production due to spam filters and rate limits. The app uses a triple-fallback: Brevo API -> Resend API -> SMTP -> Console log. This ensures OTPs are always delivered.", QA))

    s.append(Paragraph("Q: Explain the Escrow payment system.", QH))
    s.append(Paragraph("When a buyer orders crops, funds are held in a secure escrow state (escrow_transactions table). Money is only released to the farmer after the buyer confirms delivery and quality. This protects both parties from fraud.", QA))

    s.append(Paragraph("Q: How does the self-healing database work?", QH))
    s.append(Paragraph("The migrate_db() function in core/db.py runs on every startup. It checks if each of the 25+ tables exists and creates missing ones. It then runs 78 column migrations, adding any missing columns. This means the schema evolves without manual SQL or downtime.", QA))

    s.append(Paragraph("Q: What is the Separation of Concerns principle?", QH))
    s.append(Paragraph("Each module has a single responsibility: auth_routes.py handles only authentication, user_routes.py handles only user operations, core/db.py handles only database connections. This makes the code maintainable, testable, and scalable.", QA))

    doc.build(s)
    print("PDF generated: SmartBank_Complete_Handbook.pdf")

if __name__ == '__main__':
    build()
