import sqlite3, psycopg2
from psycopg2.extras import execute_values
sq_conn = sqlite3.connect('database/smartbank.db')
sq_conn.row_factory = sqlite3.Row
pg_conn = psycopg2.connect('postgresql://neondb_owner:npg_HmTRnFztvs92@ep-noisy-waterfall-an4soyoz.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require')

sq_cur = sq_conn.cursor()
pg_cur = pg_conn.cursor()

pg_cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
pg_cols = [r[0] for r in pg_cur.fetchall()]

sq_cur.execute("PRAGMA table_info(users)")
sq_cols = [r['name'] for r in sq_cur.fetchall()]

common = [c for c in sq_cols if c in pg_cols]
cols_str = ', '.join(common)

sq_cur.execute(f"SELECT {cols_str} FROM users")
rows = sq_cur.fetchall()
data = [tuple(r) for r in rows]

query = f"INSERT INTO users ({cols_str}) VALUES %s"
try:
    execute_values(pg_cur, query, data)
    pg_conn.commit()
    print('Users migrated!')
except Exception as e:
    print('USER ERROR:', str(e))
