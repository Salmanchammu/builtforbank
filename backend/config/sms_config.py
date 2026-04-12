import requests
import json
import os

# SMS Configuration for Smart Bank (India)
# Using Fast2SMS or similar provider pattern

SMS_CONFIG = {
    "provider": "Fast2SMS",
    "api_key": os.environ.get("SMS_API_KEY", ""),
    "sender_id": "SMTBnk",
    "route": "q", # 'q' is quick route (best for no-Dlt)
    "enabled": True,
    # Auto-enable mock mode if no API key is provided, so it doesn't fail silently
    "mock_mode": not bool(os.environ.get("SMS_API_KEY"))
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

    if SMS_CONFIG["mock_mode"]:
        print(f"--- [MOCK SMS SENT] ---")
        print(f"To: {clean_phone}")
        print(f"Message: {message}")
        print(f"-----------------------")
        # Log to a temporary file for verification
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
            print(f"SMS successfully sent to {phone}")
            return True
        else:
            print(f"SMS failed: {res_data.get('message')}")
            return False
            
    except Exception as e:
        print(f"SMS Error: {str(e)}")
        return False
