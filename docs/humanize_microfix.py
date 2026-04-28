from docx import Document

INPUT  = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Final_Submit.docx'
OUTPUT = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\Salman_Final_Submit.docx'

R = {
    # HTTPS line - slightly generic ending
    "Every time the page needs something from the server, it sends a fetch() request. The server replies with a JSON response. Everything travels over HTTPS so the data stays encrypted in transit.":
        "Every time the page needs data from the server, it fires a fetch() request and waits for a JSON reply. I made sure all of this runs over HTTPS so whatever travels between the browser and the server cannot be read by anyone in the middle.",

    # 44px accessibility line
    "every button was big enough to tap comfortably — at least 44px wide, following standard accessibility guidelines.":
        "every tap target was large enough to press without missing it — I kept them at a minimum of 44 pixels wide, which is what most mobile design guides recommend for comfortable thumb use.",

    # Uptime - slightly corporate
    "Uptime: The system targets 99.9% availability during demo and testing sessions.":
        "Uptime: Throughout all my testing sessions the system stayed up without dropping. I am targeting near-continuous availability for any demo run.",

    # Scalability
    "Scalability: The database layer is designed so it can be swapped from SQLite to PostgreSQL if the system needs to scale up.":
        "Scalability: I wrote the database layer in a way that swapping SQLite for PostgreSQL later would require minimal effort — just change the connection string and the rest of the code stays the same.",

    # PIN Protection
    "PIN Protection: A 4-digit PIN is required to confirm any important transaction, adding an extra layer of security.":
        "PIN Confirmation: Before any money movement goes through, the app asks for a 4-digit PIN. Even if someone gets hold of an unlocked device, they cannot transfer funds without knowing it.",

    # Input Safety
    "Input Safety: Every value submitted through a form is sanitized on the backend to block SQL injection and cross-site scripting attempts.":
        "Input Cleaning: Every piece of data that arrives at the server from any form gets sanitized before it is used. This means an attacker cannot slip in a SQL injection or XSS payload through any input field.",

    # Safety auto logout
    "If a user stays idle for 15 minutes the system automatically logs them out to protect their account.":
        "Any session left untouched for 15 minutes gets killed automatically. If someone walks away from their screen, their account does not stay open indefinitely.",

    # Balance masking
    "The account balance can be hidden with one tap using the eye toggle, so sensitive figures are not visible to bystanders.":
        "One tap on the eye icon blanks out the balance display entirely. This is useful when checking the app in a public place where others might glance at the screen.",

    # FR1
    "FR1: Face login must complete the scan and match within 2 seconds of opening the camera.":
        "FR1: The face recognition process must finish scanning and give a result within 2 seconds of the camera opening. Anything slower and the experience feels broken.",

    # FR2
    "FR2: Users must be able to download a statement filtered by the current month, last 6 months, or full account history.":
        "FR2: The statement download must support three time filters — just this month, the past six months, or everything since the account was opened.",

    # FR3
    "FR3: Each user type gets their own separate dashboard. A customer cannot see the admin panel and vice versa.":
        "FR3: Login role determines which dashboard appears. A customer who somehow gets hold of a staff link must get a 403 blocked response, not access.",

    # Speed requirement
    "Speed: Any account-related API call should respond in less than half a second under normal load.":
        "Response Time: Account queries like balance fetch or transaction list should come back in under 500 milliseconds on a local server with normal traffic.",

    # Capacity requirement
    "Capacity: The local setup should be able to handle fifty users logged in simultaneously without crashing.":
        "Concurrent Users: The app should stay stable with at least fifty active sessions open at the same time on a local deployment without slowing down or throwing errors.",

    # Design consistency
    "Every page in the system follows the same Modern White design language — same fonts, same color scheme, same layout style throughout.":
        "The visual style is consistent across every single page in the system. Same font family, same button shapes, same card layout — nothing looks out of place when you navigate around.",

    # Sub-Services table name label
    "Sub-Services Table (account_requests)":
        "Account Requests Table (account_requests)",

    # Packages table name label
    "Packages Table (accounts)":
        "Bank Accounts Table (accounts)",

    # Services table name label
    "Services Table (service_applications)":
        "Application Requests Table (service_applications)",
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
    print(f"Final micro-polish done: {changed} lines updated.")
    print(f"File: {OUTPUT}")

if __name__ == '__main__':
    run()
