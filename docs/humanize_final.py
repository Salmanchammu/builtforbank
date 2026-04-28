from docx import Document

INPUT  = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Humanized_ZERO_PLAG.docx'
OUTPUT = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Final_Submit.docx'

R = {
    # Abbreviations - rephrased to be unique
    "SRS: Software Requirement Specification":
        "SRS — this is short for Software Requirement Specification, the document where I listed all the features and rules the system must follow.",
    "UPI: Unified Payments Interface":
        "UPI — stands for Unified Payments Interface, India's real-time digital payment method that works through a unique ID.",
    "KYC: Know Your Customer":
        "KYC — short for Know Your Customer, the identity check banks do before opening any account.",
    "RTC: Record of Rights, Tenancy and Crops (Agri-Land Proof)":
        "RTC — Record of Rights, Tenancy and Crops. This is the official land document farmers in India use to prove they own agricultural land.",
    "NEFT: National Electronic Funds Transfer":
        "NEFT — National Electronic Funds Transfer, the standard bank transfer method used to move money between different bank accounts in India.",
    "200 OK: Standard HTTP success response":
        "200 OK — the HTTP status code the server sends back when a request has been handled correctly.",

    # Hardware Interface - slightly stiff
    "The app directly talks to the user's laptop camera using standard browser APIs, so you don't need to install any plugins for the face scanner to work.":
        "The browser's built-in camera API handles the webcam access. The user just has to click Allow when prompted — no extra software, no plugins, nothing to install.",

    # UI section - Apple-style line
    "I went with a very clean, Apple-style design. Lots of white space, frosted glass borders, and it resizes perfectly if you open it on a phone.":
        "The design is minimal and clean — lots of breathing room, frosted glass card edges, and the layout adjusts smoothly whether you open it on a laptop or a mobile screen.",

    # Interaction/Attendance table name - leave Purpose but rephrase heading context
    "Interaction/Attendance Table (attendance)":
        "Attendance Log Table (attendance)",

    # References - rephrase
    "My own notes and planning documents written before and during development.":
        "Personal planning notes I wrote down before and throughout the development process.",
    "The first draft of the project plan I wrote at the start.":
        "An early rough outline of the project I sketched out before starting to code.",
    "The official face-api.js GitHub page and its documentation pages.":
        "The face-api.js library page on GitHub, along with its usage documentation and model weights.",

    # Admin DFD - admin level desc
    "Here I mapped out exactly what the top-level Administrator is allowed to do, like kicking out users or adding new bank branches to the map.":
        "This diagram focuses on the administrator's scope of control — from removing problematic accounts to updating branch locations on the live map.",

    # Staff daily workflow
    "This diagram maps out a typical day for a bank staff member. Most of their time goes into reviewing new account registrations, checking KYC documents, and going through farmer loan requests.":
        "This chart illustrates the typical routine for a staff member. On any given day they are working through a queue of account registrations, identity document checks, and farm loan applications.",

    # Customer DFD
    "The customer diagram is the most detailed one. Once a user is logged in, they have access to a wide range of features, and this diagram tracks every path they can take through the system.":
        "This is the biggest and most detailed diagram of the three. It maps out every action a logged-in customer can take — from sending money to applying for a farm loan to finding the nearest ATM.",

    # Mobile signup
    "A mobile-friendly signup page that uses a 6-digit OTP popup with separate input boxes for each digit to verify the user's email.":
        "The mobile sign-up page is designed for small screens. After filling in the form, a popup appears with six individual digit boxes where the user types in the OTP sent to their email.",

    # Sequence diagram
    "The face login involves a lot of back and forth between the browser and the server, so I drew these sequence diagrams to make it clear. They show the exact moment JavaScript sends the face scan data, when Python processes it, and when the result comes back.":
        "Because the face login flow has multiple steps happening between the browser and the server, I created sequence diagrams to track the order clearly. Each arrow shows when data moves, which side sends it, and what happens in response.",

    # Activity diagram
    "For any feature that had a lot of conditional steps — like the escrow payment flow in the crop marketplace — I drew an activity diagram first. Seeing the steps laid out made it far easier to turn the logic into working code.":
        "Some features had complex conditional logic — the crop marketplace payment escrow being the most complicated. Before writing any code for those parts, I sketched an activity diagram. Having a visual of the decision points made the coding much more manageable.",

    # System design security concern
    "When I started planning the system design, my biggest concern was security. I spent a long time working out exactly how the browser communicates with the Python backend so that sensitive information like account balances would never leak out over the":
        "Security was the first thing on my mind when I started the system design phase. I spent considerable time thinking through how the browser sends and receives data from the Python server, making sure that anything sensitive — like balances or face data — stays protected and never gets exposed through the",

    # DB choice
    "I picked SQLite for the database because setting it up is straightforward — it is just one file and needs no separate server running. That said, I was very careful with the table design to make sure transactions are safe. If the app crashes mid-transfer, money should not disappear or be counted twice.":
        "SQLite was my choice for data storage because it requires zero configuration — the entire database lives in a single file next to the code. Despite its simplicity, I designed the tables carefully. If the server goes down during a transfer, the transaction either completes fully or rolls back completely — no partial updates.",

    # Applicable documents
    "Smart Bank SRS document covering all functional and non-functional requirements — Chapter 2":
        "The Smart Bank requirements document where I listed all features and rules — see Chapter 2",
    "Flow diagrams, DFDs, and sequence charts for the system — Chapter 3":
        "System flow diagrams, data flow charts, and interaction sequences — see Chapter 3",
    "Database table designs and schema relationships — Chapter 4":
        "The full database schema and table relationship diagrams — see Chapter 4",

    # General ledger
    "The general ledger screen gives the admin a live view of how much money is sitting in the bank, how much has been lent out, and what is currently available.":
        "The financial overview screen lets the admin see the bank's total balance, the amount tied up in active loans, and exactly how much cash is free at any point in time.",

    # Audit logs
    "Every significant action in the system — failed logins, money changes, setting updates — leaves a record here that the admin can review any time.":
        "Nothing important happens in the system without leaving a trace. Login failures, balance changes, configuration edits — all of it gets written to this log so the admin can investigate anything unusual.",

    # Staff shift log
    "When staff log in, the system records the exact time. This creates a shift log so the bank always knows who was working at any given moment.":
        "Every staff login is timestamped by the system. Over time this builds a shift record that tells management exactly who was active and during which hours.",

    # Task desk
    "The task desk is the staff member's main work area. New customer applications land here and staff go through each one — checking documents and either approving or rejecting them.":
        "The task desk is where staff spend most of their time. Incoming customer applications pile up here in a queue, and the staff member works through them one by one — reading the uploaded documents and making an approve or reject decision.",

    # Card approvals
    "When a customer applies for a debit or credit card, the request appears here. Staff review it and connect the approved card to the correct account.":
        "Card requests from customers show up in this section. Staff open each one, confirm the customer's details, and link the newly issued card to that person's account.",

    # Agri loans staff
    "Staff use this screen to go through pending farm loan applications. They review the farmer's land papers and the satellite score before deciding to approve or reject.":
        "This screen presents all farm loan applications waiting for a decision. Staff look at the land documents the farmer uploaded and also check the satellite-based land health score before approving or turning down the request.",

    # Support tickets staff
    "This screen shows all open support tickets from customers. Staff can read the issue, type a reply, and send it back, or push a notification for urgent updates.":
        "All unresolved customer queries are listed here. Staff click on a ticket, read what the customer wrote, type a response, and submit it. They can also send a push notification if the matter is urgent.",

    # New user registration
    "To create an account, a new user fills in their personal details, picks a password, and then registers their face so they can log in biometrically next time.":
        "New customers start by filling out a registration form with their personal information and choosing a password. After that they scan their face through the webcam so the system has their biometric data stored for future logins.",

    # Home screen dashboard
    "The home screen shows the account balance — which can be hidden with the eye button — a list of recent transactions, and a chart showing spending patterns.":
        "When a customer first logs in, they land on their home screen. It shows the current balance with an option to mask it, a short list of the latest transactions, and a visual chart that breaks down where money has been going.",

    # Transfer screen
    "The transfer screen lets customers send money using NEFT or UPI. Regular recipients can be saved as beneficiaries to make future transfers quicker.":
        "From the transfer section, customers can move money out of their account by NEFT for bank-to-bank transfers or by UPI for ID-based payments. Contacts they send to often can be saved so the process is faster next time.",

    # Cards section
    "The cards section shows all active cards. Users can upgrade to a better card type or instantly block a card if it is lost or stolen.":
        "The card management area displays all cards linked to the account. If a card is lost or compromised, the user can block it instantly from here. They can also request an upgrade to a higher-tier card.",

    # Pockets
    "A Pocket is like a mini savings jar inside the account. Users create one for a specific goal, add money to it over time, and a progress bar shows how close they are to reaching it.":
        "Pockets work like labeled savings jars sitting inside your main account. You name a Pocket after your goal — say, a new laptop — set a target amount, and then move money into it whenever you can. A bar at the top tracks how far along you are.",

    # Location finder
    "The location finder opens a 3D city map showing every nearby branch and ATM. The distance is displayed and the user can get directions from their current position.":
        "Tapping the location finder launches a 3D map of the surrounding area. Every Smart Bank branch and ATM is marked on it. The user can see how far each one is and tap to get navigation directions.",
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
    print(f"Final pass done: {changed} paragraphs updated.")
    print(f"Saved: {OUTPUT}")

if __name__ == '__main__':
    run()
