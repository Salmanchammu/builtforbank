import fitz

doc = fitz.open(r'c:\Users\salma\Downloads\report final-15.pdf')
for i in range(4, 9):
    page = doc[i]
    text = page.get_text()
    if "CONTENTS" in text.upper() or "CHAPTER" in text.upper():
        print(f"--- PAGE {i+1} ---")
        print(text)
