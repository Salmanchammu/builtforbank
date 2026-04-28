import fitz

doc = fitz.open(r'c:\Users\salma\Downloads\report final-15.pdf')
for i in range(2):
    page = doc[i]
    drawings = page.get_drawings()
    print(f'Page {i+1} drawings: {len(drawings)}')
    for j, d in enumerate(drawings):
        print(f'  {j}: type={d.get("type", "unknown")}, color={d.get("color")}, fill={d.get("fill")}, width={d.get("width")}')
        if "rect" in d:
             print(f'     rect: {d["rect"]}')
