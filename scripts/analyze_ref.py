import fitz

def analyze_fonts(pdf_path, num_pages=3):
    try:
        doc = fitz.open(pdf_path)
        print(f"--- Analyzing: {pdf_path} ---")
        for i in range(min(num_pages, len(doc))):
            page = doc[i]
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                if "lines" in block:
                    for line in block["lines"]:
                        for span in line["spans"]:
                            if span["text"].strip():
                                print(f"Page {i+1}: '{span['text'][:30]}...' -> Font: {span['font']}, Size: {span['size']:.1f}, Color: {span['color']}")
    except Exception as e:
        print(f"Error: {e}")

analyze_fonts(r"c:\Users\salma\Downloads\report final-15.pdf", 3)
