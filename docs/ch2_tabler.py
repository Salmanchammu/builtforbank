import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Convert Functional Requirements from lists to tables
func_req = """### 2.3.6 Functional Requirements

| Module Code | Module Description | Detailed Specific Requirement |
|-------------|-------------------|--------------------------------|
| **FR-AUTH-1** | Authentication | The core engine is required to handle user faces within 2 seconds using TinyFaceDetector. |
| **FR-AUTH-2** | Authentication | The platform must support active directory password-based login with Werkzeug PBKDF2-SHA256 hashed storage. |
| **FR-AUTH-3** | Authentication | Identity management mandates password complexity: minimum 7 characters, 1 uppercase, 3 digits, 1 special character. |
| **FR-AUTH-4** | Authentication | Identity routing handles dispatching a 6-digit OTP to the email during registration. |
| **FR-AUTH-5** | Authentication | The core engine incorporates liveness detection using EAR blink verification to block photo spoofing. |
| **FR-AUTH-6** | Authentication | Mobile gateway requires a secondary 4-digit mobile passcode. |
| **FR-ACC-1** | Account Management | Profile systems allow customers to securely open a maximum of 3 bank accounts via KYC. |
| **FR-ACC-2** | Account Management | Generation engines create unique SMTB-prefixed account numbers instantly. |
| **FR-ACC-3** | Account Management | Traffic routers enforce distinct dashboards based on secure role login (Customer/Staff/Admin). |
| **FR-ACC-4** | Account Management | Structure repositories support four foundational account types: Savings, Current, Corporate, and Agriculture. |
| **FR-ACC-5** | Account Management | Risk controls permit administrators to block/unblock user accounts with immediate session termination. |
| **FR-TXN-1** | Transaction Engine | Ledger modules mandate NEFT/IMPS fund transfers between accounts with daily hard limits (₹2,00,000 INR; ₹50,000 international). |
| **FR-TXN-2** | Transaction Engine | Currency exchange arrays calculate multi-currency transfers (INR, USD, EUR, GBP, AED). |
| **FR-TXN-3** | Transaction Engine | Loop prevention blocks self-transfers entirely. |
| **FR-TXN-4** | Transaction Engine | Audit logic triggers a hard stop if attempting a transfer without a sufficient balance baseline. |
| **FR-TXN-5** | Transaction Engine | The core engine mints unique transaction reference identifiers sequentially. |
| **FR-TXN-6** | Transaction Engine | Live endpoints integrate UPI simulations with 6-digit PIN validation. |
| **FR-LOAN-1** | Loan Processing | Credit modules deploy specific term categories: Personal, Business, Education, Vehicle, and Agricultural. |
| **FR-LOAN-2** | Loan Processing | The mathematical backend mandates a 5% baseline interest computation, scaled. |
| **FR-LOAN-3** | Loan Processing | The cron scheduler is tasked with applying algorithmic daily fines precisely at midnight. |
| **FR-LOAN-4** | Loan Processing | Approved capital requests are immediately withdrawn from the master institutional liquidity pool. |
| **FR-LOAN-5** | Loan Processing | The ledger accepts isolated partial balance deductions. |
| **FR-RPT-1** | Data Reporting | Audit systems inject user-defined boundaries for PDF statement filtering (1 Month/6 Month/All). |
| **FR-RPT-2** | Data Reporting | Rendering engines instantiate dynamic branded PDF outputs utilizing ReportLab. |
| **FR-RPT-3** | Data Reporting | Export controls compile isolated tables for independent Users, Loans, and Transactions audits. |
| **FR-MAP-1** | Geospatial Grid | Geographic rendering arrays plot a 3D terrain grid strictly operating on MapLibre GL. |
| **FR-MAP-2** | Geospatial Grid | Coordinate markers output isolated location popups rendering exact latitude/longitude coordinates. |
| **FR-MAP-3** | Geospatial Grid | Admin structures integrate complete geospatial database CRUD operations. |

### 2.3.7 Non-Functional Requirements

| Layer Constraint | Target Metric | Engineering Implementation |
|------------------|---------------|-----------------------------|
| **Performance Level 1** | Sub-500ms API | Internal routing nodes process database queries instantaneously. |
| **Performance Level 2** | Sub-2s Biometrics | Facial tensor computations run purely constrained via WebAssembly memory limits. |
| **Performance Level 3** | High Concurrency | Connection pools natively stabilize operations handling 50 active simulated traffic flows. |
| **Performance Level 4** | Instant Transition | The UI Virtual DOM engine triggers component replacements within 300 milliseconds. |
| **Performance Level 5** | PDF Rendering | The ReportLayer buffer engine strictly converts 1,000 query rows under 5 seconds parallelized. |
| **Security Layer 1** | Salted Hashes | Credential retention strictly utilizes localized PBKDF2 cryptography matrices. |
| **Security Layer 2** | TTL Sessions | Session tokens implement rapid rotation, automatically self-destructing post 30 minutes. |
| **Security Layer 3** | XSS Protection | Input sanitization protocols aggressively strip all external script executions. |
| **Security Layer 4** | Descriptor Format| Biometric strings exist purely as mathematical 128-float arrays (irreversible format). |
| **Security Layer 5** | RBAC Architecture| Routing layers respond rigorously with HTTP 403 blocks during clearance mismatch anomalies. |
| **Reliability Layer 1** | 99.9% Uptime | Structural architecture attempts an operational peak continuous loop. |
| **Reliability Layer 2** | Distributed Writes | Transactional logs adhere purely to atomic WAL protocols, securing ledger sequence tracking. |
| **Reliability Layer 3** | Finite Precision | Floating-point variables mandate standardized arithmetic limiting trailing residual drift anomalies. |
| **Scalability Layer 1** | Database Agnostic| The abstraction protocol allows hot-swapping direct SQLite blocks to cluster-ready PostgreSQL matrices. |
| **Scalability Layer 2** | Fragmented Code | Flask Blueprints split backend functionalities deliberately isolating components. |
| **Scalability Layer 3** | Edge Caching | The presentation tier delegates fixed asset loads off-server targeting generalized CDNs strictly. |
"""

import re
old_block_match = re.search(r'(### 2\.3\.6 Functional Requirements.*?)(?=### 2\.3\.8 Design Constraints)', text, re.DOTALL)
if old_block_match:
    text = text.replace(old_block_match.group(1), func_req + "\n")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated chapter 2 tables")
