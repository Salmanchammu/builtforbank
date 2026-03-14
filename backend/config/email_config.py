import os

# Email Configuration for Smart Bank
# On Render: set SMTP_SENDER_EMAIL and SMTP_SENDER_PASSWORD as env vars in the dashboard
# Locally: these fall back to the values below

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
try:
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
except ValueError:
    SMTP_PORT = 587  # fallback if env var was set incorrectly
SENDER_EMAIL = os.environ.get("SMTP_SENDER_EMAIL", "builtforbank@gmail.com")
SENDER_PASSWORD = os.environ.get("SMTP_SENDER_PASSWORD", "hlhp upfq ufgi qiev")
SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "false").lower() == "true"

# Resend API Configuration
# By default, Resend requires a verified domain. 
# For testing, you can use "onboarding@resend.dev" which only sends to your own email.
RESEND_FROM = os.environ.get("RESEND_FROM", f"Smart Bank <{SENDER_EMAIL}>")
