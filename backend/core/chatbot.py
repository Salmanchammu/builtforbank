import random
import logging
from .db import get_db

logger = logging.getLogger('smart_bank.chatbot')

class BankingChatbot:
    def __init__(self):
        self.intents = {
            'greeting': {'patterns': ['hello', 'hi', 'hey'], 'responses': ["Hello! I'm your Smart Bank AI assistant. How can I help you today?"]},
            'balance_inquiry': {'patterns': ['balance', 'how much'], 'responses': ["I'll fetch your current account balance."], 'requires_auth': True},
            'transaction_history': {'patterns': ['transactions', 'history', 'recent'], 'responses': ["I'll show you your recent transactions."], 'requires_auth': True},
            'transfer_money': {'patterns': ['transfer', 'send money'], 'responses': ["I can help you transfer money. Proceed to the transfer section?"], 'requires_auth': True},
            'loan_inquiry': {'patterns': ['loan', 'apply'], 'responses': ["We offer Personal, Home, and Car loans. Would you like to see options?"], 'requires_auth': True},
            'card_inquiry': {'patterns': ['card', 'credit', 'debit'], 'responses': ["I can help you request a new card. Gold or Platinum?"], 'requires_auth': True},
            'support_request': {'patterns': ['help', 'support'], 'responses': ["I can help with balance, transfers, loans, and cards. Just ask!"]},
            'thanks': {'patterns': ['thanks', 'thank you'], 'responses': ["You're welcome! Happy to help."]}
        }
    
    def get_response(self, message, user_id=None):
        msg = message.lower()
        db = get_db()
        for intent, data in self.intents.items():
            for p in data['patterns']:
                if p in msg:
                    if data.get('requires_auth') and not user_id:
                        return "Please log in to access your account details.", intent
                    
                    # Dynamic responses for authenticated users
                    if intent == 'balance_inquiry' and user_id:
                        accounts = db.execute('SELECT balance FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
                        if accounts:
                            total = sum(float(a['balance']) for a in accounts)
                            return f"The total balance across your accounts is ₹{total:,.2f}.", intent
                        return "I couldn't find any linked accounts for your profile.", intent
                        
                    return random.choice(data['responses']), intent
        return "I'm not sure I understand. Try asking about your balance, transactions, or loans.", "unknown"
