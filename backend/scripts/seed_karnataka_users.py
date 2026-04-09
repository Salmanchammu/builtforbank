import sys
import os
import sqlite3
import random
from datetime import datetime

# Add the backend directory to the path so we can import core
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.db import get_db
from core.constants import DATABASE

KARNATAKA_CITIES = [
    {"name": "Bangalore", "lat": 12.9716, "lng": 77.5946},
    {"name": "Mysore", "lat": 12.2958, "lng": 76.6394},
    {"name": "Hubli", "lat": 15.3647, "lng": 75.1240},
    {"name": "Belgaum", "lat": 15.8497, "lng": 74.4977},
    {"name": "Mangalore", "lat": 12.9141, "lng": 74.8560}
]

TEST_USERS = [
    {"username": "karnataka_user1", "name": "Rahul Kumar", "email": "rahul.k@example.com"},
    {"username": "karnataka_user2", "name": "Priya Sharma", "email": "priya.s@example.com"},
    {"username": "karnataka_user3", "name": "Anil Gowda", "email": "anil.g@example.com"},
    {"username": "karnataka_user4", "name": "Sneha Reddy", "email": "sneha.r@example.com"},
    {"username": "karnataka_user5", "name": "Vijay Patil", "email": "vijay.p@example.com"}
]

def seed_users():
    print(f"Connecting to database at {DATABASE}...")
    conn = sqlite3.connect(DATABASE)
    cur = conn.cursor()
    
    # Ensure columns exist (though migrate_db should have done this)
    try:
        cur.execute("ALTER TABLE users ADD COLUMN signup_lat DECIMAL(10, 7)")
        cur.execute("ALTER TABLE users ADD COLUMN signup_lng DECIMAL(10, 7)")
        cur.execute("ALTER TABLE users ADD COLUMN signup_city VARCHAR(100)")
        cur.execute("ALTER TABLE users ADD COLUMN signup_country VARCHAR(100)")
    except sqlite3.OperationalError:
        pass # Already exists
    
    for i, user_info in enumerate(TEST_USERS):
        city = KARNATAKA_CITIES[i]
        username = user_info["username"]
        
        # Check if user already exists
        cur.execute("SELECT id FROM users WHERE username = ?", (username,))
        existing = cur.fetchone()
        
        if existing:
            print(f"User {username} already exists, skipping...")
            continue
            
        print(f"Creating user {username} in {city['name']}...")
        
        # Insert user
        cur.execute("""
            INSERT INTO users (username, password, email, name, status, signup_lat, signup_lng, signup_city, signup_country)
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 'India')
        """, (username, 'pbkdf2:sha256:260000$testpassword', user_info["email"], user_info["name"], city["lat"], city["lng"], city["name"]))
        
        user_id = cur.lastrowid
        
        # Create an account for this user
        acc_num = f"6000{random.randint(100000, 999999)}"
        cur.execute("""
            INSERT INTO accounts (user_id, account_number, account_type, balance, status)
            VALUES (?, ?, 'savings', ?, 'active')
        """, (user_id, acc_num, random.uniform(5000, 50000)))
        
    conn.commit()
    conn.close()
    print("Seeding complete!")

if __name__ == "__main__":
    seed_users()
