"""
Humanize Chapter 3 and 5 text - remove AI-sounding language,
make it read like a student wrote it naturally.
"""
import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

humanize = {
    # Chapter 3 fixes
    'Structural blueprinting entails delineating the overarching layout, constituent parts, discrete modules, and interconnection surfaces to fulfill documented stipulations.':
        'System design is about deciding how different parts of the software will be organized and how they will talk to each other so that all the requirements we identified earlier are properly met.',

    'Within the **Smart Bank** context, the structural emphasis centers on safeguarded information transit among account holders, institutional personnel, and physiological computation engines.':
        'For Smart Bank, we focused on making sure that data moves safely between the customer, bank staff, and the face recognition system without any leaks or unauthorized access.',

    'The Contextual Interaction Schematic depicts the bidirectional communication channels linking the Smart Bank nucleus with its peripheral actors':
        'The Context Flow Diagram below shows how the Smart Bank system connects with outside users like customers, staff, and the admin',

    'A Data Movement Schematic graphically traces the transit of information parcels across the system landscape, capturing the procedural transformations at each stage.':
        'A Data Flow Diagram shows how information moves through the system step by step, from input to processing to storage.',

    'Temporal interaction schematics chart the procedural progression of operational cases by rendering the message exchanges among system entities across a chronological axis.':
        'Sequence diagrams show the order in which different parts of the system send messages to each other during a particular task.',

    'Workflow progression schematics portray the procedural routing within the system, visualizing the hand-off of control between successive operational stages.':
        'Activity diagrams show the step-by-step workflow of a process, making it easy to see which action comes after which.',

    'The Administrator sub-system focuses on managing user roles and system integrity.':
        'This diagram breaks down what the Admin can do inside the system.',

    'Focused on localized operational tasks, KYC verification, and agricultural loan assessment.':
        'This shows the main jobs that bank staff handle on a daily basis.',

    'The core retail banking interface for daily financial activities and personal growth.':
        'This covers everything a regular customer can do after logging in.',

    # Chapter 5 fixes
    'The granular design stage expands upon the structural blueprint by partitioning the application into self-contained operational units.':
        'In the detailed design chapter, we break the whole application down into smaller, independent modules that each handle one specific job.',

    'Visual layout specifications, routing arbitration logic, and service-tier processing conduits are methodically compartmentalized.':
        'We have organized the UI screens, the URL routing logic, and the backend processing into clear separate sections.',

    'The Smart Bank software operates deploying a sophisticated web-app architecture (Flask backend with vanilla JS/HTML frontends).':
        'Smart Bank runs as a web application where the frontend is built with plain HTML, CSS, and JavaScript, and the backend uses Python Flask.',

    'The Supervisory tier delivers exhaustive platform governance, steering workforce profiles, institutional capital pools, and macro-level infrastructure parameters.':
        'The Admin dashboard gives full control over the system — managing staff, tracking the bank\'s total funds, and handling branch locations.',

    'The Personnel tier concentrates on assignment execution, identity document validation, account provisioning petitions, and front-line customer dialogue through the assistance interface.':
        'The Staff dashboard is where employees handle their daily tasks like verifying KYC documents, processing account requests, and responding to customer queries.',

    'The Account Holder tier supports diversified ledger operations customized to the individual profile archetype (Retail, Corporate, Agriculture).':
        'The Customer dashboard lets users manage their accounts, make transfers, and access features based on their account type (Savings, Current, or Agriculture).',

    'Secured biometric and password/PIN-based administrative access protocol granting elevated operational rights.':
        'Admins can log in using either their password or face scan to access the admin control panel.',

    'Creation, deletion, and role assignment for bank staffing.':
        'The admin can add new staff members, remove existing ones, and assign them specific roles.',

    'Overrides and direct suspension controls on customer profiles during fraudulent activity incidents.':
        'If a customer account shows suspicious activity, the admin can directly block or suspend it from here.',

    'Real-time tracking of total platform deposits, active loan liabilities, and liquid reserves.':
        'This module shows the bank\'s total deposits, outstanding loans, and available funds in real time.',

    'Administrative interface mapping deploying MapLibre 3D, allowing admins to add or deactivate physical bank branch/ATM locations and attach geospatial images.':
        'Admins use this section to add or remove branch and ATM locations on the 3D map, along with uploading photos of each location.',

    'Viewable systemic trails logging transaction overrides, login attempts, and policy modifications.':
        'All important actions like login attempts, transaction changes, and setting modifications are logged here for review.',

    'Enforced login tracking shift times and operational access.':
        'Staff members log in with tracked shift timings so the bank knows who was active and when.',

    'Approval workflow pipelines for new account creation requests, managing pending KYC (Know Your Customer) verifications, and validating document uploads.':
        'This is where staff process new account applications, check KYC documents, and approve or reject requests.',

    'Issuance workflows for new virtual debit/credit cards linked to customer accounts.':
        'Staff can approve new card requests and link them to the right customer account.',

    'A dedicated processing system for assessing farmer profiles, evaluating land yield metrics, and approving agriculture credit subsidies.':
        'This module lets staff review farm loan applications by checking the farmer\'s land documents and satellite health scores before approving or rejecting the loan.',

    'Handling live chat tickets, email escalations, and issuing localized user notifications for pivotal alerts.':
        'Staff can view and respond to customer support tickets, and send notifications for important updates.',

    'Fast, highly compliant onboarding systems deploying biometric Face ID and document verification pathways.':
        'New users sign up by filling in their details and registering their face for biometric login.',

    'The core interface reflecting dynamic balances (with privacy eye toggles), recent transactions, and segmented transaction history analytics.':
        'The main dashboard where customers see their balance (with a hide/show toggle), recent transactions, and spending charts.',

    'Enabling secure peer-to-peer or peer-to-business liquidity transfers including beneficiary lifecycle management.':
        'Customers can send money to other accounts via NEFT or UPI, and save frequent recipients as beneficiaries.',

    'Interface to review connected cards, request new tier upgrades, and perform emergency block/unblock actions.':
        'Users can view their cards, request upgrades, and quickly block a card if it gets lost or stolen.',

    'Tool allowing users to lock designated funds into target-oriented savings vaults, with progress visualizers.':
        'Pockets let users set aside money for specific goals like a vacation or new phone, with a progress bar showing how close they are.',

    'A fully interactive, MapLibre-powered 3D spatial map enabling customers to navigate to the nearest Branches and ATMs uploaded by the bank staff.':
        'Customers can open a 3D map to find the nearest Smart Bank branches and ATMs, with directions and distance shown.',

    # Fix any remaining AI-sounding phrases in chapters 3/5
    'delineates the structure': 'describes the layout',
    'meticulously categorized': 'properly organized',
    'modular functional segments': 'smaller working parts',
    'respective domains belonging to': 'sections for',
    'partitions routing, processing, and visualization models into': 'separates the URL routing, data processing, and screen display logic into',
}

for old, new in humanize.items():
    if old in content:
        content = content.replace(old, new)
        changes += 1

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Humanization complete: {changes} phrases rewritten in natural language.')
