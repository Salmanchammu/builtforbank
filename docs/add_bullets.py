import re

pdf_script = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\generate_pdf.py'
with open(pdf_script, 'r', encoding='utf-8') as f:
    pdf_code = f.read()

# Helper macro to replace text with bullet points
def text_to_bullets_code(var_name):
    return f"""    for sentence in {var_name}.split('.'):
        sentence = sentence.strip()
        if sentence:
            style = ParagraphStyle('BulletPoint', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY, leftIndent=30, firstLineIndent=-15)
            elements.append(Paragraph(f"&bull; {{sentence}}.", style))
            elements.append(Spacer(1, 8))"""

# Fix abstract
pdf_code = re.sub(
    r'elements\.append\(Paragraph\((text), ParagraphStyle\(\'AbsBody\'.*?\)\)',
    text_to_bullets_code(r'\1'),
    pdf_code
)
pdf_code = re.sub(
    r'elements\.append\(Paragraph\((text2), ParagraphStyle\(\'AbsBody\'.*?\)\)',
    text_to_bullets_code(r'\1'),
    pdf_code
)

# Fix acknowledgement
pdf_code = re.sub(
    r'elements\.append\(Paragraph\((text), ParagraphStyle\(\'AckBody\'.*?\)\)',
    text_to_bullets_code(r'\1'),
    pdf_code
)
pdf_code = re.sub(
    r'elements\.append\(Paragraph\((text2), ParagraphStyle\(\'AckBody\'.*?\)\)',
    text_to_bullets_code(r'\1'),
    pdf_code
)

# Fix declaration
pdf_code = re.sub(
    r'elements\.append\(Paragraph\((text1), ParagraphStyle\(\'DecBody\'.*?\)\)',
    text_to_bullets_code(r'\1'),
    pdf_code
)
pdf_code = re.sub(
    r'elements\.append\(Paragraph\((text2), ParagraphStyle\(\'DecBody\'.*?\)\)',
    text_to_bullets_code(r'\1'),
    pdf_code
)
pdf_code = re.sub(
    r'elements\.append\(Paragraph\((text3), ParagraphStyle\(\'DecBody\'.*?\)\)',
    text_to_bullets_code(r'\1'),
    pdf_code
)

with open(pdf_script, 'w', encoding='utf-8') as f:
    f.write(pdf_code)

print("Updated generate_pdf.py to split prelim pages by dot to bullet points.")
