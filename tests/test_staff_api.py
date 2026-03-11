import requests
s = requests.Session()
res = s.post('http://localhost:5001/api/auth/login', json={'username':'yasir','password':'password123', 'role':'staff'})
print('Login:', res.status_code)
if res.status_code == 200:
    for endpoint in ['dashboard', 'customers', 'accounts', 'account_requests', 'transactions']:
        r = s.get(f'http://localhost:5001/api/staff/{endpoint}')
        print(f'{endpoint.capitalize()}: {r.status_code}')
        if r.status_code != 200:
            print(f"Error for {endpoint}:", r.text[:200])
