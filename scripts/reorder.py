import re
import os
import codecs

base_dir = r"c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2"
coding_md_path = os.path.join(base_dir, "coding_chapter6.md")
report_md_path = os.path.join(base_dir, "docs", "SmartBank_Project_Report.md")
frontend_js_dir = os.path.join(base_dir, "frontend", "js")

def read_file_safely(filepath):
    try:
        with open(filepath, 'rb') as f:
            raw = f.read()
        if raw.startswith(codecs.BOM_UTF16_LE):
            return raw.decode('utf-16le')
        elif b'\x00' in raw:
            return raw.decode('utf-16le')
        else:
            return raw.decode('utf-8')
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return ""

content = read_file_safely(coding_md_path)
# Clean up any weird crlf issues
content = content.replace('\r\n', '\n').replace('\r', '\n')

parts = re.split(r'^(## 6\.\d+\s+.*)', content, flags=re.MULTILINE)

sections = []
for i in range(1, len(parts), 2):
    header = parts[i].strip()
    body = parts[i+1]
    sections.append({'header': header, 'body': body})

def get_section(search_str):
    for s in sections:
        # Avoid case sensitivity issues and normalize spaces
        if search_str.lower().replace(" ", "") in s['header'].lower().replace(" ", ""):
            return s
    return None

def extract_title(header):
    return re.sub(r'^## 6\.\d+\s+(.*)', r'\1', header)

def get_js_snippet(filename, lines=100):
    try:
        raw = read_file_safely(os.path.join(frontend_js_dir, filename))
        lines_arr = raw.replace('\r\n', '\n').split('\n')
        # Filter out massive base64 or long lines
        clean_lines = [l for l in lines_arr[:lines] if len(l) < 500]
        return '\n'.join(clean_lines)
    except Exception as e:
        return f"/* Error reading code: {e} */"

new_js_logic = [
    {
        'header': 'Placeholder',
        'title': 'Frontend — Admin Dashboard Logic (`admindash.js`)',
        'body': f'\nThis module handles administrative functionalities such as user role management, system auditing, and global platform controls. It tracks real-time statistics.\n\n```javascript\n{get_js_snippet("admindash.js", 80)}\n// ... code continues\n```\n'
    },
    {
        'header': 'Placeholder',
        'title': 'Frontend — Staff Dashboard Logic (`staffdash.js`)',
        'body': f'\nStaff operations are controlled via this module, securely processing KYC document reviews, account request approvals, and agriculture loan tracking via AJAX endpoints.\n\n```javascript\n{get_js_snippet("staffdash.js", 80)}\n// ... code continues\n```\n'
    },
    {
        'header': 'Placeholder',
        'title': 'Frontend — Mobile UI Logic (`mobile-logic.js`)',
        'body': f'\nOptimized for touch interfaces, this script drives the Progressive Web App (PWA) experience. It manages bottom-sheet navigations, biometric verification checks, and real-time balance toggling ("Eye" masking) for maximum privacy.\n\n```javascript\n{get_js_snippet("mobile-logic.js", 80)}\n// ... code continues\n```\n'
    },
    {
        'header': 'Placeholder',
        'title': 'Frontend — Virtual Assistant (`chatbot.js`)',
        'body': f'\nThis component provides an interactive customer support assistant. It categorizes intents based on natural language keywords to autonomously resolve user questions.\n\n```javascript\n{get_js_snippet("chatbot.js", 80)}\n// ... code continues\n```\n'
    }
]

group_A_strs = ['Introduction', 'Development Environment']
group_B_strs = [
    'FRONTEND — Landing Page', 'FRONTEND — User Login Page', 'FRONTEND — User Registration Page', 
    'FRONTEND — Forgot Password Page', 'FRONTEND — Reset Password Page',
    'FRONTEND — Staff & Admin Login', 'FRONTEND — Mobile Login', 'FRONTEND — Mobile Signup', 
    'FRONTEND — User Dashboard', 'FRONTEND — Staff Dashboard',
    'FRONTEND — Admin Dashboard', 'Frontend File Map Summary'
]
group_C_strs = ['Frontend — Face Authentication', 'Frontend — User Dashboard SPA']
group_D_strs = [
    'Backend Architecture', 'Database Layer', 'Authentication & Security', 
    'Input Validation', 'Email Service', 'Business Logic', 
    'USER MODULE — Authentication', 'USER MODULE — Banking',
    'STAFF MODULE', 'ADMIN MODULE', 'API Route Summary', 'System Integration'
]

ordered_sections = []

for s_name in group_A_strs:
    sec = get_section(s_name)
    if sec: ordered_sections.append(sec)

for s_name in group_B_strs:
    sec = get_section(s_name)
    if sec: ordered_sections.append(sec)

for s_name in group_C_strs:
    sec = get_section(s_name)
    if sec: ordered_sections.append(sec)

for n_js in new_js_logic:
    ordered_sections.append(n_js)

for s_name in group_D_strs:
    sec = get_section(s_name)
    if sec: ordered_sections.append(sec)

new_chapter6_lines = ["\n# 6. CODING\n# CHAPTER-6\n\n"]
current_num = 1
for sec in ordered_sections:
    title = sec.get('title') or extract_title(sec['header'])
    new_chapter6_lines.append(f"## 6.{current_num} {title}\n")
    new_chapter6_lines.append(sec['body'])
    current_num += 1

# Read the original up to line 906
old_report_content = read_file_safely(report_md_path).replace('\r\n', '\n')
report_lines = old_report_content.split('\n')
new_report_lines = [l + '\n' for l in report_lines[:906]]

try:
    with open(report_md_path, 'w', encoding='utf-8') as f:
        f.writelines(new_report_lines)
        f.write(''.join(new_chapter6_lines))
    print(f"SUCCESS: Integrated {len(ordered_sections)} sections correctly into {report_md_path}.")
except Exception as e:
    print(f"FAILED to write: {e}")

