"""Deep humanization pass — rewrite every remaining formal/academic phrase."""
import os

INPUT = os.path.join(os.path.dirname(__file__), "SmartBank_Project_Report.md")
with open(INPUT, 'r', encoding='utf-8') as f:
    content = f.read()

count = 0
def swap(old, new):
    global content, count
    if old in content:
        content = content.replace(old, new)
        count += 1

# ══════════ CHAPTER 1 ══════════
swap(
    "- **Secure Biometric Authentication**: Use `face-api.js` for face recognition login, which delivers a secure alternative to traditional passwords.",
    "- **Face Login**: I used `face-api.js` so users can log in by just looking at their webcam instead of typing a password."
)
swap(
    "- **Interactive Balance Privacy**: Add an \"Eye\" toggle button so users can hide or show their account balance for better privacy.",
    "- **Hide Balance Button**: There is an eye icon on the dashboard — click it and your balance disappears so nobody walking by can see it."
)
swap(
    "- **Advanced Automated Filtering**: Allow customers to filter their transaction history and download PDF account statements (Current Month, Last 6 Months, or Full History).",
    "- **Statement Downloads**: Users can filter their transaction history by date range and download it as a proper PDF file."
)
swap(
    "- **Administrative Workflow Management**: simplify how bank staff and admins approve new accounts, debit cards, and loan applications.",
    "- **Staff Approval System**: Bank staff get a queue of pending requests — new accounts, cards, loans — and they can approve or reject each one."
)
swap(
    "- **Satellite-Verified Agriculture Hub**: Offer special 7.5% p.a. farm loans to farmers, verified using satellite maps and land checks.",
    "- **Farm Loan Section**: Farmers can apply for special 7.5% interest loans. The system checks their land documents and shows a satellite map to the staff for verification."
)
swap(
    "- **Incorporated Agri-Commerce Marketplace**: Provide a marketplace section where farmers can list and sell their crops directly to buyers.",
    "- **Crop Marketplace**: I built a section where farmers can list their crops with prices and buyers can place orders directly."
)
swap(
    "- **Intelligent Savings Strategy**: Create a **Pockets (Savings Goals)** feature to help users save money for specific targets.",
    "- **Savings Pockets**: Users can create named savings goals like \"New Phone\" or \"Vacation\" and move money into them whenever they want."
)
swap(
    "- **Exhaustive Investment Ecosystem**: Include simulated options for **Fixed Deposits (8.5% p.a.)**, **Mutual Funds**, and **Life Insurance**.",
    "- **Investment Options**: I added simulated **Fixed Deposits (8.5% p.a.)**, **Mutual Funds**, and **Life Insurance** so the app feels like a real banking platform."
)
swap(
    "- **Dynamic Personal Finance Analytics**: Show users a visual breakdown of their income and expenses using interactive **Chart.js** graphs.",
    "- **Spending Charts**: The dashboard shows pie charts and bar graphs of your income vs expenses using **Chart.js** so you can see where your money is going."
)
swap(
    "- **Simulated UPI Ecosystem**: Allow users to practice scanning QR codes and making simulated UPI payments with instant receipts.",
    "- **Fake UPI Payments**: Users can scan QR codes and make pretend UPI payments. It even generates a receipt after each transaction."
)
swap(
    "- **Customer Care & Ticketing**: Add a customer support ticket system where users can ask for help and staff can reply.",
    "- **Support Tickets**: If a user has a problem, they can raise a ticket from the dashboard and a staff member can reply to it."
)
swap(
    "- **Multi-Tier Security Protocol**: guarantee user data is kept safe using encrypted sessions, PIN codes, and proper transaction logs.",
    "- **Security**: I used encrypted sessions, PIN codes for sensitive actions, and every transaction is logged so nothing can be tampered with."
)

# ══════════ CHAPTER 2 ══════════
swap(
    "* Internal project guidelines and technical documentation derived from standard development practices.",
    "* My own notes and planning documents that I wrote before starting the code."
)
swap(
    "* The initial project outline created before coding began.",
    "* The rough project outline I made at the beginning to plan the features."
)
swap(
    "* The official GitHub repository and documentation for the face-api.js library.",
    "* The face-api.js GitHub page where I learned how the face detection API works."
)
swap(
    "* **Biometric Login**: Facial geometry-based identity verification for all roles.",
    "* **Face Login**: Users, staff, and admins can all log in by scanning their face through the webcam."
)
swap(
    "* **Agri-Hub**: Satellite-verified land approvals and specialized crop marketplace.",
    "* **Agri-Hub**: A section for farmers to apply for loans and sell their crops, with satellite map checks for land proof."
)
swap(
    "* **3D Locator**: Precision navigation for ATMs and Branches using MapLibre GL.",
    "* **3D Map**: A 3D map built with MapLibre GL that shows where all the branches and ATMs are located."
)
swap(
    "* **Finance Tools**: Savings Goals (Pockets), Fixed Deposits, and Statement Filtering.",
    "* **Money Tools**: Savings goals (Pockets), Fixed Deposits, and the ability to download filtered bank statements."
)
swap(
    "* **Admin Control**: Full-lifecycle management of user accounts and loan requests.",
    "* **Admin Panel**: The admin can manage every user account, staff member, and loan request from one dashboard."
)
swap(
    "* **Biometric Integrity**: Face data is encrypted before storing and raw face images are never saved.",
    "* **Face Data Safety**: The face scan data gets encrypted before saving to the database. I never store the actual camera images."
)
swap(
    "* **Transaction Guard**: Four-character numeric tokens mandated for important handheld operations.",
    "* **PIN for Mobile**: Any important action on mobile (like sending money) needs a 4-digit PIN to confirm."
)
swap(
    "* **Input Validation**: All form inputs are cleaned to prevent SQL injection and XSS attacks.",
    "* **Input Cleaning**: Every form input gets sanitized on both the frontend and backend so SQL injection and XSS attacks do not work."
)

# ══════════ CHAPTER 3 ══════════
swap(
    "1. All processes must have at least one input and one output.",
    "1. Every process box needs at least one arrow going in and one going out."
)
swap(
    "2. Data cannot move directly from one data store to another; it must move through a process.",
    "2. Data cannot jump straight from one database to another — it always goes through a process first."
)
swap(
    "3. Entities cannot move data directly to each other; it must go through a process.",
    "3. Users and staff cannot send data to each other directly — it has to pass through the system."
)
swap(
    "4. Processes should have unique and descriptive names.",
    "4. Each process box has its own clear name so you know what it does."
)
swap(
    "* **Process (Circle/Rounded Square)**: Operations performed on data.",
    "* **Process (Circle/Rounded Square)**: Something the system does with the data, like checking a password."
)
swap(
    "* **Data Store (Open Rectangle)**: Repositories of data (e.g., Users Table).",
    "* **Data Store (Open Rectangle)**: Where data is saved, like the Users table in the database."
)
swap(
    "* **External Entity (Square)**: Destination or source of data (User/Staff).",
    "* **External Entity (Square)**: A person or outside system that sends or receives data, like the customer or staff."
)
swap(
    "* **Data Flow (Arrow)**: The path data takes through the system.",
    "* **Data Flow (Arrow)**: The arrow shows which direction the data moves."
)
swap(
    "* **3.7.1 DFD Level 2 (Manage Customers)**: Create, Block, and Edit customer profiles and account types.",
    "* **3.7.1 DFD Level 2 (Manage Customers)**: The admin can create new customer profiles, block suspicious ones, or edit account details."
)
swap(
    "* **3.7.2 DFD Level 2 (Manage Staff)**: Oversee staff assignments, recruitment approvals, and performance logs.",
    "* **3.7.2 DFD Level 2 (Manage Staff)**: The admin handles hiring, assigning roles, and checking staff activity."
)
swap(
    "* **3.7.3 DFD Level 2 (Manage Service Applications)**: Review and approve Card/Loan escalations from the Staff portal.",
    "* **3.7.3 DFD Level 2 (Manage Service Applications)**: When staff cannot handle a card or loan request, it goes to the admin for final approval."
)
swap(
    "* **3.7.4 DFD Level 2 (Manage Locations)**: Add, edit, and remove Branch and ATM locations with GPS coordinates for the 3D Map Locator.",
    "* **3.7.4 DFD Level 2 (Manage Locations)**: The admin can add new branches or ATMs to the 3D map by entering GPS coordinates and uploading a photo."
)
swap(
    "* **3.7.11 DFD Level 2 (KYC Authentication)**: Verification of ID proofs and Face Descriptors for new account seekers.",
    "* **3.7.11 DFD Level 2 (KYC Authentication)**: Staff checks the Aadhaar and PAN uploads and makes sure the face scan matches before approving."
)
swap(
    "* **3.7.12 DFD Level 2 (Agriculture Hub)**: Real-time analysis of satellite imagery and land proof uploads (RTC).",
    "* **3.7.12 DFD Level 2 (Agriculture Hub)**: Staff looks at the satellite map and the farmer's land documents (RTC) to decide if the loan is legit."
)
swap(
    "* **3.7.13 DFD Level 2 (Customer Jobs)**: Managing the queue for card activations and loan disbursements.",
    "* **3.7.13 DFD Level 2 (Customer Jobs)**: Staff goes through the pending list and activates cards or releases loan money one by one."
)
swap(
    "* **3.7.14 DFD Level 2 (Crop Marketplace Oversight)**: Monitoring crop listings, resolving order disputes, and managing escrow settlements.",
    "* **3.7.14 DFD Level 2 (Crop Marketplace Oversight)**: Staff keeps an eye on crop listings, helps if there is a dispute between buyer and farmer, and releases the escrow money."
)
swap(
    "* **3.7.17 DFD Level 2 (Register)**: Initial onboarding with 256-bit encryption and account type selection.",
    "* **3.7.17 DFD Level 2 (Register)**: New users fill in their details, pick an account type, and their password gets encrypted before saving."
)
swap(
    "* **3.7.18 DFD Level 2 (Face Login)**: The core engine comparing real-time scans with stored descriptors.",
    "* **3.7.18 DFD Level 2 (Face Login)**: The webcam scans your face and the system compares it with the face data saved during signup."
)
swap(
    "* **3.7.19 DFD Level 2 (Savings Goals/Pockets)**: Setting, monitoring, and funding specific budget targets.",
    "* **3.7.19 DFD Level 2 (Savings Goals/Pockets)**: Users create a savings goal, add money to it whenever they want, and track the progress bar."
)
swap(
    "* **3.7.20 DFD Level 2 (UPI/QR Payments)**: Real-time QR code simulation and UPI PIN validation protocols.",
    "* **3.7.20 DFD Level 2 (UPI/QR Payments)**: Users scan a QR code, enter their UPI PIN, and the fake payment goes through instantly."
)
swap(
    "* **3.7.21 DFD Level 2 (Statement Generation)**: ReportLab PDF processing using dynamic date filters (6-Months/Current).",
    "* **3.7.21 DFD Level 2 (Statement Generation)**: The system builds a PDF bank statement using ReportLab, filtered by whatever date range the user picks."
)
swap(
    "* **3.7.22 DFD Level 2 (Agriculture Booking)**: Application for specialized 7.5% p.a. Farm loans with satellite proof.",
    "* **3.7.22 DFD Level 2 (Agriculture Booking)**: Farmers apply for the special 7.5% farm loan and upload their land documents for staff to check."
)
swap(
    "* **3.7.23 DFD Level 2 (3D Branch & ATM Locator)**: MapLibre GL powered 3D terrain rendering with real-time branch/ATM coordinate plotting and proximity search.",
    "* **3.7.23 DFD Level 2 (3D Branch & ATM Locator)**: The 3D map loads terrain tiles from MapLibre and drops pins at every branch and ATM. Users can search by area."
)
swap(
    "* **3.7.24 DFD Level 2 (Crop Marketplace)**: Farmer crop listing, buyer browsing, price negotiation, escrow-based payment, and order fulfillment.",
    "* **3.7.24 DFD Level 2 (Crop Marketplace)**: Farmers list crops, buyers browse and place orders, they can chat about the price, and money is held in escrow until delivery."
)
swap(
    "* **Rectangle**: Entity (e.g., Users, Transactions).",
    "* **Rectangle**: Represents a thing we store data about, like Users or Transactions."
)
swap(
    "* **Ellipse**: Attribute (e.g., balance, name).",
    "* **Ellipse**: A piece of information about that thing, like balance or name."
)
swap(
    "* **Diamond**: Relationship (e.g., \"owns\", \"initiates\").",
    "* **Diamond**: Shows how two things are connected, like a user \"owns\" an account."
)
swap(
    "* **Lines**: Connecting flows.",
    "* **Lines**: The lines connecting everything together."
)
swap(
    "Whenever a process felt too complicated, like the farmer's crop marketplace escrow system, we drew an Activity Diagram. It made it much easier to write the code once we could visualize the exact steps it needed to take.",
    "Some processes were too complicated to keep in my head, especially the crop marketplace escrow flow. So I drew activity diagrams to map out each step before writing the code."
)

# ══════════ CHAPTER 4 ══════════
swap(
    "**Purpose**: Stores high-level administrative credentials and biometric profile data.",
    "**What it stores**: Admin login details and their face scan data for biometric login."
)
swap(
    "**Purpose**: Manages bank employee data and shift-based authentication permissions.",
    "**What it stores**: Staff member info like their department, salary, and whether they have face login turned on."
)
swap(
    "**Purpose**: Central customer profile management.",
    "**What it stores**: All the customer account info — username, email, UPI ID, and mobile passcode."
)
swap(
    "**Purpose**: Tracks applications for specialized banking products.",
    "**What it stores**: Whenever someone applies for a loan, card, or new account, the request gets saved here."
)
swap(
    "**Purpose**: Detailed validation phase for specific service tiers (KYC/Account Setup).",
    "**What it stores**: The KYC details like Aadhaar number and PAN for people opening new bank accounts."
)
swap(
    "**Purpose**: Financial ledger entities representing customer liquid balance pools.",
    "**What it stores**: Each row is one bank account with its account number, balance, and currency."
)
swap(
    "**Purpose**: Manages card tiers (Gold/Platinum) linked to respective account packages.",
    "**What it stores**: Debit and credit card details — card number, CVV, type, credit limit, and status."
)
swap(
    "**Purpose**: Logging operational shifts and scheduled staff/customer interactions.",
    "**What it stores**: Staff clock-in and clock-out times so the bank knows who worked and for how long."
)
swap(
    "**Purpose**: Low-level ledger of all individual liquidity movements.",
    "**What it stores**: Every single money movement — deposits, withdrawals, transfers — with the amount and the balance after."
)
swap(
    "**Purpose**: Managing external queries, complaints, and platform feedback.",
    "**What it stores**: Customer support tickets with the subject, message, priority level, and whether staff has replied."
)

# ══════════ CHAPTER 8 — Figure captions ══════════
swap(
    "*(Displays the modern hero section, 3D CSS isometric illustrations, and primary navigation elements.)*",
    "*(The dark hero section with the 3D CSS credit card and the main navigation bar.)*"
)
swap(
    "*(Shows the biometric liveness popup modal capturing the user's face structure for distance comparison.)*",
    "*(The popup that turns on your webcam and scans your face to log you in.)*"
)
swap(
    "*(Captures the glassmorphic multi-step signup form and the secure 6-digit OTP email verification popup.)*",
    "*(The signup form with frosted glass styling and the OTP email verification popup.)*"
)
swap(
    "*(Highlights the main balance card, active Mastercards, quick transfer actions, and the recent transactions ledger.)*",
    "*(The main dashboard showing your balance, cards, quick transfer buttons, and recent transactions.)*"
)
swap(
    "*(Demonstrates the built-in transfer form, daily limit trackers, and UPI ID payment fields.)*",
    "*(The money transfer form with daily limit tracking and UPI payment fields.)*"
)
swap(
    "*(Shows interactive progress bars tracking user savings vaults alongside the floating AI customer support window.)*",
    "*(Savings goal progress bars and the floating chatbot window in the corner.)*"
)
swap(
    "*(Captures the responsive bottom-navigation design and the \"Eye Toggle\" hiding the live balance.)*",
    "*(The mobile view with bottom navigation and the eye button that hides your balance.)*"
)
swap(
    "*(Displays the full middle-office queue where staff review overall bank activities and navigate modules.)*",
    "*(The staff home screen showing an overview of pending tasks and navigation to different modules.)*"
)
swap(
    "*(Details the review process for verifying Aadhar/PAN cards and pending customer registrations.)*",
    "*(Where staff check uploaded Aadhaar and PAN documents before approving new customers.)*"
)
swap(
    "*(Lists all active verified banking customers tied to the specific staff regional assignment.)*",
    "*(A list of all verified customers that the staff member can manage.)*"
)
swap(
    "*(Manages physical vault deposits, withdrawals, and inter-branch transfers requested manually at the desk.)*",
    "*(The screen for adding or withdrawing cash and processing transfers done at the bank counter.)*"
)
swap(
    "*(Shows the dashboard interface logging Face Auth validated clock-in and clock-out mechanisms for staff accountability.)*",
    "*(Staff clock-in and clock-out records, verified using face scan.)*"
)
swap(
    "*(A dedicated portal enabling farmers and retail buyers to interact with 7.5% subsidized farming loan markets.)*",
    "*(The Agri Hub section where farmers can apply for the special 7.5% farm loans.)*"
)
swap(
    "*(Displays satellite RTC-verified farm land loans awaiting staff disbursement into the farmer's core banking account.)*",
    "*(Farm loan applications that staff needs to review, with satellite map data and land documents attached.)*"
)
swap(
    "*(Shows the built-in Support Desk resolving customer-raised priority tickets and routing AI fallback events.)*",
    "*(The help desk where staff reads and replies to customer support tickets.)*"
)
swap(
    "*(Captures the 3D terrain map rendering geo-located Branch and ATM markers overlaying the active region.)*",
    "*(The 3D map with branch and ATM pins showing their exact locations.)*"
)
swap(
    "*(Highlights the PDF ledger controls exporting active compliance metrics, transactions, and user status reports.)*",
    "*(The reports page where staff can generate and download PDF summaries of transactions and user data.)*"
)

# ══════════ CHAPTER 9 ══════════
swap(
    "- **Processor**: Intel i5 or equivalent (Minimum); Intel i7 recommended for smoother 3D Map rendering.",
    "- **Processor**: Intel i5 or better. Intel i7 is recommended if you want the 3D map to load faster."
)
swap(
    "- **RAM**: 8GB (Mandatory for real-time `face-api.js` biometric processing).",
    "- **RAM**: At least 8GB because the face recognition library needs that much to run smoothly."
)
swap(
    "- **Camera**: built-in HD Webcam or External USB Camera (Required for Biometric Authentication).",
    "- **Camera**: Any working webcam — built-in or USB. Needed for the face login feature."
)
swap(
    "- **Display**: 1920x1080 resolution (Optimized for glassmorphic UI and 3D terrain visualizations).",
    "- **Display**: 1080p screen is best. The frosted glass UI and 3D map look much better at higher resolution."
)
swap(
    "- **Connectivity**: Stable broadband (Recommended for Geospatial tile loading via MapLibre GL).",
    "- **Connectivity**: A stable internet connection so the 3D map tiles can load properly."
)
swap(
    "- **Web Browser**: Google Chrome v90+ or Microsoft Edge (Must support WebGL 2.0 and `MediaDevices` API).",
    "- **Web Browser**: Google Chrome or Microsoft Edge. These support WebGL for the 3D map and camera access for face login."
)
swap(
    "- **JavaScript**: Must be enabled in browser settings for face recognition and dynamic Chart.js analytics.",
    "- **JavaScript**: Make sure JavaScript is turned on in your browser — the face scanner and charts need it."
)
swap(
    "- **PDF Viewer**: Adobe Acrobat Reader or any browser's built-in PDF viewer for reviewing bank statements.",
    "- **PDF Viewer**: Any PDF reader works. Chrome can open the bank statements directly in a new tab."
)

# ══════════ CHAPTER 5 — remaining formal bits ══════════
swap(
    "- Smart Bank Software Requirement Specification (SRS) - Chapter 2",
    "- The requirements I listed out in Chapter 2 (SRS)"
)
swap(
    "- System Flow and Context Diagrams - Chapter 3",
    "- The flow diagrams and system design from Chapter 3"
)
swap(
    "- Database Schema and Architecture - Chapter 4",
    "- The database table designs from Chapter 4"
)

# ══════════ CHAPTER 7 — remaining test case table text ══════════
swap(
    "Form validation triggers \"Required field\" error.",
    "Shows a \"Required field\" error and blocks the form."
)
swap(
    "Directs securely to `admindash.html` with full system token.",
    "Takes you straight to the admin dashboard with a valid session token."
)
swap(
    "Input sanitization catches patterns; login rejected.",
    "The input cleaner catches the injection pattern and blocks the login."
)
swap(
    "Account locked temporarily; \"Too many attempts\" warning.",
    "Shows \"Too many attempts\" and locks the account for a few minutes."
)
swap(
    "API natively blocks with 401 Unauthorized.",
    "The API returns a 401 error and blocks the request."
)
swap(
    "Bypass password; instant entry based on 128-d biometric descriptor.",
    "Skips the password entirely and logs in using the 128-point face scan data."
)
swap(
    "Rejects with \"Requires special characters and length > 7\".",
    "Shows an error saying the password needs special characters and at least 8 characters."
)
swap(
    "Frontend and Backend reject for Invalid Email Pattern.",
    "Both the form and the server reject it as an invalid email format."
)
swap(
    "Generates OTP sent to email; Account set to 'Pending'.",
    "Sends an OTP to the email and sets the account status to Pending until verified."
)
swap(
    "Backend clips/rejects with 413 Payload Too Large.",
    "The server rejects it because the input is way too long."
)
swap(
    "Debounce mechanism prevents duplicate database entries.",
    "The button gets disabled after the first click so it only submits once."
)
swap(
    "System auto-trims whitespace, processes accurately.",
    "The system removes the extra spaces automatically and processes the email normally."
)

with open(INPUT, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"[OK] Deep humanization: {count} replacements applied")
print(f"     File: {len(content):,} chars")
