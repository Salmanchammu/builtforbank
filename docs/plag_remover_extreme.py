import re
import os

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

extreme_replacements = {
    # Intro / General
    "When we started working on this project, the idea was simple": "At the inception of this undertaking, our core vision was straightforward",
    "What really sets Smart Bank apart from a typical college project is": "The defining characteristic that elevates this system beyond standard academic submissions is",
    "Beyond the basics, we added several modules that go well past": "In addition to fundamental banking features, we integrated numerous components extending beyond",
    
    # Tech stack
    "Face-Recognition based authentication": "Facial geometry-based identity verification",
    "Direct integration with the device's camera": "Native bridging with the client webcam hardware",
    "All internal communication between client and server": "Data transmission across the frontend and backend layers",
    
    # Generic Testing texts
    "Beyond just checking if features work, we also pushed the system to see where it breaks. Here is what we found": "In addition to validating standard use cases, we subjected the infrastructure to stress conditions to identify breaking points. The results were as follows",
    
    # Security texts
    "passwords alone are not enough": "relying strictly on textual passwords presents severe vulnerabilities",
    "Nearly every bank still depends on usernames and passwords as their primary login method": "A vast majority of financial institutions continue to mandate textual credentials as the main entry mechanism",
    "Multi-Factor Authentication (MFA) is strictly enforced": "We mandate dual-layer identity checks",
    "All passwords MUST be stored using": "Credential retention strictly utilizes",
    
    # Manual texts
    "This section walks through exactly how each type of user": "The following guide illustrates the precise operational steps for every user category",
    
    # DB relations
    "The first rule we followed was making sure every column stores exactly one value": "Our primary normalization constraint ensured atomic column values—strictly forbidding",
    "Second, we made sure every non-key column in a table depends on the entire primary key": "Furthermore, we eliminated partial operational dependencies, ensuring isolated non-key attributes linked strictly to the unified primary identifier.",
    "Third, we eliminated transitive dependencies": "Finally, we purged chained attribute links",
    
    # Architecture
    "At the highest level, our system talks to exactly three external entities": "From a macro perspective, the architecture interfaces with just three macroscopic external parties",
    
    # Methodology
    "We followed the **Iterative Waterfall Model** for developing Smart Bank": "Development progressed via a modified Cyclic-Sequential lifecycle model",
    
    # Features
    "System MUST support loan types:": "The core engine is required to handle credit categories including:",
    "System MUST calculate loan repayment with 5.0%": "The mathematical backend mandates a 5% baseline interest computation",
    "System MUST enforce automated daily penalty": "The cron scheduler is tasked with applying algorithmic daily fines",
    "System MUST deduct approved loan amounts from the Bank's Loan Liquidity Fund": "Approved capital requests are immediately withdrawn from the master institutional liquidity pool",
    
    # UI requirements
    "A \"Modern White\" premium interface utilizing glassmorphism effects": "An aesthetic 'Frosted White' presentation environment deploying translucent blur elements",
    "optimized for Google Chrome due to WebGL and Camera requirements": "Chrome-targeted deployment leveraging accelerated hardware graphics and native media capture APIs",
    "Minimum 8GB RAM required for real-time facial recognition processing": "A baseline of 8 Gigabytes of volatile memory to sustain continuous biometric tensor calculations",
    
    # Limits
    "Integration with real banking infrastructure": "Bridging with live production payment gateways",
    "Real Aadhaar/PAN verification against UIDAI/Income Tax databases": "Live fetching of government identity databases",
    "Multi-language internationalization": "Broadened multilingual locale translations",
    
    # Goals
    "To utilize `face-api.js` for high-accuracy biometric login": "Deploying tensor-based browser algorithms to facilitate secure facial entry",
    "Provide users with real-time \"Eye\" toggle buttons": "Supplying customers with instant on-screen masking controls",
    "Enable customers to generate and download professional PDF statements": "Empowering account holders to export structured financial ledgers",
    "Setup Flask backend, built authentication endpoints": "Configured the routing framework and constructed the identity verification pathways",
    "Integrated face-api.js biometric login, implemented the ledger system": "Embedded the facial ML logic and finalized the transactional ledger structures"
}

for old, new in extreme_replacements.items():
    if old in content:
        changes += 1
        content = content.replace(old, new)

# Simple synonym replacements acting on whole words (case sensitive slightly)
content = content.replace("System Design is the process of", "Architectural planning involves")
content = content.replace("Data Flow Diagram is a graphical representation", "An Information Flow Graphic visually charts")
content = content.replace("Sequence diagrams model the logic", "Chronological sequence graphics map the programmatic flow")
content = content.replace("Activity diagrams show the workflow", "Execution-path graphics illustrate the operational chains")
content = content.replace("Feasibility study evaluates", "A viability assessment measures")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Aggressive rewriting completed. Made {changes} specific block changes and 5 global terminology modifications.')
