import re

with open('frontend/staffdash.html', 'r', encoding='utf-8') as f:
    html = f.read()

start = html.find('<div id="dashboard"')
end = html.find('id="services"')
sub = html[start:end]

open_tags = []
for m in re.finditer(r'<(/?div)([^>]*)>', sub):
    if m.group(1) == 'div':
        # opening
        open_tags.append((m.start(), m.group(0)))
    elif m.group(1) == '/div':
        if open_tags:
            open_tags.pop()

if not open_tags:
    print("Perfectly matched!")
else:
    for _, tag in open_tags:
        clean = " ".join(tag.replace("\n", "").split())
        print(f"Unclosed: {clean[:80]}...")
