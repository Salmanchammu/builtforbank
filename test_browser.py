from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time

def run():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--window-size=1920,1080')
    driver = webdriver.Chrome(options=options)
    
    driver.get("http://127.0.0.1:5000/staff.html")
    time.sleep(2)
    try:
        driver.execute_script("document.getElementById('staffId').value = 'yasir';")
        driver.execute_script("document.getElementById('staffPassword').value = 'Yasir123#';")
        driver.execute_script("staffLogin(new Event('submit'));")
        time.sleep(5)
        print("--- ON DASHBOARD ---")
        driver.save_screenshot('staff_dashboard.png')
        print("Saved screenshot to staff_dashboard.png")
    except Exception as e:
        print("Login failed:", e)
    
    driver.quit()

if __name__ == '__main__':
    run()
