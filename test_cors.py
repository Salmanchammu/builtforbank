import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from app import app
with app.test_client() as client:
    resp = client.options('/api/auth/login', headers={
        'Origin': 'https://smart-bank-v2.onrender.com',
        'Access-Control-Request-Method': 'POST'
    })
    print("CORS for onrender.com:", resp.headers.get('Access-Control-Allow-Origin', 'NONE'))
    
    resp2 = client.options('/api/auth/login', headers={
        'Origin': 'http://localhost:5000',
        'Access-Control-Request-Method': 'POST'
    })
    print("CORS for localhost:", resp2.headers.get('Access-Control-Allow-Origin', 'NONE'))
