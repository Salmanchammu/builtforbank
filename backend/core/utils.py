import re

def validate_email(email):
    if not email: return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    if not password: return False, "Password is required"
    if not password[0].isupper():
        return False, "Password must start with an uppercase letter"
        
    return True, ""

def validate_phone(phone):
    if not phone: return True
    pattern = r'^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$'
    return re.match(pattern, phone) is not None
