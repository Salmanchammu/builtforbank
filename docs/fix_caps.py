"""
Fix capitalization issues caused by word-level synonym swaps.
Ensures proper casing at sentence/bullet starts.
"""
import re
import os

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

fixes = 0

# Fix specific known issues from the synonym swaps
capitalization_fixes = {
    '● **incorporated Agri-Commerce': '● **Incorporated Agri-Commerce',
    '● **exhaustive Investment': '● **Exhaustive Investment',
    'rationalize the approval process': 'Rationalize the approval process',
    'realization of **Pockets': 'Realization of **Pockets',
    '**exhaustive Browser-Hosted': '**Exhaustive Browser-Hosted',
    'expedite a dedicated marketplace': 'Expedite a dedicated marketplace',
    'incorporated support system': 'integrated support system',
    'guarantee maximum data integrity': 'Guarantee maximum data integrity',
    'deploying AI-driven': 'utilizing AI-driven',
}

for old, new in capitalization_fixes.items():
    if old in content:
        content = content.replace(old, new)
        fixes += 1

# General fix: After ● ** or bullet starts, capitalize the next word
# Fix pattern: ● **lowercase -> ● **Uppercase
def fix_bullet_cap(m):
    return m.group(1) + m.group(2).upper()

content = re.sub(r'(● \*\*)([a-z])', fix_bullet_cap, content)

# Fix sentences starting with lowercase after periods
def fix_sentence_cap(m):
    return m.group(1) + m.group(2).upper()

content = re.sub(r'(\. )([a-z])', fix_sentence_cap, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Capitalization fixes applied: {fixes} specific + pattern-based corrections.')
