import os
from playwright.sync_api import sync_playwright

def generate_pdf():
    html_path_abs = os.path.abspath(os.path.join("scripts", "css_trick_guide.html"))
    pdf_path = "CSS_Color_Trick_Viva.pdf"
    
    file_uri = f"file:///{html_path_abs.replace(chr(92), '/')}"
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(file_uri, wait_until="networkidle")
        page.pdf(path=pdf_path, format="A4", print_background=True, margin={"top": "1in", "bottom": "1in", "left": "1in", "right": "1in"})
        browser.close()
        
    print(f"Successfully generated {pdf_path}!")

if __name__ == '__main__':
    generate_pdf()
