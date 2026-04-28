import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Extract 1.2 Introduction
intro_match = re.search(r'(## 1\.2 INTRODUCTION)(.*?)(?=## 1\.3 OBJECTIVES)', text, re.DOTALL)

if intro_match:
    header = intro_match.group(1)
    content = intro_match.group(2).strip()
    
    # Split content into paragraphs first
    paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
    
    new_content_lines = []
    for p in paragraphs:
        # Split paragraph into sentences by dot
        # Using a simple split, keeping the dot
        sentences = re.split(r'(?<=\.)\s+', p)
        for s in sentences:
            if s.strip():
                new_content_lines.append(f"● {s.strip()}")
    
    new_intro = header + "\n" + "\n".join(new_content_lines) + "\n\n"
    text = text.replace(intro_match.group(0), new_intro)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated Chapter 1.2 Introduction to be point-wise.")
