import os
from playwright.sync_api import sync_playwright

def compile_and_generate_pdf():
    chapters_dir = os.path.join("scripts", "guide_chapters")
    chapter_files = [
        "ch1_html_css.html",
        "ch2_js.html",
        "ch3_python.html",
        "ch4_db_flask.html",
        "ch5_smartbank.html"
    ]
    
    content = ""
    for file in chapter_files:
        with open(os.path.join(chapters_dir, file), "r", encoding="utf-8") as f:
            content += f.read() + "\n<div class='page-break'></div>\n"

    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartBank Full Viva Masterclass</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px;
            background-color: #f8fafc;
        }}
        .chapter {{
            background: white;
            padding: 60px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            margin-bottom: 40px;
        }}
        h1 {{ color: #0f172a; font-size: 2.5rem; text-align: center; border-bottom: 3px solid #e2e8f0; padding-bottom: 20px; }}
        h2 {{ color: #800000; font-size: 1.8rem; margin-top: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }}
        h3 {{ color: #334155; font-size: 1.4rem; margin-top: 30px; }}
        p {{ font-size: 1.1rem; margin-bottom: 15px; }}
        ul, ol {{ margin-bottom: 20px; }}
        li {{ font-size: 1.1rem; margin-bottom: 8px; }}
        .code-block {{
            background-color: #0f172a;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Courier New', Courier, monospace;
            overflow-x: auto;
            margin: 20px 0;
            font-size: 0.95rem;
            white-space: pre-wrap; 
            word-wrap: break-word;
        }}
        .highlight {{ color: #38bdf8; font-weight: bold; }}
        .comment {{ color: #94a3b8; font-style: italic; }}
        .concept-box {{
            background-color: #f0fdf4;
            border-left: 5px solid #22c55e;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }}
        .viva-tip {{
            background-color: #fffbeb;
            border: 1px solid #fde047;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            font-style: italic;
        }}
        .page-break {{ page-break-after: always; }}
        
        @media print {{
            body {{ background: white; padding: 0; }}
            .chapter {{ box-shadow: none; padding: 0; margin: 0; }}
            
            /* Prevent slicing issues */
            h1, h2, h3 {{ page-break-after: avoid; page-break-inside: avoid; }}
            p, li {{ page-break-inside: avoid; orphans: 3; widows: 3; }}
            .code-block {{ page-break-inside: avoid; border: 1px solid #ccc; background: #f8f9fa; color: #000; }}
        }}
    </style>
</head>
<body>
    <div class="chapter">
        <h1>SmartBank: The Definitive Viva Guide</h1>
        <p style="text-align: center; font-size: 1.2rem; color: #64748b;">An exhaustive, conversational guide to Web Architecture, Database Integrity, and Full-Stack Implementation.</p>
    </div>
    {content}
</body>
</html>"""
    
    html_path_abs = os.path.abspath("Ultimate_SmartBank_Viva_Guide.html")
    pdf_path = "Ultimate_SmartBank_Viva_Guide.pdf"
    
    with open(html_path_abs, "w", encoding="utf-8") as f:
        f.write(html_template)
    
    print("Compiling to PDF via Playwright...")
    file_uri = f"file:///{html_path_abs.replace(chr(92), '/')}"
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(file_uri, wait_until="networkidle")
        # Standard 1-inch margins completely prevent bottom text clipping
        page.pdf(path=pdf_path, format="A4", print_background=True, margin={"top": "1in", "bottom": "1in", "left": "1in", "right": "1in"})
        browser.close()
        
    print(f"Successfully generated {pdf_path}!")

if __name__ == '__main__':
    compile_and_generate_pdf()
