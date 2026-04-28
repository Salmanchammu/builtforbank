"""Trim excess content to bring page count from 186 to ~160 pages."""
import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# 1. Remove Section 9.6 (Exhaustive Scenario Operation Manual) - ~8 pages of verbose edge case scenarios
content = re.sub(
    r'## 9\.6 Exhaustive Scenario Operation Manual.*?(?=# 10\. CONCLUSION)',
    '', content, flags=re.DOTALL
)
print("Removed: Section 9.6 (Exhaustive Scenario Manual)")

# 2. Remove Section 5.10 (DFD Narrative Walkthroughs) - ~6 pages of verbose engine descriptions
content = re.sub(
    r'## 5\.10 Exhaustive Data Flow Diagram.*?(?=# 6\. CODING)',
    '', content, flags=re.DOTALL
)
print("Removed: Section 5.10 (DFD Narrative Walkthroughs)")

# 3. Remove Section 7.5.4 (Maximum Saturation Boundary Tests) and 7.5.5 (Penetration Checklist) - ~4 pages
content = re.sub(
    r'### 7\.5\.4 Maximum Saturation Boundary.*?(?=# 8\. USER INTERFACE)',
    '', content, flags=re.DOTALL
)
print("Removed: Sections 7.5.4 & 7.5.5 (Boundary Tests & Penetration Checklist)")

# 4. Remove Section 4.7 (Comprehensive Data Dictionary) - ~6 pages of verbose column definitions  
content = re.sub(
    r'## 4\.7 Comprehensive Data Dictionary.*?(?=# 5\. DETAILED DESIGN)',
    '', content, flags=re.DOTALL
)
print("Removed: Section 4.7 (Data Dictionary)")

# 5. Remove Section 7.5.3 (duplicate Security Hardening Drills near Ch8) - ~2 pages
content = re.sub(
    r'### 7\.5\.3 Security Hardening Drills.*?(?=# 8\. USER INTERFACE)',
    '', content, flags=re.DOTALL
)
print("Removed: Section 7.5.3 (Security Hardening Drills duplicate)")

# Clean up multiple blank lines
content = re.sub(r'\n{4,}', '\n\n\n', content)

new_len = len(content)
print(f"\nTrimmed: {original_len - new_len:,} characters removed ({(original_len - new_len)*100//original_len}% reduction)")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved trimmed report.")
