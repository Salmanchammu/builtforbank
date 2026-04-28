import re
import os

pdf_script = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\generate_pdf.py'
with open(pdf_script, 'r', encoding='utf-8') as f:
    pdf_code = f.read()

# 1. Add Acknowledgement, Abstract, and List of Figures generator functions
new_pages = """
def create_acknowledgement_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("ACKNOWLEDGEMENT", ParagraphStyle('AckTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text = "We would like to express our deep sense of gratitude to our guide <b>Asst. Professor Nikshitha M</b>, Professor, Department of Computer Science and Information Science, Srinivas University, for her valuable guidance and continuous encouragement throughout this project."
    elements.append(Paragraph(text, ParagraphStyle('AckBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    elements.append(Spacer(1, 15))
    
    text2 = "We also extend our sincere thanks to the Dean and all faculty members of the Institute of Computer Science and Information Science for providing the necessary facilities and support."
    elements.append(Paragraph(text2, ParagraphStyle('AckBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    elements.append(Spacer(1, 80))
    
    data = [
        ["", Paragraph("Mr. Salman (03SU22SD000)", styles['BodyBold'])]
    ]
    t = Table(data, colWidths=[A4[0]/2, A4[0]/2 - MARGIN*2])
    t.setStyle(TableStyle([('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(t)
    
    elements.append(PageBreak())
    return elements

def create_abstract_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("ABSTRACT", ParagraphStyle('AbsTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text = "Smart Bank is an advanced digital banking and biometric security platform designed to integrate core banking operations with modern facial recognition technology and specialized financial tools for the agricultural sector. The system is built using Python, Flask, SQLite, and vanilla HTML5/CSS3/JavaScript."
    elements.append(Paragraph(text, ParagraphStyle('AbsBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    elements.append(Spacer(1, 15))
    
    text2 = "Key features include a browser-based biometric authentication mechanism utilizing face-api.js, eliminating the sole reliance on traditional text-based credentials. Furthermore, the platform pioneers a specialized 'Agriculture Hub' enabling satellite-verified farm loan assessments and a secure B2B crop marketplace."
    elements.append(Paragraph(text2, ParagraphStyle('AbsBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    
    elements.append(PageBreak())
    return elements

def create_list_of_figures_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("LIST OF FIGURES", ParagraphStyle('LofTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    figures = [
        "1. Context Flow Diagram",
        "2. Data Flow Diagram Level 0",
        "3. Data Flow Diagram Level 1 (Admin)",
        "4. Entity-Relationship Diagram",
        "5. Biometric Authentication Sequence",
        "6. UPI Transaction Sequence",
        "7. MapLibre 3D Terrain Locator Workflow",
        "8. Customer Dashboard Architecture",
        "9. Agriculture Hub Flowchart"
    ]
    
    for fig in figures:
        elements.append(Paragraph(fig, ParagraphStyle('LofItem', fontName=FONT_NAME, fontSize=14, leading=26)))
        
    elements.append(PageBreak())
    return elements
"""

# Insert these functions right before create_toc
pdf_code = re.sub(r'# ─── TABLE OF CONTENTS ───', new_pages + '\n# ─── TABLE OF CONTENTS ───', pdf_code)

# 2. Update TOC function to include roman numerals and "CONTENTS"
toc_func_old = r'''def create_toc\(styles\):.*?return elements'''
toc_func_new = '''def create_toc(styles):
    elements = []
    # Centered and underlined CONTENTS
    elements.append(Paragraph("<u>CONTENTS</u>", ParagraphStyle('TocTitle', fontName=FONT_BOLD, fontSize=18, alignment=TA_CENTER, spaceAfter=30)))
    
    roman_entries = [
        ("i.", "Declaration"),
        ("ii.", "Acknowledgement"),
        ("iii.", "Abstract"),
        ("iv.", "List Of Figures")
    ]
    
    for numeral, title in roman_entries:
        text = f"<b>{numeral} {title}</b>"
        style = ParagraphStyle('tocRom', fontName=FONT_BOLD, fontSize=14, leading=26, spaceAfter=8)
        elements.append(Paragraph(text, style))
    
    elements.append(Spacer(1, 20))
    
    toc_entries = [
        ("1.SYNOPSIS", ""),
        ("", "CHAPTER-1"),
        ("", "1.1 Title of the project"),
        ("", "1.2 Introduction"),
        ("", "1.3 Objectives"),
        ("", "1.4 Project Category"),
        ("", "1.5 Tools/platform,hardware and software requirement specifications"),
        ("", "1.5.1 Hardware Requirements"),
        ("", "1.5.2 Software Requirements"),
        ("", "1.5.3 Tools/languages used"),
        ("Chapter 2", "Software Requirement and Specification"),
        ("", "2.1 Introduction"),
        ("", "2.2 Overall Description"),
        ("", "2.3 Specific Requirements"),
        ("", "2.4 Other Requirements"),
        ("Chapter 3", "System Design"),
        ("", "3.1-3.10 DFD and System Architecture"),
        ("", "3.11 Feasibility Study"),
        ("Chapter 4", "Database Design"),
        ("", "4.1 ER Diagram"),
        ("", "4.2-4.11 Entity Tables"),
        ("Chapter 5", "Detailed Design"),
        ("", "5.1-5.10 Module Design"),
        ("Chapter 6", "Coding (Implementation)"),
        ("", "6.1-6.31 Frontend and Backend Code"),
        ("Chapter 7", "Testing"),
        ("", "7.1-7.5 Test Cases (68 Cases)"),
        ("Chapter 8", "User Interface"),
        ("", "8.1-8.8 UI Design and Screenshots"),
        ("Chapter 9", "User Manual"),
        ("", "9.1-9.9 Customer/Staff/Admin/Mobile Guide"),
        ("Chapter 10", "Conclusion and Future Scope"),
        ("", "10.1-10.5 Conclusion, Advantages, Limitations, Future Scope"),
        ("Chapter 11", "Bibliography"),
        ("", "11.1 Books Reference (14 entries)"),
        ("", "11.2 Web References (20 entries)"),
    ]
    
    for chapter, title in toc_entries:
        if chapter:
            text = f"<b>{chapter} {title}</b>" if title else f"<b>{chapter}</b>"
            style = ParagraphStyle('tocCh', fontName=FONT_BOLD, fontSize=12,
                                   leading=20, spaceAfter=4, spaceBefore=10)
        else:
            text = f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{title}"
            style = ParagraphStyle('tocEn', fontName=FONT_NAME, fontSize=12,
                                   leading=18, spaceAfter=2, leftIndent=30)
        elements.append(Paragraph(text, style))
    
    elements.append(PageBreak())
    return elements'''

pdf_code = re.sub(toc_func_old, toc_func_new, pdf_code, flags=re.DOTALL)

# 3. Add to story execution
story_exec_old = r'''    story\.extend\(create_declaration_page\(styles\)\)\s*story\.extend\(create_toc\(styles\)\)'''
story_exec_new = '''    story.extend(create_declaration_page(styles))
    story.extend(create_acknowledgement_page(styles))
    story.extend(create_abstract_page(styles))
    story.extend(create_list_of_figures_page(styles))
    story.extend(create_toc(styles))'''

pdf_code = re.sub(story_exec_old, story_exec_new, pdf_code, flags=re.MULTILINE)

with open(pdf_script, 'w', encoding='utf-8') as f:
    f.write(pdf_code)

print("Pre-pages and TOC updated.")
