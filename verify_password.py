from werkzeug.security import check_password_hash
import json

h = 'scrypt:32768:8:1$IszqJtDlJbCIpL1H$09ae5eb92c787786b43814aa47d7b0f118ef02373b5d833cc7f10093cd856a102c8cd770d9908aad9aceab0d8d8ae124d7f22ac15a073b1fa20065768e7d53db'

print(f"Checking hash for 'yasir'...")
print(f"Match Yasir123#: {check_password_hash(h, 'Yasir123#')}")
print(f"Match yasir123: {check_password_hash(h, 'yasir123')}")
