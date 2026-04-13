import sqlite3

tables = ['users', 'staff', 'admins', 'agri_buyers']
conn = sqlite3.connect('../database/smartbank.db')
for table in tables:
    try:
        conn.execute(f'ALTER TABLE {table} ADD COLUMN phone_otp TEXT')
        print(f'Added phone_otp to {table}')
    except Exception as e:
        print(f'{table}: {e}')
conn.commit()
conn.close()
