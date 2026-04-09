import requests

def test_api():
    s = requests.Session()
    login_data = {"username": "yasir", "password": "Yasir123#", "role": "staff"}
    res = s.post("http://127.0.0.1:5000/api/auth/login", json=login_data)
    if res.ok:
        print("Logged in!")
    else:
        print("Login failed", res.text)
        return

    for url in [
        "/api/staff/service-applications",
        "/api/staff/geo-map",
        "/api/staff/account_requests",
        "/api/staff/dashboard"
    ]:
        res = s.get("http://127.0.0.1:5000" + url)
        print(url, "=>", res.status_code)
        if not res.ok:
            print("Error details:", res.text[:200])

if __name__ == "__main__":
    test_api()
