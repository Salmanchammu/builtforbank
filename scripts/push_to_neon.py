import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import os
import sys

def migrate_data():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        print("Please run this script like so:")
        print("  $env:DATABASE_URL='postgresql://your-neon-url'; python push_to_neon.py")
        sys.exit(1)
        
    print("Connecting to local SQLite database...")
    sqlite_conn = sqlite3.connect('database/smartbank.db')
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    print("Connecting to remote PostgreSQL database...")
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    pg_conn = psycopg2.connect(database_url)
    pg_cursor = pg_conn.cursor()
    
    # Get all tables from SQLite
    sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row['name'] for row in sqlite_cursor.fetchall()]
    
    for table in tables:
        print(f"\nMigrating table: {table}")
        
        # Get all data
        sqlite_cursor.execute(f"SELECT * FROM {table}")
        rows = sqlite_cursor.fetchall()
        
        if not rows:
            print(f"  - No data in {table}, skipping.")
            continue
            
        columns = rows[0].keys()
        col_names = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        # Convert sqlite3.Row to tuple, replacing empty strings with None to avoid Postgres type errors (e.g., date fields)
        data_to_insert = [tuple(None if val == "" else val for val in row) for row in rows]
        
        print(f"  - Found {len(data_to_insert)} rows. Inserting into Postgres...")
        
        try:
            # We use ON CONFLICT DO NOTHING to avoid duplicate key errors if run multiple times
            # However, ON CONFLICT requires a unique constraint which we don't know dynamically.
            # Simple fallback: clear the table first (DANGEROUS but this is a fresh migration)
            pg_cursor.execute(f"DELETE FROM {table}")
            
            insert_query = f"INSERT INTO {table} ({col_names}) VALUES %s"
            execute_values(pg_cursor, insert_query, data_to_insert)
            
            # Reset the sequence if there's an 'id' column
            if 'id' in columns:
                pg_cursor.execute(f"SELECT MAX(id) FROM {table}")
                max_id = pg_cursor.fetchone()[0]
                if max_id:
                    pg_cursor.execute(f"SELECT setval('{table}_id_seq', {max_id})")
            
            pg_conn.commit()
            print(f"  - Successfully migrated {table}!")
        except Exception as e:
            pg_conn.rollback()
            print(f"  - ERROR migrating {table}: {e}")
            
    print("\nMigration Complete!")
    sqlite_conn.close()
    pg_conn.close()

if __name__ == '__main__':
    migrate_data()
