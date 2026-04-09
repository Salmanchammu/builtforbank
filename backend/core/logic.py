import logging
from datetime import datetime
from .db import get_db

logger = logging.getLogger('smart_bank.logic')

def apply_loan_penalties(db=None):
    """Core logic to apply daily penalty of 0.1% for overdue loans"""
    if db is None:
        db = get_db()
    
    today = datetime.now().date()
    # Find loans where next_due_date has passed and haven't been charged today
    # Focus only on approved/active loans
    try:
        loans = db.execute('''
            SELECT * FROM loans 
            WHERE status IN ("approved", "overdue") 
            AND next_due_date < ? 
            AND (last_charge_date IS NULL OR DATE(last_charge_date) < ?)
        ''', (today, today)).fetchall()
        
        count = 0
        for loan in loans:
            # Penalty: 0.1% of principal amount per day (more standard than monthly payment %)
            amount_to_base_on = float(loan['loan_amount'])
            penalty = round(amount_to_base_on * 0.001, 2)
            
            # Use current penalty_amount or default to 0
            current_penalty = float(loan['penalty_amount'] if loan['penalty_amount'] is not None else 0)
            new_penalty = current_penalty + penalty
            
            # Outstanding amount includes the new penalty
            current_outstanding = float(loan['outstanding_amount'] if loan['outstanding_amount'] is not None else loan['loan_amount'])
            new_outstanding = current_outstanding + penalty
            
            db.execute('''
                UPDATE loans 
                SET penalty_amount = ?, 
                    outstanding_amount = ?, 
                    status = "overdue",
                    last_charge_date = CURRENT_TIMESTAMP 
                WHERE id = ?
            ''', (new_penalty, new_outstanding, loan['id']))
            count += 1
            
        if count > 0:
            db.commit()
        return count
    except Exception as e:
        logger.error(f"Error applying penalties: {e}")
        return 0
