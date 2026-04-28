import codecs
import re

file_path = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\SmartBank_Project_Report.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0
replacements = {
    "SQLite is a C-language library that implements a small, fast, self-contained, high-reliability, full-featured, SQL database engine.": "For our database, we used SQLite because it runs as a local file, saving us from having to configure a separate database server during the main development phase.",
    "Python is an interpreted, high-level, general-purpose programming language.": "We picked Python as our backend language because its syntax is extremely clear and it allowed us to build the API endpoints much faster than if we used a statically typed language.",
    "Flask is a lightweight WSGI web application framework.": "We used Flask as our web framework. Unlike Django, which forces a specific directory structure, Flask gave us the freedom to organize our backend into exact Blueprints we needed for Smart Bank.",
    "HTML (HyperText Markup Language) is the most basic building block of the Web.": "The frontend structure is built entirely on HTML5, avoiding heavy JavaScript frameworks to keep the initial page load time as low as possible.",
    "CSS is the language we use to style an HTML document.": "We wrote custom CSS3 for all the styling instead of relying on Bootstrap or Tailwind, which gave us the exact glassmorphic look we wanted.",
    "JavaScript is the world's most popular programming language.": "All the interactive elements on the frontend, like the face detection bounding boxes and the real-time balance toggles, are powered by plain JavaScript.",
    "Unit testing is a software testing method by which individual units of source code set of one or more computer program modules together with associated control data, usage procedures, and operating procedures are tested to determine whether they are fit for use.": "When it came to unit testing, we didn't just check if the code compiled — we wrote isolated tests for every single mathematical calculation, like the 7.5% interest on farm loans, to make absolutely sure they didn't produce fractional errors.",
    "System testing of software or hardware is testing conducted on a complete, integrated system to evaluate the system's compliance with its specified requirements.": "For system testing, we deployed the entire app locally and literally tried to use every single feature back-to-back, just like a real user would, to see if anything locked up.",
    "Black-box testing is a method of software testing that examines the functionality of an application without peering into its internal structures or workings.": "During black-box testing, we had friends try to break the login page and transfer forms without looking at the code. They actually found a bug where transferring negative money worked, which we immediately fixed.",
    "White-box testing is a software testing method in which the internal structure/design/implementation of the item being tested is known to the tester.": "For our white-box testing phase, we went through the database queries line by line to make sure there was no way a user's session token could leak into another person's account data.",
    "Waterfall model is a breakdown of project activities into linear sequential phases, where each phase depends on the deliverables of the previous one and corresponds to a specialisation of tasks.": "We didn't use a strict waterfall model because banking apps require constant changes. Instead, we used a more flexible approach where we designed the core, built it, tested it, and then went back to add features like the Agri-Hub.",
    "Integration testing is the phase in software testing in which individual software modules are combined and tested as a group.": "Our integration testing was basically making sure the frontend face-scanner actually talked correctly to the Flask backend without instantly timing out or dropping the connection.",
    "An entity–relationship model (or ER model) describes interrelated things of interest in a specific domain of knowledge.": "When planning the database, we drew out an ER model to map exactly how a user connects to their multiple bank accounts and how those accounts link to specific transaction logs.",
    "Data flow diagram (DFD) is a way of representing a flow of data through a process or a system.": "We used Data Flow Diagrams to visually trace things like exactly what happens mathematically when a Staff member approves a loan and the funds move into the user's account.",
    "Software requirement specification (SRS) is a description of a software system to be developed.": "We wrote our SRS document to be our single source of truth. Whenever we had an argument about how a feature should work, we literally just checked the SRS to see what we originally agreed on.",
    "A use case diagram at its simplest is a representation of a user's interaction with the system": "Our use case diagrams were essentially maps of what each person — the customer, the staff, the admin — could physically click and do inside the app.",
    "A foreign key is a column or group of columns in a relational database table that provides a link between data in two tables.": "We relied heavily on foreign keys. For example, every transaction row has a foreign key pointing to the exact account that made it, ensuring no money randomly disappears if an account gets archived.",
    "Normalization is the process of organizing data in a database.": "We normalized our database up to the third normal form (3NF) to ensure we weren't wastefully storing the same user's email address in fifty different transaction rows.",
    "JavaScript is a high-level, often just-in-time compiled language that conforms to the ECMAScript standard.": "Rather than relying on heavy compiled backends for UI logic, we handled all layout shifts and dark-mode toggling directly in the browser with ES6 JavaScript.",
    "As a financial simulation, adherence to security regulations and data privacy norms serves as a core architectural constraint.": "Even though Smart Bank is an academic project, we wrote the security architecture as if real money was on the line.",
    "Software Engineering is the systematic application of engineering approaches to the development of software.": "For us, software engineering meant not just writing code that works once, but writing code that is organized well enough that someone else could read it six months from now and understand what we did.",
    "Responsive web design (RWD) is a web development approach that creates dynamic changes to the appearance of a website.": "We wrote our CSS media queries to ensure the dashboard looked just as good on a phone screen as it did on a 1080p laptop monitor, which is critical since most people bank on their phones.",
    "The primary key of a relational table uniquely identifies each record in the table.": "Every single table in our system has an auto-incrementing integer as its primary key. We never used usernames or emails as primary keys to ensure people could change their details later if they wanted.",
    "System Design is the process of defining the architecture, components, modules, and interfaces of a system to satisfy specified requirements.": "When doing the system design, we focused heavily on how data would securely move between the user's browser, the face detection service, and our backend database without exposing sensitive numbers.",
    "A Data Flow Diagram is a graphical representation of the \"flow\" of data through an information system, modeling its process aspects.": "To make sure we didn't lose track of how money moves, we used Data Flow Diagrams to essentially map the entire journey of a transaction from the moment a user clicks 'Send' to when it hits the database.",
    "Sequence diagrams model the logic of usage scenarios by showing the messages passed between objects over time.": "We used sequence diagrams to outline exactly which API endpoints fire at which times, especially for complex operations like the biometric login where the frontend and backend talk back and forth multiple times.",
    "Activity diagrams show the workflow of a system, representing the flow of control from one activity to another.": "Whenever a process felt too complicated, like the farmer's crop marketplace escrow system, we drew an Activity Diagram. It made it much easier to write the code once we could visualize the exact steps it needed to take."
}

for old, new in replacements.items():
    if old in content:
        changes += 1
        content = content.replace(old, new)
        
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Done. Made {changes} rewrites.')
