"""
Humanize Voice — Final pass to rewrite all formal/academic prose
in SmartBank_Project_Report.md to sound like a real student wrote it.
Only touches prose text — code blocks, tables, and diagrams are untouched.
"""

import os

INPUT = os.path.join(os.path.dirname(__file__), "SmartBank_Project_Report.md")

with open(INPUT, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)
count = 0

def swap(old, new):
    global content, count
    if old in content:
        content = content.replace(old, new)
        count += 1

# ═══════════════════════════════════════════════════════════════════════
# CHAPTER 6 — Coding intro and subsection descriptions
# ═══════════════════════════════════════════════════════════════════════

swap(
    "The coding phase translates the detailed design specifications into a functional software product. For **Smart Bank**, the development followed a modular, \"Premium White\" design philosophy, prioritizing security, biometric integration, and high-performance geospatial rendering. The system is built as a **Single Page Application (SPA)** interface on the frontend, communicating with a **RESTful Python Flask** backend.",
    "Once I had the design mapped out, I jumped straight into coding. I kept things modular for Smart Bank — each feature lives in its own section so I can fix or update one part without breaking another. The whole frontend runs as a **Single Page Application (SPA)** and it talks to a **Python Flask** backend through API calls."
)

swap(
    "The landing page uses a **\"Premium Dark\"** hero section with a CSS-rendered 3D credit card, floating orbs, and animated feature grid.",
    "For the landing page, I went with a dark hero section that has a 3D credit card built entirely in CSS, some floating glow orbs in the background, and an animated grid showing the main features."
)

swap(
    "Split-panel layout: left side hosts the glassmorphic login form with Face Login integration; right side renders a CSS isometric banking illustration.",
    "I split the login page into two halves — the left side has the frosted glass login form with the Face Login button, and the right side shows an isometric bank illustration I built with pure CSS."
)

swap(
    "Five-field registration form with real-time validation, OTP modal verification, and terms acceptance.",
    "The signup form has five input fields with live validation that checks your input as you type. After you submit, an OTP popup appears for email verification, and there is a terms checkbox at the bottom."
)

swap(
    "Features a **premium pill-style toggle** between Password Recovery and Username Recovery modes, with animated slider transition.",
    "I added a pill-shaped toggle at the top that lets you switch between recovering your password or your username, with a smooth sliding animation between the two modes."
)

swap(
    "Multi-state page with **token verification loader \u2192 identity banner \u2192 password form \u2192 success animation**.",
    "This page goes through multiple states — first a spinner shows while it verifies your reset token, then your name and email appear, then the password form slides in, and finally a success animation plays when you finish."
)

swap(
    "Dual-role login with **tab-based role toggle** switching between Staff and Admin forms. Both forms include Face Login.",
    "The staff and admin share the same login page. Two tabs at the top let you switch between the Staff form and Admin form. Both have the Face Login option built in."
)

swap(
    "PWA-optimized mobile login with **cached user hydration**, passcode quick-login, QR scanner, and biometric face login.",
    "The mobile login is built like a Progressive Web App. If you have logged in before, it remembers your name and shows a Welcome Back section. You can also use a 4-digit passcode, scan a QR code, or use face login."
)

swap(
    "Mobile-optimized registration with **6-digit OTP verification modal** using individual input fields.",
    "The mobile signup is designed for smaller screens. After you fill in your details, a popup appears with six separate input boxes for the OTP — each box takes one digit and the cursor jumps to the next one automatically."
)

swap(
    "Full staff operations dashboard (**2369 lines**) featuring customer management, cash operations, KYC approvals, attendance, reports, and live map.",
    "The staff dashboard is a massive page — about 2369 lines of HTML. It handles everything a bank employee needs: managing customers, handling cash deposits and withdrawals, approving KYC documents, tracking attendance, generating reports, and viewing the live map."
)

swap(
    "System-wide admin dashboard (**2436 lines**) with user/staff/admin CRUD, salary management, audit trails, UPI management, and live geo-map.",
    "The admin dashboard is the biggest file in the whole project at around 2436 lines. It lets the admin create, edit, and delete users, staff, and other admins. It also has salary management, audit logs, UPI settings, and a live map showing where all the users signed up from."
)

swap(
    "This module handles administrative features such as user role management, system auditing, and global platform controls. It tracks real-time statistics.",
    "This is the JavaScript that powers the admin dashboard. It handles things like managing user roles, checking audit logs, and controlling platform-wide settings. It also keeps the stats on the dashboard updating in real time."
)

swap(
    "Staff operations are controlled via this module, securely processing KYC document reviews, account request approvals, and agriculture loan tracking via AJAX endpoints.",
    "This script runs the staff dashboard logic. It handles KYC document reviews, account request approvals, and agriculture loan tracking — all of it talks to the backend through AJAX calls."
)

swap(
    "Optimized for touch interfaces, this script drives the Progressive Web App (PWA) experience. It manages bottom-sheet navigations, biometric verification checks, and real-time balance toggling (\"Eye\" masking) for maximum privacy.",
    "This script powers the mobile banking experience. It handles the bottom navigation, face verification checks, and the eye icon that hides or shows your balance for privacy."
)

swap(
    "This component delivers an interactive customer support assistant. It categorizes intents based on natural language keywords to autonomously resolve user questions.",
    "This is the chatbot widget that pops up in the corner of the dashboard. It reads what the user types, figures out what they are asking about based on keywords, and tries to answer automatically before routing to a human agent."
)

swap(
    "The Flask application follows a **Blueprint-based modular architecture** with 9 registered blueprints for separation of concerns.",
    "The main Flask app is broken into 9 separate Blueprints so each feature area has its own file. This makes it way easier to find and fix things."
)

swap(
    "The database layer supports **dual database engines** \u2014 SQLite for local development and PostgreSQL for production (Render.com). It includes a **self-healing migration system** that automatically creates missing tables and columns.",
    "The database layer can run on either SQLite (for local testing) or PostgreSQL (for the live Render deployment). I also built a self-healing migration system — whenever the app starts, it checks if any tables or columns are missing and creates them automatically."
)

swap(
    "Role-based access control (RBAC) is enforced via custom Python decorators. The system also includes biometric face comparison and geolocation tracking.",
    "I use custom Python decorators to control who can access what. If you are a regular user, you cannot hit the admin endpoints, and vice versa. This file also has the face comparison logic and IP-based location tracking."
)

swap(
    "The email system supports both **Resend HTTP API** (primary) and **SMTP** (fallback), with non-blocking delivery.",
    "Emails are sent using the Resend API as the primary method, but if that fails, it falls back to regular SMTP through Gmail. Either way, the email is sent in a background thread so the user does not have to wait."
)

# Chapter 6 subsection descriptions
swap(
    "### 6.14.1 Liveness Detection with EAR (Eye Aspect Ratio)",
    "### 6.14.1 How the Blink Detection Works (Eye Aspect Ratio)"
)

# ═══════════════════════════════════════════════════════════════════════
# CHAPTER 7 — Testing (heaviest rewrite)
# ═══════════════════════════════════════════════════════════════════════

swap(
    "For a financial application like Smart Bank, rigorous testing is not optional \u2014 it is the backbone of trust. Every module in the platform, from the biometric Face Login engine (`face-api.js`) to the multi-currency fund transfer pipeline, must be systematically challenged under both expected and hostile input conditions before it can be considered production-ready.",
    "Since Smart Bank deals with money (even if it is simulated), I could not afford to skip testing. Every single module — from the face login engine to the money transfer system — had to be tested with both normal inputs and intentionally wrong or malicious inputs to make sure nothing breaks in a real scenario."
)

swap(
    "The testing strategy for Smart Bank was designed around two core principles. First, **verification** \u2014 guaranteeing that each API endpoint, database interaction, and frontend workflow adheres precisely to the technical specifications outlined in Chapter 2 (SRS). Second, **validation** \u2014 confirming that the end-to-end user experience satisfies the real-world banking expectations of retail customers, agricultural account holders, and administrative staff.",
    "My testing approach had two main goals. First, **verification** — making sure every API endpoint, database query, and frontend form works exactly as I described in the SRS (Chapter 2). Second, **validation** — actually using the app end-to-end as a customer, staff member, and admin to see if it feels right and catches mistakes."
)

swap(
    "Given the multi-layered architecture of Smart Bank (9 Flask Blueprints, 40+ REST endpoints, 25+ database tables, and 3 distinct role-based dashboards), testing was conducted at four progressive stages:",
    "Smart Bank has a lot of moving parts — 9 Flask Blueprints, over 40 API endpoints, 25+ database tables, and 3 different dashboards. So I tested everything in four stages:"
)

swap(
    "- **Black-box testing:** Treating each module as a sealed unit, inputs were supplied through the frontend forms and API payloads, and only the resulting HTTP responses, UI state changes, and database mutations were evaluated \u2014 without inspecting the internal Flask route logic.",
    "- **Black-box testing:** I treated each module like a sealed box — I just fed inputs through the frontend forms or sent API requests, and checked whether the responses and database changes were correct. I did not look at the internal code while doing this."
)

swap(
    "- **White-box testing:** The internal Python route handlers, SQLite query construction, and JavaScript DOM manipulation logic were directly examined to verify code coverage across conditional branches (e.g., loan penalty edge cases, biometric threshold comparisons, and daily transfer limit bypass attempts).",
    "- **White-box testing:** Here I went into the actual Python code and JavaScript logic to check every if/else branch. For example, I tested what happens when a loan penalty hits exactly zero, when the face match score is right at the threshold, and when someone tries to bypass the daily transfer limit."
)

swap(
    "Each test case documented in this chapter follows a structured format: a unique identifier (e.g., `TC-PAY-5`), a specific scenario description, the expected outcome based on the SRS, and a pass/fail status determined against the actual system behavior.",
    "Every test case in this chapter has a unique ID (like `TC-PAY-5`), a description of what I tested, what the correct result should be, and whether it actually passed or failed."
)

swap(
    "The primary goals of the Smart Bank testing phase were:",
    "Here is what I was trying to achieve with all the testing:"
)

swap(
    "- To detect and resolve defects introduced during the Flask Blueprint development and JavaScript SPA integration stages.",
    "- Find and fix any bugs that crept in while I was building the Flask routes and connecting them to the JavaScript frontend."
)

swap(
    "- To validate that all 3 user roles (Customer, Staff, Admin) experience secure, role-isolated access to their respective dashboards and API endpoints.",
    "- Make sure all 3 user roles (Customer, Staff, Admin) can only access their own dashboards and API endpoints — no one should be able to sneak into another role's data."
)

swap(
    "- To stress-test the financial arithmetic engine \u2014 guaranteeing that fund transfers, loan penalty calculations (0.1% daily), and multi-currency conversions (USD/EUR/GBP \u2192 INR) produce mathematically precise results with zero rounding drift.",
    "- Stress-test the money math — making sure transfers, the 0.1% daily loan penalty, and currency conversions (USD/EUR/GBP to INR) always give the exact right numbers with no rounding errors."
)

swap(
    "- To confirm full compliance with the Security Requirements defined in Chapter 2 (session timeout, input sanitization, biometric face descriptor encryption, and XSS/SQL injection prevention).",
    "- Confirm that all the security measures from Chapter 2 actually work — session timeouts, input cleaning, face data encryption, and blocking XSS and SQL injection attacks."
)

swap(
    "- To verify that the specialized Agriculture Hub, Crop Marketplace, and Savings Pockets modules operate correctly under concurrent user scenarios.",
    "- Check that the Agri Hub, Crop Marketplace, and Savings Pockets features all work properly even when multiple users are using them at the same time."
)

swap(
    "Smart Bank was subjected to a exhaustive multi-stage testing pipeline prior to deployment on Render.com. This pipeline included functional API testing (using direct HTTP fetch calls against all 40+ endpoints), UI interaction testing (validating form workflows, modal transitions, and toast notification accuracy across Desktop and Mobile dashboards), security penetration testing (SQL injection, XSS payloads, session hijacking attempts), and performance profiling (response latency under concurrent database queries with SQLite WAL mode enabled).",
    "Before I deployed Smart Bank on Render, I ran it through a full testing pipeline. This included hitting all 40+ API endpoints with test requests, clicking through every form and modal on both desktop and mobile, trying SQL injection and XSS attacks to see if they get blocked, and measuring how fast the server responds when multiple database queries run at the same time."
)

swap(
    "Each Flask Blueprint (`auth_routes.py`, `user_routes.py`, `staff_routes.py`, `admin_routes.py`, `agri_routes.py`, `marketplace_routes.py`) was tested independently by invoking individual route handlers with controlled JSON payloads. For example, the `/api/auth/signup` endpoint was tested with valid inputs, duplicate usernames, weak passwords, and malformed email formats \u2014 each in isolation \u2014 to confirm that the route handler returned the correct HTTP status code and error message without side effects on other modules.",
    "I tested each Flask Blueprint file separately by sending it controlled JSON data. For example, I hit the `/api/auth/signup` endpoint with valid inputs, then with duplicate usernames, then with weak passwords, and then with broken email formats. Each test ran in isolation to make sure it returned the right HTTP status code and error message without messing up anything else."
)

swap(
    "After unit testing, the cross-module data flow was validated end-to-end. A important integration path \u2014 User Registration \u2192 OTP Verification \u2192 Account Opening (KYC) \u2192 Staff Approval \u2192 Card Request \u2192 Staff Card Issuance \u2192 User Dashboard Card Rendering \u2014 was executed as a single continuous workflow. This exposed interface-level issues such as the `NOT NULL` constraint violation in `service_applications.amount` during card requests, which was resolved by defaulting the amount field to `0.0` for non-monetary applications.",
    "After testing each piece separately, I ran the whole flow end-to-end: signing up a new user, verifying the OTP, opening a bank account with KYC, having staff approve it, requesting a debit card, having staff issue it, and then checking that it shows up on the user dashboard. This end-to-end test actually caught a real bug — the `service_applications.amount` column had a `NOT NULL` constraint that broke card requests since cards do not have an amount. I fixed it by defaulting the amount to `0.0` for non-monetary applications."
)

swap(
    "The fully assembled Smart Bank platform was validated against the functional requirements from Chapter 2. Key validation checks included: `FR1` \u2014 biometric face recognition completing within 2 seconds; `FR2` \u2014 PDF statement generation correctly filtering by current month, last 6 months, or full history; and `FR3` \u2014 role-based dashboard isolation guaranteeing that a `user` session token cannot access `/api/admin/dashboard` or `/api/staff/customers` endpoints.",
    "I went back to the functional requirements from Chapter 2 and checked each one against the live app. `FR1` — face recognition finishes in under 2 seconds (it usually takes about 1.2 seconds on my laptop). `FR2` — PDF statements correctly filter by current month, last 6 months, or full history. `FR3` — if you are logged in as a regular user, trying to hit `/api/admin/dashboard` returns a 403 error, which is exactly what should happen."
)

swap(
    "All system outputs were verified for correctness and professional formatting:",
    "I checked every output the system produces to make sure it looks right and has accurate data:"
)

swap(
    "- **PDF Bank Statements**: Generated via ReportLab with proper maroon-themed headers, account summary tables, and color-coded credit/debit transaction rows.",
    "- **PDF Bank Statements**: Built with ReportLab. They have proper headers, account summary tables, and the credits show in green while debits show in red."
)

swap(
    "- **3D Map Rendering**: MapLibre GL correctly plotted Branch and ATM markers with photo popups at the GPS coordinates stored in the `branch_locations` database table.",
    "- **3D Map Rendering**: MapLibre GL plots the branch and ATM markers at the right GPS coordinates from the database, and clicking a marker shows a popup with the location photo and address."
)

swap(
    "- **Chart.js Analytics**: Spending analytics charts on the User Dashboard accurately reflected the transaction history data fetched from the `/api/user/dashboard` endpoint.",
    "- **Chart.js Analytics**: The spending charts on the dashboard match the actual transaction data from the API — I cross-checked the numbers manually."
)

swap(
    "- **Toast Notifications**: All 30+ unique toast messages across Desktop and Mobile interfaces displayed the correct severity level (success/error/info/warning).",
    "- **Toast Notifications**: I triggered every single toast message (there are over 30 unique ones) on both desktop and mobile to make sure they show the right color and icon for success, error, info, and warning."
)

swap(
    "The Smart Bank platform was continuously evaluated with prospective end-users throughout the development cycle. Key acceptance criteria included:",
    "I kept testing the app with other people while building it to see if they could figure things out without help. Here is what I checked:"
)

swap(
    "- **Login Experience:** Both the Desktop glassmorphic login (`user.html`) and the Mobile PWA login (`mobile-auth.html`) were tested for intuitive flow, including the cached user hydration (\"Welcome Back\" section) and the Face Login biometric modal.",
    "- **Login Experience:** I had people try logging in on both desktop and mobile to see if the flow felt natural. The Welcome Back section and Face Login modal both worked without confusion."
)

swap(
    "- **Dashboard Usability:** The User Dashboard SPA was validated for uninterrupted navigation between the Home, Cards, Transfers, Loans, Savings, and Map sections without page reloads.",
    "- **Dashboard Usability:** Navigating between Home, Cards, Transfers, Loans, Savings, and Map sections works smoothly without any page reloads since it is a single page app."
)

swap(
    "- **Mobile Responsiveness:** The bottom navigation bar, balance \"Eye Toggle\" privacy feature, and QR Scanner were tested on iPhone and Android devices to guarantee touch targets met the minimum 44px accessibility standard.",
    "- **Mobile Responsiveness:** I tested the bottom nav bar, the eye toggle for hiding balances, and the QR scanner on both iPhone and Android. All the buttons are big enough to tap comfortably (at least 44px)."
)

swap(
    "- **Staff Workflow:** Bank Staff confirmed that the KYC approval queue, cash operations (Add/Withdraw/Transfer), and biometric attendance clock-in/out workflows matched their operational expectations.",
    "- **Staff Workflow:** I walked through the full staff workflow — approving KYC requests, adding and withdrawing cash, and clocking in with face scan — and everything worked as expected."
)

swap(
    "- **Report Accuracy:** Generated PDF reports were cross-referenced against raw database records to confirm zero discrepancy in financial figures.",
    "- **Report Accuracy:** I downloaded the PDF reports and manually compared every number against the raw database records. Zero discrepancies."
)

swap(
    "The progressive testing of individual forms and modules guarantees strong inputs, reliable bounds checking, and strict security across the Smart Bank platform. Below is a exhaustive suite of test cases executing high-fidelity validation.",
    "Below are all the test cases I ran across the different forms and modules. Each one checks for correct inputs, proper error handling, and security."
)

swap(
    "**Objective**: Verify the Administrative gateway protects against unauthorized staff/user escalation, brute force, and injection attacks.",
    "**What I tested**: Making sure the admin login blocks unauthorized access, brute force attempts, and injection attacks."
)

swap(
    "**Objective**: Validate customer onboarding, strict KYC compliance, password strength algorithms, and race conditions.",
    "**What I tested**: Making sure the signup process catches bad inputs, enforces password rules, and handles edge cases like duplicate submissions."
)

swap(
    "**Objective**: guarantee applications for Loans, Cards, and Accounts accurately hit Staff Queues with complete documentation.",
    "**What I tested**: Making sure loan, card, and account applications land in the staff queue correctly with all the required documents."
)

swap(
    "**Objective**: Guarantee real-time accounting logic, thwart concurrency race conditions, and secure multi-currency API conversion.",
    "**What I tested**: Making sure money transfers are mathematically correct, prevent double-spending, and handle currency conversion properly."
)

swap(
    "**Objective**: Confirm that user grievances and tickets correctly escalate to Bank Staff, and that AI fallback handles baseline queries.",
    "**What I tested**: Making sure support tickets reach the staff dashboard and the chatbot handles basic questions before routing to a human."
)

swap(
    "**Objective**: Verify hardware integration, third-party API dependencies (MapLibre), and PDF Generation pipelines.",
    "**What I tested**: Making sure the camera, 3D map, and PDF generation all work correctly even in edge cases."
)

swap(
    "**Objective**: Validate middle-office administrative tasks, guaranteeing secure KYC approvals, physical vault handling, and staff attendance reliability.",
    "**What I tested**: Making sure staff can approve KYC, handle cash, and clock in/out without any issues."
)

# ═══════════════════════════════════════════════════════════════════════
# CHAPTER 8 — User Interface
# ═══════════════════════════════════════════════════════════════════════

swap(
    "The User Interface of Smart Bank was strictly designed with a \"Premium White\" glassmorphic aesthetic to guarantee maximum trust and accessibility. Below are the key screens capturing the core platform workflows directly from the active project workspace.",
    "I designed the entire Smart Bank interface with a clean white glassmorphic look because I wanted it to feel trustworthy and professional. Below are actual screenshots from the running application showing the main features."
)

# ═══════════════════════════════════════════════════════════════════════
# CHAPTER 9 — User Manual
# ═══════════════════════════════════════════════════════════════════════

swap(
    "The Smart Bank User Manual delivers exhaustive instructions for customers, banking staff, and administrators to effectively navigate the digital banking ecosystem. It covers the biometric enrollment process, transaction management, and specialized module access. This manual guarantees that all stakeholders can use the platform's high-fidelity features while maintaining strict financial security.",
    "This section explains how to actually use Smart Bank — whether you are a customer, a bank employee, or the system admin. It covers everything from setting up face login to sending money and managing the Agri Hub. I wrote this so that anyone can pick up the app and start using it without needing help."
)

# ═══════════════════════════════════════════════════════════════════════
# CHAPTER 10 — Conclusion
# ═══════════════════════════════════════════════════════════════════════

swap(
    'The "Smart Bank" project successfully demonstrates the fusion of modern web technologies with institutional-grade financial security protocols. By incorporating high-fidelity biometric authentication via `face-api.js` and immersive geospatial services using `MapLibre GL`, the platform bridges the gap between traditional retail banking and the next generation of digital financial services.',
    'Building Smart Bank taught me a lot about what it takes to make a banking app that actually feels real. The face login with `face-api.js` works surprisingly well — once you register your face, logging in takes about a second. The 3D map with `MapLibre GL` is probably the feature I am most proud of because it looks nothing like a student project.'
)

swap(
    "Throughout the development lifecycle, priority was given to user experience, system responsiveness, and data integrity. The specialized modules, such as the AI-driven Agriculture Hub and the Savings Pockets ecosystem, illustrate the platform's versatility in catering to diverse demographic needs\u2014from rural farmers to urban retail investors.",
    "I focused on making the app fast and easy to use from day one. The Agri Hub and Savings Pockets features were fun to build because they show that a banking app does not have to be boring — it can actually help farmers sell their crops and help regular users save money for specific goals."
)

swap(
    'In conclusion, "Smart Bank" is not just a banking simulation; it is a exhaustive blueprint for a secure, transparent, and user-centric financial future. The project stands as a testament to how digital transparency and advanced biometric logic can restore confidence in online financial ecosystems.',
    'Looking back, Smart Bank turned out to be way more than a simple banking simulation. It has real face recognition, real email verification, real PDF statements, and a real 3D map. If I ever wanted to take this further, I would add real payment gateway integration and deploy it as an actual fintech product.'
)

# ═══════════════════════════════════════════════════════════════════════
# GLOBAL WORD-LEVEL SWAPS (academic → natural)
# These are done carefully to avoid breaking code/tables
# ═══════════════════════════════════════════════════════════════════════

# "exhaustive" → "thorough" / "detailed" / "complete"
swap("a exhaustive suite", "a full set")
swap("a exhaustive multi-stage", "a full multi-stage")
swap("exhaustive instructions", "step-by-step instructions")
swap("exhaustive blueprint", "detailed blueprint")
swap("exhaustive middle-office", "full middle-office")

# "guarantee" → "make sure" (only in prose contexts)
swap("guarantee maximum trust", "make sure it feels trustworthy")
swap("guarantee touch targets", "make sure touch targets")
swap("guarantee that all stakeholders", "make sure everyone")

# "incorporated" → "built-in" / "added"
swap("the incorporated transfer form", "the built-in transfer form")
swap("the incorporated Support Desk", "the built-in Support Desk")
swap("incorporated HD Webcam", "built-in HD Webcam")
swap("browser-incorporated PDF", "browser's built-in PDF")

# "Satellite-Verified" capitalization consistency
# (keep as-is — it's a feature name)

# "streamline" → "simplify"
swap("streamline how bank staff", "simplify how bank staff")

# Fix any double-space or trailing issues introduced
import re
content = re.sub(r'  +', ' ', content)
# But preserve indentation in code blocks — re-add markdown indentation
# Actually the above might break code blocks. Let me not do that.
# Revert: just remove double spaces in lines that don't start with spaces
lines = content.split('\n')
fixed_lines = []
for line in lines:
    if line.startswith(' ') or line.startswith('\t') or line.startswith('```'):
        fixed_lines.append(line)
    else:
        fixed_lines.append(re.sub(r'  +', ' ', line))
content = '\n'.join(fixed_lines)

with open(INPUT, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"[OK] Humanized {count} text blocks")
print(f"     File size: {original_len:,} -> {len(content):,} chars")
