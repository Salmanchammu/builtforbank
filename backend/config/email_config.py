# Email Configuration for Password Reset
# Edit these settings to enable email sending

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "builtforbank@gmail.com"  # Your email address
SENDER_PASSWORD = "hlhp upfq ufgi qiev"  # Your app password (not regular password)

# HOW TO GET GMAIL APP PASSWORD:
# 1. Go to your Google Account (myaccount.google.com)
# 2. Click "Security" on the left
# 3. Under "Signing in to Google", enable "2-Step Verification"
# 4. Once enabled, go back to Security
# 5. Click "App passwords" under "Signing in to Google"
# 6. Select "Mail" and "Other (Custom name)"
# 7. Enter "Smart Bank" as the name
# 8. Click "Generate"
# 9. Copy the 16-character password
# 10. Paste it as SENDER_PASSWORD above

# For other email providers:
# - Outlook: smtp.office365.com (port 587)
# - Yahoo: smtp.mail.yahoo.com (port 587)
# - Custom: Contact your email provider for SMTP settings
