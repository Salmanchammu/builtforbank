"""
Final cleanup: Remove remaining AI-sounding language and make it plain English.
"""
import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# Fix overly complex phrases back to simple English
fixes = {
    'Everyday account holders requiring ledger oversight and capital movement operative capability':
        'Regular users who need to check their accounts and transfer money',

    'Designated personnel overseeing identity verification, credit sanctions, and agricultural portfolio entries':
        'Bank employees who verify documents, approve loans, and manage agriculture records',

    'Elevated operators conducting platform-wide compliance reviews and workforce role allocation':
        'Top-level users who manage the entire system and assign staff roles',

    'Calibrated for Chromium-derived browsers owing to GPU rendering and media capture prerequisites':
        'Works best on Google Chrome because it needs camera access and 3D map rendering',

    'A baseline of 8 Gigabytes of volatile memory to sustain continuous biometric tensor calculations':
        'At least 8GB RAM needed for the face recognition to run smoothly',

    'Account holders are presumed to possess an operational image capture peripheral for facial identity checks':
        'Users should have a working webcam for face login',

    'The platform necessitates persistent network availability for retrieving assets from external distribution endpoints':
        'The system needs a stable internet connection to load fonts and icons from',

    'The platform interfaces with commodity imaging hardware for frame acquisition and harnesses client-side file systems for exportable ledger document retention.':
        'The system uses the device webcam to capture face images and saves PDF statements to the local Downloads folder.',

    'deploying translucent blur overlays, adaptive flexbox grid compositions':
        'with frosted glass effects and flexible responsive layouts',

    'plus a distinct ambient-adaptive theme switch for varied illumination contexts':
        'along with a Dark/Light mode toggle',

    'Data interchange spanning the presentation and service tiers flows through asynchronous Fetch requests carrying JSON-encoded payloads across encrypted transport channels (HTTPS).':
        'The frontend talks to the backend using fetch() calls that send and receive JSON data over HTTPS.',

    'The engine is obligated to resolve facial geometries within a two-second ceiling':
        'The system should recognize a face within 2 seconds',

    'Service-layer round-trip latency for ledger inquiries shall remain beneath half a second':
        'Backend responses should come back in under 500ms for account queries',

    'Sustain up to fifty parallel emulated account sessions within a standalone deployment':
        'Handle up to 50 users at the same time in a local setup',

    'The interface must adhere to a cohesive visual grammar':
        'The design should look the same across all pages',

    'Forced session expiration following a quarter-hour of dormancy':
        'Auto logout after 15 minutes of no activity',

    'Physiological feature vectors undergo encryption and are never persisted as unprocessed visual captures':
        'Face data is encrypted before storing and raw face images are never saved',

    'Four-character numeric tokens mandated for critical handheld operations':
        '4-digit PIN required for sensitive mobile transactions',

    'Every input surface undergoes rigorous sanitization to thwart injection exploits and script-based intrusions (XSS)':
        'All form inputs are cleaned to prevent SQL injection and XSS attacks',

    'operative capability': 'features',
    'operative capabilities': 'features',
    'adaptive viewport rendering': 'responsive design',
    'intuitively navigable': 'easy to use',
    'resilient': 'strong',
    'elastically expandable': 'scalable',
    'elastic expandability': 'scalability',
    'in a streamlined manner': 'efficiently',
    'augmented': 'improved',
    'augments': 'improves',
    'augmentation': 'improvement',
    'scaffolding': 'framework',
    'scaffoldings': 'frameworks',
    'rationalized': 'organized',
    'rationalizing': 'organizing',
    'rationalize': 'streamline',
    'hurdles': 'challenges',
    'pivotal': 'important',

    # Fix Chapter 1 remaining AI text
    'represents a resilient, multi-layered fintech solution conceived to address the growing necessity for dependable, easily reachable, and stringently secured monetary service delivery':
        'is a full-stack digital banking application built for our BCA final project. It covers all the key areas of online banking including account management, fund transfers, and secure login',

    'The platform furnishes account holders with an extensive catalogue of elevated banking provisions, encompassing instantaneous ledger oversight and biometrically shielded entry spanning diverse device form factors.':
        'Users get access to features like real-time balance checking, transaction history, and face-based login that works on both desktop and mobile.',

    'Central to the "Smart Bank" architecture lies a cutting-edge **Facial Geometry Identification** mechanism':
        'The main highlight of Smart Bank is its **Face Recognition Login** system',

    'enabling both customers and institutional employees to reach role-specific control panels through live physiological scanning':
        'which lets users and staff log in by scanning their face through the webcam',

    'The interface employs a "Frosted White" translucent aesthetic, fine-tuned for fluid operation across both workstation and handheld computing ecosystems':
        'The UI uses a clean white design with glassmorphism effects, and works well on both desktop and mobile screens',

    'incorporates a **Dual-Theme Selector** permitting individualized display calibration':
        'includes a **Dark/Light Mode** toggle so users can switch based on their preference',

    'A distinguishing capability within the platform is the **Precision 3D Facility Navigator**':
        'Another standout feature is the **3D Branch and ATM Locator**',

    'harnessing `MapLibre GL` to deliver pinpoint directional guidance with volumetric terrain modeling and structural outlines':
        'powered by `MapLibre GL` which shows a 3D map with terrain and building outlines to help users find the nearest branch or ATM',

    'Extending well past conventional banking boundaries, "Smart Bank" delivers an adaptive **Individual Fiscal Management Suite**':
        'Beyond basic banking, Smart Bank also includes a **Personal Finance** section',

    'housing purpose-driven **Budgetary Targets (Pockets)** crafted to cultivate monetary responsibility':
        'with **Savings Goals (Pockets)** that help users save money for specific targets',

    'For agrarian account holders, the platform avails a specialized **Algorithm-Assisted Farming Portal**':
        'For farmers, there is a dedicated **Agriculture Hub**',

    'Additionally, the framework weaves in **Equity Fund** and **Term Assurance** mockups paired with live **Expenditure Breakdown Dashboards**':
        'The system also has **Mutual Fund** and **Life Insurance** simulations along with **Spending Analytics** charts',

    '"Smart Bank" merges location-aware intelligence with enterprise-caliber safeguards, furnishing a polished and fortified digital financial workflow suited to contemporary account holders.':
        'Overall, Smart Bank brings together mapping, biometric security, and banking features into one complete platform.',

    # Fix Chapter 2 remaining
    'This manuscript aims to furnish a granular specification of the programmatic prerequisites':
        'This document describes the software requirements',

    'It delineates both operational and supplementary stipulations, peripheral interconnections, and architectural boundaries':
        'It covers what the system needs to do, what hardware it connects to, and what limits it has',

    'guaranteeing a fortified, physiologically authenticated financial interaction':
        'so that users get a secure banking experience with face-based login',

    'The operational perimeter of Smart Bank encompasses identity corroboration through facial geometry matching':
        'Smart Bank covers user login through face recognition',

    'multi-ledger stewardship, emulated capital movements (UPI/NEFT), volumetric facility cartography, and a purpose-built algorithm-powered agrarian interface':
        'account management, simulated fund transfers (UPI/NEFT), 3D branch mapping, and an Agriculture Hub for farmers',

    'The architecture caters to three distinct persona categories: Account Holders (Clientele), Institutional Personnel, and Supervisory Controllers.':
        'The system has three user roles: Customers, Bank Staff, and Administrators.',

    '"Smart Bank" functions as a self-contained, browser-accessible digital monetary ecosystem.':
        '"Smart Bank" is a standalone web-based banking application.',

    'It follows a distributed request-response paradigm wherein the presentation tier (HTML/CSS/JS) communicates with a Python Flask service layer backed by a unified SQLite relational data store.':
        'The frontend is built with HTML/CSS/JavaScript and it talks to a Python Flask backend that stores data in SQLite.',

    'Exhaustive Browser-Hosted Software Solution (Financial Technology coupled with Physiological Identity Safeguards)':
        'Full-Stack Web Application (Banking + Face Recognition Security)',
}

for old, new in fixes.items():
    if old in content:
        content = content.replace(old, new)
        changes += 1

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'AI slop cleanup done: {changes} phrases fixed to plain English.')
