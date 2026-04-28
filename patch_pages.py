import re
from reportlab.lib.units import inch

with open(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\docs\generate_pdf.py', 'r', encoding='utf-8') as f:
    content = f.read()

pages_code = """# ─── COVER PAGE ───────────────────────────────────────────────────────────────
def create_cover_page(styles):
    elements = []
    elements.append(Spacer(1, 1.5 * inch))
    
    elements.append(Paragraph("SMART BANK", ParagraphStyle('CoverTitleBig', fontName=FONT_BOLD, fontSize=24, alignment=TA_CENTER, leading=30)))
    elements.append(Spacer(1, 1 * inch))
    
    elements.append(Paragraph("Submitted to Srinivas University", ParagraphStyle('CoverSub', fontName=FONT_NAME, fontSize=14, alignment=TA_CENTER)))
    elements.append(Spacer(1, 1.5 * inch))
    
    elements.append(Paragraph("Under the guidance of:", ParagraphStyle('CoverText', fontName=FONT_NAME, fontSize=14, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("<b>Asst. Professor Nikshitha M</b>", ParagraphStyle('CoverGuide', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 2 * inch))
    elements.append(Paragraph("<b>INSTITUTE OF COMPUTER SCIENCE AND INFORMATION SCIENCE</b>", ParagraphStyle('CoverDept', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("<b>SRINIVAS UNIVERSITY</b>", ParagraphStyle('CoverUni', fontName=FONT_BOLD, fontSize=18, alignment=TA_CENTER)))
    
    elements.append(PageBreak())
    return elements

def create_certificate_page(styles):
    elements = []
    elements.append(Paragraph("SRINIVAS UNIVERSITY", ParagraphStyle('CertUni', fontName=FONT_BOLD, fontSize=26, alignment=TA_CENTER, textColor=HexColor('#1e3a8a'))))
    elements.append(Paragraph("Srinivas Nagar, Mukka - 574 146", ParagraphStyle('CertAddress', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Paragraph("<b>(Private University Established by Karnataka Govt. ACT No.42 of 2013, Recognized by UGC, New Delhi &amp; Member of Association of Indian Universities, New Delhi)</b>", ParagraphStyle('CertDetails', fontName=FONT_BOLD, fontSize=11, alignment=TA_CENTER)))
    elements.append(Paragraph("Web : www.srinivasuniversity.edu.in , Email: info@srinivasuniversity.edu.in", ParagraphStyle('CertWeb', fontName=FONT_NAME, fontSize=11, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=1, color=black))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("INSTITUTE OF COMPUTER SCIENCE AND INFORMATION SCIENCE", ParagraphStyle('CertInst', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER, textColor=HexColor('#800000'))))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("C E R T I F I C A T E", ParagraphStyle('CertTitle', fontName=FONT_BOLD, fontSize=20, alignment=TA_CENTER, textColor=black)))
    
    elements.append(Spacer(1, 30))
    text = "This is to certify that the project work entitled \"<b>SMART BANK</b>\" carried out by <b>Mr./Ms. Salman (Registration No. ________)</b>, a bonafide student of this institution, in partial fulfillment for the award of Degree <b>B.C.A</b> at Srinivas University, Pandeshwara, Mangaluru - 575 001 during the academic year 2024-2025. It is also certified that the corrections/suggestions given during internal assessment have been incorporated in the report. The project report has been approved as it satisfies the academic requirements in respect of Project Work prescribed for the said degree."
    elements.append(Paragraph(text, ParagraphStyle('CertBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    
    elements.append(Spacer(1, 60))
    
    # Signatures
    data = [
        [Paragraph("<b>Name &amp; Signature of the Guide</b>", styles['BodyText12']), Paragraph("<b>Name &amp; Signature of the Dean</b>", styles['BodyText12'])]
    ]
    t = Table(data, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t.setStyle(TableStyle([('ALIGN', (0,0), (0,0), 'LEFT'), ('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(t)
    
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("<b>External Viva :</b>", styles['H3']))
    elements.append(Spacer(1, 20))
    
    data2 = [
        [Paragraph("<b>Name of the Examiners</b>", styles['BodyText12']), Paragraph("<b>Signature with Date</b>", styles['BodyText12'])],
        [Paragraph("<b>1.</b>", styles['BodyText12']), ""],
        [Paragraph("<b>2.</b>", styles['BodyText12']), ""]
    ]
    t2 = Table(data2, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t2.setStyle(TableStyle([('ALIGN', (0,0), (0,-1), 'LEFT'), ('ALIGN', (1,0), (1,-1), 'RIGHT'), ('BOTTOMPADDING', (0,0), (-1,-1), 15)]))
    elements.append(t2)
    
    elements.append(PageBreak())
    return elements

def create_declaration_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("DECLARATION", ParagraphStyle('DecTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text1 = "I hereby declare that the project report is in fulfillment of the requirements for the degree of Bachelor of Computer Application."
    elements.append(Paragraph(text1, ParagraphStyle('DecBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    elements.append(Spacer(1, 15))
    
    text2 = "I hereby declare that I have undertaken the project work under the guidance of <b>Asst. Professor Nikshitha M</b>."
    elements.append(Paragraph(text2, ParagraphStyle('DecBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    elements.append(Spacer(1, 15))
    
    text3 = "I hereby declare that this project report is our original work and to our knowledge and belief the matter presented in this report has not been submitted by us for the award of any other degree."
    elements.append(Paragraph(text3, ParagraphStyle('DecBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    
    elements.append(Spacer(1, 60))
    
    data = [
        [Paragraph("<b>Place: Mangalore</b>", styles['BodyText12']), Paragraph("<b>Signature:</b>", styles['BodyText12'])],
        [Paragraph("<b>Date: 14-05-2025</b>", styles['BodyText12']), ""]
    ]
    t = Table(data, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t.setStyle(TableStyle([('ALIGN', (0,0), (0,-1), 'LEFT'), ('ALIGN', (1,0), (1,-1), 'RIGHT'), ('BOTTOMPADDING', (0,0), (-1,-1), 10)]))
    elements.append(t)
    
    elements.append(PageBreak())
    return elements

# ─── TABLE OF CONTENTS ────────────────────────────────────────────────────────"""

content = re.sub(r'# ─── COVER PAGE ───────────────────────────────────────────────────────────────.*?# ─── TABLE OF CONTENTS ────────────────────────────────────────────────────────', pages_code, content, flags=re.DOTALL)

# Now update the main call
main_update = """    story = []
    story.extend(create_cover_page(styles))
    story.extend(create_certificate_page(styles))
    story.extend(create_declaration_page(styles))
    story.extend(create_toc(styles))"""

content = re.sub(r'    story = \[\]\n    story\.extend\(create_cover_page\(styles\)\)\n    story\.extend\(create_toc\(styles\)\)', main_update, content)

with open(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\docs\generate_pdf.py', 'w', encoding='utf-8') as f:
    f.write(content)
