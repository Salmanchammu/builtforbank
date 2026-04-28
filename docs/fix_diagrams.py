"""
Fix diagrams in generate_pdf.py:
1. Make all arrows straight (orthogonal L-shaped routing)
2. Add a proper Chen-notation ER diagram renderer
3. Remove color fills from diagram boxes (simple black/white)
"""
import re

pdf_gen_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\generate_pdf.py'
with open(pdf_gen_path, 'r', encoding='utf-8') as f:
    code = f.read()

# ═══════════════════════════════════════════════════════════════════════════════
# 1. REPLACE draw_arrow_line with ORTHOGONAL (straight) arrow drawing
# ═══════════════════════════════════════════════════════════════════════════════

old_arrow = '''def draw_arrow_line(d, x1, y1, x2, y2, label=None, both_ways=False):
    """Draw a line with arrowhead(s) and optional label."""
    d.add(Line(x1, y1, x2, y2, strokeColor=HexColor('#555555'), strokeWidth=1))
    # Forward arrowhead (at x2,y2)
    angle = math.atan2(y2 - y1, x2 - x1)
    sz = 6
    d.add(Polygon([
        x2, y2,
        x2 - sz * math.cos(angle - 0.4), y2 - sz * math.sin(angle - 0.4),
        x2 - sz * math.cos(angle + 0.4), y2 - sz * math.sin(angle + 0.4),
    ], fillColor=HexColor('#555555'), strokeColor=HexColor('#555555'), strokeWidth=0.5))
    # Reverse arrowhead if bidirectional
    if both_ways:
        rev = angle + math.pi
        d.add(Polygon([
            x1, y1,
            x1 - sz * math.cos(rev - 0.4), y1 - sz * math.sin(rev - 0.4),
            x1 - sz * math.cos(rev + 0.4), y1 - sz * math.sin(rev + 0.4),
        ], fillColor=HexColor('#555555'), strokeColor=HexColor('#555555'), strokeWidth=0.5))
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        d.add(String(mx, my + 6, label, fontSize=6, fontName=FONT_ITALIC,
                     fillColor=HexColor('#888888'), textAnchor='middle'))'''

new_arrow = '''def _draw_arrowhead(d, x, y, direction):
    """Draw a small triangular arrowhead pointing in given direction."""
    sz = 5
    col = black
    if direction == 'down':
        d.add(Polygon([x, y, x - sz, y + sz, x + sz, y + sz],
                       fillColor=col, strokeColor=col, strokeWidth=0.5))
    elif direction == 'up':
        d.add(Polygon([x, y, x - sz, y - sz, x + sz, y - sz],
                       fillColor=col, strokeColor=col, strokeWidth=0.5))
    elif direction == 'right':
        d.add(Polygon([x, y, x - sz, y + sz, x - sz, y - sz],
                       fillColor=col, strokeColor=col, strokeWidth=0.5))
    elif direction == 'left':
        d.add(Polygon([x, y, x + sz, y + sz, x + sz, y - sz],
                       fillColor=col, strokeColor=col, strokeWidth=0.5))


def draw_arrow_line(d, x1, y1, x2, y2, label=None, both_ways=False):
    """Draw straight orthogonal arrows (L-shaped routing, no diagonals)."""
    lc = black
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)

    if dx < 3:
        # Vertical straight line
        d.add(Line(x1, y1, x2, y2, strokeColor=lc, strokeWidth=1))
        direction = 'down' if y2 < y1 else 'up'
        _draw_arrowhead(d, x2, y2, direction)
        if both_ways:
            _draw_arrowhead(d, x1, y1, 'up' if direction == 'down' else 'down')
    elif dy < 3:
        # Horizontal straight line
        d.add(Line(x1, y1, x2, y2, strokeColor=lc, strokeWidth=1))
        direction = 'right' if x2 > x1 else 'left'
        _draw_arrowhead(d, x2, y2, direction)
        if both_ways:
            _draw_arrowhead(d, x1, y1, 'left' if direction == 'right' else 'right')
    else:
        # L-shaped: go vertical first, then horizontal
        mid_y = (y1 + y2) / 2
        d.add(Line(x1, y1, x1, mid_y, strokeColor=lc, strokeWidth=1))
        d.add(Line(x1, mid_y, x2, mid_y, strokeColor=lc, strokeWidth=1))
        d.add(Line(x2, mid_y, x2, y2, strokeColor=lc, strokeWidth=1))
        direction = 'down' if y2 < y1 else 'up'
        _draw_arrowhead(d, x2, y2, direction)
        if both_ways:
            rev = 'up' if direction == 'down' else 'down'
            _draw_arrowhead(d, x1, y1, rev)

    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        d.add(String(mx + 3, my + 8, label, fontSize=6, fontName=FONT_ITALIC,
                     fillColor=HexColor('#444444'), textAnchor='middle'))'''

code = code.replace(old_arrow, new_arrow)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. REMOVE colored fills from diagram boxes - make all plain white/black
# ═══════════════════════════════════════════════════════════════════════════════

# Replace colored box fills with plain white
code = code.replace("fill = HexColor('#fff0f0')", "fill = white")
code = code.replace("shape = 'rect'; fill = HexColor('#f0f5ff')", "shape = 'rect'; fill = white")
code = code.replace("shape = 'rect'; fill = HexColor('#f0fff0')", "shape = 'rect'; fill = white")
code = code.replace("fill_color=HexColor('#f0f5ff')", "fill_color=white")

# Make diagram title bars plain black instead of maroon
code = code.replace("fillColor=MAROON,\r\n               strokeColor=MAROON", "fillColor=black,\r\n               strokeColor=black")
code = code.replace("fillColor=MAROON,\n               strokeColor=MAROON", "fillColor=black,\n               strokeColor=black")

# Fix box borders to black
code = code.replace("border_color=MAROON, font_size=font_size", "border_color=black, font_size=font_size")
code = code.replace("border_color=MAROON, font_size=7", "border_color=black, font_size=7")

# Fix diagram outer border
code = code.replace("strokeColor=MAROON, strokeWidth=1.5, rx=8", "strokeColor=black, strokeWidth=1, rx=4")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. ADD dedicated Chen-notation ER diagram renderer
# ═══════════════════════════════════════════════════════════════════════════════

er_renderer = '''

def _render_chen_er_diagram(title="Entity-Relationship Diagram"):
    """Render a proper Chen-notation ER diagram for Smart Bank."""
    dw = AVAIL_WIDTH
    dh = 680

    d = Drawing(dw, dh)
    # Simple border
    d.add(Rect(0, 0, dw, dh, fillColor=white, strokeColor=black, strokeWidth=1))
    # Title
    d.add(String(dw / 2, dh - 15, title, fontSize=10, fontName=FONT_BOLD,
                 fillColor=black, textAnchor='middle'))

    # Entity definitions: (name, x, y, width, height)
    ew, eh = 80, 28
    entities = {
        'Admin':       (20,  dh - 70,  ew, eh),
        'Staff':       (180, dh - 70,  ew, eh),
        'Users':       (100, dh - 170, ew, eh),
        'Accounts':    (270, dh - 170, ew, eh),
        'Transactions':(390, dh - 170, 90, eh),
        'Cards':       (380, dh - 70,  ew, eh),
        'Loans':       (270, dh - 270, ew, eh),
        'Pockets':     (20,  dh - 270, ew, eh),
        'Service_Apps':(100, dh - 270, 90, eh),
        'Support':     (20,  dh - 370, ew, eh),
        'Attendance':  (180, dh - 370, ew, eh),
        'Locations':   (350, dh - 270, ew, eh),
        'Agri_Loans':  (20,  dh - 470, ew, eh),
        'Acct_Requests':(350, dh - 370, 90, eh),
        'Crop_Listings':(120, dh - 470, 90, eh),
        'Crop_Orders': (260, dh - 470, 90, eh),
        'Agri_Buyers': (390, dh - 470, ew, eh),
        'Escrow':      (260, dh - 560, ew, eh),
    }

    # Draw entities as rectangles
    for name, (ex, ey, eww, ehh) in entities.items():
        d.add(Rect(ex, ey, eww, ehh, fillColor=white, strokeColor=black, strokeWidth=1.2))
        display = name.replace('_', ' ')
        if len(display) > 12:
            display = display[:11] + '..'
        d.add(String(ex + eww/2, ey + ehh/2 - 4, display,
                     fontSize=7, fontName=FONT_BOLD, fillColor=black, textAnchor='middle'))

    # Relationships: (entity1, entity2, label, card1, card2)
    relationships = [
        ('Admin', 'Staff', 'manages', '1', 'M'),
        ('Staff', 'Users', 'verifies', '1', 'M'),
        ('Users', 'Accounts', 'owns', '1', 'M'),
        ('Accounts', 'Transactions', 'logs', '1', 'M'),
        ('Accounts', 'Cards', 'linked', '1', 'M'),
        ('Accounts', 'Loans', 'assigned', '1', 'M'),
        ('Users', 'Pockets', 'sets', '1', 'M'),
        ('Users', 'Service_Apps', 'applies', '1', 'M'),
        ('Users', 'Support', 'submits', '1', 'M'),
        ('Staff', 'Attendance', 'records', '1', 'M'),
        ('Users', 'Agri_Loans', 'requests', '1', 'M'),
        ('Users', 'Acct_Requests', 'files', '1', 'M'),
        ('Admin', 'Locations', 'manages', '1', 'M'),
        ('Users', 'Crop_Listings', 'lists', '1', 'M'),
        ('Crop_Listings', 'Crop_Orders', 'fulfilled', '1', 'M'),
        ('Agri_Buyers', 'Crop_Orders', 'places', '1', 'M'),
        ('Crop_Orders', 'Escrow', 'secured', '1', '1'),
    ]

    for e1, e2, label, c1, c2 in relationships:
        if e1 not in entities or e2 not in entities:
            continue
        x1e, y1e, w1, h1 = entities[e1]
        x2e, y2e, w2, h2 = entities[e2]

        # Center points
        cx1, cy1 = x1e + w1/2, y1e + h1/2
        cx2, cy2 = x2e + w2/2, y2e + h2/2

        # Connection points (from edge of box)
        if abs(cy1 - cy2) < 5:
            # Same row - horizontal
            if cx2 > cx1:
                px1, py1 = x1e + w1, cy1
                px2, py2 = x2e, cy2
            else:
                px1, py1 = x1e, cy1
                px2, py2 = x2e + w2, cy2
        elif cy1 > cy2:
            # e1 above e2
            px1, py1 = cx1, y1e
            px2, py2 = cx2, y2e + h2
        else:
            px1, py1 = cx1, y1e + h1
            px2, py2 = cx2, y2e

        # Draw relationship diamond at midpoint
        mx, my = (px1 + px2) / 2, (py1 + py2) / 2
        ds = 18  # diamond size
        d.add(Polygon([mx, my + ds/2, mx + ds, my, mx, my - ds/2, mx - ds, my],
                       fillColor=white, strokeColor=black, strokeWidth=1))
        d.add(String(mx, my - 3, label, fontSize=5, fontName=FONT_NAME,
                     fillColor=black, textAnchor='middle'))

        # Draw straight lines from entity to diamond
        # Line from e1 to diamond
        if abs(py1 - my) < 3:
            d.add(Line(px1, py1, mx - ds, my, strokeColor=black, strokeWidth=0.8))
            d.add(Line(mx + ds, my, px2, py2, strokeColor=black, strokeWidth=0.8))
        else:
            d.add(Line(px1, py1, mx, my + ds/2 if py1 > my else my - ds/2, strokeColor=black, strokeWidth=0.8))
            d.add(Line(mx, my - ds/2 if py1 > my else my + ds/2, px2, py2, strokeColor=black, strokeWidth=0.8))

        # Cardinality labels
        d.add(String(px1 + (3 if px2 > px1 else -8), py1 + (8 if py1 > py2 else -5),
                     c1, fontSize=6, fontName=FONT_BOLD, fillColor=black, textAnchor='middle'))
        d.add(String(px2 + (-8 if px2 > px1 else 3), py2 + (-5 if py1 > py2 else 8),
                     c2, fontSize=6, fontName=FONT_BOLD, fillColor=black, textAnchor='middle'))

    return d

'''

# Insert the ER renderer before the TABLE PARSER section
code = code.replace(
    "# ─── TABLE PARSER",
    er_renderer + "# ─── TABLE PARSER"
)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Hook ER diagram into the mermaid parser
# ═══════════════════════════════════════════════════════════════════════════════

old_er_detect = '''    is_sequence = any(l.startswith('sequenceDiagram') for l in raw_lines)
    if is_sequence:
        return _render_sequence_diagram(raw_lines, title)'''

new_er_detect = '''    is_sequence = any(l.startswith('sequenceDiagram') for l in raw_lines)
    if is_sequence:
        return _render_sequence_diagram(raw_lines, title)

    # Detect ER diagram and use Chen-notation renderer
    is_er = any(l.startswith('erDiagram') for l in raw_lines)
    if is_er:
        return _render_chen_er_diagram(title)'''

code = code.replace(old_er_detect, new_er_detect)

with open(pdf_gen_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("generate_pdf.py updated:")
print("  [OK] Arrow drawing -> orthogonal (straight L-shaped)")
print("  [OK] Box fills -> plain white/black (no colors)")
print("  [OK] Chen-notation ER diagram renderer added")
print("  [OK] ER diagram auto-detection hooked in")
