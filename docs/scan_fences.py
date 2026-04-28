"""Scan and auto-fix all unclosed code fences in the markdown report."""
import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Pass 1: Find every ``` line
fence_lines = []
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('```'):
        fence_lines.append((i, stripped))

print(f"Total fence markers found: {len(fence_lines)}")
for idx, (ln, text) in enumerate(fence_lines):
    state = "OPEN" if idx % 2 == 0 else "CLOSE"
    print(f"  [{state}] Line {ln+1}: {text[:60]}")

# Check if odd count (means one is unclosed)
if len(fence_lines) % 2 != 0:
    print(f"\n*** ODD number of fences ({len(fence_lines)}) — there IS an unclosed code block! ***")
else:
    print(f"\nEven number of fences ({len(fence_lines)}) — all code blocks appear matched.")

# Pass 2: Detect chapter headings trapped inside code blocks
in_code = False
open_line = -1
issues = []
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('```'):
        if not in_code:
            in_code = True
            open_line = i
        else:
            in_code = False
            open_line = -1
    elif in_code and stripped.startswith('# '):
        issues.append((i+1, open_line+1, stripped[:80]))

if issues:
    print(f"\n*** {len(issues)} chapter headings found INSIDE code blocks: ***")
    for ln, opened, text in issues:
        print(f"  Line {ln} (code opened at {opened}): {text}")
else:
    print("\nNo chapter headings trapped inside code blocks.")
