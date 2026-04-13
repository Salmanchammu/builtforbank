import os
import threading
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger('smart_bank.email')

# Try importing from the config package in the parent directory
# Try absolute package import first (for Gunicorn/Render), then relative for direct execution
try:
    from backend.config import email_config
except (ImportError, ValueError):
    try:
        from config import email_config
    except ImportError:
        try:
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
            from config import email_config
        except ImportError:
            email_config = None

def send_email_async(to_email, subject, body_html):
    """Send email in a separate thread to avoid blocking the main request."""
    def send_task():
        try:
            if not email_config or email_config.SENDER_EMAIL == "your-email@gmail.com":
                logger.warning(f"Email not configured. To: {to_email}")
                return

            logger.info(f"Starting email delivery to {to_email}...")
            
            # Try Brevo (Sendinblue) HTTP API first
            brevo_api_key = email_config.BREVO_API_KEY
            if brevo_api_key:
                try:
                    import urllib.request as urllib_req
                    import json as json_lib
                    
                    payload = json_lib.dumps({
                        "sender": {"name": "Smart Bank", "email": email_config.SENDER_EMAIL},
                        "to": [{"email": to_email}],
                        "subject": subject,
                        "htmlContent": body_html
                    }).encode('utf-8')
                    
                    req = urllib_req.Request(
                        "https://api.brevo.com/v3/smtp/email",
                        data=payload,
                        headers={
                            "api-key": brevo_api_key,
                            "Content-Type": "application/json",
                            "User-Agent": "SmartBank/2.0"
                        }
                    )
                    
                    with urllib_req.urlopen(req, timeout=15) as response:
                        res_body = response.read().decode('utf-8')
                        logger.info(f"Email sent via Brevo to {to_email}. Response: {res_body}")
                    return
                except Exception as e:
                    logger.error(f"Brevo API failure: {str(e)}")

            # Try Resend HTTP API second
            resend_api_key = email_config.RESEND_API_KEY
            if resend_api_key:
                try:
                    import urllib.request as urllib_req
                    import json as json_lib
                    
                    resend_sender = getattr(email_config, 'RESEND_FROM', f"Smart Bank <{email_config.SENDER_EMAIL}>")
                    
                    payload = json_lib.dumps({
                        "from": resend_sender,
                        "to": [to_email],
                        "subject": subject,
                        "html": body_html
                    }).encode('utf-8')
                    
                    req = urllib_req.Request(
                        "https://api.resend.com/emails",
                        data=payload,
                        headers={
                            "Authorization": f"Bearer {resend_api_key}",
                            "Content-Type": "application/json",
                            "User-Agent": "SmartBank/2.0"
                        }
                    )
                    
                    with urllib_req.urlopen(req, timeout=15) as response:
                        res_body = response.read().decode('utf-8')
                        logger.info(f"Email sent via Resend to {to_email}. Response: {res_body}")
                    return
                except Exception as e:
                    logger.error(f"Resend API failure: {str(e)}")

            # SMTP fallback
            msg = MIMEMultipart()
            msg['From'] = email_config.SENDER_EMAIL
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body_html, 'html'))

            # Force SSL for port 465, else use STARTTLS
            if email_config.SMTP_PORT == 465 or getattr(email_config, 'SMTP_USE_SSL', False):
                import ssl
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(email_config.SMTP_SERVER, email_config.SMTP_PORT, context=context, timeout=10) as server:
                    server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(email_config.SMTP_SERVER, email_config.SMTP_PORT, timeout=10) as server:
                    server.starttls()
                    server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                    server.send_message(msg)
            logger.info(f"Email successfully delivered via SMTP to {to_email}")
            
        except Exception as e:
            logger.error(f"FATAL: All email methods failed for {to_email}: {str(e)}")
            
            # --- RENDER LOG FALLBACK (Extremely Important for the user) ---
            # If all else fails, we PRINT the code to the terminal so the user can see it in Render Logs
            import re
            otp_match = re.search(r'<b>(\d{6})</b>', body_html)
            code = otp_match.group(1) if otp_match else "Unknown"
            
            print("\n" + "!"*60)
            print(f"!!! EMAIL DELIVERY FAILED TO: {to_email}")
            print(f"!!! YOUR VERIFICATION CODE IS: {code}")
            print(f"!!! Check Render logs if you didn't get the email.")
            print("!"*60 + "\n")

    # Execute asynchronously
    import threading
    threading.Thread(target=send_task, daemon=True).start()

def send_email_diagnostic(to_email, subject, body_html):
    """Synchronous version of send_email for diagnostics. Returns detailed results."""
    import traceback
    results = {"success": False, "resend": None, "smtp": None, "config": "Unknown"}
    
    if not email_config or email_config.SENDER_EMAIL == "your-email@gmail.com":
        results["config"] = "Email not configured (using default placeholders)"
        return results
    
    results["config"] = f"Configured sender: {email_config.SENDER_EMAIL}"
    
    # Try Brevo first
    brevo_api_key = os.environ.get("BREVO_API_KEY")
    if brevo_api_key:
        try:
            import urllib.request as urllib_req
            import json as json_lib
            payload = json_lib.dumps({
                "sender": {"name": "Smart Bank", "email": email_config.SENDER_EMAIL},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": body_html
            }).encode('utf-8')
            req = urllib_req.Request("https://api.brevo.com/v3/smtp/email", data=payload,
                                    headers={"api-key": brevo_api_key, "Content-Type": "application/json", "User-Agent": "SmartBank/2.0"})
            with urllib_req.urlopen(req, timeout=10) as response:
                results["brevo"] = f"Success: {response.read().decode('utf-8')}"
                results["success"] = True
        except urllib_req.HTTPError as he:
            error_body = he.read().decode('utf-8') if he.fp else 'No body'
            results["brevo"] = f"HTTP {he.code}: {error_body}"
        except Exception as e:
            results["brevo"] = f"FAILED: {str(e)}"
    if not results["success"]:
      resend_api_key = os.environ.get("RESEND_API_KEY")
      if resend_api_key:
        try:
            import urllib.request as urllib_req
            import json as json_lib
            resend_sender = getattr(email_config, 'RESEND_FROM', f"Smart Bank <{email_config.SENDER_EMAIL}>")
            results["resend_from"] = resend_sender
            payload = json_lib.dumps({
                "from": resend_sender,
                "to": [to_email],
                "subject": subject,
                "html": body_html
            }).encode('utf-8')
            req = urllib_req.Request("https://api.resend.com/emails", data=payload,
                                    headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json", "User-Agent": "SmartBank/2.0"})
            with urllib_req.urlopen(req, timeout=10) as response:
                results["resend"] = f"Success: {response.read().decode('utf-8')}"
                results["success"] = True
        except urllib_req.HTTPError as he:
            error_body = he.read().decode('utf-8') if he.fp else 'No body'
            results["resend"] = f"HTTP {he.code}: {error_body}"
        except Exception as e:
            results["resend"] = f"FAILED: {str(e)}\n{traceback.format_exc()}"

    if not results["success"]:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart()
            msg['From'] = email_config.SENDER_EMAIL
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body_html, 'html'))
            
            use_ssl = email_config.SMTP_PORT == 465 or getattr(email_config, 'SMTP_USE_SSL', False)
            if use_ssl:
                import ssl; context = ssl.create_default_context()
                with smtplib.SMTP_SSL(email_config.SMTP_SERVER, email_config.SMTP_PORT, context=context, timeout=10) as server:
                    server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(email_config.SMTP_SERVER, email_config.SMTP_PORT, timeout=10) as server:
                    server.starttls()
                    server.login(email_config.SENDER_EMAIL, email_config.SENDER_PASSWORD)
                    server.send_message(msg)
            results["smtp"] = "Success via SMTP"
            results["success"] = True
        except Exception as e:
            results["smtp"] = f"FAILED: {str(e)}\n{traceback.format_exc()}"
            
    return results
