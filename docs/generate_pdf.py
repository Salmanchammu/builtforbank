"""
Smart Bank Project Report - PDF Generator
Converts SmartBank_Project_Report.md to a professional PDF
Font: Times New Roman, Size 12, Minimum 130 pages
WITH proper visual diagrams and professional tables
"""

import re
import os
import textwrap
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.utils import ImageReader
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.colors import HexColor, black, white, Color
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Preformatted, KeepTogether, HRFlowable, Flowable, Image
)
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon, Circle, Ellipse, Group
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── CONFIG ───────────────────────────────────────────────────────────────────
INPUT_MD = os.path.join(os.path.dirname(__file__), "SmartBank_Project_Report.md")
OUTPUT_PDF = os.path.join(os.path.dirname(__file__), "SmartBank_Project_Report.pdf")
MARGIN = 1 * inch

# Register Professional TrueType fonts for Unicode (Rupee Symbol) support
FONT_DIR = r"C:\Windows\Fonts"
TIMES_REG = os.path.join(FONT_DIR, "times.ttf")
TIMES_BOLD_PATH = os.path.join(FONT_DIR, "timesbd.ttf")
TIMES_ITALIC_PATH = os.path.join(FONT_DIR, "timesi.ttf")
TIMES_BI_PATH = os.path.join(FONT_DIR, "timesbi.ttf")

if all(os.path.exists(f) for f in [TIMES_REG, TIMES_BOLD_PATH, TIMES_ITALIC_PATH, TIMES_BI_PATH]):
    pdfmetrics.registerFont(TTFont('TimesNewRoman', TIMES_REG))
    pdfmetrics.registerFont(TTFont('TimesNewRoman-Bold', TIMES_BOLD_PATH))
    pdfmetrics.registerFont(TTFont('TimesNewRoman-Italic', TIMES_ITALIC_PATH))
    pdfmetrics.registerFont(TTFont('TimesNewRoman-BoldItalic', TIMES_BI_PATH))
    
    FONT_NAME = "TimesNewRoman"
    FONT_BOLD = "TimesNewRoman-Bold"
    FONT_ITALIC = "TimesNewRoman-Italic"
    FONT_BOLD_ITALIC = "TimesNewRoman-BoldItalic"
    
    COUR_REG = os.path.join(FONT_DIR, "cour.ttf")
    if os.path.exists(COUR_REG):
        pdfmetrics.registerFont(TTFont('CourierNew', COUR_REG))
        FONT_MONO = FONT_NAME
    else:
        FONT_MONO = FONT_NAME
else:
    # Standard Fallback
    FONT_NAME = "Times-Roman"
    FONT_BOLD = "Times-Bold"
    FONT_ITALIC = "Times-Italic"
    FONT_BOLD_ITALIC = "Times-BoldItalic"
    FONT_MONO = FONT_NAME


FONT_SIZE = 12
LINE_SPACING = 18  # 1.5 line spacing for academic format (12pt * 1.5)

MAROON = black
LIGHT_MAROON = HexColor('#333333')
LIGHT_BG = HexColor('#f5f5f5')
BORDER_COLOR = HexColor('#999999')
AVAIL_WIDTH = A4[0] - 2 * MARGIN  # ~468 points

# ─── STYLES ───────────────────────────────────────────────────────────────────
def create_styles():
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='ChapterTitle', fontName=FONT_BOLD, fontSize=18, leading=26,
        alignment=TA_CENTER, spaceAfter=20, spaceBefore=30, textColor=MAROON,
    ))
    styles.add(ParagraphStyle(
        name='H1', fontName=FONT_BOLD, fontSize=16, leading=22,
        alignment=TA_LEFT, spaceAfter=14, spaceBefore=24, textColor=MAROON,
    ))
    styles.add(ParagraphStyle(
        name='H2', fontName=FONT_BOLD, fontSize=14, leading=20,
        alignment=TA_LEFT, spaceAfter=10, spaceBefore=18,
    ))
    styles.add(ParagraphStyle(
        name='H3', fontName=FONT_BOLD, fontSize=13, leading=18,
        alignment=TA_LEFT, spaceAfter=8, spaceBefore=14,
    ))
    styles.add(ParagraphStyle(
        name='H4', fontName=FONT_BOLD, fontSize=12, leading=16,
        alignment=TA_LEFT, spaceAfter=6, spaceBefore=10,
    ))
    styles.add(ParagraphStyle(
        name='BodyText12', fontName=FONT_NAME, fontSize=FONT_SIZE, leading=LINE_SPACING,
        alignment=TA_JUSTIFY, spaceAfter=8, spaceBefore=4,
    ))
    styles.add(ParagraphStyle(
        name='BodyBold', fontName=FONT_BOLD, fontSize=FONT_SIZE, leading=LINE_SPACING,
        alignment=TA_LEFT, spaceAfter=6, spaceBefore=8,
    ))
    styles.add(ParagraphStyle(
        name='BulletItem', fontName=FONT_NAME, fontSize=FONT_SIZE, leading=LINE_SPACING,
        alignment=TA_JUSTIFY, spaceAfter=4, spaceBefore=2, leftIndent=24, bulletIndent=12,
    ))
    styles.add(ParagraphStyle(
        name='NumberedItem', fontName=FONT_NAME, fontSize=FONT_SIZE, leading=LINE_SPACING,
        alignment=TA_JUSTIFY, spaceAfter=4, spaceBefore=2, leftIndent=24,
    ))
    styles.add(ParagraphStyle(
        name='CodeBlock', fontName=FONT_NAME, fontSize=12, leading=16,
        alignment=TA_LEFT, spaceAfter=8, spaceBefore=8,
        leftIndent=20, rightIndent=5,
        wordWrap='CJK',
    ))
    styles.add(ParagraphStyle(
        name='TableHeader', fontName=FONT_BOLD, fontSize=10, leading=14,
        alignment=TA_LEFT, textColor=black,
    ))
    styles.add(ParagraphStyle(
        name='TableCell', fontName=FONT_NAME, fontSize=10, leading=14,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name='CoverTitle', fontName=FONT_BOLD, fontSize=26, leading=34,
        alignment=TA_CENTER, spaceAfter=20, textColor=MAROON,
    ))
    styles.add(ParagraphStyle(
        name='CoverSubtitle', fontName=FONT_BOLD, fontSize=16, leading=22,
        alignment=TA_CENTER, spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        name='CoverText', fontName=FONT_NAME, fontSize=14, leading=20,
        alignment=TA_CENTER, spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name='DiagramTitle', fontName=FONT_BOLD_ITALIC, fontSize=11, leading=15,
        alignment=TA_CENTER, spaceAfter=4, spaceBefore=4, textColor=HexColor('#555555'),
    ))
    return styles


# ─── MARKDOWN INLINE FORMATTING ──────────────────────────────────────────────
def format_inline(text):
    """Convert markdown inline formatting to ReportLab XML tags."""
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    
    code_spans = []
    def save_code(m):
        code_spans.append(m.group(1))
        return f'__CODE_{len(code_spans)-1}__'
    text = re.sub(r'`([^`]+)`', save_code, text)
    
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'[Figure: \1]', text)
    
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<b><i>\1</i></b>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text)
    
    for idx, code in enumerate(code_spans):
        safe_code = code.replace('*', '&#42;')
        text = text.replace(f'__CODE_{idx}__', f'<font face="{FONT_MONO}" size="{FONT_SIZE}">{safe_code}</font>')
    
    return text


# ─── MERMAID DIAGRAM RENDERER ─────────────────────────────────────────────────
import math

def draw_box(d, x, y, w, h, text, fill_color=white, border_color=black, font_size=7, shape='rect'):
    """Draw a labeled box on a Drawing."""
    if shape == 'circle':
        cx, cy = x + w/2, y + h/2
        r = min(w, h) / 2
        d.add(Circle(cx, cy, r, fillColor=fill_color, strokeColor=border_color, strokeWidth=1.5))
    elif shape == 'diamond':
        cx, cy = x + w/2, y + h/2
        hw, hh = w/2, h/2
        d.add(Polygon(
            [cx, cy+hh, cx+hw, cy, cx, cy-hh, cx-hw, cy],
            fillColor=fill_color, strokeColor=border_color, strokeWidth=1.5
        ))
    elif shape == 'rounded':
        d.add(Rect(x, y, w, h, rx=10, ry=10, fillColor=fill_color, strokeColor=border_color, strokeWidth=1.5))
    else:
        d.add(Rect(x, y, w, h, fillColor=fill_color, strokeColor=border_color, strokeWidth=1.5))
    
    # Center text inside the box
    lines = text.split('\n')
    line_h = font_size + 2
    total_h = len(lines) * line_h
    start_y = y + h/2 + total_h/2 - font_size
    for i, line in enumerate(lines):
        d.add(String(x + w/2, start_y - i * line_h, line,
                     fontSize=font_size, fontName=FONT_BOLD if font_size > 7 else FONT_NAME,
                     fillColor=black, textAnchor='middle'))


def _draw_arrowhead(d, x, y, direction):
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
        # White background mask behind text to avoid line strike-through
        d.add(Rect(mx - len(label)*1.8 - 2, my - 3, len(label)*3.6 + 4, 12, fillColor=white, strokeColor=white, strokeWidth=0))
        d.add(String(mx, my + 1, label, fontSize=6, fontName=FONT_ITALIC,
                     fillColor=black, textAnchor='middle'))


def parse_mermaid_to_drawing(mermaid_code, title="Diagram"):
    """Parse Mermaid graph code and render as a proper hierarchical ReportLab Drawing."""
    raw_lines = [l.strip() for l in mermaid_code.strip().split('\n') if l.strip()]

    # Detect diagram direction
    is_sequence = any(l.startswith('sequenceDiagram') for l in raw_lines)
    if is_sequence:
        return _render_sequence_diagram(raw_lines, title)

    # Detect ER diagram and use Chen-notation renderer
    is_er = any(l.startswith('erDiagram') for l in raw_lines)
    if is_er:
        return _render_chen_er_diagram(title)

    # ── Parse nodes and edges ──
    nodes = {}       # id -> label
    edges = []       # (src, dst, label, bidirectional)

    for line in raw_lines:
        if line.startswith(('graph', 'flowchart', 'erDiagram', 'classDiagram', '%%', 'ALT', 'ELSE', 'END',
                            'participant', 'sequenceDiagram', 'style', 'classDef', 'subgraph', 'end')):
            continue

        # Node definitions: ID[Label], ID((Label)), ID{Label}, ID[(Label)]
        for nid, nlabel in re.findall(r'(\w+)\[([^\]]+)\]', line):
            nodes[nid] = nlabel.strip('"').strip()
        for nid, nlabel in re.findall(r'(\w+)\(\(([^\)]+)\)\)', line):
            nodes[nid] = nlabel.strip('"').strip()
        for nid, nlabel in re.findall(r'(\w+)\{([^\}]+)\}', line):
            nodes[nid] = nlabel.strip('"').strip()
        for nid, nlabel in re.findall(r'(\w+)\[\(([^\)]+)\)\]', line):
            nodes[nid] = nlabel.strip('"').strip()

        # Labeled bidirectional: A <-->|label| B
        for src, lbl, dst in re.findall(r'(\w+)\s*<-->\|([^|]*)\|\s*(\w+)', line):
            edges.append((src, dst, lbl.strip(), True))

        # Labeled directional: A -->|label| B
        for src, lbl, dst in re.findall(r'(\w+)\s*-->\|([^|]*)\|\s*(\w+)', line):
            already = any(e[0] == src and e[1] == dst for e in edges)
            if not already:
                edges.append((src, dst, lbl.strip(), False))

        # ER diagram connections: A ||--o{ B : "label" or A ||--|| B
        for src, dst, lbl in re.findall(r'(\w+)\s*(?:\|\||}\|)--[o|]\{?\s*(\w+)\s*:\s*"([^"]*)"', line):
            already = any(e[0] == src and e[1] == dst for e in edges)
            if not already:
                edges.append((src, dst, lbl.strip(), False))

        # Simple bidirectional: A <--> B
        for src, dst in re.findall(r'(\w+)\s*<-->\s*(\w+)', line):
            already = any((e[0] == src and e[1] == dst) or (e[0] == dst and e[1] == src) for e in edges)
            if not already:
                edges.append((src, dst, '', True))

        # Simple directional A --> B
        for src, dst in re.findall(r'(\w+)\s*-->\s*(\w+)', line):
            already = any(e[0] == src and e[1] == dst for e in edges)
            if not already:
                edges.append((src, dst, '', False))

    # Ensure all edge nodes exist
    for e in edges:
        src, dst = e[0], e[1]
        if src not in nodes:
            nodes[src] = src
        if dst not in nodes:
            nodes[dst] = dst

    if not nodes:
        return None

    node_ids = list(nodes.keys())

    # ── Build adjacency for DIRECTIONAL edges only (for tree layout) ──
    children = {nid: [] for nid in nodes}
    child_set = set()
    for src, dst, _, bidi in edges:
        if not bidi:  # Only use one-way arrows for hierarchy
            children.setdefault(src, []).append(dst)
            child_set.add(dst)

    # ── BFS level assignment ──
    roots = [nid for nid in node_ids if nid not in child_set]
    if not roots:
        roots = [node_ids[0]]

    levels = {}
    visited = set()
    queue = [(r, 0) for r in roots]
    while queue:
        curr, lvl = queue.pop(0)
        if curr in visited:
            continue
        visited.add(curr)
        levels[curr] = lvl
        for ch in children.get(curr, []):
            if ch not in visited:
                queue.append((ch, lvl + 1))

    # Place any unvisited nodes at level 0
    for nid in nodes:
        if nid not in levels:
            levels[nid] = 0

    # ── STAR LAYOUT FIX: if all nodes at level 0, pick hub node ──
    all_at_zero = all(v == 0 for v in levels.values()) and len(nodes) > 2
    if all_at_zero:
        # Count connections per node
        conn_count = {nid: 0 for nid in nodes}
        for src, dst, _, _ in edges:
            conn_count[src] = conn_count.get(src, 0) + 1
            conn_count[dst] = conn_count.get(dst, 0) + 1
        # Most connected = center (level 0), rest = level 1
        hub = max(conn_count, key=conn_count.get)
        levels[hub] = 0
        for nid in nodes:
            if nid != hub:
                levels[nid] = 1

    # ── Group by level ──
    level_groups = {}
    for nid, lvl in levels.items():
        level_groups.setdefault(lvl, []).append(nid)
    for lvl in level_groups:
        level_groups[lvl].sort(key=lambda x: node_ids.index(x))

    # ── Split wide rows into multiple rows of max 3 ──
    MAX_PER_ROW = 3
    new_level_groups = {}
    new_lvl = 0
    for lvl in sorted(level_groups.keys()):
        grp = level_groups[lvl]
        while grp:
            new_level_groups[new_lvl] = grp[:MAX_PER_ROW]
            grp = grp[MAX_PER_ROW:]
            new_lvl += 1
    level_groups = new_level_groups

    num_rows = max(level_groups.keys()) + 1 if level_groups else 1
    max_cols = max(len(g) for g in level_groups.values()) if level_groups else 1

    # ── Sizing - auto-fit box width to text ──
    box_w = 120
    box_h = 40
    h_gap = 18
    v_gap = 40
    font_size = 8

    top_pad = 35
    bot_pad = 15
    MAX_DRAWING_H = 650

    MAX_DRAWING_W = 430

    content_w = max_cols * (box_w + h_gap) - h_gap + 30

    if content_w > MAX_DRAWING_W:
        scale = MAX_DRAWING_W / content_w
        box_w = max(55, int(box_w * scale))
        h_gap = max(5, int(h_gap * scale))
        font_size = max(5, int(font_size * scale))
        content_w = max_cols * (box_w + h_gap) - h_gap + 30

    content_h = top_pad + bot_pad + num_rows * box_h + (num_rows - 1) * v_gap + 22

    if content_h > MAX_DRAWING_H:
        v_gap = max(15, (MAX_DRAWING_H - 22 - top_pad - bot_pad - num_rows * box_h) // max(num_rows - 1, 1))
        content_h = top_pad + bot_pad + num_rows * box_h + (num_rows - 1) * v_gap + 22
    if content_h > MAX_DRAWING_H:
        box_h = max(22, (MAX_DRAWING_H - 22 - top_pad - bot_pad - (num_rows - 1) * v_gap) // num_rows)
        content_h = top_pad + bot_pad + num_rows * box_h + (num_rows - 1) * v_gap + 22

    drawing_w = min(max(content_w, 360), MAX_DRAWING_W)
    drawing_h = min(content_h, MAX_DRAWING_H)

    d = Drawing(drawing_w, drawing_h)

    # Background - plain white with NO border (as requested)
    d.add(Rect(0, 0, drawing_w, drawing_h, fillColor=white,
               strokeColor=white, strokeWidth=0))
    # Title - plain black text on white (no colored bar)
    d.add(Rect(0, drawing_h - 20, drawing_w, 20, fillColor=white,
               strokeColor=black, strokeWidth=0.5))
    d.add(String(drawing_w / 2, drawing_h - 15, title,
                 fontSize=9, fontName=FONT_BOLD, fillColor=black, textAnchor='middle'))

    # ── Position nodes – centered per level ──
    positions = {}
    render_list = []
    for lvl, grp in level_groups.items():
        n = len(grp)
        total_w = n * box_w + (n - 1) * h_gap
        sx = (drawing_w - total_w) / 2
        for idx, nid in enumerate(grp):
            bx = sx + idx * (box_w + h_gap)
            by = drawing_h - 22 - top_pad - lvl * (box_h + v_gap) - box_h
            by = max(bot_pad, by)
            positions[nid] = (bx, by)
            label = nodes[nid]
            shape = 'rect'
            fill = white  # ALL boxes white - no colors
            
            # Robust word-wrap
            words = label.split()
            lines = []
            curr_line = ""
            for w in words:
                if len(curr_line) + len(w) > 16:
                    if curr_line: lines.append(curr_line.strip())
                    curr_line = w + " "
                else:
                    curr_line += w + " "
            if curr_line:
                lines.append(curr_line.strip())
                
            disp = '\n'.join(lines)
            
            # Adjust box height dynamically based on lines
            box_h_dynamic = max(box_h, len(lines) * 9 + 8)
            
            render_list.append((bx, by - (box_h_dynamic - box_h), box_w, box_h_dynamic, disp, fill, shape))

    # ── Draw edges (behind nodes) ──
    for src, dst, lbl, bidi in edges:
        if src not in positions or dst not in positions:
            continue
        sx, sy = positions[src]
        dx, dy = positions[dst]
        src_cx, src_cy = sx + box_w / 2, sy + box_h / 2
        dst_cx, dst_cy = dx + box_w / 2, dy + box_h / 2

        # Determine connection points
        if abs(sy - dy) < 5:
            if dx > sx:
                x1, y1 = sx + box_w, sy + box_h / 2
                x2, y2 = dx, dy + box_h / 2
            else:
                x1, y1 = sx, sy + box_h / 2
                x2, y2 = dx + box_w, dy + box_h / 2
        elif sy > dy:
            x1, y1 = src_cx, sy
            x2, y2 = dst_cx, dy + box_h
        else:
            x1, y1 = src_cx, sy + box_h
            x2, y2 = dst_cx, dy

        draw_arrow_line(d, x1, y1, x2, y2, None, both_ways=bidi)

    # ── Draw nodes on top ──
    for bx, by, bw, bh, disp, fill, shape in render_list:
        draw_box(d, bx, by, bw, bh, disp,
                 fill_color=fill, border_color=black, font_size=font_size, shape=shape)

    return d


def _render_sequence_diagram(raw_lines, title):
    """Render a sequence diagram as a simple vertical flow chart."""
    participants = []
    steps = []
    for line in raw_lines:
        m = re.match(r'participant\s+(\w+)\s+as\s+(.+)', line)
        if m:
            participants.append((m.group(1), m.group(2).strip()))
            continue
        m2 = re.match(r'(\w+)\s*->>?\s*(\w+)\s*:\s*(.+)', line)
        if m2:
            steps.append((m2.group(1), m2.group(2), m2.group(3).strip()))
            continue
        m3 = re.match(r'(\w+)\s*-->>?\s*(\w+)\s*:\s*(.+)', line)
        if m3:
            steps.append((m3.group(1), m3.group(2), m3.group(3).strip()))

    if not participants and not steps:
        return None

    # Collect participant IDs
    p_ids = []
    p_labels = {}
    for pid, plbl in participants:
        p_ids.append(pid)
        p_labels[pid] = plbl
    for src, dst, _ in steps:
        for p in [src, dst]:
            if p not in p_ids:
                p_ids.append(p)
                p_labels[p] = p

    n_p = len(p_ids)
    MAX_SEQ_W = 434
    MAX_SEQ_H = 650

    # Dynamically size participant box widths based on label text length
    FONT_SIZE_P = 7  # participant label font size
    CHAR_W = FONT_SIZE_P * 0.55  # approximate character width
    p_box_ws = {}
    for pid in p_ids:
        lbl = p_labels[pid]
        p_box_ws[pid] = max(50, len(lbl) * CHAR_W + 12)

    # Calculate column width: evenly divide the drawing width
    col_w = MAX_SEQ_W / n_p
    drawing_w = MAX_SEQ_W

    # Cap box widths to fit within their column
    max_bw = col_w - 4  # 2px padding each side
    for pid in p_ids:
        if p_box_ws[pid] > max_bw:
            p_box_ws[pid] = max_bw

    P_BOX_H = 28
    TITLE_H = 30
    P_BOX_TOP = TITLE_H + 10  # space from top for title
    MSG_START_Y_OFFSET = P_BOX_TOP + P_BOX_H + 15  # messages start below boxes

    row_h = 40
    content_h = MSG_START_Y_OFFSET + len(steps) * row_h + 30
    if content_h > MAX_SEQ_H:
        row_h = max(18, (MAX_SEQ_H - MSG_START_Y_OFFSET - 30) / max(len(steps), 1))
        drawing_h = MAX_SEQ_H
    else:
        drawing_h = content_h

    d = Drawing(drawing_w, drawing_h)
    # Background - no border
    d.add(Rect(0, 0, drawing_w, drawing_h, fillColor=white,
               strokeColor=white, strokeWidth=0))
    # Title - plain black text on white
    d.add(Rect(0, drawing_h - TITLE_H, drawing_w, TITLE_H, fillColor=white,
               strokeColor=black, strokeWidth=0.5))
    d.add(String(drawing_w / 2, drawing_h - TITLE_H + 10, title,
                 fontSize=10, fontName=FONT_BOLD, fillColor=black, textAnchor='middle'))

    # Draw participant boxes - evenly spaced across drawing width
    p_x = {}
    for i, pid in enumerate(p_ids):
        cx = col_w * i + col_w / 2
        p_x[pid] = cx
        bw = p_box_ws[pid]
        box_y = drawing_h - P_BOX_TOP - P_BOX_H
        d.add(Rect(cx - bw/2, box_y, bw, P_BOX_H,
                   fillColor=white, strokeColor=black, strokeWidth=1.5))
        # Draw label text inside box
        lbl = p_labels[pid]
        d.add(String(cx, box_y + P_BOX_H/2 - 3, lbl,
                     fontSize=FONT_SIZE_P, fontName=FONT_BOLD,
                     fillColor=black, textAnchor='middle'))
        # Lifeline (dashed line below box)
        d.add(Line(cx, box_y, cx, 10, strokeColor=HexColor('#999999'),
                   strokeWidth=0.7, strokeDashArray=[3, 3]))

    # Draw messages
    MSG_FONT = 7
    for i, (src, dst, msg) in enumerate(steps):
        if src not in p_x or dst not in p_x:
            continue
        y = drawing_h - MSG_START_Y_OFFSET - i * row_h
        x1, x2 = p_x[src], p_x[dst]
        if src == dst:
            # Self-call
            d.add(Line(x1, y, x1 + 25, y, strokeColor=black, strokeWidth=0.8))
            d.add(Line(x1 + 25, y, x1 + 25, y - 10, strokeColor=black, strokeWidth=0.8))
            draw_arrow_line(d, x1 + 25, y - 10, x1, y - 10)
            d.add(String(x1 + 30, y + 3, msg, fontSize=MSG_FONT, fontName=FONT_ITALIC,
                         fillColor=black, textAnchor='start'))
        else:
            # Draw horizontal arrow with label
            d.add(Line(x1, y, x2, y, strokeColor=black, strokeWidth=0.8))
            direction = 'right' if x2 > x1 else 'left'
            _draw_arrowhead(d, x2, y, direction)
            # Label above the arrow
            mid_x = (x1 + x2) / 2
            # White mask so line doesn't strike through text
            tw = len(msg) * MSG_FONT * 0.45 + 6
            d.add(Rect(mid_x - tw/2, y + 1, tw, MSG_FONT + 4,
                       fillColor=white, strokeColor=white, strokeWidth=0))
            d.add(String(mid_x, y + 3, msg, fontSize=MSG_FONT, fontName=FONT_ITALIC,
                         fillColor=black, textAnchor='middle'))

    return d




def _render_chen_er_diagram(title="Entity-Relationship Diagram"):
    """ER diagram — simple boxes connected by straight lines, no text on arrows."""
    dw = 434
    dh = 650
    d = Drawing(dw, dh)
    d.add(Rect(0, 0, dw, dh, fillColor=white, strokeColor=white, strokeWidth=0))
    d.add(String(dw / 2, dh - 16, title, fontSize=12, fontName=FONT_BOLD,
                 fillColor=black, textAnchor='middle'))

    bw, bh = 90, 30
    x0, x1, x2, x3 = 8, 118, 228, 338
    y0 = dh - 65
    y1 = dh - 145
    y2 = dh - 225
    y3 = dh - 305
    y4 = dh - 385
    y5 = dh - 465

    E = {
        'Admin': (x0,y0,bw,bh), 'Staff': (x1,y0,bw,bh),
        'Attendance': (x2,y0,bw,bh), 'Locations': (x3,y0,bw,bh),
        'Users': (x0,y1,bw,bh), 'Accounts': (x2,y1,bw,bh), 'Cards': (x3,y1,bw,bh),
        'Pockets': (x0,y2,bw,bh), 'Service Apps': (x1,y2,bw,bh),
        'Transactions': (x2,y2,bw,bh), 'Loans': (x3,y2,bw,bh),
        'Support': (x0,y3,bw,bh), 'Support Requests': (x1,y3,bw,bh),
        'Acct Requests': (x2,y3,bw,bh), 'Agri Loans': (x3,y3,bw,bh),
        'Crop Listings': (x0,y4,bw,bh), 'Crop Orders': (x1,y4,bw,bh),
        'Agri Buyers': (x2,y4,bw,bh), 'Escrow': (x1,y5,bw,bh),
    }

    def mx(n): return E[n][0] + E[n][2]/2
    def my(n): return E[n][1] + E[n][3]/2
    def tp(n): return E[n][1] + E[n][3]
    def bt(n): return E[n][1]
    def rt(n): return E[n][0] + E[n][2]
    def lt(n): return E[n][0]

    def ln(x1, y1, x2, y2):
        d.add(Line(x1, y1, x2, y2, strokeColor=black, strokeWidth=0.8))
        # Arrowhead at destination
        angle = math.atan2(y2 - y1, x2 - x1)
        sz = 5
        d.add(Polygon([
            x2, y2,
            x2 - sz * math.cos(angle - 0.4), y2 - sz * math.sin(angle - 0.4),
            x2 - sz * math.cos(angle + 0.4), y2 - sz * math.sin(angle + 0.4),
        ], fillColor=black, strokeColor=black, strokeWidth=0.5))

    def crd(x, y, txt):
        d.add(Rect(x-5, y-2, 10, 12, fillColor=white, strokeColor=white, strokeWidth=0))
        d.add(String(x, y, txt, fontSize=8, fontName=FONT_BOLD, fillColor=black, textAnchor='middle'))

    # ROW 0 horizontal
    ln(rt('Admin'), my('Admin'), lt('Staff'), my('Staff'))
    crd((rt('Admin')+lt('Staff'))/2, my('Admin')+5, '1:M')
    ln(rt('Staff'), my('Staff'), lt('Attendance'), my('Attendance'))
    crd((rt('Staff')+lt('Attendance'))/2, my('Staff')+5, 'M:M')
    ln(rt('Attendance'), my('Attendance'), lt('Locations'), my('Locations'))
    crd((rt('Attendance')+lt('Locations'))/2, my('Attendance')+5, '1:M')

    # ROW 0 to ROW 1 vertical
    ln(mx('Admin'), bt('Admin'), mx('Users'), tp('Users'))
    crd(mx('Admin')+12, (bt('Admin')+tp('Users'))/2, '1:M')
    ln(mx('Staff'), bt('Staff'), mx('Users')+20, tp('Users'))
    crd(mx('Staff')+12, (bt('Staff')+tp('Users'))/2, '1:M')
    ln(mx('Locations'), bt('Locations'), mx('Cards'), tp('Cards'))
    crd(mx('Locations')+12, (bt('Locations')+tp('Cards'))/2, '1:M')

    # ROW 1 horizontal
    ln(rt('Users'), my('Users'), lt('Accounts'), my('Accounts'))
    crd((rt('Users')+lt('Accounts'))/2, my('Users')+5, '1:M')
    ln(rt('Accounts'), my('Accounts'), lt('Cards'), my('Cards'))
    crd((rt('Accounts')+lt('Cards'))/2, my('Accounts')+5, '1:M')

    # ROW 1 to ROW 2
    ln(mx('Users'), bt('Users'), mx('Pockets'), tp('Pockets'))
    crd(mx('Users')+12, (bt('Users')+tp('Pockets'))/2, '1:M')
    ln(mx('Users')+30, bt('Users'), mx('Service Apps'), tp('Service Apps'))
    ln(mx('Accounts'), bt('Accounts'), mx('Transactions'), tp('Transactions'))
    crd(mx('Accounts')+12, (bt('Accounts')+tp('Transactions'))/2, '1:M')
    ln(mx('Cards'), bt('Cards'), mx('Loans'), tp('Loans'))
    crd(mx('Cards')+12, (bt('Cards')+tp('Loans'))/2, 'M:M')

    # ROW 2 to ROW 3
    ln(mx('Pockets'), bt('Pockets'), mx('Support'), tp('Support'))
    crd(mx('Pockets')+12, (bt('Pockets')+tp('Support'))/2, 'M:M')
    ln(mx('Service Apps'), bt('Service Apps'), mx('Support Requests'), tp('Support Requests'))
    crd(mx('Service Apps')+12, (bt('Service Apps')+tp('Support Requests'))/2, 'M:1')
    ln(mx('Transactions'), bt('Transactions'), mx('Acct Requests'), tp('Acct Requests'))
    crd(mx('Transactions')+12, (bt('Transactions')+tp('Acct Requests'))/2, 'M:M')
    ln(mx('Loans'), bt('Loans'), mx('Agri Loans'), tp('Agri Loans'))
    crd(mx('Loans')+12, (bt('Loans')+tp('Agri Loans'))/2, '1:M')

    # ROW 3 to ROW 4
    ln(mx('Support'), bt('Support'), mx('Crop Listings'), tp('Crop Listings'))
    crd(mx('Support')+12, (bt('Support')+tp('Crop Listings'))/2, '1:M')
    ln(mx('Support Requests'), bt('Support Requests'), mx('Crop Orders'), tp('Crop Orders'))
    crd(mx('Support Requests')+12, (bt('Support Requests')+tp('Crop Orders'))/2, 'M:1')

    # ROW 4 horizontal
    ln(rt('Crop Listings'), my('Crop Listings'), lt('Crop Orders'), my('Crop Orders'))
    crd((rt('Crop Listings')+lt('Crop Orders'))/2, my('Crop Listings')+5, 'M:1')
    ln(rt('Crop Orders'), my('Crop Orders'), lt('Agri Buyers'), my('Agri Buyers'))
    crd((rt('Crop Orders')+lt('Agri Buyers'))/2, my('Crop Orders')+5, 'M:1')

    # ROW 4 to ROW 5
    ln(mx('Crop Orders'), bt('Crop Orders'), mx('Escrow'), tp('Escrow'))
    crd(mx('Crop Orders')+12, (bt('Crop Orders')+tp('Escrow'))/2, '1:1')

    # Draw entity boxes LAST
    for name, (ex, ey, ew, eh) in E.items():
        d.add(Rect(ex, ey, ew, eh, fillColor=white, strokeColor=black, strokeWidth=1.5))
        d.add(String(ex + ew/2, ey + eh/2 - 4, name,
                     fontSize=9, fontName=FONT_BOLD, fillColor=black, textAnchor='middle'))

    return d

# ─── TABLE PARSER ─────────────────────────────────────────────────────────────
def parse_table(lines, styles):
    """Parse markdown table lines into a professional ReportLab Table."""
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.strip('|').split('|')]
        cells = [c for c in cells if c != '']
        rows.append(cells)
    
    if not rows:
        return None
    
    clean_rows = []
    for row in rows:
        if all(re.match(r'^[-:\s]+$', cell) for cell in row):
            continue
        clean_rows.append(row)
    
    if not clean_rows:
        return None
    
    max_cols = max(len(r) for r in clean_rows)
    for r in clean_rows:
        while len(r) < max_cols:
            r.append('')
    
    table_data = []
    for i, row in enumerate(clean_rows):
        style_name = 'TableHeader' if i == 0 else 'TableCell'
        processed_cells = []
        for cell in row:
            try:
                processed_cells.append(Paragraph(format_inline(cell), styles[style_name]))
            except Exception:
                safe = cell.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                processed_cells.append(Paragraph(safe, styles[style_name]))
        table_data.append(processed_cells)
    
    # Column widths - safe equal distribution with minimum
    min_col = 40
    col_width = max(AVAIL_WIDTH / max_cols, min_col)
    col_widths = [col_width] * max_cols
    
    # If total exceeds available, scale down
    total_w = sum(col_widths)
    if total_w > AVAIL_WIDTH:
        scale = AVAIL_WIDTH / total_w
        col_widths = [w * scale for w in col_widths]
    
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    style_cmds = [
        # Header row - plain black text, bold, no background color
        ('TEXTCOLOR', (0, 0), (-1, 0), black),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        
        # Body
        ('FONTNAME', (0, 1), (-1, -1), FONT_NAME),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TEXTCOLOR', (0, 1), (-1, -1), black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        
        # Simple black borders - no color
        ('GRID', (0, 0), (-1, -1), 0.5, black),
        ('LINEBELOW', (0, 0), (-1, 0), 1, black),
        
        # All rows white background - no alternating colors
        ('BACKGROUND', (0, 0), (-1, -1), white),
        
        # Padding
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]
    
    table.setStyle(TableStyle(style_cmds))
    return table


# ─── COVER PAGE ───────────────────────────────────────────────────────────────
def create_cover_page(styles):
    elements = []
    elements.append(Spacer(1, 1 * inch))
    
    elements.append(Paragraph("SRINIVAS   UNIVERSITY", ParagraphStyle('CoverUniT', fontName=FONT_BOLD, fontSize=20, alignment=TA_CENTER, spaceAfter=20)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("SMART BANK", ParagraphStyle('CoverTitleBig', fontName=FONT_BOLD, fontSize=24, alignment=TA_CENTER, textColor=MAROON, spaceAfter=20)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Submitted to Srinivas University on partial Completion of Sixth Semester", ParagraphStyle('CoverSub', fontName=FONT_NAME, fontSize=14, alignment=TA_CENTER)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Bachelor of Computer Application", ParagraphStyle('CoverDeg', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("By", ParagraphStyle('CoverBy', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Paragraph("Salman (03SU22SD000)", ParagraphStyle('CoverName', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("VI Semester BCA", ParagraphStyle('CoverSem', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Under the Guidance of", ParagraphStyle('CoverGuidT', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Paragraph("Asst. Professor Nikshitha M", ParagraphStyle('CoverGuide', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("Faculty of", ParagraphStyle('CoverFac', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Paragraph("Srinivas University Institute of Computer", ParagraphStyle('CoverInst1', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    elements.append(Paragraph("and Information Science", ParagraphStyle('CoverInst2', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    elements.append(Paragraph("Pandeshwar, Mangalore", ParagraphStyle('CoverLoc', fontName=FONT_NAME, fontSize=12, alignment=TA_CENTER)))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("2024-2025", ParagraphStyle('CoverYear', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    
    elements.append(PageBreak())
    return elements

def create_certificate_page(styles):
    elements = []
    elements.append(Paragraph("SRINIVAS UNIVERSITY", ParagraphStyle('CertUni', fontName=FONT_BOLD, fontSize=24, alignment=TA_CENTER)))
    elements.append(Paragraph("Srinivas Nagar, Mukka – 574 146, Mangaluru, Karnataka. Phone : 0824-2477456", ParagraphStyle('CertAddress', fontName=FONT_NAME, fontSize=11, alignment=TA_CENTER)))
    elements.append(Paragraph("(Private University Established by Karnataka Govt. ACT No.42 of 2013, Recognized", ParagraphStyle('CertDetails1', fontName=FONT_BOLD, fontSize=10, alignment=TA_CENTER)))
    elements.append(Paragraph("by UGC, New Delhi &amp; Member of Association of Indian Universities, New Delhi)", ParagraphStyle('CertDetails2', fontName=FONT_BOLD, fontSize=10, alignment=TA_CENTER)))
    elements.append(Paragraph("Web : www.srinivasuniversity.edu.in, Email: info@srinivasuniversity.edu.in", ParagraphStyle('CertWeb', fontName=FONT_NAME, fontSize=10, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 15))
    elements.append(Paragraph("INSTITUTE OF COMPUTER SCIENCE &amp; INFORMATION SCIENCES", ParagraphStyle('CertInst', fontName=FONT_BOLD, fontSize=14, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("C E R T I F I C A T E", ParagraphStyle('CertTitle', fontName=FONT_BOLD, fontSize=20, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 30))
    text = '''This is to certify that the project work entitled "SMART BANK" carried out by Mr. Salman (Registration No. 03SU22SD000), a bonafide student of this institution, in partial fulfillment for the award of Degree B.C.A at Srinivas University, City Campus, Pandeshwara, Mangaluru – 575 001, during the academic year 2024-2025. It is also certified that all corrections/suggestions indicated during internal assessment have been incorporated in the Report. The project report has been approved as it satisfies the academic requirements in respect of Project work prescribed for the said degree.'''
    elements.append(Paragraph(text, ParagraphStyle('CertBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY)))
    
    elements.append(Spacer(1, 60))
    
    # Signatures
    data = [
        [Paragraph("Name &amp; Signature of the Guide", styles['BodyBold']), Paragraph("Name &amp; Signature of the Dean", styles['BodyBold'])]
    ]
    t = Table(data, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t.setStyle(TableStyle([('ALIGN', (0,0), (0,0), 'LEFT'), ('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(t)
    
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("External Viva :", styles['H3']))
    elements.append(Spacer(1, 20))
    
    data2 = [
        [Paragraph("Name of the Examiners", styles['BodyText12']), Paragraph("Signature with Date", styles['BodyText12'])],
        [Paragraph("1.", styles['BodyText12']), ""],
        [Paragraph("2.", styles['BodyText12']), ""]
    ]
    t2 = Table(data2, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t2.setStyle(TableStyle([('ALIGN', (0,0), (0,-1), 'LEFT'), ('ALIGN', (1,0), (1,-1), 'RIGHT'), ('BOTTOMPADDING', (0,0), (-1,-1), 15)]))
    elements.append(t2)
    
    elements.append(PageBreak())
    return elements

def create_declaration_page(styles):
    elements = []
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("DECLARATION", ParagraphStyle('DecTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text1 = "I hereby declare that the project work detail which is being presented in this report is in fulfillment of the requirement for the award of degree of Bachelor of Computer Application."
    text2 = "I hereby declare that I have undertaken our project work on 'SMART BANK' under the guidance of Asst. Professor Nikshitha M, Professor, Department of Computer Science and Information Science, Srinivas University, Mangalore."
    text3 = "I hereby declare that this project work report is my own work and the best of our knowledge and belief the matter embedded in report has not been submitted by us for the award of other degree to this or any other university."
    
    style = ParagraphStyle('DecBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY, spaceAfter=15)
    elements.append(Paragraph(text1, style))
    elements.append(Paragraph(text2, style))
    elements.append(Paragraph(text3, style))
    
    elements.append(Spacer(1, 60))
    data = [
        [Paragraph("Place: Mangalore", styles['BodyText12']), Paragraph("Mr. Salman (03SU22SD000)", styles['BodyText12'])],
        [Paragraph("Date: 14-05-2025", styles['BodyText12']), ""]
    ]
    t = Table(data, colWidths=[A4[0]/2 - MARGIN, A4[0]/2 - MARGIN])
    t.setStyle(TableStyle([('ALIGN', (0,0), (0,-1), 'LEFT'), ('ALIGN', (1,0), (1,-1), 'RIGHT'), ('BOTTOMPADDING', (0,0), (-1,-1), 10)]))
    elements.append(t)
    elements.append(PageBreak())
    return elements

def create_acknowledgement_page(styles):
    elements = []
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("ACKNOWLEDGEMENT", ParagraphStyle('AckTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text = "We would like to express our deep sense of gratitude to our guide <b>Asst. Professor Nikshitha M</b>, Professor, Department of Computer Science and Information Science, Srinivas University, for her valuable guidance and continuous encouragement throughout this project."
    text2 = "We also extend our sincere thanks to the Dean and all faculty members of the Institute of Computer Science and Information Science for providing the necessary facilities and support."
    
    style = ParagraphStyle('AckBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY, spaceAfter=15)
    elements.append(Paragraph(text, style))
    elements.append(Paragraph(text2, style))
    
    elements.append(Spacer(1, 80))
    data = [
        ["", Paragraph("Mr. Salman (03SU22SD000)", styles['BodyBold'])]
    ]
    t = Table(data, colWidths=[A4[0]/2, A4[0]/2 - MARGIN*2])
    t.setStyle(TableStyle([('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(t)
    elements.append(PageBreak())
    return elements

def create_abstract_page(styles):
    elements = []
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("ABSTRACT", ParagraphStyle('AbsTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    text = "Smart Bank is an advanced digital banking and biometric security platform designed to integrate core banking operations with modern facial recognition technology and specialized financial tools for the agricultural sector. The system is built using Python, Flask, SQLite, and vanilla HTML5/CSS3/JavaScript."
    text2 = "Key features include a browser-based biometric authentication mechanism utilizing face-api.js, eliminating the sole reliance on traditional text-based credentials. Furthermore, the platform pioneers a specialized 'Agriculture Hub' enabling satellite-verified farm loan assessments and a secure B2B crop marketplace."
    
    style = ParagraphStyle('AbsBody', fontName=FONT_NAME, fontSize=14, leading=22, alignment=TA_JUSTIFY, spaceAfter=15)
    elements.append(Paragraph(text, style))
    elements.append(Paragraph(text2, style))
    
    elements.append(PageBreak())
    return elements

def create_list_of_figures_page(styles):
    elements = []
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("LIST OF FIGURES", ParagraphStyle('LofTitle', fontName=FONT_BOLD, fontSize=16, alignment=TA_CENTER)))
    elements.append(Spacer(1, 40))
    
    figures = [
        "1. Context Flow Diagram",
        "2. Data Flow Diagram Level 0",
        "3. Data Flow Diagram Level 1 (Admin)",
        "4. Entity-Relationship Diagram",
        "5. Biometric Authentication Sequence",
        "6. UPI Transaction Sequence",
        "7. MapLibre 3D Terrain Locator Workflow",
        "8. Customer Dashboard Architecture",
        "9. Agriculture Hub Flowchart"
    ]
    
    for fig in figures:
        elements.append(Paragraph(fig, ParagraphStyle('LofItem', fontName=FONT_NAME, fontSize=14, leading=26)))
        
    elements.append(PageBreak())
    return elements

# ─── TABLE OF CONTENTS ────────────────────────────────────────────────────────
def create_toc(styles):
    elements = []
    # Centered and underlined CONTENTS
    elements.append(Paragraph("<u>CONTENTS</u>", ParagraphStyle('TocTitle', fontName=FONT_BOLD, fontSize=18, alignment=TA_CENTER, spaceAfter=30)))
    
    roman_entries = [
        ("i.", "Declaration"),
        ("ii.", "Acknowledgement"),
        ("iii.", "Abstract"),
        ("iv.", "List Of Figures")
    ]
    
    for numeral, title in roman_entries:
        text = f"<b>{numeral} {title}</b>"
        style = ParagraphStyle('tocRom', fontName=FONT_BOLD, fontSize=14, leading=26, spaceAfter=8)
        elements.append(Paragraph(text, style))
    
    elements.append(Spacer(1, 20))
    
    toc_entries = [
        ("1.SYNOPSIS", ""),
        ("", "CHAPTER-1"),
        ("", "1.1 Title of the project"),
        ("", "1.2 Introduction"),
        ("", "1.3 Objectives"),
        ("", "1.4 Project Category"),
        ("", "1.5 Tools/platform,hardware and software requirement specifications"),
        ("", "1.5.1 Hardware Requirements"),
        ("", "1.5.2 Software Requirements"),
        ("", "1.5.3 Tools/languages used"),
        ("Chapter 2", "Software Requirement and Specification"),
        ("", "2.1 Introduction"),
        ("", "2.2 Overall Description"),
        ("", "2.3 Specific Requirements"),
        ("", "2.4 Other Requirements"),
        ("Chapter 3", "System Design"),
        ("", "3.1-3.10 DFD and System Architecture"),
        ("", "3.11 Feasibility Study"),
        ("Chapter 4", "Database Design"),
        ("", "4.1 ER Diagram"),
        ("", "4.2-4.11 Entity Tables"),
        ("Chapter 5", "Detailed Design"),
        ("", "5.1-5.10 Module Design"),
        ("Chapter 6", "Coding (Implementation)"),
        ("", "6.1-6.31 Frontend and Backend Code"),
        ("Chapter 7", "Testing"),
        ("", "7.1-7.5 Test Cases (68 Cases)"),
        ("Chapter 8", "User Interface"),
        ("", "8.1-8.8 UI Design and Screenshots"),
        ("Chapter 9", "User Manual"),
        ("", "9.1-9.9 Customer/Staff/Admin/Mobile Guide"),
        ("Chapter 10", "Conclusion and Future Scope"),
        ("", "10.1-10.5 Conclusion, Advantages, Limitations, Future Scope"),
        ("Chapter 11", "Bibliography"),
        ("", "11.1 Books Reference (14 entries)"),
        ("", "11.2 Web References (20 entries)"),
    ]
    
    for chapter, title in toc_entries:
        if chapter:
            text = f"<b>{chapter} {title}</b>" if title else f"<b>{chapter}</b>"
            style = ParagraphStyle('tocCh', fontName=FONT_BOLD, fontSize=12,
                                   leading=20, spaceAfter=4, spaceBefore=10)
        else:
            text = f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{title}"
            style = ParagraphStyle('tocEn', fontName=FONT_NAME, fontSize=12,
                                   leading=18, spaceAfter=2, leftIndent=30)
        elements.append(Paragraph(text, style))
    
    elements.append(PageBreak())
    return elements


# ─── MAIN PARSER ──────────────────────────────────────────────────────────────
def parse_markdown(md_text, styles):
    """Parse markdown text into ReportLab flowable elements."""
    elements = []
    lines = md_text.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        if not stripped:
            i += 1
            continue
        
        # --- dividers
        if re.match(r'^-{3,}$', stripped):
            elements.append(Spacer(1, 10))
            i += 1
            continue
        
        # Image lines
        if re.match(r'^!\[.*\]\(.*\)$', stripped):
            img_match = re.match(r'!\[([^\]]*)\]\(([^\)]+)\)', stripped)
            if img_match:
                alt = img_match.group(1)
                img_rel_path = img_match.group(2)
                
                # Check if image exists
                md_dir = os.path.dirname(os.path.abspath(INPUT_MD))
                full_img_path = os.path.join(md_dir, img_rel_path)
                
                if os.path.exists(full_img_path):
                    try:
                        img_reader = ImageReader(full_img_path)
                        iw, ih = img_reader.getSize()
                        aspect = ih / float(iw)
                        new_w = AVAIL_WIDTH
                        if iw < AVAIL_WIDTH:
                            new_w = iw
                        new_h = new_w * aspect
                        if new_h > 500:
                            new_h = 500
                            new_w = new_h / aspect
                        
                        elements.append(Spacer(1, 15))
                        # Center the image using a KeepTogether with proper alignment, or a table
                        # For Image, flowable hAlign='CENTER' works but must be set on the component
                        pdf_img = Image(full_img_path, width=new_w, height=new_h)
                        pdf_img.hAlign = 'CENTER'
                        elements.append(KeepTogether([pdf_img]))
                        elements.append(Spacer(1, 8))
                        elements.append(Paragraph(
                            f"<i>Figure: {format_inline(alt)}</i>",
                            ParagraphStyle('imgCap', fontName=FONT_ITALIC, fontSize=11, leading=14, alignment=TA_CENTER, textColor=HexColor('#555555'))
                        ))
                        elements.append(Spacer(1, 15))
                    except Exception as e:
                        # Fallback if image is broken
                        elements.append(Spacer(1, 8))
                        elements.append(Paragraph(f"<i>[Error loading image: {format_inline(alt)}]</i>", ParagraphStyle('imgErr', fontName=FONT_ITALIC, fontSize=11, alignment=TA_CENTER, textColor=HexColor('#ff0000'))))
                        elements.append(Spacer(1, 8))
                else:
                    # Fallback if missing
                    elements.append(Spacer(1, 8))
                    elements.append(Paragraph(
                        f"<i>[Screenshot: {format_inline(alt)}]</i>",
                        ParagraphStyle('imgR', fontName=FONT_ITALIC, fontSize=11,
                                       leading=14, alignment=TA_CENTER, textColor=HexColor('#666666'))
                    ))
                    elements.append(Spacer(1, 8))
            i += 1
            continue
        
        # Code/Mermaid blocks
        if stripped.startswith('```'):
            lang = stripped[3:].strip().lower()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            
            code_text = textwrap.dedent('\n'.join(code_lines).strip('\n'))
            
            if lang == 'mermaid' and code_text.strip():
                # Detect diagram title from context
                title = "System Diagram"
                # Look back for a heading
                for j in range(len(elements) - 1, max(len(elements) - 5, -1), -1):
                    if hasattr(elements[j], 'text') and isinstance(elements[j], Paragraph):
                        possible = getattr(elements[j], 'text', '')
                        if possible and len(possible) < 80:
                            # Strip XML tags for title
                            title = re.sub(r'<[^>]+>', '', possible).strip()
                            if title:
                                break
                
                drawing = parse_mermaid_to_drawing(code_text, title)
                if drawing:
                    elements.append(Spacer(1, 10))
                    elements.append(drawing)
                    elements.append(Paragraph(
                        f"<i>Figure: {title}</i>", styles['DiagramTitle']
                    ))
                    elements.append(Spacer(1, 10))
            elif code_text.strip():
                # Wrap code in <pre> tags so it preserves newlines but wraps long lines
                safe_code = code_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                safe_code = safe_code.replace('\n', '<br/>')
                safe_code = safe_code.replace(' ', '&nbsp;')
                pre = Paragraph(safe_code, styles['CodeBlock'])
                elements.append(Spacer(1, 6))
                elements.append(pre)
                elements.append(Spacer(1, 6))
            continue
        
        # Tables
        if stripped.startswith('|') and '|' in stripped[1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1
            
            tbl = parse_table(table_lines, styles)
            if tbl:
                elements.append(Spacer(1, 10))
                elements.append(KeepTogether([tbl]))
                elements.append(Spacer(1, 10))
            continue
        
        # CHAPTER headings — render with page break if "CHAPTER-X: TITLE" format
        if re.match(r'^# CHAPTER', stripped) or re.match(r'^# APPENDIX', stripped):
            title_match = re.match(r'^# CHAPTER[-\s]*\d+[:\s]*(.+)', stripped)
            if title_match and title_match.group(1).strip():
                # Format like "CHAPTER-3: SYSTEM DESIGN" — add page break + render
                if len(elements) > 5:
                    elements.append(PageBreak())
                elements.append(Paragraph(format_inline(stripped[2:].strip()), styles['ChapterTitle']))
            # else: standalone "CHAPTER-X" line (chapters 4+), skip — title already rendered
            i += 1
            continue
        
        # H1
        if re.match(r'^# ', stripped):
            text = stripped[2:].strip()
            if re.match(r'^\d+\.', text) or text.startswith('APPENDIX') or text.startswith('SMART BANK'):
                if len(elements) > 5:
                    elements.append(PageBreak())
            elements.append(Paragraph(format_inline(text), styles['ChapterTitle']))
            i += 1
            continue
        
        # H2
        if re.match(r'^## ', stripped):
            text = stripped[3:].strip()
            if text == "PROJECT REPORT":
                i += 1
                continue
            elements.append(Paragraph(format_inline(text), styles['H2']))
            i += 1
            continue
        
        # H3
        if re.match(r'^### ', stripped):
            text = stripped[4:].strip()
            elements.append(Paragraph(format_inline(text), styles['H3']))
            i += 1
            continue
        
        # H4
        if re.match(r'^#### ', stripped):
            text = stripped[5:].strip()
            elements.append(Paragraph(format_inline(text), styles['H4']))
            i += 1
            continue
        
        # Numbered list
        if re.match(r'^\d+\.\s', stripped):
            match = re.match(r'^(\d+)\.\s+(.*)', stripped)
            if match:
                num = match.group(1)
                text = match.group(2)
                try:
                    elements.append(Paragraph(
                        f"<b>{num}.</b> {format_inline(text)}", styles['NumberedItem']
                    ))
                except Exception:
                    safe = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    elements.append(Paragraph(f"<b>{num}.</b> {safe}", styles['NumberedItem']))
                i += 1
                continue
        
        # Bullet points
        if re.match(r'^[-*]\s', stripped):
            text = re.sub(r'^[-*]\s+', '', stripped)
            try:
                elements.append(Paragraph(f"<bullet>&bull;</bullet>{format_inline(text)}", styles['BulletItem']))
            except Exception:
                safe = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                elements.append(Paragraph(f"<bullet>&bull;</bullet>{safe}", styles['BulletItem']))
            i += 1
            continue
        
        # Indented bullets
        if re.match(r'^\s+[-*]\s', line):
            text = re.sub(r'^\s+[-*]\s+', '', line)
            indent_style = ParagraphStyle(
                'IndBul', parent=styles['BulletItem'], leftIndent=48, bulletIndent=36
            )
            try:
                elements.append(Paragraph(f"<bullet>&bull;</bullet>{format_inline(text)}", indent_style))
            except Exception:
                pass
            i += 1
            continue
        
        # Images
        img_match = re.match(r'^!\[(.*?)\]\((.*?)\)', stripped)
        if img_match:
            alt_text = img_match.group(1)
            img_path = img_match.group(2)
            
            # Resolve image path relative to the input MD directory
            full_img_path = os.path.join(os.path.dirname(INPUT_MD), img_path)
            
            if os.path.exists(full_img_path):
                try:
                    # Maintain aspect ratio and fit within page width
                    imgReader = ImageReader(full_img_path)
                    img_w, img_h = imgReader.getSize()
                    
                    max_w = A4[0] - 2 * MARGIN - 20
                    if img_w > max_w:
                        ratio = max_w / float(img_w)
                        img_w = max_w
                        img_h = img_h * ratio
                        
                    img = Image(full_img_path, width=img_w, height=img_h)
                    
                    elements.append(Spacer(1, 10))
                    elements.append(img)
                    elements.append(Spacer(1, 10))
                except Exception as e:
                    print(f"Warning: Could not load image {full_img_path} - {e}")
            else:
                print(f"Warning: Image file not found: {full_img_path}")
                
            i += 1
            continue
            
        # Bold-start paragraphs
        if stripped.startswith('**') and '**' in stripped[2:]:
            try:
                elements.append(Paragraph(format_inline(stripped), styles['BodyText12']))
            except Exception:
                safe = stripped.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                safe = re.sub(r'\*\*(.+?)\*\*', r'\1', safe)
                elements.append(Paragraph(safe, styles['BodyText12']))
            i += 1
            continue
        
        # Regular paragraphs
        para_lines = [stripped]
        i += 1
        while i < len(lines):
            next_line = lines[i].strip()
            if (not next_line or
                next_line.startswith('#') or
                next_line.startswith('```') or
                next_line.startswith('|') or
                next_line.startswith('---') or
                re.match(r'^[-*]\s', next_line) or
                re.match(r'^\d+\.\s', next_line) or
                re.match(r'^!\[', next_line)):
                break
            para_lines.append(next_line)
            i += 1
        
        full_para = ' '.join(para_lines)
        if full_para.strip():
            try:
                elements.append(Paragraph(format_inline(full_para), styles['BodyText12']))
            except Exception:
                safe = full_para.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                safe = re.sub(r'\*\*(.+?)\*\*', r'\1', safe)
                safe = re.sub(r'\*(.+?)\*', r'\1', safe)
                safe = re.sub(r'`([^`]+)`', r'\1', safe)
                elements.append(Paragraph(safe, styles['BodyText12']))
    
    return elements


# ─── PAGE NUMBER FOOTER ──────────────────────────────────────────────────────
def add_page_number(canvas, doc):
    page_num = canvas.getPageNumber()
    canvas.saveState()
    
    # -- Page Border matching user screenshot --
    # Outer thin border (1 pt thick, centered at 25.5)
    canvas.setStrokeColor(black)
    canvas.setLineWidth(1.0)
    canvas.rect(25.5, 25.5, A4[0] - 51, A4[1] - 51, stroke=1, fill=0)
    
    # Inner thick border (3 pt thick, centered at 28.5)
    canvas.setLineWidth(3.0)
    canvas.rect(28.5, 28.5, A4[0] - 57, A4[1] - 57, stroke=1, fill=0)
    
    # Page number
    canvas.setFont(FONT_NAME, 10)
    canvas.drawCentredString(A4[0] / 2, 0.5 * inch + 10, f"- {page_num} -")
    
    canvas.restoreState()


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  SMART BANK PROJECT REPORT - PDF GENERATOR")
    print("  Font: Times New Roman | Size: 12 | Target: 130+ pages")
    print("  WITH Visual Diagrams and Professional Tables")
    print("=" * 60)
    
    print(f"\n[1/4] Reading: {INPUT_MD}")
    with open(INPUT_MD, 'r', encoding='utf-8') as f:
        md_text = f.read()
    print(f"       Read {len(md_text):,} characters, {md_text.count(chr(10)):,} lines")
    
    print("[2/4] Building styles...")
    styles = create_styles()
    
    print("[3/4] Parsing markdown and building PDF elements...")
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=A4,
        topMargin=MARGIN + 10,
        bottomMargin=MARGIN,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        title="Smart Bank - Project Report",
        author="Smart Bank Development Team",
        subject="Advanced Digital Banking and Biometric Security Platform",
    )
    
    story = []
    story.extend(create_cover_page(styles))
    story.extend(create_certificate_page(styles))
    story.extend(create_declaration_page(styles))
    story.extend(create_acknowledgement_page(styles))
    story.extend(create_abstract_page(styles))
    story.extend(create_list_of_figures_page(styles))
    story.extend(create_toc(styles))
    
    content_elements = parse_markdown(md_text, styles)
    story.extend(content_elements)
    
    story.append(Spacer(1, 1 * inch))
    story.append(Spacer(1, 20))
    
    print(f"[4/4] Generating PDF: {OUTPUT_PDF}")
    doc.build(story)
    
    file_size = os.path.getsize(OUTPUT_PDF)
    print(f"\n{'=' * 60}")
    print(f"  [OK] PDF Generated Successfully!")
    print(f"  File: {OUTPUT_PDF}")
    print(f"  Size: {file_size / 1024:.0f} KB ({file_size / (1024*1024):.1f} MB)")
    print(f"  Font: Times New Roman, Size 12")
    print(f"  Paper: A4, 1-inch margins")
    print(f"  Features: Visual diagrams, professional tables")
    print(f"{'=' * 60}")
    print(f"\n  Open the PDF to verify page count (target: 130+)")


if __name__ == "__main__":
    main()
