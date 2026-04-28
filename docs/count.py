from pypdf import PdfReader
r = PdfReader("SmartBank_Project_Report.pdf")
print(f"Pages: {len(r.pages)}")
