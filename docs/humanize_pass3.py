from docx import Document

INPUT  = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Humanized_FINAL_v2.docx'
OUTPUT = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Humanized_ZERO_PLAG.docx'

# Final polish - rewrite anything still slightly stiff or generic-sounding
R = {
    # SRS Purpose section
    "This section breaks down exactly what my code needs to run properly. It lists out the hardware requirements, the software stack I chose, and what the system is actually supposed to do from a technical standpoint.":
        "In this section I documented everything the system needs before it can actually run. That includes the minimum hardware specs, the tools and software I chose, and a clear list of what every feature is supposed to do.",

    # SRS Scope
    "The scope of this project is pretty big. It handles three types of users: normal customers, bank staff who approve things, and the main admin. It covers everything from logging in with your face to sending fake money to other accounts and viewing 3D maps.":
        "This project covers a lot of ground. Three different types of people use it: regular customers, bank staff members, and a system admin. The features range from face-based login and money transfers all the way to a 3D city map for finding branches.",

    # SRS Overview
    "This section essentially lists everything I needed to set up before I could start programming. It explains what the server needs to run, what the browser needs to support, and how the data is kept safe.":
        "Before writing any code, I figured out exactly what the system would need to function. This part covers the server setup, what the browser must be capable of, and how user data stays protected at all times.",

    # Product Perspective
    "Technically, the project is a full-stack web app. I wrote the frontend entirely in plain HTML, CSS, and JS without using any heavy frameworks like React. The backend is written in Python using Flask, and all the data is saved in a simple SQLite database file.":
        "This is a complete web application covering both the visible side and the server side. I built the frontend using just HTML, CSS, and plain JavaScript — no React or any other heavy framework. The server runs on Python with Flask, and all data is kept in a SQLite file on disk.",

    # Assumptions
    "The system assumes users have a working webcam connected to their device for the face login feature.":
        "I built the face login assuming everyone using the system has a working camera on their device. Without a camera, biometric login simply cannot work.",

    "A working internet connection is needed to load external icon sets and fonts from CDN services like FontAwesome and Google Fonts.":
        "The device also needs internet access so that page icons from FontAwesome and text fonts from Google Fonts can load. Without connectivity these visual elements will not appear.",

    # External Interface
    "The app accesses the device camera through the browser to scan faces for login, and saves PDF statements directly to the user's Downloads folder.":
        "For face login, the app opens the device camera directly in the browser without needing any extra software installed. When a user downloads a bank statement, the PDF file goes straight into their Downloads folder.",

    # Communication Interface
    "The frontend talks to the backend using fetch() calls that send and receive JSON data over HTTPS.":
        "Every time the page needs something from the server, it sends a fetch() request. The server replies with a JSON response. Everything travels over HTTPS so the data stays encrypted in transit.",

    # System Design intro fragment fix
    "For the system design, my main worry was making sure nobody could steal fake money or bypass the face login. I spent a lot of time mapping out exactly how a user's browser talks to the Python backend so that things like account balances never get leaked in the network":
        "When I started planning the system design, my biggest concern was security. I spent a long time working out exactly how the browser communicates with the Python backend so that sensitive information like account balances would never leak out over the",

    "tab.":
        "network connection.",

    # Context diagram
    "The diagram below basically shows the 30,000-foot view of the whole project. It shows how the core Python app sits in the middle and talks to the customers on one side, and the bank staff on the other.":
        "This diagram gives the bird's-eye view of the whole system. The Python app is at the center, with customers connecting on one side and bank staff on the other. Everything flows through that central application.",

    # DFD intro
    "I mapped out how exactly the information travels from the user's screen into the backend logic using these custom flowcharts.":
        "To understand how data moves through the system, I created these flowcharts. They show the exact path information takes from the moment a user does something on screen all the way to the backend and back.",

    # Sequence diagrams
    "I drew up these sequence diagrams because the face login logic got really confusing. I needed to see exactly when the JavaScript sends the face data to Python and when Python replies.":
        "The face login involves a lot of back and forth between the browser and the server, so I drew these sequence diagrams to make it clear. They show the exact moment JavaScript sends the face scan data, when Python processes it, and when the result comes back.",

    # Activity diagrams
    "Whenever a process felt too complicated, like the farmer's crop marketplace escrow system, we drew an Activity Diagram. It made it much easier to write the code once we could visualize the exact steps it needed to take.":
        "For any feature that had a lot of conditional steps — like the escrow payment flow in the crop marketplace — I drew an activity diagram first. Seeing the steps laid out made it far easier to turn the logic into working code.",

    # Staff chart description
    "This chart shows the daily workflow for a bank employee, mostly just approving accounts and looking at farmer loan applications.":
        "This diagram maps out a typical day for a bank staff member. Most of their time goes into reviewing new account registrations, checking KYC documents, and going through farmer loan requests.",

    # Customer DFD intro
    "This is the most complex part: it shows everything a normal user can click on once they get past the login screen.":
        "The customer diagram is the most detailed one. Once a user is logged in, they have access to a wide range of features, and this diagram tracks every path they can take through the system.",

    # DB intro
    "For the database I chose SQLite mainly because it is simple to set up — just a single file, no server to configure. But I was very careful with how I designed the tables so that money could never be duplicated or lost if something crashed in the middle of a transfer.":
        "I picked SQLite for the database because setting it up is straightforward — it is just one file and needs no separate server running. That said, I was very careful with the table design to make sure transactions are safe. If the app crashes mid-transfer, money should not disappear or be counted twice.",

    # DB scope
    "Below are the tables I created. I kept them separate and clean — one table for users, one for their accounts, one for transactions, and so on, with proper foreign keys linking them together.":
        "Here are the tables that make up the database. I kept the structure clean and logical — a separate table for each main concept, with foreign keys connecting related records across tables.",

    # Detailed Design intro
    "When I started writing the actual code, I quickly realized that putting everything in one file would be a nightmare to manage. So I split the app into clear sections — one for the admin panel, one for the staff portal, and the largest one for the customer dashboard.":
        "As soon as I began coding, it was obvious that keeping everything in one file was not going to work. I divided the application into separate modules — one handles the admin features, another handles the staff side, and the biggest one takes care of everything the customer sees.",

    # Structure of package
    "The whole backend runs on Python Flask, which serves plain HTML pages to the browser. No heavy frontend framework was used — just regular HTML, CSS, and JavaScript.":
        "The entire server side is built with Python and Flask. It sends plain HTML files to the browser when a page is requested. I did not use any frontend framework — everything on screen is powered by regular HTML, CSS, and vanilla JavaScript.",

    # Admin panel desc
    "The admin panel is the top-level control screen. From here you can add new staff members, check the bank's total funds, and update the 3D branch and ATM map.":
        "The admin control screen sits at the top of the entire system. From here, a superuser can bring in new staff, review the bank's overall financial picture, and keep the 3D branch locator map up to date.",

    # Staff screen desc
    "The staff screen works like a task queue. Any time a new customer registers, their application sits here waiting for a staff member to review and approve before they can access their account.":
        "Think of the staff dashboard as a work queue. Every new customer application that comes in sits here until a staff member opens it, checks the details, and gives it the green light — only then can the customer log in.",

    # Customer screen desc
    "This is the main dashboard that most users will spend their time on. It is where you check your balance, send money, manage your card, and use the savings pockets.":
        "The customer dashboard is what the average user sees when they log in. It is the hub for everything — checking how much money you have, sending payments, managing cards, and building up savings goals.",

    # Project category
    "Full-Stack Web Application (Banking + Face Recognition Security)":
        "Full-Stack Web Application covering digital banking features and biometric face recognition security.",
}

def replace_para(para, new_text):
    if not para.runs:
        para.text = new_text
        return
    first = para.runs[0]
    for r in para.runs: r.text = ''
    first.text = new_text
    for r in para.runs[1:]:
        r._element.getparent().remove(r._element)

def run():
    doc = Document(INPUT)
    changed = 0
    for para in doc.paragraphs:
        t = para.text.strip()
        if t in R:
            replace_para(para, R[t])
            changed += 1
    doc.save(OUTPUT)
    print(f"Pass-3 done: {changed} paragraphs polished.")
    print(f"Saved: {OUTPUT}")

if __name__ == '__main__':
    run()
