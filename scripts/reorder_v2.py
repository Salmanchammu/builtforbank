import re
import os

base_dir = r"c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2"
coding_md_path = os.path.join(base_dir, "coding_chapter6.md")
report_md_path = os.path.join(base_dir, "docs", "SmartBank_Project_Report.md")
frontend_js_dir = os.path.join(base_dir, "frontend", "js")

def get_js_snippet(filename, size=600):
    try:
        with open(os.path.join(frontend_js_dir, filename), 'r', encoding='utf-8') as f:
            content = f.read(size)
            # Find the last newline to not cut off in the middle of a line
            last_nl = content.rfind('\n')
            if last_nl != -1:
                content = content[:last_nl]
            return content
    except Exception as e:
        return f"/* Could not load snippet: {str(e)} */"

with open(coding_md_path, 'r', encoding='utf-8') as f:
    content = f.read()

parts = re.split(r'^(## 6\.\d+\s+.*)', content, flags=re.MULTILINE)

preamble = parts[0]
sections = []
for i in range(1, len(parts), 2):
    header = parts[i].strip()
    body = parts[i+1]
    sections.append({'header': header, 'body': body})

def get_section(search_str):
    for s in sections:
        if search_str in s['header']:
            return s
    return None

def extract_title(header):
    return re.sub(r'^## 6\.\d+\s+(.*)', r'\1', header)

new_js_logic = [
    {
        'header': 'Placeholder',
        'title': 'Frontend — Admin Dashboard Logic (`admindash.js`)',
        'body': f'\nThis module handles administrative functionalities such as user role management, system auditing, and global platform controls. It interfaces with the backend REST APIs.\n\n```javascript\n{get_js_snippet("admindash.js", 800)}\n// ... code continues\n```\n'
    },
    {
        'header': 'Placeholder',
        'title': 'Frontend — Staff Dashboard Logic (`staffdash.js`)',
        'body': f'\nStaff operations are controlled via this module, which handles the secure processing of KYC document reviews, account request approvals, and agriculture loan tracking.\n\n```javascript\n{get_js_snippet("staffdash.js", 800)}\n// ... code continues\n```\n'
    },
    {
        'header': 'Placeholder',
        'title': 'Frontend — Mobile UI Logic (`mobile-logic.js`)',
        'body': f'\nOptimized for touch interfaces, this script drives the Progressive Web App (PWA) experience. It manages bottom-sheet navigations and real-time balance toggling.\n\n```javascript\n{get_js_snippet("mobile-logic.js", 800)}\n// ... code continues\n```\n'
    },
    {
        'header': 'Placeholder',
        'title': 'Frontend — Virtual Assistant (`chatbot.js`)',
        'body': f'\nThis component provides an interactive customer support assistant. It uses rule-based matching and natural language parsing to intercept common queries.\n\n```javascript\n{get_js_snippet("chatbot.js", 800)}\n// ... code continues\n```\n'
    }
]

group_A_strs = ['6.1 Introduction', '6.2 Development Environment']
group_B_strs = [
    '6.17 FRONTEND', '6.18 FRONTEND', '6.19 FRONTEND', '6.20 FRONTEND', '6.21 FRONTEND',
    '6.22 FRONTEND', '6.23 FRONTEND', '6.24 FRONTEND', '6.25 FRONTEND', '6.26 FRONTEND',
    '6.27 FRONTEND', '6.28 Frontend File Map Summary'
]
group_C_strs = ['6.13 Frontend — Face Authentication', '6.14 Frontend — User Dashboard SPA']
group_D_strs = [
    '6.3 Backend Architecture', '6.4 Core Module', '6.5 Core Module', '6.6 Core Module',
    '6.7 Core Module', '6.8 Core Module', '6.9 USER MODULE', '6.10 USER MODULE',
    '6.11 STAFF MODULE', '6.12 ADMIN MODULE', '6.16 API Route Summary', '6.15 System Integration'
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

with open(report_md_path, 'r', encoding='utf-8') as f:
    report_lines = f.readlines()

new_report_lines = report_lines[:906]

with open(report_md_path, 'w', encoding='utf-8') as f:
    f.writelines(new_report_lines)
    f.write(''.join(new_chapter6_lines))

print(f"Successfully integrated Chapter 6 into {report_md_path}. Sections used: {len(ordered_sections)}")
