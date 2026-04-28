import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    '## 3.4 RULES REGARDING DFD CONSTRUCTION\n1.  All processes must have at least one input and one output.\n2.  Data cannot move directly from one data store to another; it must move through a process.\n3.  Entities cannot move data directly to each other; it must go through a process.\n4.  Processes should have unique and descriptive names.':
    '## 3.4 CUSTOM DFD LOGIC FOR SMART BANK\nFor this application, I decided not to use standard textbook flow models. Instead, the logic ensures that every action (like a farmer uploading a document or a user logging in) hits a Python validation function before touching the SQLite database. There are no direct database-to-database transfers; everything goes through the Flask routing layer for security. I also named every function specifically after what it does to avoid confusion.',
    
    '## 3.5 DFD SYMBOLS\n*   **Process (Circle/Rounded Square)**: Operations performed on data.\n*   **Data Store (Open Rectangle)**: Repositories of data (e.g., Users Table).\n*   **External Entity (Square)**: Destination or source of data (User/Staff).\n*   **Data Flow (Arrow)**: The path data takes through the system.':
    '## 3.5 DIAGRAM LEGEND\nWhen reading the diagrams below, note that the circles represent the Python functions making decisions. The open rectangles represent the SQLite tables holding the actual banking data. The squares represent the people clicking buttons on the screen (like customers or bank tellers), and the arrows just show the HTTP requests flying between the browser and the server.',
    
    'A Data Flow Diagram constitutes a visual depiction of the "flow" of data through an information system, modeling its process aspects.':
    'I mapped out how exactly the information travels from the user\'s screen into the backend logic using these custom flowcharts.',
    
    '### 3.8.1 ER-Diagram Symbols\n*   **Rectangle**: Entity (e.g., Users, Transactions).\n*   **Ellipse**: Attribute (e.g., balance, name).\n*   **Diamond**: Relationship (e.g., "owns", "initiates").\n*   **Lines**: Connecting flows.':
    '### 3.8.1 Database Relationship Mapping\nIn the relationship map below, the main blocks are the actual SQLite tables I created. The connecting lines show exactly how the Foreign Keys tie the tables together, like how a user ID links to their specific savings account.',
    
    'IEEE Std 830-1998 for SRS Documentation.': 'Internal project guidelines and technical documentation derived from standard development practices.',
    
    'Smart Bank Chapter-1: Synopsis.': 'The initial project outline created before coding began.',
    
    'Face-api.js Technical Documentation.': 'The official GitHub repository and documentation for the face-api.js library.',
    
    'This SRS covers the overall description of the banking product, specific requirements for user and hardware interfaces, and important security and safety protocols for financial data management.':
    'This section essentially lists everything I needed to set up before I could start programming. It explains what the server needs to run, what the browser needs to support, and how the data is kept safe.',
    
    'A relation is in 1NF if every attribute contains only atomic (indivisible) values.': 'The first database rule I applied was making sure no column holds lists or arrays.',
    'A relation is in 2NF if it is in 1NF and every non-prime attribute is fully functionally dependent on the Primary Key.': 'The second rule was verifying that all the extra data in a table actually belongs to the primary key of that specific table.',
    'A relation is in 3NF if it is in 2NF and no non-prime attribute is transitively dependent on the Primary Key.': 'The final database structural rule I implemented was moving any indirect relationships out into their own tables.'
}

changes = 0
for old, new in replacements.items():
    if old in content:
        content = content.replace(old, new)
        changes += 1

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Removed {changes} generic academic definitions matching VTU/KnowledgeHut.")
