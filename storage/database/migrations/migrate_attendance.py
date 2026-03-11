import sqlite3
import os

db_path = os.path.join('..', 'database', 'smart_bank.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

def table_exists(name):
    return c.execute('SELECT name FROM sqlite_master WHERE type="table" AND name=?', (name,)).fetchone() is not None

def column_exists(table, column):
    return any(i[1] == column for i in c.execute(f'PRAGMA table_info({table})').fetchall())

# Migration logic
print("Starting migration...")

# 1. Update staff table
if table_exists('staff'):
    if not column_exists('staff', 'face_descriptor'):
        print("Adding face_descriptor to staff...")
        c.execute('ALTER TABLE staff ADD COLUMN face_descriptor TEXT')
    else:
        print("face_descriptor already exists in staff.")
else:
    print("Error: staff table missing!")

# 2. Update admins table
if table_exists('admins'):
    if not column_exists('admins', 'face_descriptor'):
        print("Adding face_descriptor to admins...")
        c.execute('ALTER TABLE admins ADD COLUMN face_descriptor TEXT')
    else:
        print("face_descriptor already exists in admins.")
else:
    print("Error: admins table missing!")

# 3. Create attendance table
if not table_exists('attendance'):
    print("Creating attendance table...")
    c.execute('''
        CREATE TABLE attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER NOT NULL,
            date DATE NOT NULL,
            clock_in TIMESTAMP,
            clock_out TIMESTAMP,
            total_hours DECIMAL(5, 2),
            status VARCHAR(20) DEFAULT 'present',
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
        )
    ''')
else:
    print("attendance table already exists.")

conn.commit()
print("Migration completed successfully.")
conn.close()
