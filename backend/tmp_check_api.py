import requests

s = requests.Session()
login = s.post('http://127.0.0.1:5000/api/auth/login', json={'username': 'salman', 'password': 'Salman123#'})
print("LOGIN:", login.json())

dash = s.get('http://127.0.0.1:5000/api/user/dashboard')
data = dash.json()
print("CARDS:", data.get('cards'))
print("REQUESTS:", data.get('card_requests'))
