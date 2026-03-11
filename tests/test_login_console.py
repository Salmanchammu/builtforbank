from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import sys

chrome_options = Options()
chrome_options.add_argument('--headless=new')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')
chrome_options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

try:
    driver = webdriver.Chrome(options=chrome_options)
    driver.get('http://localhost:8000/staff.html')
    time.sleep(1)
    
    # Fill login
    driver.execute_script("document.getElementById('staffId').value = 'yasir';")
    driver.execute_script("document.getElementById('staffPassword').value = 'yasir123';")
    driver.execute_script("staffLogin();")
    
    time.sleep(2)
    
    logs = driver.get_log('browser')
    print('--- CONSOLE LOGS ---')
    for log in logs:
        print(f"[{log['level']}] {log['message']}")
        
    driver.quit()
except Exception as e:
    print('Error:', e)
