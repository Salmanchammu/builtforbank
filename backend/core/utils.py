import re

def validate_email(email):
    if not email: return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    if not password: return False, "Password is required"
    if len(password) < 7:
        return False, "Password must be at least 7 characters long"
    
    # Check for at least 1 uppercase letter
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
        
    # Check for at least 3 numbers
    digit_count = sum(c.isdigit() for c in password)
    if digit_count < 3:
        return False, "Password must contain at least 3 numbers"
        
    # Check for at least 1 symbol
    if not re.search(r"[@$!%*?&]", password):
        return False, "Password must contain at least one special character (@$!%*?&)"
        
    return True, ""

def validate_phone(phone):
    if not phone: return True
    pattern = r'^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$'
    return re.match(pattern, phone) is not None
