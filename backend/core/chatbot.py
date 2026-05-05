import random
import logging
from datetime import datetime
from .db import get_db

logger = logging.getLogger('smart_bank.chatbot')

class BankingChatbot:
    def __init__(self):
        self.intents = {
            'greeting': {
                'patterns': ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings', 'namaste', 'hola'],
                'responses': [
                    "Hello! 👋 I'm your Smart Bank AI assistant. How can I help you today?",
                    "Hi there! Welcome to Smart Bank. I can help with balances, transfers, loans, cards, and more!",
                    "Hey! 😊 Great to see you. What can I do for you today?",
                    "Hello! I'm here to make your banking easy. Ask me anything!"
                ]
            },
            'balance_inquiry': {
                'patterns': ['balance', 'how much money', 'my money', 'account balance', 'check balance', 'show balance', 'what is my balance', 'available balance', 'remaining balance', 'funds'],
                'responses': ["Let me check your account balance for you..."],
                'requires_auth': True
            },
            'transaction_history': {
                'patterns': ['transactions', 'history', 'recent transactions', 'statement', 'activity', 'past transactions', 'mini statement', 'last transaction', 'spending', 'debits', 'credits'],
                'responses': [
                    "📋 I'll pull up your recent transactions now. Navigating you to the transaction history...",
                    "Let me fetch your transaction history. One moment..."
                ],
                'requires_auth': True
            },
            'transfer_money': {
                'patterns': ['transfer', 'send money', 'pay someone', 'bank transfer', 'neft', 'imps', 'rtgs', 'send funds', 'wire money', 'remittance'],
                'responses': [
                    "💸 I can help you transfer money! I'll take you to the transfer section.",
                    "Sure! Let me redirect you to initiate a transfer. You can send via IMPS, NEFT, or internal transfer."
                ],
                'requires_auth': True
            },
            'loan_inquiry': {
                'patterns': ['loan', 'apply loan', 'personal loan', 'home loan', 'car loan', 'education loan', 'loan status', 'emi', 'loan repayment', 'interest rate', 'gold loan', 'agriculture loan', 'agri loan'],
                'responses': [
                    "🏦 We offer multiple loan products:\n• Personal Loan — from 8.9% p.a.\n• Home Loan — from 7.5% p.a.\n• Gold Loan — instant approval at 8% p.a.\n• Agriculture Loan — GPS-verified with satellite analysis\n\nI'll take you to the loans section to explore!",
                    "Great question! Smart Bank offers competitive loan rates. Let me navigate you to explore your options."
                ],
                'requires_auth': True
            },
            'card_inquiry': {
                'patterns': ['card', 'credit card', 'debit card', 'apply card', 'card status', 'block card', 'card limit', 'virtual card', 'platinum card', 'gold card', 'card number', 'cvv', 'card details'],
                'responses': [
                    "💳 I can help with your cards! Smart Bank offers:\n• Classic Debit Card — Free with every account\n• Gold Credit Card — Up to ₹2L limit\n• Platinum Credit Card — Premium rewards & lounge access\n\nLet me take you to card services!",
                    "Sure! I'll navigate you to the cards section where you can view, manage, or apply for new cards."
                ],
                'requires_auth': True
            },
            'support_request': {
                'patterns': ['help', 'support', 'talk to agent', 'customer service', 'complaint', 'issue', 'problem', 'speak to human', 'live chat', 'escalate', 'ticket', 'report'],
                'responses': [
                    "🎧 I'll connect you with our support team right away. Creating a live support ticket...",
                    "Let me get you connected to a staff member who can help. One moment..."
                ]
            },
            'upi_inquiry': {
                'patterns': ['upi', 'upi pin', 'upi id', 'upi payment', 'upi transfer', 'vpa', 'bhim', 'google pay', 'phonepe'],
                'responses': [
                    "📱 Smart Bank supports UPI payments via NPCI sandbox! You can:\n• Send money instantly using UPI ID\n• Change your UPI PIN anytime\n• Scan QR codes for quick payments\n\nNeed help with anything specific?"
                ],
                'requires_auth': True
            },
            'fd_inquiry': {
                'patterns': ['fixed deposit', 'fd', 'recurring deposit', 'rd', 'deposit', 'savings interest', 'term deposit'],
                'responses': [
                    "🏛️ Smart Bank Fixed Deposits:\n• Rates up to 7.5% p.a.\n• Flexible tenure: 6 months to 5 years\n• Senior citizen bonus: +0.5% extra\n• Premature withdrawal available\n\nWould you like to open a new FD?",
                    "Great investment choice! Our FD rates are highly competitive. I can help you open one from your dashboard."
                ]
            },
            'mutual_fund': {
                'patterns': ['mutual fund', 'invest', 'sip', 'mutual funds', 'investment', 'portfolio', 'stocks', 'equity'],
                'responses': [
                    "📈 Smart Bank Mutual Fund offerings:\n• Alpha Growth Fund — +18% p.a. returns\n• Smart Wealth Builder — Min ₹2,000 SIP\n• Secure Future Flexi-Cap — Balanced risk\n\nI can help you start investing today!"
                ]
            },
            'insurance': {
                'patterns': ['insurance', 'life insurance', 'health insurance', 'term plan', 'policy', 'premium', 'coverage'],
                'responses': [
                    "🛡️ Our insurance partners offer:\n• Term Protect — High cover, low premiums\n• Health Plus — Comprehensive medical cover\n• Child Saver — Secure their education\n• Retire Easy — Guaranteed pension plan\n\nWould you like to explore any of these?"
                ]
            },
            'kyc': {
                'patterns': ['kyc', 'verification', 'verify identity', 'aadhar', 'aadhaar', 'pan card', 'documents', 'document verification'],
                'responses': [
                    "📄 KYC Verification:\nYour KYC status is managed in your profile settings. You can:\n• Upload Aadhaar & PAN documents\n• Check verification status\n• Update personal details\n\nGo to Profile → Manage KYC to get started."
                ],
                'requires_auth': True
            },
            'security': {
                'patterns': ['password', 'reset password', 'change password', 'security', 'pin', 'otp', 'two factor', '2fa', 'biometric', 'face login', 'fingerprint'],
                'responses': [
                    "🔐 Security options available:\n• Reset login password\n• Set/Change balance PIN (4-digit)\n• Set/Change UPI PIN (6-digit)\n• Setup Face Recognition login\n• Enable biometric authentication\n\nGo to Profile → Settings for these options."
                ]
            },
            'account_opening': {
                'patterns': ['open account', 'new account', 'savings account', 'current account', 'create account', 'account type'],
                'responses': [
                    "🏦 Smart Bank Account Types:\n• Savings Account — 4% interest, zero-balance\n• Current Account — Ideal for business\n• Agriculture Account — Special farmer benefits\n• Student Account — Zero charges under 25\n\nYou can open additional accounts from your profile!"
                ],
                'requires_auth': True
            },
            'branch_atm': {
                'patterns': ['branch', 'atm', 'nearby', 'location', 'nearest branch', 'nearest atm', 'branch locator', 'find branch'],
                'responses': [
                    "📍 Use our Branch & ATM Locator to find the nearest Smart Bank locations! It features:\n• Interactive 3D map\n• Real-time distance calculation\n• Walking, driving & transit directions\n• One-tap Google Maps navigation\n\nI'll take you to the locator now!"
                ]
            },
            'thanks': {
                'patterns': ['thanks', 'thank you', 'thank', 'appreciate', 'grateful', 'awesome', 'great'],
                'responses': [
                    "You're welcome! 😊 Happy to help. Anything else?",
                    "Glad I could help! Don't hesitate to ask if you need anything else.",
                    "My pleasure! I'm always here for you. 🌟"
                ]
            },
            'goodbye': {
                'patterns': ['bye', 'goodbye', 'see you', 'quit', 'exit', 'close', 'done'],
                'responses': [
                    "Goodbye! 👋 Have a great day. Come back anytime!",
                    "See you later! Your finances are in good hands with Smart Bank. 🏦",
                    "Take care! Remember, I'm available 24/7 if you need help."
                ]
            },
            'joke': {
                'patterns': ['joke', 'funny', 'make me laugh', 'tell me something'],
                'responses': [
                    "😄 Here's one: Why did the banker switch careers? Because he lost interest!",
                    "😂 Banking humor: What do you call a financial wizard? A branch manager!",
                    "🤭 Why don't banks ever go on vacation? They can't afford to lose interest!"
                ]
            },
            'who_are_you': {
                'patterns': ['who are you', 'what are you', 'your name', 'about you', 'what can you do', 'features'],
                'responses': [
                    "🤖 I'm Smart Bank AI — your personal finance assistant!\n\nI can help with:\n• 💰 Balance inquiries\n• 📋 Transaction history\n• 💸 Money transfers\n• 🏦 Loan applications\n• 💳 Card management\n• 📱 UPI payments\n• 📍 Branch/ATM locator\n• 🛡️ Insurance & investments\n• 🎧 Live staff support\n\nJust type your question!"
                ]
            },
            'offers': {
                'patterns': ['offers', 'discount', 'cashback', 'promo', 'promotion', 'coupon', 'deal', 'reward'],
                'responses': [
                    "🎉 Current Offers:\n• 10% cashback on Swiggy (Code: SMART10) — min ₹500\n• Pre-approved Personal Loan at 8.9% — zero documentation\n• FD rates up to 7.5% for new deposits\n\nCheck the Offers section for more exclusive deals!"
                ]
            },
            'crop_marketplace': {
                'patterns': ['crop', 'marketplace', 'sell crop', 'buy crop', 'farming', 'agriculture market', 'mandi'],
                'responses': [
                    "🌾 Crop Marketplace:\nSmart Bank's agriculture marketplace lets you:\n• List crops for sale with photos\n• Set prices and minimum order quantities\n• Track orders and manage listings\n• Connect directly with buyers\n\nAvailable for Agriculture account holders. Check the More section!"
                ],
                'requires_auth': True
            }
        }
    
    def get_response(self, message, user_id=None):
        msg = message.lower().strip()
        db = get_db()
        
        # Check each intent
        for intent, data in self.intents.items():
            for p in data['patterns']:
                if p in msg:
                    if data.get('requires_auth') and not user_id:
                        return "🔒 Please log in to access your account details.", intent
                    
                    # Dynamic responses for authenticated users
                    if intent == 'balance_inquiry' and user_id:
                        try:
                            accounts = db.execute('SELECT account_number, balance, account_type FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
                            if accounts:
                                total = sum(float(a['balance']) for a in accounts)
                                lines = [f"💰 **Your Account Summary**\n"]
                                for a in accounts:
                                    acct_type = a['account_type'].title() if a['account_type'] else 'Savings'
                                    lines.append(f"• {acct_type}: ₹{float(a['balance']):,.2f} ({a['account_number'][-4:]})")
                                if len(accounts) > 1:
                                    lines.append(f"\n📊 Total across {len(accounts)} accounts: ₹{total:,.2f}")
                                return "\n".join(lines), intent
                            return "I couldn't find any linked accounts for your profile. Please open an account first.", intent
                        except Exception as e:
                            logger.error(f"Balance query error: {e}")
                            return "I had trouble fetching your balance. Please try again.", intent

                    if intent == 'transaction_history' and user_id:
                        try:
                            txns = db.execute('''
                                SELECT type, amount, description, created_at 
                                FROM transactions 
                                WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?) 
                                ORDER BY created_at DESC LIMIT 5
                            ''', (user_id,)).fetchall()
                            if txns:
                                lines = ["📋 **Your Last 5 Transactions:**\n"]
                                for t in txns:
                                    emoji = "🟢" if t['type'] in ('credit', 'deposit') else "🔴"
                                    amt = float(t['amount'])
                                    desc = t['description'] or 'Transaction'
                                    date_str = t['created_at'][:10] if t['created_at'] else 'N/A'
                                    lines.append(f"{emoji} ₹{amt:,.2f} — {desc} ({date_str})")
                                lines.append("\nNavigating you to full transaction history...")
                                return "\n".join(lines), intent
                        except Exception as e:
                            logger.error(f"Transaction query error: {e}")
                    
                    return random.choice(data['responses']), intent
        
        # No intent matched — helpful fallback
        return "🤔 I'm not sure I understand that. Here are some things I can help with:\n\n• Check your balance\n• View recent transactions\n• Transfer money\n• Apply for loans or cards\n• Find nearby branches\n• Get live support\n\nTry rephrasing your question, or type 'help' for more options!", "unknown"
