import sys
import os
import json

from main import app
from core.db import get_db

app.testing = True
client = app.test_client()

print('Testing Login for salman...')
response = client.post('/api/auth/login', json={
    'username': 'salman',
    'password': 'Salman123#',
    'role': 'user',
    'device_type': 'desktop'
})

print('STATUS:', response.status_code)
print('RESPONSE:', response.get_json())
