import sys
import os
import sqlite3
import random
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from core.constants import DATABASE

try:
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Get some users
    cursor.execute("SELECT id FROM users LIMIT 5")
    users = [row['id'] for row in cursor.fetchall()]
    
    if not users:
        print("❌ No users found to seed loans for.")
        sys.exit(1)
        
    crops = ['Rice', 'Wheat', 'Sugarcane', 'Cotton', 'Coffee']
    recommendations = ['Approved', 'Manual Review', 'Manual Review', 'Approved', 'Rejected']
    
    for i, user_id in enumerate(users):
        farm_coords = f"{12.9 + random.uniform(0, 2):.4f}, {75.5 + random.uniform(0, 2):.4f}"
        land_size = random.uniform(2, 25)
        crop = crops[i % len(crops)]
        amount = random.randint(50000, 500000)
        score = random.randint(30, 95)
        rec = recommendations[i % len(recommendations)]
        
        cursor.execute("""
            INSERT INTO agriculture_loans 
            (user_id, farm_coordinates, land_size_acres, crop_type, requested_amount, ai_health_score, ai_recommendation, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        """, (user_id, farm_coords, land_size, crop, amount, score, rec))

    conn.commit()
    print(f"✅ Seeded {len(users)} Agri Loans.")
    conn.close()
except Exception as e:
    print(f"❌ Seeding failed: {e}")
