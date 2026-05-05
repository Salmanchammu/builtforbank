"""
Seed 10 SmartBank branches across major Indian cities into the existing database.
Run once: python seed_branches.py
"""
import sqlite3
import os

DB_NAMES = ['bank.db', 'smartbank.db', 'smart_bank.db']

BRANCHES = [
    ("SmartBank HQ - Mumbai", "branch", "Bandra Kurla Complex, Bandra East", "Mumbai", 19.0596, 72.8656),
    ("SmartBank - Delhi", "branch", "Connaught Place, Central Delhi", "New Delhi", 28.6315, 77.2167),
    ("SmartBank - Bangalore", "branch", "MG Road, Bangalore CBD", "Bangalore", 12.9752, 77.6066),
    ("SmartBank - Chennai", "branch", "Anna Salai, T. Nagar", "Chennai", 13.0418, 80.2341),
    ("SmartBank - Hyderabad", "branch", "HITEC City, Madhapur", "Hyderabad", 17.4435, 78.3772),
    ("SmartBank - Kolkata", "branch", "Park Street, Central Kolkata", "Kolkata", 22.5513, 88.3517),
    ("SmartBank - Pune", "branch", "FC Road, Shivajinagar", "Pune", 18.5288, 73.8463),
    ("SmartBank - Ahmedabad", "branch", "CG Road, Navrangpura", "Ahmedabad", 23.0300, 72.5670),
    ("SmartBank - Jaipur", "branch", "MI Road, C-Scheme", "Jaipur", 26.9124, 75.7873),
    ("SmartBank - Kochi", "branch", "MG Road, Ernakulam", "Kochi", 9.9816, 76.2999),
]

found = False
for db_name in DB_NAMES:
    if os.path.exists(db_name):
        found = True
        print(f"Found database: {db_name}")
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()

        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bank_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL,
                type VARCHAR(20) NOT NULL DEFAULT 'branch',
                address TEXT,
                city VARCHAR(100),
                lat DECIMAL(10, 7),
                lng DECIMAL(10, 7),
                photo_url VARCHAR(255),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Check existing count
        existing = cursor.execute("SELECT COUNT(*) FROM bank_locations").fetchone()[0]
        print(f"  Existing locations: {existing}")

        inserted = 0
        for name, btype, address, city, lat, lng in BRANCHES:
            # Skip if branch with same name already exists
            exists = cursor.execute("SELECT 1 FROM bank_locations WHERE name = ?", (name,)).fetchone()
            if not exists:
                cursor.execute(
                    "INSERT INTO bank_locations (name, type, address, city, lat, lng, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
                    (name, btype, address, city, lat, lng)
                )
                inserted += 1

        conn.commit()
        conn.close()
        print(f"  Inserted {inserted} new branches. Total now: {existing + inserted}")
        break

if not found:
    print("No database file found! Make sure you run this from the backend/ directory.")

print("\nDone! Restart your server to see the branches on the map.")
