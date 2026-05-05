from playwright.sync_api import sync_playwright
import os

def generate_pdf():
    # Convert to absolute path correctly for Windows
    abs_path = os.path.abspath('SmartBank_Masterclass_Viva_Guide.html')
    html_path = f"file:///{abs_path.replace(chr(92), '/')}"
    pdf_path = "SmartBank_Masterclass_Viva_Guide.pdf"
    
    print(f"Loading {html_path}...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(html_path, wait_until="networkidle")
        page.pdf(path=pdf_path, format="A4", print_background=True, margin={"top": "40px", "bottom": "40px"})
        browser.close()
        
    print(f"Successfully generated {pdf_path}")

if __name__ == '__main__':
    generate_pdf()
