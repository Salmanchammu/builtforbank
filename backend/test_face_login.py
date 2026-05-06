import requests
import json

url = "http://127.0.0.1:5000/api/auth/face-login"
payload = {
    "face_descriptor": [0.1] * 128
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print("STATUS:", response.status_code)
    print("TEXT:", response.text)
except Exception as e:
    print("ERROR:", e)
