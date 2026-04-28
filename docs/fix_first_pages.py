import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\generate_pdf.py'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

new_functions = """
def create_cover_page(styles):
    elements = []
    elements.append(Spacer(1, 1 * inch))
    
    elements.append(Paragraph("SRINIVAS   UNIVERSITY", ParagraphStyle('CoverUniT', fontName=FONT_BOLD, fontSize=20, alignment=TA_CENTER, spaceAfter=20)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("SMART BANK", ParagraphStyle('CoverTitleBig', fontName=FONT_BOLD, fontSize=24, alignment=TA_CENTER, textColor=MAROON, spaceAfter=20)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Submitted to Srinivas University on partial Completion of Sixth Semester", ParagraphStyle('CoverSub', fontName=FONT_NAME, fontSize=14, alignment=TA_CENTER)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Bachelor of Computer Application", ParagraphStyle('CoverDeg', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("By", ParagraphStyle('CoverBy', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Paragraph("Salman (03SU22SD000)", ParagraphStyle('CoverName', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("VI Semester BCA", ParagraphStyle('CoverSem', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Under the Guidance of", ParagraphStyle('CoverGuidT', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Paragraph("Asst. Professor Nikshitha M", ParagraphStyle('CoverGuide', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("Faculty of", ParagraphStyle('CoverFac', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Paragraph("Srinivas University Institute of Computer", ParagraphStyle('CoverInst1', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    elements.append(Paragraph("and Information Science", ParagraphStyle('CoverInst2', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    elements.append(Paragraph("Pandeshwar, Mangalore", ParagraphStyle('CoverLoc', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("2024-2025", ParagraphStyle('CoverYear', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    
    elements.append(PageBreak())
    return elements

def create_certificate_page(styles):
    elements = []
    elements.append(Paragraph("SRINIVAS UNIVERSITY", ParagraphStyle('CertUni', fontName=FONT_BOLD, fontSize=24, alignment=TA_CENTER)))
    elements.append(Paragraph("Srinivas Nagar, Mukka – 574 146, Mangaluru, Karnataka. Phone : 0824-2477456", ParagraphStyle('CertAddress', fontName=FONT_NAME, fontSize=11, alignment=TA_CENTER)))
    elements.append(Paragraph("(Private University Established by Karnataka Govt. ACT No.42 of 2013, Recognized", ParagraphStyle('CertDetails1', fontName=FONT_BOLD, fontSize=10, alignment=TA_CENTER)))
    elements.append(Paragraph("by UGC, New Delhi &amp; Member of Association of Indian Universities, New Delhi)", ParagraphStyle('CertDetails2', fontName=FONT_BOLD, fontSize=10, alignment=TA_CENTER)))
    elements.append(Paragraph("Web : www.srinivasuniversity.edu.in, Email: info@srinivasuniversity.edu.in", ParagraphStyle('CertWeb', fontName=FONT_NAME, fontSize=10, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 15))
    elements.append(Paragraph("INSTITUTE OF COMPUTER SCIENCE &amp; INFORMATION SCIENCES", ParagraphStyle('CertInst', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("C E R T I F I C A T E", ParagraphStyle('CertTitle', fontName=FONT_BOLD, fontSize=20, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 30))
    text = '''This is to certify that the project work entitled "SMART BANK" carried out by Mr. Salman (Registration No. 03SU22SD000), a bonafide student of this institution, in partial fulfillment for the award of Degree B.C.A at Srinivas University, City Campus, Pandeshwara, Mangaluru – 575 001, during the academic year 2024-2025. It is also certified that all corrections/suggestions indicated during internal assessment have been incorporated in the Report. The project report has been approved as it satisfies the academic requirements in respect of Project work prescribed for the said degree.'''
    elements.append(Paragraph(text, ParagraphStyle('CertBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    
    elements.append(Spacer(1, 60))
    
    # Signatures
    data = [
        [Paragraph("Name &amp; Signature of the Guide", styles['BodyBold']), Paragraph("Name &amp; Signature of the Dean", styles['BodyBold'])]
    ]
    t = Table(data, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t.setStyle(TableStyle([('ALIGN', (0,0), (0,0), 'LEFT'), ('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(t)
    
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("External Viva :", styles['H3']))
    elements.append(Spacer(1, 20))
    
    data2 = [
        [Paragraph("Name of the Examiners", styles['BodyText12']), Paragraph("Signature with Date", styles['BodyText12'])],
        [Paragraph("1.", styles['BodyText12']), ""],
        [Paragraph("2.", styles['BodyText12']), ""]
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
    
    text1 = "I hereby declare that the project work detail which is being presented in this report is in fulfillment of the requirement for the award of degree of Bachelor of Computer Application."
    elements.append(Paragraph(text1, ParagraphStyle('DecBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    elements.append(Spacer(1, 15))
    
    text2 = "I hereby declare that I have undertaken our project work on \"SMART BANK\" under the guidance of Asst. Professor Nikshitha M, Professor, Department of Computer Science and Information Science, Srinivas University, Mangalore."
    elements.append(Paragraph(text2, ParagraphStyle('DecBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    elements.append(Spacer(1, 15))
    
    text3 = "I hereby declare that this project work report is my own work and the best of our knowledge and belief the matter embedded in report has not been submitted by us for the award of other degree to this or any other university."
    elements.append(Paragraph(text3, ParagraphStyle('DecBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    
    elements.append(Spacer(1, 60))
    
    data = [
        [Paragraph("Place: Mangalore", styles['BodyText12']), Paragraph("Mr. Salman (03SU22SD000)", styles['BodyText12'])],
        [Paragraph("Date: 14-05-2025", styles['BodyText12']), ""]
    ]
    t = Table(data, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t.setStyle(TableStyle([('ALIGN', (0,0), (0,-1), 'LEFT'), ('ALIGN', (1,0), (1,-1), 'RIGHT'), ('BOTTOMPADDING', (0,0), (-1,-1), 10)]))
    elements.append(t)
    
    elements.append(PageBreak())
    return elements
"""

import re
old_block_match = re.search(r'def create_cover_page\(styles\):.*?return elements\s*def create_certificate_page\(styles\):.*?return elements\s*def create_declaration_page\(styles\):.*?return elements', text, re.DOTALL)

if old_block_match:
    text = text.replace(old_block_match.group(0), new_functions.strip() + "\n")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated first three pages to exactly match reference PDF formats.")
