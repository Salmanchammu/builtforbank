import os
import subprocess
import sys

# Ensure markdown is installed
try:
    import markdown
except ImportError:
    print("Installing markdown...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "markdown"])
    import markdown

from playwright.sync_api import sync_playwright

def generate_pdf():
    # Read the original handbook
    artifact_path = r"C:\Users\salma\.gemini\antigravity\brain\31b9feba-55f3-4ef6-8a81-3f2ec8a58f36\SmartBank_Handbook.md"
    
    with open(artifact_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    # Expand the handbook with MASSIVE details
    expansion = """
---

## 15. Comprehensive API Reference (All Endpoints)

### 15.1 User Blueprints (`/api/user/*`)
- **GET** `/api/user/accounts` - Retrieve all accounts for the logged-in user.
- **POST** `/api/user/account-request` - Submit KYC for a new account type (Aadhaar/PAN required).
- **GET** `/api/user/transactions` - Fetch paginated transaction history.
- **POST** `/api/user/transfer` - Initiate NEFT/IMPS transfer (requires balance passcode).
- **GET** `/api/user/cards` - View active debit/credit cards and virtual numbers.
- **POST** `/api/user/card-request` - Apply for a new card type.
- **GET** `/api/user/loans` - View active loans, EMI schedules, and outstanding balances.
- **POST** `/api/user/loan-apply` - Apply for personal/home/gold loan.
- **GET** `/api/user/upi/status` - Check if UPI ID is linked.
- **POST** `/api/user/upi/setup` - Create virtual UPI ID.
- **POST** `/api/user/upi/pay` - Process UPI payment to another VPA.
- **GET** `/api/user/notifications` - Fetch unread system notifications.
- **GET** `/api/user/support-tickets` - View status of user-created tickets.

### 15.2 Staff Blueprints (`/api/staff/*`)
- **GET** `/api/staff/dashboard-stats` - View global banking metrics (Total deposits, active loans).
- **GET** `/api/staff/pending-kyc` - List all pending account requests.
- **POST** `/api/staff/approve-kyc` - Approve user KYC and generate account number.
- **GET** `/api/staff/loan-applications` - List pending loans with AI risk scores.
- **POST** `/api/staff/approve-loan` - Sanction loan and disburse funds.
- **GET** `/api/staff/card-requests` - View pending credit/debit card applications.
- **POST** `/api/staff/clock-in` - Record staff attendance (timestamp).
- **GET** `/api/staff/support-queue` - View active customer support tickets.

### 15.3 Admin Blueprints (`/api/admin/*`)
- **GET** `/api/admin/system-stats` - View total liquidity, active users, and global metrics.
- **GET** `/api/admin/users` - Paginated list of all users with status filters.
- **POST** `/api/admin/toggle-user` - Suspend or activate a user account.
- **GET** `/api/admin/staff` - List all bank employees and their departments.
- **POST** `/api/admin/add-staff` - Provision a new staff account.
- **GET** `/api/admin/audit-logs` - View immutable system action logs.
- **GET** `/api/admin/finances` - View internal bank liquidity funds.

### 15.4 Mobile Specific (`/api/mobile/*`)
- **GET** `/api/mobile/dashboard` - Aggregated single-call endpoint for mobile UI.
- **POST** `/api/mobile/verify-passcode` - Unlock mobile app with 4-digit PIN.
- **POST** `/api/mobile/setup-passcode` - Initial PIN creation.

### 15.5 Agriculture (`/api/agri/*` & `/api/marketplace/*`)
- **POST** `/api/agri/apply-loan` - Requires GPS coordinates (`lat`, `lng`), land size, and crop type.
- **GET** `/api/agri/marketplace/listings` - View all active crop listings from farmers.
- **POST** `/api/marketplace/create-listing` - Farmer uploads crop details and price.
- **POST** `/api/marketplace/place-order` - Buyer initiates escrow payment for crop.
- **POST** `/api/marketplace/release-escrow` - Buyer confirms receipt, releasing funds.

---

## 16. Code Deep Dive: How the AI Chatbot Works

The SmartBank chatbot uses an **Intent-Based NLP Engine** built in pure Python.

```python
# snippet from backend/core/chatbot.py
def get_response(self, message, user_id=None):
    msg = message.lower().strip()
    db = get_db()
    
    # Check each intent against the user message
    for intent, data in self.intents.items():
        for p in data['patterns']:
            if p in msg:
                # Require authentication for sensitive intents
                if data.get('requires_auth') and not user_id:
                    return "🔒 Please log in to access your account details.", intent
                
                # Dynamic Response: Balance Inquiry
                if intent == 'balance_inquiry' and user_id:
                    accounts = db.execute('SELECT account_number, balance FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
                    if accounts:
                        total = sum(float(a['balance']) for a in accounts)
                        return f"📊 Total balance across your accounts is ₹{total:,.2f}", intent
                
                # Dynamic Response: Transaction History
                if intent == 'transaction_history' and user_id:
                    # Fetch last 5 transactions from DB
                    ...
```
**Why this is powerful for Vivas:** You can explain that while LLMs (like ChatGPT) are prone to hallucinations, a banking system *must* be deterministic. This pattern-matching approach guarantees that the bot will never accidentally promise a user a 0% interest loan.

---

## 17. Code Deep Dive: Security & Face Authentication

Face authentication operates entirely on numerical vectors, not images.

```javascript
// Client-side (Frontend)
const detections = await faceapi.detectSingleFace(video)
    .withFaceLandmarks()
    .withFaceDescriptor();

// Send only the 128-dimensional array to the server
const descriptorArray = Array.from(detections.descriptor);
fetch('/api/auth/face-login', {
    method: 'POST',
    body: JSON.stringify({ face_descriptor: descriptorArray })
});
```

```python
# Server-side (backend/core/auth.py)
def compare_face_descriptors(d1, d2, threshold=0.5):
    # Euclidean distance formula
    dist = sum((a - b) ** 2 for a, b in zip(d1, d2)) ** 0.5
    return dist < threshold
```
**Why this matters:** Storing raw face images is a huge GDPR/data privacy risk. By only storing the 128-dimensional mathematical representation, even if the database is breached, the hackers cannot reconstruct the user's face.

---

## 18. The Database Schema (Entity Relationship Overview)

- `users` (1) ---> (N) `accounts`
- `accounts` (1) ---> (N) `transactions`
- `accounts` (1) ---> (N) `cards`
- `users` (1) ---> (N) `loans`
- `users` (1) ---> (N) `support_tickets`
- `crop_listings` (1) ---> (N) `crop_orders`
- `crop_orders` (1) ---> (1) `escrow_transactions`

---

## 19. Complete Viva Q&A Cheat Sheet

**Q: Why did you use Flask instead of Django?**
A: Flask is a micro-framework that gives complete control over the architecture. I used Flask Blueprints to modularize the 9 different route files. Django is monolithic and often brings too much overhead; Flask allowed me to build exactly what I needed, specifically tailoring the `core/auth.py` middleware for multi-role RBAC and Face Auth.

**Q: How is the database secured?**
A: All passwords use PBKDF2-SHA256 hashing via Werkzeug. Face data is stored as mathematical descriptors, not images. We prevent SQL injection by strictly using parameterized queries (`?` in SQLite, `%s` in Postgres).

**Q: How does the Agriculture Loan feature work?**
A: Farmers submit their land coordinates (Lat/Lng) and crop type. The backend logic stores this and sets the status to pending. In a real-world scenario, this would integrate with a satellite API (like ISRO's Bhuvan or Sentinel) to verify soil moisture and crop health. Currently, the system simulates this AI health score to assist staff in approvals.

**Q: What happens if two people transfer money at the exact same millisecond?**
A: We enabled SQLite WAL (Write-Ahead Logging) mode, and in production, PostgreSQL handles strict ACID concurrency with row-level locking. This ensures money isn't duplicated or lost during simultaneous database writes.

**Q: Why use external APIs for email instead of just SMTP?**
A: Relying solely on Gmail SMTP is unreliable in production due to spam filters and rate limits. The app is built with a triple-fallback system: It attempts to use the Brevo HTTP API, falls back to Resend API, and finally falls back to standard SMTP. If all fail, it logs the OTP securely to the server console to prevent user lockouts during development.
"""
    
    final_md = md_content + expansion

    html_content = markdown.markdown(final_md, extensions=['tables', 'fenced_code'])

    # CSS to make it look like a beautiful professional handbook
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>SmartBank Handbook</title>
        <style>
            body {{
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 900px;
                margin: 0 auto;
                padding: 40px;
                background-color: #f8f9fa;
            }}
            .container {{
                background-color: #ffffff;
                padding: 50px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }}
            h1 {{
                color: #1a365d;
                border-bottom: 3px solid #3182ce;
                padding-bottom: 10px;
                font-size: 2.5em;
            }}
            h2 {{
                color: #2b6cb0;
                margin-top: 40px;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 5px;
            }}
            h3 {{
                color: #2c5282;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }}
            th, td {{
                padding: 12px;
                border: 1px solid #e2e8f0;
                text-align: left;
            }}
            th {{
                background-color: #edf2f7;
                font-weight: bold;
            }}
            pre {{
                background-color: #2d3748;
                color: #e2e8f0;
                padding: 15px;
                border-radius: 5px;
                overflow-x: auto;
                font-family: 'Courier New', Courier, monospace;
            }}
            code {{
                background-color: #edf2f7;
                padding: 2px 4px;
                border-radius: 3px;
                font-family: 'Courier New', Courier, monospace;
                color: #c53030;
            }}
            pre code {{
                background-color: transparent;
                color: inherit;
                padding: 0;
            }}
            blockquote {{
                border-left: 4px solid #ecc94b;
                background-color: #fffff0;
                padding: 10px 20px;
                margin: 0;
                font-style: italic;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            {html_content}
        </div>
    </body>
    </html>
    """

    html_file = os.path.abspath("SmartBank_Handbook_Expanded.html")
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(full_html)

    pdf_file = "SmartBank_Handbook_Expanded.pdf"
    print(f"Generating PDF at {pdf_file}...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"file:///{html_file.replace(chr(92), '/')}", wait_until="networkidle")
        page.pdf(path=pdf_file, format="A4", print_background=True, margin={"top": "40px", "bottom": "40px", "left": "40px", "right": "40px"})
        browser.close()
        
    print(f"Successfully generated {pdf_file}")

if __name__ == '__main__':
    generate_pdf()
