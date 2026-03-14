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
# RECOMMENDED: verify "buildforbank.com" in Resend dashboard
# RESEND_FROM = "Smart Bank <support@buildforbank.com>"

_RESEND_KEY = os.environ.get("RESEND_API_KEY")
_ON_CLOUD = any(os.environ.get(k) for k in ['RENDER', 'RAILWAY_ENVIRONMENT', 'PORT'])

# Intelligent fallback for RESEND_FROM
# Resend requires a verified domain or onboarding@resend.dev
_raw_resend_from = os.environ.get("RESEND_FROM")
if not _raw_resend_from:
    # If no sender is set, check if our default sender is a public domain
    _public_domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com']
    _current_domain = SENDER_EMAIL.split('@')[-1].lower()
    
    if _RESEND_KEY and (_ON_CLOUD or _current_domain in _public_domains):
        RESEND_FROM = "Smart Bank <onboarding@resend.dev>"
    else:
        RESEND_FROM = f"Smart Bank <{SENDER_EMAIL}>"
else:
    RESEND_FROM = _raw_resend_from

# Final safety check: if it looks like a public domain and it's Resend, it WILL fail unless it's onboarding
if _RESEND_KEY and any(dom in RESEND_FROM.lower() for dom in ['@gmail.com', '@yahoo.com', '@outlook.com']):
    if "onboarding@resend.dev" not in RESEND_FROM:
        # Fallback to onboarding if it's a known public domain (Resend requirement)
        RESEND_FROM = "Smart Bank <onboarding@resend.dev>"

print(f"📧 Email Config: Resend Sender set to '{RESEND_FROM}'")
