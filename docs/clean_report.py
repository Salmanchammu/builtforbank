import re

file_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace 3+ consecutive newlines with 2 newlines
content = re.sub(r'\n{3,}', '\n\n', content)

# 2. Replace multiple separators with a single one
# Separator is --- maybe with some whitespace around it
content = re.sub(r'(\s*\n---\s*\n)+', '\n\n---\n\n', content)

# 3. Fix trailing spaces on lines
content = '\n'.join([line.rstrip() for line in content.splitlines()])

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleanup complete.")
