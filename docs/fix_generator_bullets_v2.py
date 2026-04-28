import re

pdf_script = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\generate_pdf.py'
with open(pdf_script, 'r', encoding='utf-8') as f:
    pdf_code = f.read()

# Improved split logic to handle abbreviations and HTML tags
def make_bullet_code_v2(var_names):
    code_blocks = []
    for var in var_names:
        code_blocks.append(f"""    # Bullet-point splitting logic for {var}
    {var}_clean = {var}.replace("Asst.", "Asst_DOT_").replace("Prof.", "Prof_DOT_").replace("Dr.", "Dr_DOT_")
    for sentence in re.split(r'\\.\\s*', {var}_clean):
        sentence = sentence.strip()
        if sentence:
            sentence = sentence.replace("Asst_DOT_", "Asst.").replace("Prof_DOT_", "Prof.").replace("Dr_DOT_", "Dr.")
            # Basic tag balanced check for <b>
            if sentence.count("<b>") > sentence.count("</b>"):
                sentence += "</b>"
            elif sentence.count("</b>") > sentence.count("<b>"):
                sentence = "<b>" + sentence
                
            style = ParagraphStyle('BulletPoint', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY, leftIndent=30, firstLineIndent=-15)
            elements.append(Paragraph(f"&bull; {{sentence}}.", style))
            elements.append(Spacer(1, 8))""")
    return "\n".join(code_blocks)

# Fix create_declaration_page
decl_old = r'def create_declaration_page\(styles\):.*?return elements'
decl_new = f"""def create_declaration_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("DECLARATION", ParagraphStyle('DecTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text1 = "I hereby declare that the project work detail which is being presented in this report is in fulfillment of the requirement for the award of degree of Bachelor of Computer Application."
    text2 = "I hereby declare that I have undertaken our project work on 'SMART BANK' under the guidance of Asst. Professor Nikshitha M, Professor, Department of Computer Science and Information Science, Srinivas University, Mangalore."
    text3 = "I hereby declare that this project work report is my own work and the best of our knowledge and belief the matter embedded in report has not been submitted by us for the award of other degree to this or any other university."
    
{make_bullet_code_v2(['text1', 'text2', 'text3'])}
    
    elements.append(Spacer(1, 60))
    
    data = [
        [Paragraph("Place: Mangalore", styles['BodyText12']), Paragraph("Mr. Salman (03SU22SD000)", styles['BodyText12'])],
        [Paragraph("Date: 14-05-2025", styles['BodyText12']), ""]
    ]
    t = Table(data, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t.setStyle(TableStyle([('ALIGN', (0,0), (0,-1), 'LEFT'), ('ALIGN', (1,0), (1,-1), 'RIGHT'), ('BOTTOMPADDING', (0,0), (-1,-1), 10)]))
    elements.append(t)
    
    elements.append(PageBreak())
    return elements"""

# Fix create_acknowledgement_page
ack_old = r'def create_acknowledgement_page\(styles\):.*?return elements'
ack_new = f"""def create_acknowledgement_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("ACKNOWLEDGEMENT", ParagraphStyle('AckTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text = "We would like to express our deep sense of gratitude to our guide <b>Asst. Professor Nikshitha M</b>, Professor, Department of Computer Science and Information Science, Srinivas University, for her valuable guidance and continuous encouragement throughout this project."
    text2 = "We also extend our sincere thanks to the Dean and all faculty members of the Institute of Computer Science and Information Science for providing the necessary facilities and support."
    
{make_bullet_code_v2(['text', 'text2'])}
    
    elements.append(Spacer(1, 80))
    
    data = [
        ["", Paragraph("Mr. Salman (03SU22SD000)", styles['BodyBold'])]
    ]
    t = Table(data, colWidths=[A4[0]/2, A4[0]/2 - MARGIN*2])
    t.setStyle(TableStyle([('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(t)
    
    elements.append(PageBreak())
    return elements"""

# Fix create_abstract_page
abs_old = r'def create_abstract_page\(styles\):.*?return elements'
abs_new = f"""def create_abstract_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("ABSTRACT", ParagraphStyle('AbsTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text = "Smart Bank is an advanced digital banking and biometric security platform designed to integrate core banking operations with modern facial recognition technology and specialized financial tools for the agricultural sector. The system is built using Python, Flask, SQLite, and vanilla HTML5/CSS3/JavaScript."
    text2 = "Key features include a browser-based biometric authentication mechanism utilizing face-api.js, eliminating the sole reliance on traditional text-based credentials. Furthermore, the platform pioneers a specialized 'Agriculture Hub' enabling satellite-verified farm loan assessments and a secure B2B crop marketplace."
    
{make_bullet_code_v2(['text', 'text2'])}
    
    elements.append(PageBreak())
    return elements"""

pdf_code = re.sub(decl_old, decl_new, pdf_code, flags=re.DOTALL)
pdf_code = re.sub(ack_old, ack_new, pdf_code, flags=re.DOTALL)
pdf_code = re.sub(abs_old, abs_new, pdf_code, flags=re.DOTALL)

with open(pdf_script, 'w', encoding='utf-8') as f:
    f.write(pdf_code)

print("Fixed generate_pdf.py prelim pages with robust bullet point splitting.")
