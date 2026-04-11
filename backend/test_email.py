from core.email_utils import send_email_diagnostic
import sys

print("Testing email configuration...")
results = send_email_diagnostic("cat674624@gmail.com", "Test Email", "<h1>Hello from Smart Bank Test!</h1>")
print(results)
