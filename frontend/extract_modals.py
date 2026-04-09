import re
from bs4 import BeautifulSoup

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    soup = BeautifulSoup(html, 'html.parser')
    
    # 1. Ensure all elements with class 'modal' are direct children of the body, placed right before the scripts/end of body
    modals = soup.find_all(class_='modal')
    
    body = soup.find('body')
    if body:
        for modal in modals:
            # If the modal is inside dashboard-container, extract it
            parent = modal.find_parent(class_='dashboard-container')
            if parent:
                extracted_modal = modal.extract()
                body.append(extracted_modal)
                body.append("\n")

    html_out = str(soup)
    
    # Fix html.parser issues
    html_out = html_out.replace('</link>', '')
    html_out = html_out.replace('</style></head>', '</style>\n</head>')
    html_out = html_out.replace('</div></body>', '</div>\n</body>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_out)
    
    print(f"Appended {len(modals)} modals in {filepath} to the body")

if __name__ == '__main__':
    process_file(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\staffdash.html')
    process_file(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\admindash.html')
