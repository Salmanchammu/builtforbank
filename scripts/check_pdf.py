import fitz
import sys

def check_pdf(pdf_path):
    print(f"Checking {pdf_path}")
    doc = fitz.open(pdf_path)
    page = doc[0]
    drawings = page.get_drawings()
    print(f"Found {len(drawings)} drawings on page 1")
    for i, d in enumerate(drawings[:10]):
        print(f"Drawing {i}: rect={d['rect']} color={d.get('color')} fill={d.get('fill')}")

check_pdf(r"C:\Users\salma\Downloads\report final-15.pdf")
# check_pdf(r"C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\docs\SmartBank_Project_Report.pdf")
