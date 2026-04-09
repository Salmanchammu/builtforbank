from flask import Blueprint, request, jsonify, session, current_app
from core.db import get_db
from core.auth import role_required, trigger_geo_lookup
import logging
from datetime import datetime
import secrets
import random
from functools import wraps

marketplace_bp = Blueprint('marketplace', __name__)
logger = logging.getLogger('smart_bank.marketplace')

COMMISSION_RATE = 0.02  # 2% bank commission

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: Get farmer's agriculture account
# ═══════════════════════════════════════════════════════════════════════════════
def _get_agri_account(db, user_id):
    return db.execute(
        "SELECT * FROM accounts WHERE user_id = ? AND LOWER(account_type) = 'agriculture' AND status = 'active' LIMIT 1",
        (user_id,)
    ).fetchone()

# ═══════════════════════════════════════════════════════════════════════════════
# FARMER — Crop Listings CRUD
# ═══════════════════════════════════════════════════════════════════════════════
@marketplace_bp.route('/listings', methods=['POST'])
@role_required('user')
def create_listing():
    user_id = session['user_id']
    db = get_db()
    acct = _get_agri_account(db, user_id)
    if not acct:
        return jsonify({'error': 'You need an Agriculture account to list crops'}), 403

    data = request.json
    required = ['crop_name', 'quantity_kg', 'price_per_kg']
    if not all(data.get(f) for f in required):
        return jsonify({'error': 'crop_name, quantity_kg, and price_per_kg are required'}), 400

    try:
        db.execute('''INSERT INTO crop_listings
            (farmer_user_id, farmer_account_id, crop_name, category, quantity_kg, price_per_kg,
             min_order_kg, description, harvest_date, location, image_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
            (user_id, acct['id'], data['crop_name'], data.get('category', 'General'),
             float(data['quantity_kg']), float(data['price_per_kg']),
             float(data.get('min_order_kg', 1)),
             data.get('description', ''), data.get('harvest_date'),
             data.get('location', ''), data.get('image_url', '')))
        db.commit()
        return jsonify({'success': True, 'message': 'Crop listing created successfully'})
    except Exception as e:
        db.rollback()
        logger.error(f'Create listing error: {e}')
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/my-listings', methods=['GET'])
@role_required('user')
def my_listings():
    db = get_db()
    rows = db.execute('''SELECT cl.*, a.account_number
        FROM crop_listings cl JOIN accounts a ON cl.farmer_account_id = a.id
        WHERE cl.farmer_user_id = ? ORDER BY cl.created_at DESC''',
        (session['user_id'],)).fetchall()
    return jsonify({'success': True, 'listings': [dict(r) for r in rows]})

@marketplace_bp.route('/listings/<int:lid>', methods=['PUT'])
@role_required('user')
def update_listing(lid):
    db = get_db()
    listing = db.execute('SELECT * FROM crop_listings WHERE id = ? AND farmer_user_id = ?',
                         (lid, session['user_id'])).fetchone()
    if not listing:
        return jsonify({'error': 'Listing not found'}), 404
    data = request.json
    db.execute('''UPDATE crop_listings SET crop_name=?, category=?, quantity_kg=?, price_per_kg=?,
        min_order_kg=?, description=?, harvest_date=?, location=?, image_url=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?''',
        (data.get('crop_name', listing['crop_name']), data.get('category', listing['category']),
         float(data.get('quantity_kg', listing['quantity_kg'])),
         float(data.get('price_per_kg', listing['price_per_kg'])),
         float(data.get('min_order_kg', listing['min_order_kg'])),
         data.get('description', listing['description']),
         data.get('harvest_date', listing['harvest_date']),
         data.get('location', listing['location']),
         data.get('image_url', listing['image_url']), lid))
    db.commit()
    return jsonify({'success': True, 'message': 'Listing updated'})

@marketplace_bp.route('/listings/<int:lid>', methods=['DELETE'])
@role_required('user')
def delete_listing(lid):
    db = get_db()
    db.execute('UPDATE crop_listings SET status = "expired" WHERE id = ? AND farmer_user_id = ?',
               (lid, session['user_id']))
    db.commit()
    return jsonify({'success': True, 'message': 'Listing removed'})

# Farmer — Orders received
@marketplace_bp.route('/my-orders', methods=['GET'])
@role_required('user')
def farmer_orders():
    db = get_db()
    rows = db.execute('''SELECT co.*, cl.crop_name, cl.category, ab.name as buyer_name, ab.business_name, ab.phone as buyer_phone
        FROM crop_orders co
        JOIN crop_listings cl ON co.listing_id = cl.id
        JOIN agri_buyers ab ON co.buyer_id = ab.id
        WHERE co.farmer_user_id = ?
        ORDER BY co.created_at DESC''', (session['user_id'],)).fetchall()
    return jsonify({'success': True, 'orders': [dict(r) for r in rows]})

@marketplace_bp.route('/orders/<int:oid>/accept', methods=['PUT'])
@role_required('user')
def accept_order(oid):
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ? AND farmer_user_id = ?',
                       (oid, session['user_id'])).fetchone()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if order['status'] != 'pending':
        return jsonify({'error': f'Cannot accept order in "{order["status"]}" status'}), 400
    db.execute("UPDATE crop_orders SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (oid,))
    db.commit()
    return jsonify({'success': True, 'message': 'Order accepted'})

@marketplace_bp.route('/orders/<int:oid>/reject', methods=['PUT'])
@role_required('user')
def reject_order(oid):
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ? AND farmer_user_id = ?',
                       (oid, session['user_id'])).fetchone()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if order['status'] not in ('pending',):
        return jsonify({'error': 'Cannot reject this order'}), 400
    db.execute("UPDATE crop_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (oid,))
    db.commit()
    return jsonify({'success': True, 'message': 'Order rejected'})

@marketplace_bp.route('/orders/<int:oid>/confirm-delivery', methods=['PUT'])
@role_required('user')
def confirm_delivery(oid):
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ? AND farmer_user_id = ?',
                       (oid, session['user_id'])).fetchone()
    if not order or order['status'] != 'escrow_held':
        return jsonify({'error': 'Order not found or not in escrow'}), 400
    db.execute("UPDATE crop_orders SET status = 'delivered', delivery_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
               (datetime.now().date().isoformat(), oid))
    db.commit()
    return jsonify({'success': True, 'message': 'Delivery confirmed. Awaiting buyer inspection.'})

# Farmer — Escrow & Tax
@marketplace_bp.route('/my-escrow', methods=['GET'])
@role_required('user')
def farmer_escrow():
    db = get_db()
    rows = db.execute('''SELECT et.*, co.status as order_status, cl.crop_name, ab.name as buyer_name
        FROM escrow_transactions et
        JOIN crop_orders co ON et.order_id = co.id
        JOIN crop_listings cl ON co.listing_id = cl.id
        JOIN agri_buyers ab ON co.buyer_id = ab.id
        WHERE co.farmer_user_id = ?
        ORDER BY et.created_at DESC''', (session['user_id'],)).fetchall()
    return jsonify({'success': True, 'escrow': [dict(r) for r in rows]})

@marketplace_bp.route('/tax-records', methods=['GET'])
@role_required('user')
def tax_records():
    db = get_db()
    uid = session['user_id']
    completed = db.execute('''SELECT co.*, cl.crop_name, ab.name as buyer_name
        FROM crop_orders co JOIN crop_listings cl ON co.listing_id = cl.id
        JOIN agri_buyers ab ON co.buyer_id = ab.id
        WHERE co.farmer_user_id = ? AND co.status = 'completed'
        ORDER BY co.updated_at DESC''', (uid,)).fetchall()
    total_revenue = sum(float(o['farmer_credit'] or 0) for o in completed)
    total_commission = sum(float(o['commission_amount'] or 0) for o in completed)
    return jsonify({
        'success': True,
        'summary': {
            'total_sales': len(completed),
            'total_revenue': round(total_revenue, 2),
            'total_commission_paid': round(total_commission, 2),
            'gross_sales': round(total_revenue + total_commission, 2)
        },
        'records': [dict(r) for r in completed]
    })

# ═══════════════════════════════════════════════════════════════════════════════
# BUYER — Browse & Order
# ═══════════════════════════════════════════════════════════════════════════════
def _buyer_required(f):
    """Decorator to ensure agri_buyer is logged in."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'agri_buyer':
            return jsonify({'error': 'Buyer login required'}), 401
        return f(*args, **kwargs)
    return decorated

@marketplace_bp.route('/browse', methods=['GET'])
def browse_listings():
    db = get_db()
    search = request.args.get('search', '')
    cat = request.args.get('category', '')
    q = '''SELECT cl.*, u.name as farmer_name, a.account_number as farmer_account
           FROM crop_listings cl
           JOIN users u ON cl.farmer_user_id = u.id
           JOIN accounts a ON cl.farmer_account_id = a.id
           WHERE cl.status = 'active' '''
    params = []
    if search:
        q += " AND (cl.crop_name LIKE ? OR cl.location LIKE ?) "
        params += [f'%{search}%', f'%{search}%']
    if cat:
        q += " AND cl.category = ? "
        params.append(cat)
    q += " ORDER BY cl.created_at DESC"
    rows = db.execute(q, params).fetchall()
    return jsonify({'success': True, 'listings': [dict(r) for r in rows]})

@marketplace_bp.route('/listing/<int:lid>', methods=['GET'])
def get_listing(lid):
    db = get_db()
    row = db.execute('''SELECT cl.*, u.name as farmer_name, a.account_number as farmer_account
        FROM crop_listings cl JOIN users u ON cl.farmer_user_id = u.id
        JOIN accounts a ON cl.farmer_account_id = a.id
        WHERE cl.id = ?''', (lid,)).fetchone()
    if not row:
        return jsonify({'error': 'Listing not found'}), 404
    return jsonify({'success': True, 'listing': dict(row)})

@marketplace_bp.route('/orders', methods=['POST'])
@_buyer_required
def place_order():
    buyer_id = session['buyer_id']
    data = request.json
    listing_id = data.get('listing_id')
    qty = float(data.get('quantity_kg', 0))
    neg_price = data.get('negotiated_price')
    note = data.get('note', '')

    db = get_db()
    listing = db.execute('SELECT * FROM crop_listings WHERE id = ? AND status = "active"', (listing_id,)).fetchone()
    if not listing:
        return jsonify({'error': 'Listing not available'}), 404
    if qty < float(listing['min_order_kg']):
        return jsonify({'error': f'Minimum order is {listing["min_order_kg"]} kg'}), 400
    if qty > float(listing['quantity_kg']):
        return jsonify({'error': 'Insufficient stock'}), 400

    ppk = float(neg_price) if neg_price else float(listing['price_per_kg'])
    total = round(ppk * qty, 2)
    commission = round(total * COMMISSION_RATE, 2)
    farmer_credit = round(total - commission, 2)

    try:
        # Start transaction context if needed, but db.commit() handles it for SQLite
        # 1. Get buyer account
        buyer_data = db.execute('SELECT associated_account_id FROM agri_buyers WHERE id = ?', (buyer_id,)).fetchone()
        if not buyer_data or not buyer_data['associated_account_id']:
            return jsonify({'error': 'No linked business account found for this buyer. Please contact staff.'}), 400
        
        acc_id = buyer_data['associated_account_id']
        account = db.execute('SELECT * FROM accounts WHERE id = ?', (acc_id,)).fetchone()
        
        if not account:
            return jsonify({'error': 'Linked business account not found'}), 404
        
        if account['balance'] < total:
            return jsonify({'error': f'Insufficient balance in Business Account. Required: ₹{total:.2f}, Available: ₹{account["balance"]:.2f}'}), 400

        # 2. Record Order FIRST
        cursor = db.execute('''INSERT INTO crop_orders
            (listing_id, buyer_id, farmer_user_id, farmer_account_id, quantity_kg, price_per_kg,
             total_amount, commission_amount, farmer_credit, status, negotiated_price, negotiation_note)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
            (listing_id, buyer_id, listing['farmer_user_id'], listing['farmer_account_id'],
             qty, ppk, total, commission, farmer_credit,
             'pending', neg_price, note))
        
        db.commit()
        return jsonify({'success': True, 'message': 'Order request submitted! Please wait for farmer acceptance.'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/orders/<int:oid>/pay', methods=['POST'])
@_buyer_required
def pay_order(oid):
    """Allows a buyer to pay for an accepted order, moving funds to escrow."""
    db = get_db()
    bid = session['buyer_id']
    
    order = db.execute('SELECT * FROM crop_orders WHERE id = ? AND buyer_id = ?', (oid, bid)).fetchone()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    if order['status'] != 'accepted':
        return jsonify({'error': f'Cannot pay for order in "{order["status"]}" status. Wait for farmer acceptance.'}), 400

    total = float(order['total_amount'])
    
    try:
        # 1. Get linked account
        buyer_data = db.execute('SELECT associated_account_id FROM agri_buyers WHERE id = ?', (bid,)).fetchone()
        if not buyer_data or not buyer_data['associated_account_id']:
            return jsonify({'error': 'No linked business account found'}), 400
        
        acc_id = buyer_data['associated_account_id']
        account = db.execute('SELECT * FROM accounts WHERE id = ?', (acc_id,)).fetchone()
        
        if not account or account['balance'] < total:
            msg = f"Insufficient balance. Required: ₹{total:.2f}"
            if account: msg += f", Available: ₹{account['balance']:.2f}"
            return jsonify({'error': msg}), 400

        # 2. Deduct funds and update status
        new_bal = round(float(account['balance']) - total, 2)
        ref = f"AGRIPAY{oid}{secrets.token_hex(2).upper()}"
        
        db.execute('UPDATE accounts SET balance = ? WHERE id = ?', (new_bal, acc_id))
        db.execute('''INSERT INTO transactions (account_id, type, amount, description, reference_number, mode, status, balance_after)
                    VALUES (?, 'debit', ?, ?, ?, 'Agri Escrow', 'completed', ?)''',
                    (acc_id, total, f"Payment for Order #{oid} held in Escrow", ref, new_bal))
        
        db.execute("UPDATE crop_orders SET status = 'escrow_held', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (oid,))
        
        # 3. Create escrow log
        db.execute('''INSERT INTO escrow_transactions (order_id, amount, status, created_at)
                      VALUES (?, ?, 'held_in_escrow', CURRENT_TIMESTAMP)''',
                   (oid, total))
        
        db.commit()
        return jsonify({'success': True, 'message': 'Payment successful! Funds are now securely held in escrow.'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/orders/<int:oid>/negotiate', methods=['PUT'])
@_buyer_required
def negotiate(oid):
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ? AND buyer_id = ?',
                       (oid, session['buyer_id'])).fetchone()
    if not order or order['status'] != 'pending':
        return jsonify({'error': 'Cannot negotiate this order'}), 400
    data = request.json
    new_price = float(data.get('price_per_kg', 0))
    if new_price <= 0:
        return jsonify({'error': 'Invalid price'}), 400
    total = round(new_price * float(order['quantity_kg']), 2)
    commission = round(total * COMMISSION_RATE, 2)
    farmer_credit = round(total - commission, 2)
    db.execute('''UPDATE crop_orders SET negotiated_price=?, negotiation_note=?,
        price_per_kg=?, total_amount=?, commission_amount=?, farmer_credit=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?''',
        (new_price, data.get('note', ''), new_price, total, commission, farmer_credit, oid))
    db.commit()
    return jsonify({'success': True, 'message': f'Price negotiated to ₹{new_price}/kg'})

@marketplace_bp.route('/orders/<int:oid>/confirm-inspection', methods=['PUT'])
@_buyer_required
def confirm_inspection(oid):
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ? AND buyer_id = ?',
                       (oid, session['buyer_id'])).fetchone()
    if not order or order['status'] != 'delivered':
        return jsonify({'error': 'Order not delivered yet'}), 400
    data = request.json
    db.execute("UPDATE crop_orders SET status='inspected', inspection_notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
               (data.get('notes', 'Inspection passed'), oid))
    db.commit()
    return jsonify({'success': True, 'message': 'Inspection confirmed. Awaiting staff to release payment.'})

@marketplace_bp.route('/buyer/orders', methods=['GET'])
@_buyer_required
def buyer_orders():
    db = get_db()
    rows = db.execute('''SELECT co.*, cl.crop_name, cl.category, cl.location, u.name as farmer_name
        FROM crop_orders co
        JOIN crop_listings cl ON co.listing_id = cl.id
        JOIN users u ON co.farmer_user_id = u.id
        WHERE co.buyer_id = ?
        ORDER BY co.created_at DESC''', (session['buyer_id'],)).fetchall()
    return jsonify({'success': True, 'orders': [dict(r) for r in rows]})

@marketplace_bp.route('/buyer/dashboard', methods=['GET'])
@_buyer_required
def buyer_dashboard():
    db = get_db()
    bid = session['buyer_id']
    total_orders = db.execute('SELECT COUNT(*) FROM crop_orders WHERE buyer_id = ?', (bid,)).fetchone()[0]
    active = db.execute("SELECT COUNT(*) FROM crop_orders WHERE buyer_id = ? AND status NOT IN ('completed','cancelled')", (bid,)).fetchone()[0]
    completed = db.execute("SELECT COUNT(*) FROM crop_orders WHERE buyer_id = ? AND status = 'completed'", (bid,)).fetchone()[0]
    total_spent = db.execute("SELECT COALESCE(SUM(total_amount),0) FROM crop_orders WHERE buyer_id = ? AND status = 'completed'", (bid,)).fetchone()[0]
    listings_count = db.execute("SELECT COUNT(*) FROM crop_listings WHERE status = 'active'").fetchone()[0]
    
    # Wallet Info
    buyer = db.execute('SELECT * FROM agri_buyers WHERE id = ?', (bid,)).fetchone()
    wallet = {'account_number': 'N/A', 'balance': 0.00, 'status': 'no_account'}
    
    if buyer and buyer['associated_account_id']:
        acc = db.execute('SELECT account_number, balance FROM accounts WHERE id = ?', (buyer['associated_account_id'],)).fetchone()
        if acc:
            wallet = {
                'account_number': acc['account_number'], 
                'balance': float(acc['balance']),
                'status': 'active'
            }
    else:
        # Check for pending KYC request or approved but unlinked account
        user = db.execute('SELECT id FROM users WHERE username = ?', (buyer['buyer_id'],)).fetchone()
        if user:
            # First, check if a Business account was approved but not yet linked
            acc = db.execute('SELECT id, account_number, balance FROM accounts WHERE user_id = ? AND account_type = "Current" AND status = "active"', (user['id'],)).fetchone()
            if acc:
                # Auto-link the account
                db.execute('UPDATE agri_buyers SET associated_account_id = ? WHERE id = ?', (acc['id'], bid))
                db.commit()
                wallet = {
                    'account_number': acc['account_number'], 
                    'balance': float(acc['balance']),
                    'status': 'active'
                }
            else:
                # Check for pending request
                pending = db.execute('''SELECT id FROM account_requests 
                                       WHERE user_id = ? AND account_type = 'Current' AND status = 'pending' ''', 
                                    (user['id'],)).fetchone()
                if pending:
                    wallet['status'] = 'pending_approval'

    return jsonify({'success': True, 'stats': {
        'total_orders': total_orders, 'active_orders': active,
        'completed_orders': completed, 'total_spent': round(float(total_spent), 2),
        'available_listings': listings_count
    }, 'wallet': wallet})



@marketplace_bp.route('/buyer/wallet/request', methods=['POST'])
@_buyer_required
def buyer_request_wallet():
    """Allows a buyer to submit a KYC request with video and documents."""
    db = get_db()
    bid = session['buyer_id']
    uid = session['user_id']

    # Use request.form for text fields, request.files for documents
    aadhaar = request.form.get('aadhaar_number')
    pan_num = request.form.get('pan_number')
    tax_id = request.form.get('tax_id')
    face_photo_b64 = request.form.get('face_photo')
    kyc_video_b64 = request.form.get('kyc_video')
    face_descriptor = request.form.get('face_descriptor')

    if not all([aadhaar, pan_num, tax_id, face_photo_b64, kyc_video_b64]):
        return jsonify({'error': 'Missing required fields or biometric data.'}), 400

    pan_doc = request.files.get('pan_doc')
    gst_doc = request.files.get('gst_doc')
    if not pan_doc or not gst_doc:
        return jsonify({'error': 'PAN and GST document uploads are required.'}), 400

    buyer = db.execute('SELECT * FROM agri_buyers WHERE id = ?', (bid,)).fetchone()
    if not buyer:
        return jsonify({'error': 'Buyer profile not found'}), 404
        
    if buyer['associated_account_id']:
        return jsonify({'error': 'You already have a Business Account linked.'}), 400

    try:
        # Create upload directory
        import base64
        import os
        upload_dir = os.path.join(current_app.root_path, '..', 'frontend', 'uploads', 'kyc', str(uid))
        os.makedirs(upload_dir, exist_ok=True)

        # Save Documents
        pan_path = os.path.join('uploads', 'kyc', str(uid), f"pan_{secrets.token_hex(4)}_{pan_doc.filename}")
        gst_path = os.path.join('uploads', 'kyc', str(uid), f"gst_{secrets.token_hex(4)}_{gst_doc.filename}")
        pan_doc.save(os.path.join(current_app.root_path, '..', 'frontend', pan_path))
        gst_doc.save(os.path.join(current_app.root_path, '..', 'frontend', gst_path))

        # Save Photo (base64)
        photo_path = os.path.join('uploads', 'kyc', str(uid), f"face_{secrets.token_hex(4)}.jpg")
        with open(os.path.join(current_app.root_path, '..', 'frontend', photo_path), "wb") as f:
            f.write(base64.b64decode(face_photo_b64.split(",")[1]))

        # Save Video (base64)
        video_path = os.path.join('uploads', 'kyc', str(uid), f"video_{secrets.token_hex(4)}.webm")
        with open(os.path.join(current_app.root_path, '..', 'frontend', video_path), "wb") as f:
            f.write(base64.b64decode(kyc_video_b64.split(",")[1]))

        # Check for existing pending request
        existing = db.execute('SELECT id FROM account_requests WHERE user_id = ? AND account_type = "Current" AND status = "pending"', (uid,)).fetchone()
        if existing:
            return jsonify({'error': 'A request is already pending approval.'}), 400
            
        # Create account request
        db.execute('''INSERT INTO account_requests 
                    (user_id, account_type, aadhaar_number, pan_number, tax_id, 
                     kyc_photo, kyc_video, pan_proof, gst_proof, status) 
                    VALUES (?, 'Current', ?, ?, ?, ?, ?, ?, ?, 'pending')''',
                    (uid, aadhaar, pan_num, tax_id, photo_path, video_path, pan_path, gst_path))
        
        # Also store face descriptor if provided for easier verification
        if face_descriptor:
            db.execute('UPDATE users SET face_descriptor = ? WHERE id = ?', (face_descriptor, uid))

        db.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Business KYC submitted with biometric verification! Staff will review your application shortly.'
        })
    except Exception as e:
        db.rollback()
        logger.error(f"KYC Request Error: {e}")
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/buyer/transactions', methods=['GET'])
@_buyer_required
def get_buyer_transactions():
    """Fetches all transactions for the buyer's linked business account."""
    db = get_db()
    bid = session['buyer_id']
    buyer = db.execute('SELECT associated_account_id FROM agri_buyers WHERE id = ?', (bid,)).fetchone()
    if not buyer or not buyer['associated_account_id']:
        return jsonify({'success': True, 'transactions': []})
    
    acc_id = buyer['associated_account_id']
    txns = db.execute('''SELECT * FROM transactions WHERE account_id = ? ORDER BY transaction_date DESC''', (acc_id,)).fetchall()
    return jsonify({'success': True, 'transactions': [dict(t) for t in txns]})

# ═══════════════════════════════════════════════════════════════════════════════
# STAFF / ADMIN — Marketplace Management
# ═══════════════════════════════════════════════════════════════════════════════
@marketplace_bp.route('/staff/orders', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_all_orders():
    db = get_db()
    rows = db.execute('''SELECT co.*, cl.crop_name, cl.category,
            u.name as farmer_name, ab.name as buyer_name, ab.business_name
        FROM crop_orders co
        JOIN crop_listings cl ON co.listing_id = cl.id
        JOIN users u ON co.farmer_user_id = u.id
        JOIN agri_buyers ab ON co.buyer_id = ab.id
        ORDER BY co.created_at DESC''').fetchall()
    return jsonify({'success': True, 'orders': [dict(r) for r in rows]})

@marketplace_bp.route('/escrow/pending', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_escrow_pending():
    db = get_db()
    
    # 1. Get stats
    pending_amount = db.execute("SELECT COALESCE(SUM(total_amount),0) FROM crop_orders WHERE status IN ('escrow_held', 'delivered', 'inspected')").fetchone()[0]
    total_commission = db.execute("SELECT COALESCE(SUM(amount),0) FROM escrow_transactions WHERE type = 'commission'").fetchone()[0]
    completed_orders = db.execute("SELECT COUNT(*) FROM crop_orders WHERE status = 'completed'").fetchone()[0]
    
    # 2. Get pending orders (those waiting for action)
    rows = db.execute('''SELECT co.*, cl.crop_name, cl.category,
            u.name as farmer_name, ab.name as buyer_name, ab.business_name
        FROM crop_orders co
        JOIN crop_listings cl ON co.listing_id = cl.id
        JOIN users u ON co.farmer_user_id = u.id
        JOIN agri_buyers ab ON co.buyer_id = ab.id
        WHERE co.status IN ('escrow_held', 'delivered', 'inspected')
        ORDER BY co.created_at ASC''').fetchall()
        
    return jsonify({
        'success': True, 
        'stats': {
            'pending_amount': round(float(pending_amount), 2),
            'total_commission_earned': round(float(total_commission), 2),
            'completed_orders': completed_orders
        },
        'orders': [dict(r) for r in rows]
    })

@marketplace_bp.route('/staff/orders/<int:oid>/release-escrow', methods=['PUT'])
@role_required(['staff', 'admin'])
def release_escrow(oid):
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ?', (oid,)).fetchone()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if order['status'] not in ('inspected', 'delivered', 'escrow_held'):
        return jsonify({'error': f'Cannot release escrow for order in "{order["status"]}" status'}), 400

    total = float(order['total_amount'])
    commission = float(order['commission_amount'])
    farmer_credit = float(order['farmer_credit'])

    try:
        # Credit farmer's agriculture account
        acct = db.execute('SELECT * FROM accounts WHERE id = ? AND status = "active"', (order['farmer_account_id'],)).fetchone()
        if not acct:
            return jsonify({'error': 'Farmer active agriculture account not found'}), 404

        new_balance = float(acct['balance']) + farmer_credit
        db.execute('UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                   (new_balance, acct['id']))

        # Record transaction in farmer's account
        ref = f"MKT{secrets.token_hex(6).upper()}"
        db.execute('''INSERT INTO transactions (account_id, type, amount, description, reference_number, balance_after, mode)
            VALUES (?, 'credit', ?, ?, ?, ?, 'Marketplace')''',
            (acct['id'], farmer_credit,
             f'Crop sale payment (Order #{oid}) – 2% commission deducted',
             ref, new_balance))

        # Escrow release + commission log
        db.execute('''INSERT INTO escrow_transactions (order_id, amount, type, description)
            VALUES (?, ?, 'release', ?)''', (oid, farmer_credit, f'Payment released to farmer account {acct["account_number"]}'))
        db.execute('''INSERT INTO escrow_transactions (order_id, amount, type, description)
            VALUES (?, ?, 'commission', ?)''', (oid, commission, f'Bank commission (2%) on order #{oid}'))

        db.execute("UPDATE crop_orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (oid,))

        # Reduce listing quantity
        listing = db.execute('SELECT * FROM crop_listings WHERE id = ?', (order['listing_id'],)).fetchone()
        if listing:
            qty_ordered = float(order['quantity_kg'])
            qty_available = float(listing['quantity_kg'])
            remaining = round(qty_available - qty_ordered, 2)
            
            if remaining <= 0:
                db.execute("UPDATE crop_listings SET status = 'sold', quantity_kg = 0 WHERE id = ?", (listing['id'],))
            else:
                db.execute("UPDATE crop_listings SET quantity_kg = ? WHERE id = ?", (remaining, listing['id']))

        # CRITICAL: Atomic commit
        db.commit()
        return jsonify({'success': True,
            'message': f'Escrow released! ₹{farmer_credit:,.2f} credited to farmer. Commission: ₹{commission:,.2f}'})
    except Exception as e:
        db.rollback()
        logger.error(f'Release escrow error: {e}')
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/staff/orders/<int:oid>/refund', methods=['PUT'])
@role_required(['staff', 'admin'])
def refund_escrow(oid):
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ?', (oid,)).fetchone()
    if not order or order['status'] not in ('escrow_held', 'delivered', 'inspected', 'accepted'):
        return jsonify({'error': 'Cannot refund this order'}), 400
    try:
        db.execute('''INSERT INTO escrow_transactions (order_id, amount, type, description)
            VALUES (?, ?, 'refund', ?)''',
            (oid, float(order['total_amount']), f'Full refund to buyer for order #{oid}'))
        db.execute("UPDATE crop_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (oid,))
        db.commit()
        return jsonify({'success': True, 'message': 'Order refunded and cancelled'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/staff/escrow-report', methods=['GET'])
@role_required(['staff', 'admin'])
def escrow_report():
    db = get_db()
    held = db.execute("SELECT COALESCE(SUM(total_amount),0) FROM crop_orders WHERE status = 'escrow_held'").fetchone()[0]
    released = db.execute("SELECT COALESCE(SUM(amount),0) FROM escrow_transactions WHERE type = 'release'").fetchone()[0]
    commission = db.execute("SELECT COALESCE(SUM(amount),0) FROM escrow_transactions WHERE type = 'commission'").fetchone()[0]
    refunded = db.execute("SELECT COALESCE(SUM(amount),0) FROM escrow_transactions WHERE type = 'refund'").fetchone()[0]
    return jsonify({'success': True, 'report': {
        'currently_held': round(float(held), 2),
        'total_released': round(float(released), 2),
        'total_commission': round(float(commission), 2),
        'total_refunded': round(float(refunded), 2)
    }})

@marketplace_bp.route('/staff/listings', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_all_listings():
    db = get_db()
    rows = db.execute('''SELECT cl.*, u.name as farmer_name
        FROM crop_listings cl JOIN users u ON cl.farmer_user_id = u.id
        ORDER BY cl.created_at DESC''').fetchall()
    return jsonify({'success': True, 'listings': [dict(r) for r in rows]})

def _provision_buyer_account(buyer_id, buyer_name, buyer_email, buyer_password):
    """
    Creates a standard bank user and a Business account for a Retail Agri Buyer.
    Returns the associated_account_id.
    """
    db = get_db()
    # 1. Create banking user if not exists
    user = db.execute('SELECT id FROM users WHERE username = ? OR email = ?', (buyer_id, buyer_email)).fetchone()
    if not user:
        db.execute('''INSERT INTO users (username, password, name, email, status) 
                    VALUES (?, ?, ?, ?, 'active')''',
                    (buyer_id, buyer_password, buyer_name, buyer_email))
        user_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        trigger_geo_lookup(user_id)
    else:
        user_id = user['id']
    
    # 2. Check if already has a business account
    acc = db.execute('SELECT id FROM accounts WHERE user_id = ? AND account_type = "Business"', (user_id,)).fetchone()
    if acc:
        return acc['id']
    
    # 3. Create new Business account
    acc_num = f"SB{''.join([str(random.randint(0, 9)) for _ in range(12)])}"
    db.execute('''INSERT INTO accounts (user_id, account_number, account_type, balance, status) 
                VALUES (?, ?, 'Business', 0.00, 'active')''',
                (user_id, acc_num))
    acc_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    return acc_id

@marketplace_bp.route('/staff/agri-buyers', methods=['POST'])
@role_required(['staff', 'admin'])
def staff_create_agri_buyer():
    data = request.json
    db = get_db()
    
    buyer_id = data.get('buyer_id')
    password = data.get('password')
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone', '')
    business_name = data.get('business_name', '')
    gst_number = data.get('gst_number', '')

    if not all([buyer_id, password, name, email]):
        return jsonify({'error': 'buyer_id, password, name, and email are required'}), 400

    existing = db.execute('SELECT id FROM agri_buyers WHERE buyer_id = ? OR email = ?', (buyer_id, email)).fetchone()
    if existing:
        return jsonify({'error': 'Buyer ID or Email already exists'}), 400

    try:
        from werkzeug.security import generate_password_hash
        hashed = generate_password_hash(password)
        
        # Provision the bank account first
        acc_id = _provision_buyer_account(buyer_id, name, email, hashed)
        
        db.execute('''INSERT INTO agri_buyers (buyer_id, password, name, email, phone, business_name, gst_number, status, associated_account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)''',
            (buyer_id, hashed, name, email, phone, business_name, gst_number, acc_id))
        db.commit()
        return jsonify({'success': True, 'message': 'Retail Agri Buyer created, activated, and Business Account provisioned.'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/staff/agri-buyers', methods=['GET'])
@role_required(['staff', 'admin'])
def staff_agri_buyers():
    db = get_db()
    rows = db.execute('''SELECT ab.id, ab.buyer_id, ab.name, ab.email, ab.phone, 
                    ab.business_name, ab.gst_number, ab.status, ab.created_at,
                    COALESCE((SELECT SUM(total_amount) FROM crop_orders 
                              WHERE buyer_id = ab.id AND status = 'completed'), 0) as total_turnover
        FROM agri_buyers ab
        ORDER BY CASE WHEN ab.status = 'pending' THEN 0 ELSE 1 END, ab.created_at DESC''').fetchall()
    return jsonify({'success': True, 'buyers': [dict(r) for r in rows]})

@marketplace_bp.route('/staff/agri-buyers/<int:bid>/approve', methods=['PUT'])
@role_required(['staff', 'admin'])
def approve_agri_buyer(bid):
    db = get_db()
    buyer = db.execute('SELECT * FROM agri_buyers WHERE id = ?', (bid,)).fetchone()
    if not buyer:
        return jsonify({'error': 'Buyer not found'}), 404
    
    try:
        # Provision if not already linked
        acc_id = buyer['associated_account_id']
        if not acc_id:
            acc_id = _provision_buyer_account(buyer['buyer_id'], buyer['name'], buyer['email'], buyer['password'])
        
        db.execute("UPDATE agri_buyers SET status = 'active', associated_account_id = ? WHERE id = ?", (acc_id, bid))
        db.commit()
        return jsonify({'success': True, 'message': 'Retail Agri Buyer approved and Business Account provisioned.'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/staff/agri-buyers/<int:bid>/suspend', methods=['PUT'])
@role_required(['staff', 'admin'])
def suspend_agri_buyer(bid):
    db = get_db()
    db.execute("UPDATE agri_buyers SET status = 'suspended' WHERE id = ?", (bid,))
    db.commit()
    return jsonify({'success': True, 'message': 'Retail Agri Buyer suspended.'})
# ═══════════════════════════════════════════════════════════════════════════════
# SMART MANDI INTELLIGENCE (India Specific)
# ═══════════════════════════════════════════════════════════════════════════════

class MandiPriceSimulator:
    """Simulates realistic Indian Mandi prices (Agmarknet style)."""
    COMMODITIES = {
        'Wheat': ['Kalyan', 'Sharbati', 'Local', '147'],
        'Rice': ['Basmati', 'Sona Masuri', 'IR64', 'Common'],
        'Cotton': ['Long Staple', 'Medium Staple', 'Desi'],
        'Onion': ['Red', 'White', 'Nasik'],
        'Potato': ['Jyoti', 'Local', 'Store'],
        'Tomato': ['Hybrid', 'Local'],
        'Maize': ['Yellow', 'White'],
        'Arhar (Tur)': ['Lemon', 'Local', 'Unpolished']
    }
    
    STATES = {
        'Maharashtra': ['Nasik', 'Pune', 'Nagpur', 'Solapur', 'Ahmednagar'],
        'Punjab': ['Ludhiana', 'Amritsar', 'Patiala', 'Jalandhar', 'Mansa'],
        'Gujarat': ['Ahmedabad', 'Surat', 'Rajkot', 'Gondal', 'Amreli'],
        'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Bareilly'],
        'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Gulbarga', 'Shimoga'],
        'Haryana': ['Karnal', 'Ambala', 'Sirsa', 'Rohtak', 'Hisar']
    }

    @staticmethod
    def get_prices(state=None, district=None, commodity=None):
        results = []
        target_states = [state] if state and state != 'All' else list(MandiPriceSimulator.STATES.keys())
        target_commodities = [commodity] if commodity and commodity != 'All' else list(MandiPriceSimulator.COMMODITIES.keys())
        
        for s in target_states:
            districts = MandiPriceSimulator.STATES.get(s, [])
            for d in districts:
                if district and district != 'All' and district != d:
                    continue
                
                # Each district has 1-2 Mandis
                mandis = [f"{d} Mandi", f"{d} APMC Market"]
                for m in mandis:
                    for c in target_commodities:
                        # 30% chance to have a price for a specific commodity in a specific mandi
                        if random.random() > 0.4:
                            variety = random.choice(MandiPriceSimulator.COMMODITIES[c])
                            # Realistic price ranges (approximate INR per 100kg/Quintal)
                            base_prices = {
                                'Wheat': 2200, 'Rice': 3500, 'Cotton': 6500, 'Onion': 1800,
                                'Potato': 1200, 'Tomato': 1500, 'Maize': 2000, 'Arhar (Tur)': 7000
                            }
                            base = base_prices.get(c, 2000)
                            modal = round(base + random.uniform(-200, 500), 2)
                            min_p = round(modal - random.uniform(50, 150), 2)
                            max_p = round(modal + random.uniform(50, 300), 2)
                            
                            results.append({
                                'state': s,
                                'district': d,
                                'mandi': m,
                                'commodity': c,
                                'variety': variety,
                                'min_price': min_p,
                                'max_price': max_p,
                                'modal_price': modal,
                                'arrival_date': datetime.now().strftime('%d-%b-%Y'),
                                'trend': random.choice(['up', 'down', 'stable'])
                            })
        return sorted(results, key=lambda x: x['arrival_date'], reverse=True)

@marketplace_bp.route('/mandi/prices', methods=['GET'])
def get_mandi_prices():
    state = request.args.get('state')
    district = request.args.get('district')
    commodity = request.args.get('commodity')
    
    prices = MandiPriceSimulator.get_prices(state, district, commodity)
    
    # Return unique states/commodities for filters
    return jsonify({
        'success': True,
        'prices': prices[:100], # Limit to top 100
        'filters': {
            'states': list(MandiPriceSimulator.STATES.keys()),
            'commodities': list(MandiPriceSimulator.COMMODITIES.keys())
        }
    })

@marketplace_bp.route('/orders/<int:oid>/chat', methods=['GET', 'POST'])
def handle_order_chat(oid):
    user_id = session.get('user_id')
    buyer_id = session.get('buyer_id')
    
    if not user_id and not buyer_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    order = db.execute('SELECT * FROM crop_orders WHERE id = ?', (oid,)).fetchone()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    # Verify participant
    if user_id and order['farmer_user_id'] != user_id:
        return jsonify({'error': 'Unauthorized participant'}), 403
    if buyer_id and order['buyer_id'] != buyer_id:
        return jsonify({'error': 'Unauthorized participant'}), 403
        
    # Determine sender type and id
    if user_id:
        sender_type = 'farmer'
        sender_id = user_id
    else:
        sender_type = 'buyer'
        sender_id = buyer_id

    if request.method == 'GET':
        chats = db.execute('''
            SELECT * FROM marketplace_chats 
            WHERE order_id = ? 
            ORDER BY created_at ASC
        ''', (oid,)).fetchall()
        
        formatted_chats = []
        for c in chats:
            name = "Unknown"
            if c['sender_type'] == 'farmer':
                f_row = db.execute('SELECT name FROM users WHERE id = ?', (c['sender_id'],)).fetchone()
                name = f_row['name'] if f_row else "Farmer"
            else:
                b_row = db.execute('SELECT name FROM agri_buyers WHERE id = ?', (c['sender_id'],)).fetchone()
                name = b_row['name'] if b_row else "Buyer"
                
            formatted_chats.append({
                'id': c['id'],
                'sender_type': c['sender_type'],
                'sender_name': name,
                'message': c['message'],
                'created_at': c['created_at']
            })
            
        return jsonify({'success': True, 'chats': formatted_chats})
        
    if request.method == 'POST':
        data = request.json
        message = data.get('message', '').strip()
        if not message:
            return jsonify({'error': 'Message cannot be empty'}), 400
            
        db.execute('''
            INSERT INTO marketplace_chats (order_id, sender_type, sender_id, message)
            VALUES (?, ?, ?, ?)
        ''', (oid, sender_type, sender_id, message))
        db.commit()
        return jsonify({'success': True, 'message': 'Message sent'})
