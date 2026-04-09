import sqlite3
import os

def run():
    try:
        DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'smartbank.db')
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        query = '''SELECT ab.id, ab.buyer_id, ab.name, ab.email, ab.phone, 
                    ab.business_name, ab.gst_number, ab.status, ab.created_at,
                    COALESCE((SELECT SUM(total_amount) FROM crop_orders 
                              WHERE buyer_id = ab.id AND status = 'completed'), 0) as total_turnover
        FROM agri_buyers ab
        ORDER BY CASE WHEN ab.status = 'pending' THEN 0 ELSE 1 END, ab.created_at DESC'''
        
        rows = cur.execute(query).fetchall()
        print("Success! Rows:", len(rows))
        for r in rows:
            print(dict(r))
    except Exception as e:
        print("Error:", str(e))

if __name__ == '__main__':
    run()
