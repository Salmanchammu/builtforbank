from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.colors import HexColor

def create_pdf():
    pdf_path = "Viva_Study_Guide_Full.pdf"
    doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, spaceAfter=20, textColor=HexColor("#1e293b"))
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=16, spaceAfter=10, spaceBefore=15, textColor=HexColor("#0f172a"))
    sub_heading_style = ParagraphStyle('CustomSubHeading', parent=styles['Heading3'], fontSize=13, spaceAfter=8, spaceBefore=10, textColor=HexColor("#334155"))
    body_style = ParagraphStyle('CustomBody', parent=styles['Normal'], fontSize=11, leading=16, spaceAfter=10, textColor=HexColor("#333333"))
    bullet_style = ParagraphStyle('CustomBullet', parent=styles['Normal'], fontSize=11, leading=16, spaceAfter=6, leftIndent=20, bulletIndent=10)

    story = []

    # Title
    story.append(Paragraph("Full Stack Viva Study Guide", title_style))
    story.append(Paragraph("A straightforward, conversational guide to explaining your project's technology stack.", body_style))
    story.append(Spacer(1, 20))

    # --- PYTHON ---
    story.append(Paragraph("1. Python (The Backend Brain)", heading_style))
    story.append(Paragraph("Python handles the heavy lifting, logic, and database connections in the SmartBank backend.", body_style))
    
    story.append(Paragraph("Data Structures", sub_heading_style))
    story.append(Paragraph("• <b>Lists vs Tuples:</b> Lists `[1, 2]` can be changed (mutable). Tuples `(1, 2)` cannot be changed (immutable), making them faster and safer for fixed data.", bullet_style))
    story.append(Paragraph("• <b>Dictionaries:</b> `{key: value}`. Works like a real dictionary. Best for fast data lookups. Keys must be immutable.", bullet_style))
    story.append(Paragraph("• <b>Sets:</b> `{1, 2}`. Only stores unique items. Great for instantly removing duplicates.", bullet_style))

    story.append(Paragraph("Decorators (@ syntax)", sub_heading_style))
    story.append(Paragraph("A decorator is a function that wraps around another function to change its behavior. Example: In Flask, we use `@app.route('/login')` to tell Python 'run this function when the user visits the login URL'. We also use `@login_required` to check security before running a page.", bullet_style))

    story.append(Paragraph("Generators & yield", sub_heading_style))
    story.append(Paragraph("If you load 1 million users using `return`, it crashes your computer's memory. `yield` turns a function into a Generator. It gives you one user at a time, pauses, and waits for you to ask for the next one, saving massive amounts of RAM.", bullet_style))

    story.append(Spacer(1, 15))

    # --- HTML ---
    story.append(Paragraph("2. HTML (The Skeleton)", heading_style))
    story.append(Paragraph("HTML creates the structure of the webpage. It is not a programming language; it is a markup language.", body_style))
    
    story.append(Paragraph("The DOM (Document Object Model)", sub_heading_style))
    story.append(Paragraph("When the browser reads your HTML, it creates a family tree of objects called the DOM. JavaScript talks to this DOM to change what the user sees without reloading the page.", bullet_style))

    story.append(Paragraph("Semantic HTML", sub_heading_style))
    story.append(Paragraph("Instead of using generic `&lt;div&gt;` tags everywhere, we use tags that have meaning, like `&lt;header&gt;`, `&lt;nav&gt;`, and `&lt;footer&gt;`. This helps search engines (SEO) and screen readers for blind users understand the page structure.", bullet_style))

    story.append(Spacer(1, 15))

    # --- CSS ---
    story.append(Paragraph("3. CSS (The Paint & Layout)", heading_style))
    story.append(Paragraph("CSS makes the HTML look good. It handles colors, spacing, and responsive design for mobile.", body_style))

    story.append(Paragraph("The Box Model", sub_heading_style))
    story.append(Paragraph("Every element on a webpage is a box. The Box Model consists of: Content (the actual text/image), Padding (space inside the border), Border (the line around it), and Margin (space outside the border pushing other elements away).", bullet_style))

    story.append(Paragraph("Flexbox vs Grid", sub_heading_style))
    story.append(Paragraph("• <b>Flexbox:</b> Best for aligning items in a single row or column (like a navigation bar).", bullet_style))
    story.append(Paragraph("• <b>CSS Grid:</b> Best for complex 2D layouts with both rows and columns (like a photo gallery or dashboard layout).", bullet_style))

    story.append(Paragraph("Classes vs IDs", sub_heading_style))
    story.append(Paragraph("Classes (`.btn`) can be used on multiple elements. IDs (`#header`) must be completely unique on the page.", bullet_style))

    story.append(PageBreak())

    # --- JAVASCRIPT ---
    story.append(Paragraph("4. JavaScript (The Muscle/Behavior)", heading_style))
    story.append(Paragraph("JS makes the page interactive. It runs in the user's browser, handling clicks, animations, and fetching data from the Python backend.", body_style))

    story.append(Paragraph("Variables: let vs const vs var", sub_heading_style))
    story.append(Paragraph("• <b>let:</b> A variable that can be changed later. Only exists inside the block `{}` where it was created.", bullet_style))
    story.append(Paragraph("• <b>const:</b> A variable that cannot be reassigned. Use this by default to prevent bugs.", bullet_style))
    story.append(Paragraph("• <b>var:</b> The old way. Avoid using it because it 'leaks' out of blocks and causes weird bugs.", bullet_style))

    story.append(Paragraph("Asynchronous JavaScript (Promises & Async/Await)", sub_heading_style))
    story.append(Paragraph("When JS asks Python for database info, it takes time. Instead of freezing the whole browser while waiting, JS uses `async/await`. It basically says: 'Send the request, go do other things, and come back to this exact spot when the data arrives.'", bullet_style))

    story.append(Paragraph("Event Listeners", sub_heading_style))
    story.append(Paragraph("Code that 'listens' for user actions. Example: `button.addEventListener('click', doSomething)`. When the button is clicked, it runs the function.", bullet_style))

    story.append(Spacer(1, 15))

    # --- DATABASES ---
    story.append(Paragraph("5. Databases (The Vault)", heading_style))
    story.append(Paragraph("Databases store persistent data. Without them, everything deletes when you turn off the server.", body_style))

    story.append(Paragraph("Relational (SQL) vs NoSQL", sub_heading_style))
    story.append(Paragraph("• <b>SQL (like PostgreSQL/SQLite):</b> Stores data in strict tables with rows and columns. Best when data is highly connected (e.g., Users have Accounts, Accounts have Transactions).", bullet_style))
    story.append(Paragraph("• <b>NoSQL (like MongoDB):</b> Stores data as flexible JSON documents. Good for rapidly changing, unstructured data.", bullet_style))

    story.append(Paragraph("Keys & Relationships", sub_heading_style))
    story.append(Paragraph("• <b>Primary Key:</b> A unique ID for every row in a table (like an Account Number).", bullet_style))
    story.append(Paragraph("• <b>Foreign Key:</b> A column in one table that links to the Primary Key of another table. This is how you link a Transaction to a specific User.", bullet_style))

    story.append(Paragraph("ACID Properties", sub_heading_style))
    story.append(Paragraph("Crucial for banking apps! ACID ensures transactions are safe.", bullet_style))
    story.append(Paragraph("• <b>Atomicity:</b> 'All or nothing'. If money leaves Account A but fails to reach Account B, the entire transfer is canceled.", bullet_style))
    story.append(Paragraph("• <b>Consistency:</b> The database rules are never broken.", bullet_style))
    story.append(Paragraph("• <b>Isolation:</b> Two people transferring money simultaneously won't mess up the math.", bullet_style))
    story.append(Paragraph("• <b>Durability:</b> Once a transaction is saved, a power outage won't erase it.", bullet_style))

    doc.build(story)
    print(f"Successfully generated {pdf_path}")

if __name__ == '__main__':
    create_pdf()
