import sys
import re

content = open('generate_pdf.py', 'r', encoding='utf-8').read()

# Make spacing larger, use 1.5 spacing which is generally 18 to 22 points
content = content.replace('LINE_SPACING = 18', 'LINE_SPACING = 20')
content = content.replace('FONT_SIZE = 12', 'FONT_SIZE = 13')

# Enhance the myFirstPage and myLaterPages to include Page Numbers
page_num_func = """
def add_page_number(canvas, doc):
    page_num = canvas.getPageNumber()
    text = f"Page {page_num}"
    canvas.saveState()
    canvas.setFont('Times-Italic', 10)
    canvas.drawCentredString(A4[0] / 2, 0.5 * inch, text)
    canvas.restoreState()

def myFirstPage(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(HexColor('#999999'))
    canvas.setLineWidth(1)
    
    canvas.setFont('Times-Italic', 10)
    canvas.drawString(MARGIN, A4[1] - 0.75 * inch, "Smart Bank - Project Report")
    canvas.drawRightString(A4[0] - MARGIN, A4[1] - 0.75 * inch, "April 2026")
    
    canvas.line(MARGIN, A4[1] - 0.8 * inch, A4[0] - MARGIN, A4[1] - 0.8 * inch)
    canvas.restoreState()
    add_page_number(canvas, doc)

def myLaterPages(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(HexColor('#999999'))
    canvas.setLineWidth(1)
    
    canvas.setFont('Times-Italic', 10)
    canvas.drawString(MARGIN, A4[1] - 0.75 * inch, "Smart Bank - Project Report")
    canvas.drawRightString(A4[0] - MARGIN, A4[1] - 0.75 * inch, "April 2026")
    
    canvas.line(MARGIN, A4[1] - 0.8 * inch, A4[0] - MARGIN, A4[1] - 0.8 * inch)
    canvas.restoreState()
    add_page_number(canvas, doc)
"""

# Find where myFirstPage starts and quickly replace the two functions.
# They look like:
# def myFirstPage(canvas, doc):
#     ...
# def myLaterPages(canvas, doc):
#     ...
#
# Followed by class DiagramNode(...)
content = re.sub(r'def myFirstPage\(canvas, doc\):.*?def myLaterPages\(canvas, doc\):.*?(?=\nclass )', page_num_func + '\n', content, flags=re.DOTALL)

with open('generate_pdf.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('generate_pdf.py successfully updated.')
