from docx import Document

INPUT  = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Humanized_Final.docx'
OUTPUT = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Humanized_FINAL_v2.docx'

R = {
# OBJECTIVES LIST
"Secure Biometric Authentication: Use face-api.js for face recognition login, which delivers a secure alternative to traditional passwords.":
"Face-Based Login: I used face-api.js to let users log in with their face instead of a password. This makes login both safer and faster.",

"Interactive Balance Privacy: Add an \"Eye\" toggle button so users can hide or show their account balance for better privacy.":
"Balance Hide Button: A simple eye icon button lets users hide their balance on screen so nobody nearby can see it.",

"Advanced Automated Filtering: Allow customers to filter their transaction history and download PDF account statements (Current Month, Last 6 Months, or Full History).":
"Statement Filtering: Customers can filter their transaction list by time period and download the result as a proper PDF bank statement.",

"Administrative Workflow Management: streamline how bank staff and admins approve new accounts, debit cards, and loan applications.":
"Staff Approval System: I built a task queue for staff and admins so they can review and approve new accounts, cards, and loan requests in one place.",

"Satellite-Verified Agriculture Hub: Offer special 7.5% p.a. farm loans to farmers, verified using satellite maps and land checks.":
"Agri Loan Hub: Farmers can apply for discounted farm loans at 7.5% per year. The system uses satellite imagery to verify their land before approving.",

"Incorporated Agri-Commerce Marketplace: Provide a marketplace section where farmers can list and sell their crops directly to buyers.":
"Crop Marketplace: A built-in shop where farmers can post their crops for sale and buyers can browse and purchase them directly.",

"Intelligent Savings Strategy: Create a Pockets (Savings Goals) feature to help users save money for specific targets.":
"Savings Pockets: Users can create separate saving goals — like saving for a phone or a trip — and track their progress with a visual bar.",

"Exhaustive Investment Ecosystem: Include simulated options for Fixed Deposits (8.5% p.a.), Mutual Funds, and Life Insurance.":
"Investment Options: The platform includes simulated Fixed Deposits at 8.5% per year, Mutual Funds, and a Life Insurance section for users to explore.",

"Dynamic Personal Finance Analytics: Show users a visual breakdown of their income and expenses using interactive Chart.js graphs.":
"Spending Charts: Users get a visual graph showing where their money is going each month, built using Chart.js.",

"Simulated UPI Ecosystem: Allow users to practice scanning QR codes and making simulated UPI payments with instant receipts.":
"UPI Payments: Users can scan a QR code and simulate a UPI payment. A receipt is generated instantly after each transaction.",

"Customer Care & Ticketing: Add a customer support ticket system where users can ask for help and staff can reply.":
"Support Tickets: Users can raise a support request from within the app and a staff member will respond through the same system.",

"Multi-Tier Security Protocol: guarantee user data is kept safe using encrypted sessions, PIN codes, and proper transaction logs.":
"Security Layers: Every user session is encrypted, transactions require a PIN, and all actions are logged so nothing goes unnoticed.",

# HARDWARE REQUIREMENTS
"Processors: Intel(R) Core(TM) i5-7200U (or higher) @ 2.50GHz 2.70 GHz":
"CPU: Intel Core i5-7200U or faster. Higher processor speed helps the face recognition run without lag.",

"RAM: 8GB and above (Recommended for real-time biometric processing)":
"RAM: 8GB or more. The face scan feature needs this much memory to run in real time.",

"Hard disk deployment: 40GB and above (To support database, ML models, and PDF assets)":
"Storage: At least 40GB free disk space to hold the database, the face recognition model files, and generated PDF statements.",

# SOFTWARE REQUIREMENTS
"Text editor: Visual Studio Code / Visual Studio":
"Code Editor: I wrote the whole project in Visual Studio Code.",

"Server: Python Flask (WSGI compliant) / Apache integration":
"Server: Python Flask handles all the backend routing and API responses.",

"Browser: Google Chrome / Microsoft Edge (Optimized for WebGL and Face Recognition)":
"Browser: The app is built for Google Chrome or Microsoft Edge, both of which support the webcam and 3D map features.",

# TOOLS
"Front-end: HTML5, CSS3 (Glassmorphism), JavaScript (ES6+), FontAwesome":
"Frontend: I used HTML5, CSS3 with a frosted-glass style, modern JavaScript, and FontAwesome icons.",

"Back-end: Python (Flask framework)":
"Backend: Python with the Flask framework handles all the server-side logic.",

"Database: SQLite3 (256-bit encryption optimized)":
"Database: SQLite3 stores all the data in a single local file with encryption applied.",

"Specialized Libraries: MapLibre GL (3D Maps), Leaflet.js (Mapping), ReportLab (PDF Statements), face-api.js (Biometrics), Chart.js (Data Analytics)":
"Libraries Used: MapLibre GL for the 3D map, Leaflet.js for basic mapping, ReportLab to generate PDF statements, face-api.js for face recognition, and Chart.js for the spending graphs.",

# REFERENCES
"Internal project guidelines and technical documentation derived from standard development practices.":
"My own notes and planning documents written before and during development.",

"The initial project outline created before coding began.":
"The first draft of the project plan I wrote at the start.",

"The official GitHub repository and documentation for the face-api.js library.":
"The official face-api.js GitHub page and its documentation pages.",

# PRODUCT FEATURES
"Biometric Login: Facial geometry-based identity verification for all roles.":
"Face Login: Every user type — customer, staff, and admin — can log in using their face instead of typing a password.",

"Agri-Hub: Satellite-verified land approvals and specialized crop marketplace.":
"Agri-Hub: A dedicated section for farmers, with satellite-based land verification for loans and a built-in crop shop.",

"3D Locator: Precision navigation for ATMs and Branches using MapLibre GL.":
"Branch Finder: A 3D interactive map that shows nearby ATMs and branches with directions.",

"Finance Tools: Savings Goals (Pockets), Fixed Deposits, and Statement Filtering.":
"Finance Tools: Savings goals with progress tracking, fixed deposit options, and downloadable filtered statements.",

"Admin Control: Full-lifecycle management of user accounts and loan requests.":
"Admin Panel: Full control over customers, staff, loans, and system settings from one screen.",

# USER CHARACTERISTICS
"Customers: Regular users who need to check their accounts and transfer money.":
"Customers: Regular people who log in to check their balance, send money, and use banking services.",

"Bank Staff: Bank employees who verify documents, approve loans, and manage agriculture records.":
"Bank Staff: Employees who review KYC documents, approve or reject loan applications, and handle farmer-related requests.",

"Administrators: Top-level users who manage the entire system and assign staff roles.":
"Administrators: The top-level system manager who controls staff accounts, customer data, and system settings.",

# GENERAL CONSTRAINTS
"Browser Compatibility: Works best on Google Chrome because it needs camera access and 3D map rendering.":
"Browser Limit: The app works best on Google Chrome. Other browsers may not support the webcam or the 3D map properly.",

"Hardware Limitation: At least 8GB RAM needed for the face recognition to run smoothly.":
"RAM Requirement: 8GB of RAM is needed. On lower-spec machines, the face recognition may be slow.",

"Simulated\tEnvironment:\tAll\tfinancial\ttransactions\tare\tsimulated\tfor educational/demonstration purposes.":
"Simulated Transactions: All money movements in this system are simulated. No real money is involved — this is a demonstration platform.",

# ASSUMPTIONS
"Users should have a working webcam for face login.":
"The system assumes users have a working webcam connected to their device for the face login feature.",

"The system needs a stable internet connection to load fonts and icons from (CDN) like FontAwesome and Google Fonts.":
"A working internet connection is needed to load external icon sets and fonts from CDN services like FontAwesome and Google Fonts.",

# EXTERNAL INTERFACE
"The system uses the device webcam to capture face images and saves PDF statements to the local Downloads folder.":
"The app accesses the device camera through the browser to scan faces for login, and saves PDF statements directly to the user's Downloads folder.",

# SOFTWARE INTERFACE
"Frontend: JavaScript ES6+ / CSS3 / HTML5.":
"Frontend stack: HTML5 for structure, CSS3 for styling, and modern JavaScript for all interactive features.",

"Backend: Python 3.8+ / Flask.":
"Backend stack: Python 3.8 or newer running a Flask web server.",

"Database: SQLite3.":
"Database: A SQLite3 file stores all user, transaction, and application data.",

"Mapping: MapLibre GL & Leaflet.js.":
"Maps: MapLibre GL powers the 3D branch locator and Leaflet.js is used for simpler map views.",

# FUNCTIONAL REQUIREMENTS
"FR1: The system should recognize a face within 2 seconds.":
"FR1: Face login must complete the scan and match within 2 seconds of opening the camera.",

"FR2: System MUST allow PDF statement filtering by month/6-months/year.":
"FR2: Users must be able to download a statement filtered by the current month, last 6 months, or full account history.",

"FR3: System MUST provide distinct dashboards based on user role login.":
"FR3: Each user type gets their own separate dashboard. A customer cannot see the admin panel and vice versa.",

# PERFORMANCE
"Latency: Backend responses should come back in under 500ms for account queries.":
"Speed: Any account-related API call should respond in less than half a second under normal load.",

"Reliability: Handle up to 50 users at the same time in a local setup.":
"Capacity: The local setup should be able to handle fifty users logged in simultaneously without crashing.",

# DESIGN CONSTRAINTS
"The design should look the same across all pages (Modern White) across all sub-pages.":
"Every page in the system follows the same Modern White design language — same fonts, same color scheme, same layout style throughout.",

# SYSTEM ATTRIBUTES
"Availability: 99.9% simulation uptime.":
"Uptime: The system targets 99.9% availability during demo and testing sessions.",

"scalability: Structured to allow migration to PostgreSQL for enterprise use.":
"Scalability: The database layer is designed so it can be swapped from SQLite to PostgreSQL if the system needs to scale up.",

# SAFETY REQUIREMENTS
"Auto logout after 15 minutes of no activity.":
"If a user stays idle for 15 minutes the system automatically logs them out to protect their account.",

"Visual masking of sensitive account balances using the \"Eye\" toggle feature.":
"The account balance can be hidden with one tap using the eye toggle, so sensitive figures are not visible to bystanders.",

# SECURITY REQUIREMENTS
"Biometric Integrity: Face data is encrypted before storing and raw face images are never saved.":
"Face Data Safety: The face descriptor numbers are encrypted before saving to the database. The actual photo is never stored — only the numeric fingerprint.",

"Transaction Guard: Four-character numeric tokens mandated for important handheld operations.":
"PIN Protection: A 4-digit PIN is required to confirm any important transaction, adding an extra layer of security.",

"Input Validation: All form inputs are cleaned to prevent SQL injection and XSS attacks.":
"Input Safety: Every value submitted through a form is sanitized on the backend to block SQL injection and cross-site scripting attempts.",

# DFD RULES
"All processes must have at least one input and one output.":
"Every process shown in the diagram must have something coming in and something going out.",

"Data cannot move directly from one data store to another; it must move through a process.":
"Data stores cannot connect to each other directly. All data must pass through a process bubble first.",

"Entities cannot move data directly to each other; it must go through a process.":
"Two external entities cannot exchange data directly. A process must always sit in between.",

"Processes should have unique and descriptive names.":
"Each process in the diagram is given a clear and unique name so the reader knows exactly what it does.",

# DFD SYMBOLS
"Process (Circle/Rounded Square): Operations performed on data.":
"Process (shown as a circle or rounded box): Represents an action or operation the system performs on data.",

"Data Store (Open Rectangle): Repositories of data (e.g., Users Table).":
"Data Store (open-ended rectangle): Where data is kept, like the Users table or the Transactions table.",

"External Entity (Square): Destination or source of data (User/Staff).":
"External Entity (square box): Someone or something outside the system that sends or receives data, like a customer or a staff member.",

"Data Flow (Arrow): The path data takes through the system.":
"Data Flow (arrow): Shows which direction information travels between processes, stores, and entities.",

# DFD LEVEL 0
"This level 0 diagram shows the absolute basics of how data enters and leaves the application.":
"This is the highest-level view of the system. It just shows what goes in — user requests — and what comes out — processed responses — without any internal detail.",

# DFD ADMIN LEVEL 2
"3.7.1 DFD Level 2 (Manage Customers): Create, Block, and Edit customer profiles and account types.":
"3.7.1 Manage Customers: The admin can create new customer profiles, block existing accounts, or edit account details and types.",

"3.7.2 DFD Level 2 (Manage Staff): Oversee staff assignments, recruitment approvals, and performance logs.":
"3.7.2 Manage Staff: Admins can hire new staff members, assign them roles, and review their activity logs.",

"3.7.3 DFD Level 2 (Manage Service Applications): Review and approve Card/Loan escalations from the Staff portal.":
"3.7.3 Manage Applications: Service requests that staff cannot handle alone — like high-value loans — get escalated here for admin sign-off.",

"3.7.4 DFD Level 2 (Manage Locations): Add, edit, and remove Branch and ATM locations with GPS coordinates for the 3D Map Locator.":
"3.7.4 Manage Locations: Admins add, update, or remove branch and ATM pin locations on the 3D map using GPS coordinates.",

# DFD STAFF LEVEL 2
"3.7.11 DFD Level 2 (KYC Authentication): Verification of ID proofs and Face Descriptors for new account seekers.":
"3.7.11 KYC Verification: Staff check the uploaded ID documents and face data for new customers before approving their accounts.",

"3.7.12 DFD Level 2 (Agriculture Hub): Real-time analysis of satellite imagery and land proof uploads (RTC).":
"3.7.12 Agriculture Hub: Staff review satellite images and land ownership documents submitted by farmers applying for agri-loans.",

"3.7.13 DFD Level 2 (Customer Jobs): Managing the queue for card activations and loan disbursements.":
"3.7.13 Customer Jobs: A task queue where staff process pending card activations and loan disbursements one by one.",

"3.7.14 DFD Level 2 (Crop Marketplace Oversight): Monitoring crop listings, resolving order disputes, and managing escrow settlements.":
"3.7.14 Marketplace Oversight: Staff can monitor what is listed in the crop marketplace, step in to resolve buyer-seller disputes, and confirm payments.",

# DFD CUSTOMER LEVEL 2
"3.7.17 DFD Level 2 (Register): Initial onboarding with 256-bit encryption and account type selection.":
"3.7.17 Registration: New users fill in their details, choose an account type, and their data is stored with encryption applied.",

"3.7.18 DFD Level 2 (Face Login): The core engine comparing real-time scans with stored descriptors.":
"3.7.18 Face Login: When a user clicks Face Login, the camera scans their face and the system compares it to the stored face data to verify identity.",

"3.7.19 DFD Level 2 (Savings Goals/Pockets): Setting, monitoring, and funding specific budget targets.":
"3.7.19 Savings Pockets: Users create a saving goal, set a target amount, and add money to it over time while watching a progress bar fill up.",

"3.7.20 DFD Level 2 (UPI/QR Payments): Real-time QR code simulation and UPI PIN validation protocols.":
"3.7.20 UPI Payments: Users scan a QR code or enter a UPI ID, enter their PIN, and the simulated payment goes through instantly.",

"3.7.21 DFD Level 2 (Statement Generation): ReportLab PDF processing using dynamic date filters (6-Months/Current).":
"3.7.21 PDF Statements: Users pick a date range and the system builds a PDF bank statement on the fly using ReportLab.",

"3.7.22 DFD Level 2 (Agriculture Booking): Application for specialized 7.5% p.a. Farm loans with satellite proof.":
"3.7.22 Farm Loan Application: Farmers fill out a loan request form and upload land proof. The system uses satellite data to help verify the land before sending it to staff.",

"3.7.23 DFD Level 2 (3D Branch & ATM Locator): MapLibre GL powered 3D terrain rendering with real-time branch/ATM coordinate plotting and proximity search.":
"3.7.23 Branch & ATM Locator: The MapLibre 3D map loads city terrain and drops pins at every branch and ATM location stored in the database, with a proximity search feature.",

"3.7.24 DFD Level 2 (Crop Marketplace): Farmer crop listing, buyer browsing, price negotiation, escrow-based payment, and order fulfillment.":
"3.7.24 Crop Marketplace: Farmers post crop listings with price and quantity. Buyers browse and place orders. Payment goes into escrow and is released when the order is confirmed.",

# ER SYMBOLS
"Rectangle: Entity (e.g., Users, Transactions).":
"Rectangle box: Represents a data entity — a real-world object the system tracks, such as Users or Transactions.",

"Ellipse: Attribute (e.g., balance, name).":
"Oval shape: Shows an attribute — a piece of data belonging to an entity, like a user's name or account balance.",

"Diamond: Relationship (e.g., \"owns\", \"initiates\").":
"Diamond shape: Represents the relationship between two entities, for example a user 'owns' an account.",

"Lines: Connecting flows.":
"Lines: Connect entities, attributes, and relationships to show how they are linked.",

# APPLICABLE DOCUMENTS
"Smart Bank Software Requirement Specification (SRS) - Chapter 2":
"Smart Bank SRS document covering all functional and non-functional requirements — Chapter 2",

"System Flow and Context Diagrams - Chapter 3":
"Flow diagrams, DFDs, and sequence charts for the system — Chapter 3",

"Database Schema and Architecture - Chapter 4":
"Database table designs and schema relationships — Chapter 4",

# MODULE DESCRIPTIONS (Admin)
"Admins can log in using either their password or face scan to access the admin control panel.":
"The admin has two login options: entering a password the usual way, or using face recognition to get into the control panel.",

"The admin can add new staff members, remove existing ones, and assign them specific roles.":
"From this screen the admin creates new staff accounts, removes old ones, and sets what each staff member is allowed to do.",

"If a customer account shows suspicious activity, the admin can directly block or suspend it from here.":
"When a customer account looks suspicious, the admin can freeze or suspend it straight from this panel without involving anyone else.",

"This module shows the bank's total deposits, outstanding loans, and available funds in real time.":
"The general ledger screen gives the admin a live view of how much money is sitting in the bank, how much has been lent out, and what is currently available.",

"Admins use this section to add or remove branch and ATM locations on the 3D map, along with uploading photos of each location.":
"This is where the admin manages the 3D map — adding new branch pins, removing closed ones, and attaching photos to each location.",

"All important actions like login attempts, transaction changes, and setting modifications are logged here for review.":
"Every significant action in the system — failed logins, money changes, setting updates — leaves a record here that the admin can review any time.",

# MODULE DESCRIPTIONS (Staff)
"Staff members log in with tracked shift timings so the bank knows who was active and when.":
"When staff log in, the system records the exact time. This creates a shift log so the bank always knows who was working at any given moment.",

"This is where staff process new account applications, check KYC documents, and approve or reject requests.":
"The task desk is the staff member's main work area. New customer applications land here and staff go through each one — checking documents and either approving or rejecting them.",

"Staff can approve new card requests and link them to the right customer account.":
"When a customer applies for a debit or credit card, the request appears here. Staff review it and connect the approved card to the correct account.",

"This module lets staff review farm loan applications by checking the farmer's land documents and satellite health scores before approving or rejecting the loan.":
"Staff use this screen to go through pending farm loan applications. They review the farmer's land papers and the satellite score before deciding to approve or reject.",

"Staff can view and respond to customer support tickets, and send notifications for important updates.":
"This screen shows all open support tickets from customers. Staff can read the issue, type a reply, and send it back, or push a notification for urgent updates.",

# MODULE DESCRIPTIONS (Customer)
"New users sign up by filling in their details and registering their face for biometric login.":
"To create an account, a new user fills in their personal details, picks a password, and then registers their face so they can log in biometrically next time.",

"The main dashboard where customers see their balance (with a hide/show toggle), recent transactions, and spending charts.":
"The home screen shows the account balance — which can be hidden with the eye button — a list of recent transactions, and a chart showing spending patterns.",

"Customers can send money to other accounts via NEFT or UPI, and save frequent recipients as beneficiaries.":
"The transfer screen lets customers send money using NEFT or UPI. Regular recipients can be saved as beneficiaries to make future transfers quicker.",

"Users can view their cards, request upgrades, and quickly block a card if it gets lost or stolen.":
"The cards section shows all active cards. Users can upgrade to a better card type or instantly block a card if it is lost or stolen.",

"Pockets let users set aside money for specific goals like a vacation or new phone, with a progress bar showing how close they are.":
"A Pocket is like a mini savings jar inside the account. Users create one for a specific goal, add money to it over time, and a progress bar shows how close they are to reaching it.",

"Customers can open a 3D map to find the nearest Smart Bank branches and ATMs, with directions and distance shown.":
"The location finder opens a 3D city map showing every nearby branch and ATM. The distance is displayed and the user can get directions from their current position.",
}

def replace_para(para, new_text):
    if not para.runs:
        para.text = new_text
        return
    first = para.runs[0]
    for r in para.runs:
        r.text = ''
    first.text = new_text
    for r in para.runs[1:]:
        r._element.getparent().remove(r._element)

def run():
    doc = Document(INPUT)
    changed = 0
    for para in doc.paragraphs:
        t = para.text.strip()
        if t in R:
            replace_para(para, R[t])
            changed += 1
    doc.save(OUTPUT)
    print(f"Pass-2 done: {changed} paragraphs rewritten.")
    print(f"Saved: {OUTPUT}")

if __name__ == '__main__':
    run()
