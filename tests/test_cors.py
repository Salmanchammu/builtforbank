import urllib.request
import json
req = urllib.request.Request('http://localhost:5000/api/auth/login', 
    data=json.dumps({'username': 'salman', 'password': 'salman123', 'role': 'user'}).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'Origin': 'http://localhost:5000'}
)
try:
    print(urllib.request.urlopen(req).read().decode('utf-8'))
except Exception as e:
    print(str(e))
