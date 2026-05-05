from flask import Blueprint, request, jsonify, session
import logging
from core.chatbot import BankingChatbot

chat_bp = Blueprint('chat', __name__)
logger = logging.getLogger('smart_bank.chat')
chatbot = BankingChatbot()

@chat_bp.route('/message', methods=['POST'])
def chat_message():
    try:
        data = request.json
        message = data.get('message', '')
        user_id = session.get('user_id') or session.get('staff_id') or session.get('admin_id')
        
        # get_response returns (response_string, intent_string)
        resp_text, intent = chatbot.get_response(message, user_id)
        
        return jsonify({
            'success': True,
            'response': resp_text,
            'intent': intent
        })
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@chat_bp.route('/suggestions', methods=['GET'])
def chat_suggestions():
    # Provide helpful suggestions for the user
    suggestions = [
        {'text': 'Check Balance', 'action': 'balance'},
        {'text': 'Transactions', 'action': 'transactions'},
        {'text': 'Transfer', 'action': 'transfer'},
        {'text': 'Loans', 'action': 'loan'},
        {'text': 'Cards', 'action': 'card'},
        {'text': 'Support', 'action': 'help'}
    ]
    return jsonify({
        'success': True,
        'suggestions': suggestions
    })
