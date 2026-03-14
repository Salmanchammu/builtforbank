import sqlite3
import json
import os

# Configuration
DB_PATH = os.path.join('storage', 'database', 'smart_bank.db')
SEED_PATH = os.path.join('backend', 'smart_seed.json')

# Tables to export (Core data only, avoiding large blobs)
TABLES = [
    'admins', 
    'staff', 
    'users', 
    'accounts', 
    'transactions', 
    'loans', 
    'cards', 
    'notifications', 
    'service_applications'
]

def generate_seed():
    if not os.path.exists(DB_PATH):
        print(f"❌ Error: Database not found at {DB_PATH}")
        return

    print(f"🚀 Generating Smart Seed from {DB_PATH}...")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    seed_data = {}
    
    for table in TABLES:
        try:
            # Check if table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if not cursor.fetchone():
                print(f"  [SKIP] Table '{table}' does not exist in this database.")
                continue

            # Fetch all rows
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            
            # Convert rows to list of dicts
            table_data = []
            for row in rows:
                d = dict(row)
                # Exclude potentially large blob/video columns to keep seed small
                blob_cols = ['kyc_video', 'aadhaar_proof', 'pan_proof', 'kyc_photo']
                for col in blob_cols:
                    if col in d:
                        # Replace with a placeholder or null
                        d[col] = f"[HIDDEN_BLOB_{len(str(d[col])) if d[col] else 0}_BYTES]"
                
                table_data.append(d)
                
            seed_data[table] = table_data
            print(f"  [OK] Exported {len(table_data)} rows from '{table}'")
            
        except Exception as e:
            print(f"  [ERR] Failed to export '{table}': {e}")
            
    # Save to JSON
    with open(SEED_PATH, 'w', encoding='utf-8') as f:
        json.dump(seed_data, f, indent=2, ensure_ascii=False)
        
    print(f"\n✅ Seed generation complete! File saved to: {SEED_PATH}")
    print(f"📦 Total tables exported: {len(seed_data)}")
    print(f"💡 You can now push this file to Git to sync your data with Render.")

if __name__ == "__main__":
    generate_seed()
