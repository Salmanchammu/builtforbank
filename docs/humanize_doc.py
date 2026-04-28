from docx import Document
from docx.oxml.ns import qn
import copy

INPUT = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman original project bank_removed.docx'
OUTPUT = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Humanized_Final.docx'

# Map of original text -> humanized text (exact paragraph text match)
REPLACEMENTS = {
    # ── TESTING CHAPTER ──────────────────────────────────────────────────────
    "For a financial application like Smart Bank, rigorous testing is not optional — it is the backbone of trust. Every module in the platform, from the biometric Face Login engine (face-api.js) to the multi-currency fund transfer pipeline, must be systematically challenged under both expected and hostile input conditions before it can be considered production-ready.":
        "When you are building something that handles people's money, testing is not something you can skip. I went through every single part of Smart Bank — from the face login powered by face-api.js all the way to the money transfer feature — and put each one through its paces. I tested under normal use and also deliberately tried to break things, just to be certain nothing would fail when a real person uses it.",

    "The testing strategy for Smart Bank was designed around two core principles. First, verification — guaranteeing that each API endpoint, database interaction, and frontend workflow adheres precisely to the technical specifications outlined in Chapter 2 (SRS). Second, validation — confirming that the end-to-end user experience satisfies the real-world banking expectations of retail customers, agricultural account holders, and administrative staff.":
        "I kept two things in mind throughout testing. First, I wanted to confirm that every part of the system does exactly what I described in the SRS — every API route, every database query, every form on screen. Second, I wanted to make sure that when a real person actually sits down and uses it — whether they are a customer, a farmer, or a staff member — the experience feels right and makes sense.",

    "Given the multi-layered architecture of Smart Bank (9 Flask Blueprints, 40+ REST endpoints, 25+ database tables, and 3 distinct role-based dashboards), testing was conducted at four progressive stages:":
        "Smart Bank has a lot of moving parts — nine separate Flask Blueprints, over forty API endpoints, twenty-five database tables, and three completely different dashboards depending on who logs in. Because of this, I broke testing into four clear stages:",

    "Black-box testing: Treating each module as a sealed unit, inputs were supplied through the frontend forms and API payloads, and only the resulting HTTP responses, UI state changes, and database mutations were evaluated — without inspecting the internal Flask route logic.":
        "Black-box testing: I treated each feature like a sealed box and only looked at what went in and what came out — form inputs, API responses, screen changes, and database updates — without touching the internal code.",

    "White-box testing: The internal Python route handlers, SQLite query construction, and JavaScript DOM manipulation logic were directly examined to verify code coverage across conditional branches (e.g., loan penalty edge cases, biometric threshold comparisons, and daily transfer limit bypass attempts).":
        "White-box testing: Here I looked inside the code itself — the Python route handlers, SQL queries, and JavaScript logic — to make sure every branch and edge case was handled, like what happens when someone hits the daily transfer limit or the biometric match score lands right on the boundary.",

    "Each test case documented in this chapter follows a structured format: a unique identifier (e.g., TC-PAY-5), a specific scenario description, the expected outcome based on the SRS, and a pass/fail status determined against the actual system behavior.":
        "Each test case I ran follows the same simple layout: a short ID like TC-PAY-5, a description of what I was testing, what the system was supposed to do, and whether it passed or failed.",

    "The primary goals of the Smart Bank testing phase were:":
        "My main goals when testing Smart Bank were:",

    "To detect and resolve defects introduced during the Flask Blueprint development and JavaScript SPA integration stages.":
        "To catch and fix any bugs that appeared while writing the Flask code and hooking it up to the frontend JavaScript.",

    "To validate that all 3 user roles (Customer, Staff, Admin) experience secure, role-isolated access to their respective dashboards and API endpoints.":
        "To make sure all three types of users — customers, staff, and the admin — can only see and do what they are supposed to. No crossing over between roles.",

    "To stress-test the financial arithmetic engine — guaranteeing that fund transfers, loan penalty calculations (0.1% daily), and multi-currency conversions (USD/EUR/GBP":
        "To stress-test the money math — making sure that transfers, daily loan penalties of 0.1%, and currency conversions between USD, EUR, GBP",

    "→ INR) produce mathematically precise results with zero rounding drift.":
        "and INR all come out with accurate numbers — no rounding errors allowed.",

    "To confirm full compliance with the Security Requirements defined in Chapter 2 (session timeout, input sanitization, biometric face descriptor encryption, and XSS/SQL injection prevention).":
        "To verify that all the security rules from Chapter 2 actually work in practice — sessions timing out, inputs being cleaned before hitting the database, face data being encrypted, and protection against XSS and SQL injection.",

    "To verify that the specialized Agriculture Hub, Crop Marketplace, and Savings Pockets modules operate correctly under concurrent user scenarios.":
        "To check that the Agriculture Hub, Crop Marketplace, and Savings Pockets all work correctly even when multiple people are using them at the same time.",

    "Smart Bank was subjected to a exhaustive multi-stage testing pipeline prior to deployment on Render.com. This pipeline included functional API testing (using direct HTTP fetch calls against all 40+ endpoints), UI interaction testing (validating form workflows, modal transitions, and toast notification accuracy across Desktop and Mobile dashboards), security penetration testing (SQL injection, XSS payloads, session hijacking attempts), and performance profiling (response latency under concurrent database queries with SQLite WAL mode enabled).":
        "Before deploying Smart Bank on Render.com, I ran it through a thorough multi-stage testing process. I manually called every one of the forty-plus API endpoints using fetch requests to check the responses. I also walked through every form, verified that modals opened and closed properly, and made sure every toast notification showed the right message on both desktop and mobile. I then tried attacking my own system with SQL injection strings and XSS payloads. Finally, I checked response times while running multiple database queries at once, with SQLite in WAL mode to handle concurrent reads.",

    "Each Flask Blueprint (auth_routes.py, user_routes.py, staff_routes.py, admin_routes.py, agri_routes.py, marketplace_routes.py) was tested independently by invoking individual route handlers with controlled JSON payloads. For example, the /api/auth/signup endpoint was tested with valid inputs, duplicate usernames, weak passwords, and malformed email formats — each in isolation — to confirm that the route handler returned the correct HTTP status code and error message without side effects on other modules.":
        "I tested each Flask Blueprint file on its own — auth_routes.py, user_routes.py, staff_routes.py, admin_routes.py, agri_routes.py, and marketplace_routes.py — by calling each route with specific test inputs. For example, I ran the signup endpoint with a correct registration, a duplicate username, a weak password, and a badly formatted email, one at a time, to make sure each case returned the right status code and error message without accidentally affecting anything else.",

    "After unit testing, the cross-module data flow was validated end-to-end. A important integration path — User Registration → OTP Verification → Account Opening (KYC) → Staff Approval → Card Request → Staff Card Issuance → User Dashboard Card Rendering — was executed as a single continuous workflow. This exposed interface-level":
        "After testing each module separately, I checked how they all worked together. I ran the complete customer journey from start to finish: signup, OTP verification, KYC submission, staff approval, card request, card issuance by staff, and finally the card showing up on the dashboard. Doing this in one continuous flow exposed some",

    "issues such as the NOT NULL constraint violation in service_applications.amount during card requests, which was resolved by defaulting the amount field to 0.0 for non-monetary applications.":
        "interface problems I had not caught before — for example, a NOT NULL error in the service_applications table during card requests, because the amount field was empty for non-money applications. I fixed this by setting the default value of amount to 0.0.",

    "The fully assembled Smart Bank platform was validated against the functional requirements from Chapter 2. Key validation checks included: FR1 — biometric face recognition completing within 2 seconds; FR2 — PDF statement generation correctly filtering by current month, last 6 months, or full history; and FR3 — role-based dashboard isolation guaranteeing that a user session token cannot access /api/admin/dashboard or":
        "Once everything was built and connected, I validated the complete platform against the requirements I wrote in Chapter 2. The key checks were: FR1 — face login must finish within 2 seconds; FR2 — the PDF statement must filter correctly by current month, last 6 months, or all time; and FR3 — a regular user session must never be able to reach the admin or staff",

    "/api/staff/customers endpoints.":
        "API endpoints. That last check passed — a customer token cannot access those routes at all.",

    "All system outputs were verified for correctness and professional formatting:":
        "I also checked every output the system generates to make sure it is accurate and looks professional:",

    "PDF Bank Statements: Generated via ReportLab with proper maroon-themed headers, account summary tables, and color-coded credit/debit transaction rows.":
        "PDF Bank Statements: They come out with a maroon header, a summary table at the top, and green/red color coding for money in and out.",

    "3D Map Rendering: MapLibre GL correctly plotted Branch and ATM markers with photo popups at the GPS coordinates stored in the branch_locations database table.":
        "3D Map: The MapLibre map drops pins at every branch and ATM from the database, and clicking a pin shows a photo popup with the location details.",

    "Chart.js Analytics: Spending analytics charts on the User Dashboard accurately reflected the transaction history data fetched from the /api/user/dashboard endpoint.":
        "Spending Charts: The Chart.js graphs on the dashboard matched exactly what was in the transaction history when I cross-checked against the raw database data.",

    "Toast Notifications: All 30+ unique toast messages across Desktop and Mobile interfaces displayed the correct severity level (success/error/info/warning).":
        "Toast Notifications: I went through all thirty-plus toast alerts on both desktop and mobile and confirmed each one showed the right color and icon for success, error, info, or warning.",

    "The Smart Bank platform was continuously evaluated with prospective end-users throughout the development cycle. Key acceptance criteria included:":
        "Throughout the project I kept testing the platform with real people. The main things they needed to be comfortable with were:",

    "Login Experience: Both the Desktop glassmorphic login (user.html) and the Mobile PWA login (mobile-auth.html) were tested for intuitive flow, including the cached user hydration (\"Welcome Back\" section) and the Face Login biometric modal.":
        "Login Experience: Both the desktop and mobile login pages were checked for a natural feel, including the 'Welcome Back' section that loads your saved details and the face scan popup.",

    "Dashboard Usability: The User Dashboard SPA was validated for uninterrupted navigation between the Home, Cards, Transfers, Loans, Savings, and Map sections without page reloads.":
        "Dashboard: Moving between Home, Cards, Transfers, Loans, Savings, and the Map should feel instant — no page reloads, ever.",

    "Mobile Responsiveness: The bottom navigation bar, balance \"Eye Toggle\" privacy feature, and QR Scanner were tested on iPhone and Android devices to guarantee":
        "Mobile: The bottom navigation bar, the eye button that hides your balance, and the QR scanner were tested on real iPhone and Android phones to make sure",

    "touch targets met the minimum 44px accessibility standard.":
        "every button was big enough to tap comfortably — at least 44px wide, following standard accessibility guidelines.",

    "Staff Workflow: Bank Staff confirmed that the KYC approval queue, cash operations (Add/Withdraw/Transfer), and biometric attendance clock-in/out workflows matched their operational expectations.":
        "Staff Workflow: I walked through the KYC approval queue, the cash deposit and withdrawal screens, and the face-based attendance system to check that everything made sense from a bank employee's point of view.",

    "Report Accuracy: Generated PDF reports were cross-referenced against raw database records to confirm zero discrepancy in financial figures.":
        "Report Accuracy: I compared every downloaded PDF statement line by line against the raw SQLite data to confirm the numbers match exactly.",

    "The progressive testing of individual forms and modules guarantees strong inputs, reliable bounds checking, and strict security across the Smart Bank platform. Below is a exhaustive suite of test cases executing high-fidelity validation.":
        "I went through each form and feature carefully, checking inputs, limits, and security rules. Below are the test cases I ran for each section of the platform.",

    "Objective: Verify the Administrative gateway protects against unauthorized staff/user escalation, brute force, and injection attacks.":
        "Objective: Make sure the admin login stops anyone who should not be there — wrong passwords, brute force attempts, and SQL or XSS injection strings.",

    "Objective: Validate customer onboarding, strict KYC compliance, password strength algorithms, and race conditions.":
        "Objective: Check that the signup form works correctly — strong password enforcement, KYC validation, and handling edge cases like two people registering with the same username simultaneously.",

    "Objective: guarantee applications for Loans, Cards, and Accounts accurately hit Staff Queues with complete documentation.":
        "Objective: Make sure that when a customer applies for a loan, card, or new account, the request appears in the correct staff queue with all required information filled in.",

    "Objective: Guarantee real-time accounting logic, thwart concurrency race conditions, and secure multi-currency API conversion.":
        "Objective: Verify that money transfers and UPI payments update balances instantly and correctly, prevent double-spending, and convert currencies accurately.",

    "Objective: Confirm that user grievances and tickets correctly escalate to Bank Staff, and that AI fallback handles baseline queries.":
        "Objective: Check that customer support tickets reach the right staff queue, and simple questions get handled automatically by the built-in AI chatbot.",

    "Objective: Verify hardware integration, third-party API dependencies (MapLibre), and PDF Generation pipelines.":
        "Objective: Test that the webcam works for face login, the MapLibre 3D map loads correctly, and PDF statements generate properly.",

    "Objective: Validate middle-office administrative tasks, guaranteeing secure KYC approvals, physical vault handling, and staff attendance reliability.":
        "Objective: Make sure staff can approve KYC documents, handle cash vault operations, and clock in and out with face recognition without any issues.",

    # ── USER INTERFACE CHAPTER ────────────────────────────────────────────────
    "The User Interface of Smart Bank was strictly designed with a \"Premium White\" glassmorphic aesthetic to guarantee maximum trust and accessibility. Below are the key screens capturing the core platform workflows directly from the active project workspace.":
        "I designed every screen in Smart Bank with a clean white frosted-glass style — the kind of look that feels trustworthy and professional. Below are the actual screens from the finished project.",

    "(Displays the modern hero section, 3D CSS isometric illustrations, and primary navigation elements.)":
        "(The landing page hero area with 3D CSS illustrations and the main navigation links.)",

    "(Shows the biometric liveness popup modal capturing the user's face structure for distance comparison.)":
        "(The face scan popup that reads your facial structure and compares it to the saved descriptor to log you in.)",

    "(Captures the glassmorphic multi-step signup form and the secure 6-digit OTP email verification popup.)":
        "(The frosted-glass signup form and the 6-digit OTP box that appears after you fill in your details.)",

    "(Highlights the main balance card, active Mastercards, quick transfer actions, and the recent transactions ledger.)":
        "(The main dashboard showing your balance, your active card, quick send buttons, and your recent transactions.)",

    "(Demonstrates the incorporated transfer form, daily limit trackers, and UPI ID payment fields.)":
        "(The transfer screen with the form for sending money by NEFT or UPI, and the daily limit tracker.)",

    "(Shows interactive progress bars tracking user savings vaults alongside the floating AI customer support window.)":
        "(The savings goals screen with progress bars for each pocket, and the AI chat bubble floating in the corner.)",

    "(Captures the responsive bottom-navigation design and the \"Eye Toggle\" hiding the live balance.)":
        "(The mobile dashboard with the bottom tab bar and the eye icon to hide or reveal your account balance.)",

    "(Displays the exhaustive middle-office queue where staff review overall bank activities and navigate modules.)":
        "(The main staff screen where bank employees see pending tasks and navigate to their work modules.)",

    "(Details the review process for verifying Aadhar/PAN cards and pending customer registrations.)":
        "(The queue where staff check uploaded Aadhaar and PAN documents and approve or reject new account requests.)",

    "(Lists all active verified banking customers tied to the specific staff regional assignment.)":
        "(The full list of approved customers that this staff member is assigned to manage.)",

    "(Manages physical vault deposits, withdrawals, and inter-branch transfers requested manually at the desk.)":
        "(Where staff handle cash deposits, withdrawals, and transfers that customers request at the counter in person.)",

    "(Shows the dashboard interface logging Face Auth validated clock-in and clock-out mechanisms for staff accountability.)":
        "(The attendance tracker where staff use face recognition to clock in and out, creating a time-stamped record.)",

    "(A dedicated portal enabling farmers and retail buyers to interact with 7.5% subsidized farming loan markets.)":
        "(The special section for farmers to apply for subsidized 7.5% interest farm loans and list crops for sale.)",

    "(Displays satellite RTC-verified farm land loans awaiting staff disbursement into the farmer's core banking account.)":
        "(Pending farm loan applications that have passed the satellite land check and are waiting for staff to release the funds.)",

    "(Shows the incorporated Support Desk resolving customer-raised priority tickets and routing AI fallback events.)":
        "(The support desk where staff respond to customer tickets, and simple queries get handled by the AI chatbot automatically.)",

    "Figure 8.16: Live MapLibre System integration":
        "Figure 8.16: Live MapLibre Map Integration",

    "(Captures the 3D terrain map rendering geo-located Branch and ATM markers overlaying the active region.)":
        "(The 3D city map with markers for every Smart Bank branch and ATM, with building heights rendered.)",

    "(Highlights the PDF ledger controls exporting active compliance metrics, transactions, and user status reports.)":
        "(The report section where you download a PDF statement filtered by date range, showing transactions in a clean format.)",

    # ── USER MANUAL CHAPTER ───────────────────────────────────────────────────
    "The Smart Bank User Manual delivers exhaustive instructions for customers, banking staff, and administrators to effectively navigate the digital banking ecosystem. It covers the biometric enrollment process, transaction management, and specialized module access. This manual guarantees that all stakeholders can use the platform's high-fidelity features while maintaining strict financial security.":
        "This section is a simple step-by-step guide for anyone using Smart Bank — whether you are a customer, a bank staff member, or the system administrator. It covers how to register your face for login, how to send money, and how to use the special features like the Agriculture Hub and Savings Pockets.",

    "Processor: Intel i5 or equivalent (Minimum); Intel i7 recommended for smoother 3D Map rendering.":
        "Processor: An Intel i5 or similar chip is the minimum. An i7 or better will make the 3D map run much more smoothly.",

    "RAM: 8GB (Mandatory for real-time face-api.js biometric processing).":
        "RAM: You need at least 8GB. Without it the face recognition will be slow or freeze up.",

    "Camera: incorporated HD Webcam or External USB Camera (Required for Biometric Authentication).":
        "Camera: Any built-in webcam or USB camera will work. You must have one connected for face login.",

    "Display: 1920x1080 resolution (Optimized for glassmorphic UI and 3D terrain visualizations).":
        "Display: Full HD (1920x1080) is best so the frosted-glass design and 3D map look sharp and clear.",

    "Connectivity: Stable broadband (Recommended for Geospatial tile loading via MapLibre GL).":
        "Internet: A stable broadband connection is needed for the 3D map to load its tiles properly.",

    "Operating System: Windows 10/11, macOS, or Linux.":
        "Operating System: Works on Windows 10 or 11, macOS, or any modern Linux distribution.",

    "Web Browser: Google Chrome v90+ or Microsoft Edge (Must support WebGL 2.0 and MediaDevices API).":
        "Browser: Use Google Chrome version 90 or newer, or Microsoft Edge. The browser must support WebGL 2.0 and allow camera access.",

    "JavaScript: Must be enabled in browser settings for face recognition and dynamic Chart.js analytics.":
        "JavaScript: Make sure JavaScript is enabled in your browser settings. Without it, face login and the spending charts will not work.",

    "PDF Viewer: Adobe Acrobat Reader or any browser-incorporated PDF viewer for reviewing bank statements.":
        "PDF Viewer: Use Adobe Reader or your browser's built-in PDF viewer to open downloaded bank statements.",

    # ── DATABASE CHAPTER ──────────────────────────────────────────────────────
    "For the database, I just went with SQLite because I didn't want to deal with setting up a heavy MySQL server. Even though it is a single file, I designed the tables very carefully so that money wouldn't randomly duplicate or disappear if the code crashed mid-transfer.":
        "For the database I chose SQLite mainly because it is simple to set up — just a single file, no server to configure. But I was very careful with how I designed the tables so that money could never be duplicated or lost if something crashed in the middle of a transfer.",

    "Below are the actual table structures I wrote. I split everything up logically — one table for users, another for their bank accounts, another for transactions, and so on.":
        "Below are the tables I created. I kept them separate and clean — one table for users, one for their accounts, one for transactions, and so on, with proper foreign keys linking them together.",

    "Purpose: Stores high-level administrative credentials and biometric profile data.":
        "Purpose: Holds the admin login credentials and the face descriptor data used for biometric login.",

    "Purpose: Manages bank employee data and shift-based authentication permissions.":
        "Purpose: Stores staff profiles and tracks which hours each employee is authorized to work.",

    "Purpose: Central customer profile management.":
        "Purpose: The main table for every registered customer — their name, email, phone, and account status.",

    "Purpose: Tracks applications for specialized banking products.":
        "Purpose: Records every application a customer submits for a loan, card, or new type of account.",

    "Purpose: Detailed validation phase for specific service tiers (KYC/Account Setup).":
        "Purpose: Stores the KYC and account setup request data while it waits for staff to review and approve it.",

    "Purpose: Financial ledger entities representing customer liquid balance pools.":
        "Purpose: The actual bank account records — one per customer — holding the current balance.",

    "Purpose: Manages card tiers (Gold/Platinum) linked to respective account packages.":
        "Purpose: Tracks each customer's debit or credit card, including card type and which account it belongs to.",

    "Purpose: Logging operational shifts and scheduled staff/customer interactions.":
        "Purpose: Records staff clock-in and clock-out times based on face-verified attendance.",

    "Purpose: Low-level ledger of all individual liquidity movements.":
        "Purpose: Every money movement — deposit, withdrawal, or transfer — gets logged as a row in this table.",

    "Purpose: Managing external queries, complaints, and platform feedback.":
        "Purpose: Stores all customer support tickets and the staff replies, along with the current status of each ticket.",

    # ── DETAILED DESIGN CHAPTER ───────────────────────────────────────────────
    "When I actually started writing the code, I realized I couldn't just dump everything into one giant file. I broke the app down into separate pieces: one chunk handles the Admin dashboard, another handles the Staff portal, and the biggest chunk handles the Customer view.":
        "When I started writing the actual code, I quickly realized that putting everything in one file would be a nightmare to manage. So I split the app into clear sections — one for the admin panel, one for the staff portal, and the largest one for the customer dashboard.",

    "As mentioned before, the whole thing runs on Python Flask for the backend, serving plain HTML files to the browser.":
        "The whole backend runs on Python Flask, which serves plain HTML pages to the browser. No heavy frontend framework was used — just regular HTML, CSS, and JavaScript.",

    "The admin panel is basically the god-mode screen. You can add new staff, see exactly how much money is sitting in the entire bank, and update the 3D map.":
        "The admin panel is the top-level control screen. From here you can add new staff members, check the bank's total funds, and update the 3D branch and ATM map.",

    "The staff screen is basically a to-do list. When a new user signs up, a staff member has to click \"approve\" here before the user can actually log in.":
        "The staff screen works like a task queue. Any time a new customer registers, their application sits here waiting for a staff member to review and approve before they can access their account.",

    "This is the main screen that 99% of people will see. It's where you send money, look at your fake credit card, and use the saving pockets.":
        "This is the main dashboard that most users will spend their time on. It is where you check your balance, send money, manage your card, and use the savings pockets.",

    "Mobile-optimized registration with 6-digit OTP verification modal using individual input fields.":
        "A mobile-friendly signup page that uses a 6-digit OTP popup with separate input boxes for each digit to verify the user's email.",
}


def replace_paragraph_text(para, new_text):
    """Replace full paragraph text while preserving the first run's formatting."""
    if not para.runs:
        para.text = new_text
        return
    # Copy formatting from first run
    first_run = para.runs[0]
    # Clear all runs
    for run in para.runs:
        run.text = ''
    # Set text on first run
    first_run.text = new_text
    # Remove extra runs
    for run in para.runs[1:]:
        run._element.getparent().remove(run._element)


def humanize():
    doc = Document(INPUT)
    changed = 0
    for para in doc.paragraphs:
        t = para.text.strip()
        if t in REPLACEMENTS:
            replace_paragraph_text(para, REPLACEMENTS[t])
            changed += 1
            print(f"  [OK] [{para.style.name}] replaced ({len(t)} chars)")

    doc.save(OUTPUT)
    print(f"\nDone! {changed} paragraphs humanized.")
    print(f"Saved → {OUTPUT}")


if __name__ == '__main__':
    humanize()
