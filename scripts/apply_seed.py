import sqlite3
import json
import os

# Configuration
DB_PATH = 'database/smartbank.db'
SEED_PATH = 'backend/smart_seed.json'

def apply_seed():
    if not os.path.exists(SEED_PATH):
        print(f"❌ Error: Seed file not found at {SEED_PATH}")
        return

    print(f"🚀 Applying Smart Seed from {SEED_PATH}...")
    
    with open(SEED_PATH, 'r', encoding='utf-8') as f:
        seed_data = json.load(f)
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Disable foreign keys temporarily to avoid issues during bulk insert
    cursor.execute("PRAGMA foreign_keys = OFF")
    
    for table, rows in seed_data.items():
        try:
            # Check if table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if not cursor.fetchone():
                print(f"  [SKIP] Table '{table}' does not exist.")
                continue

            # Clear table
            cursor.execute(f"DELETE FROM {table}")
            
            if not rows:
                print(f"  [OK] Table '{table}' cleared (no data in seed)")
                continue

            # Get valid columns from the database table
            cursor.execute(f"PRAGMA table_info({table})")
            db_columns = [col[1] for col in cursor.fetchall()]
            
            # Filter seed data to only include columns that exist in the DB
            columns = [col for col in rows[0].keys() if col in db_columns]
            
            placeholders = ', '.join(['?' for _ in columns])
            col_names = ', '.join(columns)
            
            sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"
            
            # Prepare data
            data_to_insert = []
            for row in rows:
                vals = []
                for col in columns:
                    val = row[col]
                    # Handle hidden blobs or placeholders if any
                    if isinstance(val, str) and val.startswith('[HIDDEN_BLOB'):
                        val = None
                    vals.append(val)
                data_to_insert.append(tuple(vals))
            
            cursor.executemany(sql, data_to_insert)
            print(f"  [OK] Imported {len(rows)} rows into '{table}'")
            
        except Exception as e:
            print(f"  [ERR] Failed to import '{table}': {e}")
            conn.rollback()
            break
            
    cursor.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()
    print(f"\n✅ Seed application complete!")

if __name__ == "__main__":
    apply_seed()
