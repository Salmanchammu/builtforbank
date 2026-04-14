import sys, os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from main import app
from core.db import get_db
from werkzeug.security import generate_password_hash
import random

with app.app_context():
    db = get_db()
    
    # 1. Check if agri buyer already exists
    existing = db.execute("SELECT id FROM agri_buyers WHERE buyer_id = ?", ("agri_test1",)).fetchone()
    if existing:
        db.execute("UPDATE agri_buyers SET email = 'salmanchamumu+buyer@gmail.com' WHERE id = ?", (existing["id"],))
        db.commit()
        print("Agri buyer agri_test1 already exists with ID:", existing["id"])
    else:
        hashed = generate_password_hash("Agri123#")
        
        # Create backing user first
        user_exists = db.execute("SELECT id FROM users WHERE username = ?", ("agri_test1",)).fetchone()
        if not user_exists:
            db.execute("INSERT INTO users (username, password, name, email, phone, status) VALUES (?, ?, ?, ?, ?, ?)",
                ("agri_test1", hashed, "Agri Test Buyer", "salmanchamumu+buyer@gmail.com", "9876543210", "active"))
            user_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        else:
            db.execute("UPDATE users SET email = 'salmanchamumu+buyer@gmail.com' WHERE id = ?", (user_exists["id"],))
            user_id = user_exists["id"]
        
        # Create business account
        acc_num = "SB" + "".join([str(random.randint(0,9)) for _ in range(12)])
        db.execute("INSERT INTO accounts (user_id, account_number, account_type, balance, status) VALUES (?, ?, ?, ?, ?)",
            (user_id, acc_num, "Business", 50000.00, "active"))
        acc_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        
        # Create agri buyer
        db.execute("INSERT INTO agri_buyers (buyer_id, password, name, email, phone, business_name, gst_number, status, associated_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("agri_test1", hashed, "Agri Test Buyer", "salmanchamumu+buyer@gmail.com", "9876543210", "FreshFarms Trading", "GST12345678", "active", acc_id))
        db.commit()
        print("Created agri buyer: agri_test1 / Agri123# with Business Account", acc_num, "Balance: 50000")
    
    # 2. Check if a farmer with agriculture account exists
    farmer = db.execute("SELECT u.id, u.username, a.id as acc_id, a.account_number FROM users u JOIN accounts a ON u.id = a.user_id WHERE LOWER(a.account_type) = ?", ("agriculture",)).fetchone()
    if farmer:
        print("Farmer found:", farmer["username"], "with agriculture account", farmer["account_number"])
    else:
        farmer_exists = db.execute("SELECT id FROM users WHERE username = ?", ("farmer1",)).fetchone()
        if not farmer_exists:
            farmer_hashed = generate_password_hash("Farmer123#")
            db.execute("INSERT INTO users (username, password, name, email, phone, status) VALUES (?, ?, ?, ?, ?, ?)",
                ("farmer1", farmer_hashed, "Raju Farmer", "salmanchamumu+farmer@gmail.com", "9123456789", "active"))
            farmer_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        else:
            db.execute("UPDATE users SET email = 'salmanchamumu+farmer@gmail.com' WHERE id = ?", (farmer_exists["id"],))
            farmer_id = farmer_exists["id"]
        
        agr_acc = "AGR" + "".join([str(random.randint(0,9)) for _ in range(12)])
        db.execute("INSERT INTO accounts (user_id, account_number, account_type, balance, status) VALUES (?, ?, ?, ?, ?)",
            (farmer_id, agr_acc, "Agriculture", 10000.00, "active"))
        db.commit()
        print("Created farmer: farmer1 / Farmer123# with Agriculture Account", agr_acc)
    
    # 3. Test crop listing creation via farmer
    farmer = db.execute("SELECT u.id, u.username, a.id as acc_id FROM users u JOIN accounts a ON u.id = a.user_id WHERE LOWER(a.account_type) = ? LIMIT 1", ("agriculture",)).fetchone()
    if farmer:
        existing_listing = db.execute("SELECT id FROM crop_listings WHERE farmer_user_id = ?", (farmer["id"],)).fetchone()
        if not existing_listing:
            db.execute("""INSERT INTO crop_listings 
                (farmer_user_id, farmer_account_id, crop_name, category, quantity_kg, price_per_kg, min_order_kg, description, location, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (farmer["id"], farmer["acc_id"], "Organic Basmati Rice", "Rice", 500.0, 65.0, 10.0, "Premium quality organic basmati rice from Punjab", "Punjab, India", "active"))
            db.execute("""INSERT INTO crop_listings 
                (farmer_user_id, farmer_account_id, crop_name, category, quantity_kg, price_per_kg, min_order_kg, description, location, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (farmer["id"], farmer["acc_id"], "Fresh Wheat", "Wheat", 1000.0, 28.0, 50.0, "High-grade wheat harvest 2026", "Haryana, India", "active"))
            db.commit()
            print("Created 2 crop listings for farmer", farmer["username"])
        else:
            print("Farmer already has crop listings")
    
    # 4. Summary
    listings = db.execute("SELECT id, crop_name, quantity_kg, price_per_kg, status FROM crop_listings").fetchall()
    print("\nCrop Listings:", len(listings))
    for l in listings:
        print("  -", l["crop_name"], l["quantity_kg"], "kg @", l["price_per_kg"], "/kg [" + l["status"] + "]")
    
    buyers = db.execute("SELECT id, buyer_id, name, status, associated_account_id FROM agri_buyers").fetchall()
    print("\nAgri Buyers:", len(buyers))
    for b in buyers:
        print("  -", b["buyer_id"], b["name"], "[" + b["status"] + "] acc_id=" + str(b["associated_account_id"]))
    
    print("\n=== ALL GOOD ===")
