from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time
import json
import os

def run():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--window-size=1920,1080')
    driver = webdriver.Chrome(options=options)
    
    driver.get("http://127.0.0.1:5000/staff.html")
    time.sleep(2)
    os.makedirs("staff_dash_screenshots", exist_ok=True)
    
    try:
        driver.execute_script("document.getElementById('staffId').value = 'yasir';")
        driver.execute_script("document.getElementById('staffPassword').value = 'Yasir123#';")
        driver.execute_script("staffLogin(new Event('submit'));")
        
        # wait for dashboard to fully load
        time.sleep(5)
        print("--- ON DASHBOARD ---")
        
        # Take a screenshot of the main map dashboard
        driver.save_screenshot('staff_dash_screenshots/01_dashboard_main.png')
        
        # Find all nav items
        nav_items = driver.find_elements(By.CSS_SELECTOR, '.nav-item')
        print(f"Found {len(nav_items)} nav items.")
        
        # Click through them
        for i, item in enumerate(nav_items):
            try:
                text = item.text.strip()
                if not text or 'Logout' in text:
                    continue
                onclick = item.get_attribute('onclick')
                print(f"Clicking {text} (onclick={onclick})")
                item.click()
                time.sleep(2) # Wait for tab to render
                driver.save_screenshot(f'staff_dash_screenshots/02_tab_{i}_{text.replace(" ", "_").replace("/", "")}.png')
            except Exception as e:
                print(f"Error clicking tab {i}: {e}")
                
        time.sleep(1)
        logs = driver.get_log('browser')
        errors = [log for log in logs if log['level'] == 'SEVERE']
        if errors:
            print(f"FOUND {len(errors)} ERRORS:")
            for e in errors:
                print(e)
        else:
            print("NO BROWSER ERRORS FOUND.")
            
        with open('browser_logs.txt', 'w') as f:
            for log in logs:
                f.write(json.dumps(log) + '\n')
                
    except Exception as e:
        print("Test failed:", e)
    
    driver.quit()

if __name__ == '__main__':
    run()
