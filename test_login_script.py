import urllib.request
import json
import sys

def test_login(role, username, password):
    url = 'http://localhost:5000/api/auth/login'
    data = json.dumps({
        'username': username,
        'password': password,
        'role': role,
        'device_type': 'mobile'
    }).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    try:
        response = urllib.request.urlopen(req)
        print(f"SUCCESS ({role}):")
        print(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR ({role}): {e.code}")
        try:
            print(e.read().decode('utf-8'))
        except:
            pass
    except Exception as e:
        print(f"ERROR ({role}): {e}")

test_login('admin', 'admin', 'admin123')
test_login('user', 'rajesh', 'user123')
