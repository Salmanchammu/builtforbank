import re

# 1. Update SmartBank_Project_Report.md
filepath = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Extract Chapter 1
ch1_match = re.search(r'(# CHAPTER-1: SYNOPSIS.*?)(?=# CHAPTER-2: SOFTWARE REQUIREMENT AND SPECIFICATION)', text, re.DOTALL)

if ch1_match:
    ch1_text = ch1_match.group(1)
    
    # We will slice ch1_text by headers
    # Find all header positions
    headers = list(re.finditer(r'^(##+ .*)$', ch1_text, re.MULTILINE))
    
    parts = []
    
    # Add text before first header (Title, etc)
    parts.append(ch1_text[:headers[0].start()])
    
    # Process each section
    for i in range(len(headers)):
        start = headers[i].start()
        end = headers[i+1].start() if i + 1 < len(headers) else len(ch1_text)
        section = ch1_text[start:end]
        
        # Keep 1.1, 1.2
        if '1.1 TITLE' in section or '1.2 INTRO' in section:
            parts.append(section)
        # Keep 1.5 Objectives -> map to 1.3
        elif '1.5 OBJECTIVES' in section:
            section = section.replace('1.5 OBJECTIVES', '1.3 OBJECTIVES')
            parts.append(section)
        # Keep 1.6 Category -> map to 1.4
        elif '1.6 PROJECT CATEGORY' in section:
            section = section.replace('1.6 PROJECT CATEGORY', '1.4 PROJECT CATEGORY')
            parts.append(section)
        # Keep 1.8 Tools -> map to 1.5
        elif '1.8 TOOLS' in section:
            section = section.replace('1.8 TOOLS/PLATFORM, HARDWARE AND SOFTWARE REQUIREMENT SPECIFICATIONS', '1.5 TOOLS/PLATFORM, HARDWARE AND SOFTWARE REQUIREMENT SPECIFICATIONS')
            parts.append(section)
        elif '1.8.1 HARDWARE' in section:
            section = section.replace('1.8.1 HARDWARE REQUIREMENTS', '1.5.1 HARDWARE REQUIREMENTS')
            parts.append(section)
        elif '1.8.2 SOFTWARE' in section:
            section = section.replace('1.8.2 SOFTWARE REQUIREMENTS', '1.5.2 SOFTWARE REQUIREMENTS')
            parts.append(section)
        elif '1.8.3 TOOLS' in section:
            section = section.replace('1.8.3 TOOLS/LANGUAGES USED', '1.5.3 TOOLS/LANGUAGES USED')
            parts.append(section)
        # Discard everything else
        
    new_ch1_text = "".join(parts)
    text = text.replace(ch1_match.group(1), new_ch1_text)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)


import re

# 2. Update generate_pdf.py TOC
pdf_script = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\generate_pdf.py'
with open(pdf_script, 'r', encoding='utf-8') as f:
    pdf_code = f.read()

old_toc_ch1 = """        ("Chapter 1", "Synopsis"),
        ("", "1.1 Title of the Project"),
        ("", "1.2 Introduction"),
        ("", "1.3 Problem Statement"),
        ("", "1.4 Motivation"),
        ("", "1.5 Objectives"),
        ("", "1.6 Project Category"),
        ("", "1.7 Project Scope"),
        ("", "1.8 Tools/Platform and Requirements"),
        ("", "1.9 Development Methodology"),"""

new_toc_ch1 = """        ("1.SYNOPSIS", ""),
        ("", "CHAPTER-1"),
        ("", "1.1 Title of the project"),
        ("", "1.2 Introduction"),
        ("", "1.3 Objectives"),
        ("", "1.4 Project Category"),
        ("", "1.5 Tools/platform,hardware and software requirement specifications"),
        ("", "1.5.1 Hardware Requirements"),
        ("", "1.5.2 Software Requirements"),
        ("", "1.5.3 Tools/languages used"),"""

# In case the exact TOC text is slightly different, let's use regex
toc_match = re.search(r'\("Chapter 1", "Synopsis"\),.*?\("Chapter 2", "Software Requirement and Specification"\),', pdf_code, re.DOTALL)
if toc_match:
    replacement = new_toc_ch1 + '\n        ("Chapter 2", "Software Requirement and Specification"),'
    pdf_code = pdf_code.replace(toc_match.group(0), replacement)
    
    with open(pdf_script, 'w', encoding='utf-8') as f:
        f.write(pdf_code)

print("Chapter 1 sliced successfully")
