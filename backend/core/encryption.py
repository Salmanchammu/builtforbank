"""
SmartBank Chat Encryption Module
Uses Fernet (AES-128-CBC) symmetric encryption for all live chat messages.
The encryption key is derived from the app's SECRET_KEY so it persists across restarts.
"""
import os
import base64
import hashlib
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger('smart_bank.encryption')

_fernet_instance = None

def _get_fernet():
    """Lazily initializes the Fernet cipher using a key derived from SECRET_KEY."""
    global _fernet_instance
    if _fernet_instance is None:
        secret = os.environ.get('SECRET_KEY', 'default_dev_key_change_in_production_99881122')
        # Derive a 32-byte key from the secret using SHA-256, then base64-encode for Fernet
        key_bytes = hashlib.sha256(secret.encode('utf-8')).digest()
        fernet_key = base64.urlsafe_b64encode(key_bytes)
        _fernet_instance = Fernet(fernet_key)
        logger.info("Chat encryption cipher initialized (AES-128-CBC via Fernet)")
    return _fernet_instance

def encrypt_message(plaintext: str) -> str:
    """Encrypts a plaintext string. Returns base64-encoded ciphertext."""
    if not plaintext:
        return ''
    f = _get_fernet()
    token = f.encrypt(plaintext.encode('utf-8'))
    return token.decode('utf-8')

def decrypt_message(ciphertext: str) -> str:
    """Decrypts a ciphertext string. Returns the original plaintext."""
    if not ciphertext:
        return ''
    try:
        f = _get_fernet()
        plaintext = f.decrypt(ciphertext.encode('utf-8'))
        return plaintext.decode('utf-8')
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return '[Encrypted message — unable to decrypt]'
