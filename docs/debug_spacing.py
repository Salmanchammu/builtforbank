"""
Debug: show paragraph spacing and formatting around section 2.2.4
"""
from docx import Document
from docx.shared import Pt

INPUT = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Final_Submit.docx'

doc = Document(INPUT)

# Find paragraphs around "2.2.4" or "General Constraints"
for i, p in enumerate(doc.paragraphs):
    if i < 80 or i > 130:
        continue
    text = p.text.strip()[:80] if p.text.strip() else "(EMPTY)"
    style = p.style.name if p.style else "None"
    
    # Get spacing
    pf = p.paragraph_format
    space_before = pf.space_before
    space_after = pf.space_after
    line_spacing = pf.line_spacing
    
    # Check for page break
    has_break = 'w:br' in p._element.xml and 'page' in p._element.xml
    
    # Font size from first run
    font_size = None
    if p.runs:
        font_size = p.runs[0].font.size
    
    print(f"[{i:3d}] Style={style:20s} | SpBefore={str(space_before):10s} SpAfter={str(space_after):10s} | FontSz={str(font_size):10s} | Break={has_break} | {text}")
