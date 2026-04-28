import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import os
import sys

SQLITE_DB_PATH = r"C:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank by\database\smartbank.db"
NEON_URL = "postgresql://neondb_owner:npg_HmTRnFztvs92@ep-noisy-waterfall-an4soyoz.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"

sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

pg_conn = psycopg2.connect(NEON_URL)
pg_cursor = pg_conn.cursor()

tables = [
    'users', 'staff', 'admins', 'accounts', 'transactions', 'cards', 
    'loans', 'card_requests', 'account_requests', 'system_audit', 
    'staff_activity_logs', 'support_tickets', 'notifications', 
    'attendance', 'beneficiaries', 'savings_goals', 'agriculture_loans', 
    'service_applications', 'user_activity_logs', 'agri_buyers', 
    'crop_listings', 'crop_orders', 'escrow_transactions', 
    'deposit_requests', 'system_finances', 'marketplace_chats'
]

for table in tables:
    try:
        pg_cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'")
        pg_cols = [row[0] for row in pg_cursor.fetchall()]
        
        sqlite_cursor.execute(f"PRAGMA table_info({table})")
        sq_cols = [row['name'] for row in sqlite_cursor.fetchall()]
        
        common_cols = [c for c in sq_cols if c in pg_cols]
        if not common_cols: continue
        col_names_str = ", ".join(common_cols)
        
        sqlite_cursor.execute(f"SELECT {col_names_str} FROM {table}")
        rows = sqlite_cursor.fetchall()
        
        if not rows: continue
            
        # Clean data: Replace empty strings with None (NULL)
        cleaned_data = []
        for row in rows:
            cleaned_row = tuple(None if val == "" else val for val in row)
            cleaned_data.append(cleaned_row)
            
        query = f"INSERT INTO {table} ({col_names_str}) VALUES %s ON CONFLICT DO NOTHING"
        
        try:
            execute_values(pg_cursor, query, cleaned_data)
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()
            query_fallback = f"INSERT INTO {table} ({col_names_str}) VALUES %s"
            try:
                execute_values(pg_cursor, query_fallback, cleaned_data)
                pg_conn.commit()
            except Exception:
                pg_conn.rollback()
            
    except Exception:
        pg_conn.rollback()

for table in tables:
    try:
        pg_cursor.execute(f"SELECT setval('{table}_id_seq', COALESCE((SELECT MAX(id)+1 FROM {table}), 1), false);")
        pg_conn.commit()
    except Exception:
        pg_conn.rollback()
