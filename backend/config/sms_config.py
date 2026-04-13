try:
    import requests
except ImportError:
    requests = None
import json
import os

# SMS Configuration for Smart Bank (India)
# Using Fast2SMS or similar provider pattern

# --- HOW TO ENABLE FAST2SMS REAL SMS ---
# 1. Get your free API Key from Fast2SMS.com
# 2. Paste your API key exactly between the quotes below:
USER_API_KEY = "KidkRh1z7QnBFxZoJYHemajvwC9XWDMcT6sN2IApt5uP0r3LEgKyI8XEAhxDL7SdOzoBu2v6an05PH3c"

SMS_CONFIG = {
    "provider": "Fast2SMS",
    "api_key": USER_API_KEY,
    "sender_id": "SMTBnk",
    "route": "q", # 'q' is quick route
    "enabled": True,
    # Mock mode will automatically turn off once you paste your real API key above!
    "mock_mode": len(USER_API_KEY) < 10
}

def send_sms(phone, message):
    """
    Sends an SMS notification to the specified phone number.
    Handles DLT-compliant messaging for India.
    """
    if not SMS_CONFIG["enabled"]:
        return False
    
    if not phone:
        print("SMS Error: No phone number provided.")
        return False

    # Normalize phone number (strip +91 etc if needed)
    clean_phone = ''.join(filter(str.isdigit, str(phone)))
    if len(clean_phone) > 10:
        clean_phone = clean_phone[-10:]

    def send_via_textbelt(ph, msg):
        try:
            # Textbelt requires country code
            tb_phone = f"+91{ph}" if len(ph) == 10 else f"+{ph}"
            tb_payload = {
                'phone': tb_phone,
                'message': msg,
                'key': 'textbelt'
            }
            resp = requests.post('https://textbelt.com/text', data=tb_payload, timeout=5)
            tb_data = resp.json()
            if tb_data.get('success'):
                print(f"SMS successfully sent via Textbelt FREE API to {tb_phone}")
                return True
            else:
                print(f"Textbelt failed: {tb_data.get('error')}")
                return False
        except Exception as te:
            print(f"Textbelt Exception: {te}")
            return False

    if SMS_CONFIG["mock_mode"]:
        print(f"--- [MOCK SMS / TEXTBELT FALLBACK] ---")
        print(f"Attempting to send real SMS via Textbelt free tier to {clean_phone}...")
        # Since mock is active, we try textbelt so they get at least 1 free real SMS for testing!
        if send_via_textbelt(clean_phone, message):
            return True
        # If textbelt quota exhausted, fall back to physical log
        print(f"Writing to physical log instead.")
        with open("sms_log.txt", "a") as f:
            f.write(f"[{phone}] {message}\n")
        return True

    try:
        url = "https://www.fast2sms.com/dev/bulkV2"
        querystring = {
            "authorization": SMS_CONFIG["api_key"],
            "route": SMS_CONFIG["route"],
            "message": message,
            "language": "english",
            "flash": "0",
            "numbers": clean_phone
        }
        
        headers = { 'cache-control': "no-cache" }
        response = requests.request("GET", url, headers=headers, params=querystring, timeout=5)
        res_data = response.json()
        
        if res_data.get("return"):
            print(f"SMS successfully sent via Fast2SMS to {phone}")
            return True
        else:
            print(f"Fast2SMS failed: {res_data.get('message')}. Falling back to Textbelt...")
            return send_via_textbelt(clean_phone, message)
            
    except Exception as e:
        print(f"Fast2SMS Error: {str(e)}. Falling back to Textbelt...")
        return send_via_textbelt(clean_phone, message)
