import urllib.request
import json

url_login = 'http://localhost:5000/api/auth/login'
req_login = urllib.request.Request(
    url_login, 
    method='POST', 
    headers={'Content-Type': 'application/json'}, 
    data=json.dumps({'username': 'admin', 'password': 'admin123', 'role': 'user'}).encode('utf-8')
)

try:
    r_login = urllib.request.urlopen(req_login)
    cookies = r_login.headers.get('Set-Cookie', '')
    login_data = json.loads(r_login.read().decode())
    print('Login OK:', login_data)
    
    # Simulate checkAuth() from mobile-dash.html
    url_check = 'http://localhost:5000/api/auth/check'
    # Normally checkAuth just does fetch(url, {credentials: 'include'})
    req_check = urllib.request.Request(
        url_check, 
        method='GET', 
        headers={'Cookie': cookies}
    )
    r_check = urllib.request.urlopen(req_check)
    check_data = json.loads(r_check.read().decode())
    print('Check OK:', check_data)
    
    # Validate the logic in JS
    if check_data.get('authenticated') and check_data.get('user'):
        print("JS Logic pass: Mobile dashboard will load.")
    else:
        print("JS Logic fail: User would be redirected back to mobile-auth.html")
except Exception as e:
    print('Error:', e)
