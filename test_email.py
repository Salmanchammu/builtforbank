import sys, os
sys.path.append('backend')
from config import email_config
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

print(f"SMTP Server: {email_config.SMTP_SERVER}")
print(f"Sender Email: {email_config.SENDER_EMAIL}")
print(f"Password (first 4 chars): {email_config.SENDER_PASSWORD[:4]}****")

try:
    msg = MIMEMultipart()
    msg['From'] = email_config.SENDER_EMAIL
    msg['To'] = email_config.SENDER_EMAIL  # sending to self as a test
    msg['Subject'] = 'Smart Bank - Email Test'
    msg.attach(MIMEText('<h1>Email is working!</h1>', 'html'))
    
    with smtplib.SMTP(email_config.SMTP_SERVER, email_config.SMTP_PORT) as server:
        server.starttls()
        server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
        server.send_message(msg)
    print("SUCCESS: Email sent to", email_config.SENDER_EMAIL)
except Exception as e:
    print(f"FAILED: {e}")
