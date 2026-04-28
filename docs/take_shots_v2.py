import time
import os
import threading
from http.server import SimpleHTTPRequestHandler
import socketserver
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# 1. Start HTTP Server
PORT = 8081
DIRECTORY = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\frontend'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

httpd = socketserver.TCPServer(('', PORT), Handler)
server_thread = threading.Thread(target=httpd.serve_forever)
server_thread.daemon = True
server_thread.start()
print('Started HTTP server on port', PORT)

# 2. Setup Selenium
options = Options()
options.add_argument('--headless')
options.add_argument('--window-size=1280,1024')
options.add_argument('--disable-gpu')
options.add_argument('--no-sandbox')
driver = webdriver.Chrome(options=options)
base_url = f'http://127.0.0.1:{PORT}'

out_dir = r'C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\docs\images'
os.makedirs(out_dir, exist_ok=True)

def take_shot(url, name, js=None, wait=3):
    print(f'Loading {url} for {name}...')
    driver.get(base_url + url)
    # let it load completely
    time.sleep(1 + wait)
    if js:
        try:
            driver.execute_script(js)
            time.sleep(wait)
        except Exception as e:
            print(f'JS Error on {name}:', e)
    
    out_path = os.path.join(out_dir, name)
    driver.save_screenshot(out_path)
    print(f'Saved {name} to {out_path}')

try:
    take_shot('/index.html', 'landing_page.png')
    
    take_shot('/user.html', 'face_auth.png', """
    const btn = document.querySelector('.face-login-btn') || document.querySelector('button[onclick*="openFace"]');
    if(btn) btn.click();
    """)
    
    take_shot('/signup.html', 'registration_otp.png', """
    const m = document.getElementById('otpModal');
    if(m) {
        m.style.display = 'flex';
        m.style.opacity = '1';
    }
    """)
    
    take_shot('/userdash.html', 'user_dashboard.png', """
    document.body.innerHTML += '<div style="position:absolute;top:0;left:0;background:#fff;z-index:9999;font-size:24px;padding:20px;">' + (document.title || 'Dashboard') + '</div>';
    """)
    
    take_shot('/userdash.html', 'transfer_upi.png', """
    if(typeof switchTab === 'function') switchTab('transfer');
    """)
    
    take_shot('/userdash.html', 'savings_chatbot.png', """
    if(typeof switchTab === 'function') switchTab('savings');
    if(typeof toggleChat === 'function') toggleChat();
    """)
finally:
    driver.quit()
    httpd.shutdown()
    print('All screenshots done.')
