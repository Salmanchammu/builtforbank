import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument('--headless')
options.add_argument('--window-size=1280,1024')
options.add_argument('--disable-gpu')
options.add_argument('--no-sandbox')

driver = webdriver.Chrome(options=options)
base_url = 'http://127.0.0.1:8080'

out_dir = r"C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\images"
os.makedirs(out_dir, exist_ok=True)

def take_shot(url, name, js=None, wait=1):
    print(f"Loading {url} for {name}...")
    driver.get(base_url + url)
    time.sleep(wait)
    if js:
        try:
            driver.execute_script(js)
            time.sleep(wait)
        except Exception as e:
            print(f'JS Error on {name}:', e)
    
    out_path = os.path.join(out_dir, name)
    driver.save_screenshot(out_path)
    print(f'Saved {name} to {out_path}')

# 1. Landing Page
take_shot('/index.html', 'landing_page.png')

# 2. Face Auth
take_shot('/user.html', 'face_auth.png', """
const btn = document.querySelector('.face-login-btn') || document.querySelector('button[onclick*="openFace"]');
if(btn) btn.click();
""")

# 3. Registration OTP
take_shot('/signup.html', 'registration_otp.png', """
const m = document.getElementById('otpModal');
if(m) {
    m.style.display = 'flex';
    m.style.opacity = '1';
}
""")

# 4. User Dashboard
take_shot('/userdash.html', 'user_dashboard.png', """
localStorage.setItem('token', 'mock_token');
localStorage.setItem('user', JSON.stringify({fullName: 'Test User', account_number: '123456789'}));
""")

# 5. Transfer UPI
take_shot('/userdash.html', 'transfer_upi.png', """
if(typeof switchTab === 'function') switchTab('transfer');
""")

# 6. Savings Chatbot
take_shot('/userdash.html', 'savings_chatbot.png', """
if(typeof switchTab === 'function') switchTab('savings');
if(typeof toggleChat === 'function') toggleChat();
""")

driver.quit()
print("All screenshots done.")
