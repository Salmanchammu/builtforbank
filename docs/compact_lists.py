import re

filepath = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

def compact_list(section_header, text):
    # Find the section and all bullet items starting with ●
    pattern = rf'({re.escape(section_header)}\n)(● .*?(?=\n\n|\n#|\Z))'
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return text
    
    header = match.group(1)
    list_content = match.group(2).strip()
    
    # Split items by newline
    items = [i.strip() for i in list_content.split('\n') if i.strip().startswith('●')]
    # Join items with a bullet character
    compacted = " ".join(items)
    
    return text.replace(match.group(0), header + compacted)

# Apply to Objectives
text = compact_list('## 1.3 OBJECTIVES', text)

# Apply to Requirements
text = compact_list('### 1.5.1 HARDWARE REQUIREMENTS', text)
text = compact_list('### 1.5.2 SOFTWARE REQUIREMENTS', text)
text = compact_list('### 1.5.3 TOOLS/LANGUAGES USED', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Compacted lists in Chapter 1 as per user photos.")
