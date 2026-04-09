import re
import os

base_dir = r"c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2"
coding_md_path = os.path.join(base_dir, "coding_chapter6.md")
report_md_path = os.path.join(base_dir, "docs", "SmartBank_Project_Report.md")
frontend_js_dir = os.path.join(base_dir, "frontend", "js")

# Try to read with utf-16, fallback to utf-8
try:
    with open(coding_md_path, 'r', encoding='utf-16') as f:
        content = f.read()
except:
    with open(coding_md_path, 'r', encoding='utf-8') as f:
        content = f.read()

parts = re.split(r'^(## 6\.\d+\s+.*)', content, flags=re.MULTILINE)

preamble = parts[0]
sections = []
for i in range(1, len(parts), 2):
    header = parts[i].strip()
    body = parts[i+1]
    sections.append({'header': header, 'body': body})

print(f"Total sections found in coding_chapter6.md: {len(sections)}")
for s in sections:
    print(s['header'])

