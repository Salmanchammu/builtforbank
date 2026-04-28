import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

humanize_dict = {
    # Chapter 1
    '"Smart Bank" represents a strong, multi-layered fintech solution conceived to address the growing necessity for dependable, easily reachable, and stringently secured monetary service delivery.':
        '"Smart Bank" is a comprehensive web-based banking application designed to provide secure and easy-to-use financial services.',
    'To utilize `face-api.js` for high-accuracy biometric login, replacing or supplementing traditional password systems.':
        'Use `face-api.js` for face recognition login, which provides a secure alternative to traditional passwords.',
    'Provide users with real-time "Eye" toggle buttons for secure balance masking on public screens.':
        'Add an "Eye" toggle button so users can hide or show their account balance for better privacy.',
    'Enable customers to generate and download professional PDF statements with precision filters':
        'Allow customers to filter their transaction history and download PDF account statements',
    'Rationalize the approval process for new account openings, card applications, and loan requests via Staff and Admin control centers.':
        'Streamline how bank staff and admins approve new accounts, debit cards, and loan applications.',
    'To provide specialized 7.5% p.a. Farm loans utilizing AI-driven satellite land verification and precision crop health analyses.':
        'Offer special 7.5% p.a. farm loans to farmers, verified using satellite maps and land checks.',
    'Expedite a dedicated marketplace for farmers to list and sell agricultural produce directly through the platform.':
        'Provide a marketplace section where farmers can list and sell their crops directly to buyers.',
    'Realization of **Pockets (Savings Goals)** to encourage user financial discipline and goal-based budgeting.':
        'Create a **Pockets (Savings Goals)** feature to help users save money for specific targets.',
    'Provide simulated access to **Fixed Deposits (8.5% p.a.)**, **Mutual Funds**, and **Life Insurance** modules for wealth growth.':
        'Include simulated options for **Fixed Deposits (8.5% p.a.)**, **Mutual Funds**, and **Life Insurance**.',
    'To give users a 360-degree view of their monthly income and spending habits using interactive **Chart.js** visualizations.':
        'Show users a visual breakdown of their income and expenses using interactive **Chart.js** graphs.',
    'Provide a risk-free environment for users to scan local QR codes and perform simulated UPI payments with instant 256-bit receipt generation.':
        'Allow users to practice scanning QR codes and making simulated UPI payments with instant receipts.',
    'Simplify user communication through an integrated support system with priority-based ticket tracking.':
        'Add a customer support ticket system where users can ask for help and staff can reply.',
    'Guarantee maximum data integrity through encrypted session handling, mobile passcodes, and transaction-specific audit logging.':
        'Ensure user data is kept safe using encrypted sessions, PIN codes, and proper transaction logs.',

    # Overly formal phrasing across chapters
    'pivotal': 'important',
    'deploying': 'using',
    'utilizing': 'using',
    'conducive': 'helpful',
    'fosters': 'helps build',
    'leverage': 'use',
    'seamlessly': 'easily',
    'seamless': 'smooth',
    'comprehensive': 'complete',
    'cutting-edge': 'modern',
    'facilitate': 'help',
    'robust': 'strong',
    'paradigm': 'model',
    'holistic': 'complete',
    'optimal': 'best',
    'mitigate': 'reduce',
    'expedite': 'speed up',
    'incorporation': 'integration',
    'augmented': 'improved',
    'amalgamation': 'combination',
    'orchestrate': 'manage',
    'consequently': 'as a result',
    'furthermore': 'also',
    'in addition to': 'along with',
    'meticulously': 'carefully',
    'delineates': 'describes',
    'subsequently': 'then',
    'procedural progression': 'step-by-step process',
    'chronological axis': 'timeline',
    'constituent parts': 'components',
    'interconnection surfaces': 'connection points',
    'safeguarded information transit': 'secure data transfer',
    'physiological computation engines': 'biometric systems',
    'peripheral actors': 'external users',
    'graphically traces the transit': 'visually tracks the movement',
    'information parcels': 'data',
    'procedural transformations': 'changes',
    'steering workforce profiles': 'managing employee accounts',
    'institutional capital pools': 'bank funds',
    'macro-level infrastructure parameters': 'system settings',
    'personnel tier': 'staff dashboard',
    'account holder tier': 'customer dashboard',
    'diversified ledger operations': 'various banking transactions',
    'profile archetype': 'account type',
    'elevated operational rights': 'admin access',
    'fraudulent activity incidents': 'suspicious activities',
    'liquid reserves': 'available funds',
    'geospatial images': 'map photos',
    'systemic trails': 'system logs',
    'policy modifications': 'setting changes',
    'enforced login tracking': 'tracked logins',
    'approval workflow pipelines': 'approval processes',
    'issuance workflows': 'issuance processes',
    'assessing farmer profiles': 'reviewing farmer applications',
    'evaluating land yield metrics': 'checking land details',
    'agriculture credit subsidies': 'farm loans',
    'email escalations': 'email support',
    'localized user notifications': 'user alerts',
    'pivotal alerts': 'important alerts',
    'highly compliant onboarding systems': 'secure registration processes',
    'biometric Face ID': 'Face ID',
    'document verification pathways': 'document checks',
    'segmented transaction history analytics': 'detailed transaction history',
    'peer-to-peer or peer-to-business liquidity transfers': 'money transfers',
    'beneficiary lifecycle management': 'beneficiary management',
    'designated funds': 'specific money',
    'target-oriented savings vaults': 'savings goals',
    'progress visualizers': 'progress bars',
    'fully interactive': 'interactive',
    'spatial map': 'map',
    'navigate to the nearest': 'find the closest',
    'granual design stage': 'detailed design phase',
    'partitioning the application': 'splitting the app',
    'self-contained operational units': 'separate modules',
    'visual layout specifications': 'UI designs',
    'routing arbitration logic': 'URL routing',
    'service-tier processing conduits': 'backend processing logic',
    'methodically compartmentalized': 'carefully separated',
    'sophisticated web-app architecture': 'modern web structure',
}

# Apply dictionary replacements
for old, new in humanize_dict.items():
    if old in content:
        content = content.replace(old, new)
        changes += 1

# Additional regex replacements for single words to avoid breaking case
words_to_replace = {
    r'\bUtilize\b': 'Use',
    r'\butilize\b': 'use',
    r'\bLeverage\b': 'Use',
    r'\bleverage\b': 'use',
    r'\bComprehensive\b': 'Detailed',
    r'\bcomprehensive\b': 'detailed',
    r'\bSeamless\b': 'Smooth',
    r'\bseamless\b': 'smooth',
    r'\bRobust\b': 'Strong',
    r'\brobust\b': 'strong',
    r'\bFacilitate\b': 'Help',
    r'\bfacilitate\b': 'help',
}

for pattern, replacement in words_to_replace.items():
    content, count = re.subn(pattern, replacement, content)
    changes += count

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Humanization complete: {changes} replacements made to remove AI phrasing.')
