import os
import logging
import sqlite3
import time
from contextlib import closing
from flask import Blueprint, request, jsonify
from backend.utils.hmac_verify import verify_hmac_signature
from backend.utils.replay_cache import replay_cache

logger = logging.getLogger(__name__)

webhook_bp = Blueprint('webhook', __name__)

def log_verification_attempt(ip: str, endpoint: str, result: str, detail: str = ""):
    """
    Logs every signature verification attempt to the state ledger.
    """
    db_path = os.environ.get('COPERNICUS_DB_PATH', os.path.expanduser('~/.copernicus/copernicus.db'))
    if db_path != ':memory:':
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    try:
        with closing(sqlite3.connect(db_path)) as conn:
            conn.execute('PRAGMA foreign_keys = ON')
            conn.execute('PRAGMA journal_mode = WAL')
            
            # Ensure table exists (usually created by StateLedger, but just in case for webhook events)
            conn.execute('''
                CREATE TABLE IF NOT EXISTS webhook_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    ip_address TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    result TEXT NOT NULL,
                    detail TEXT
                )
            ''')
            conn.commit()
            
            now = int(time.time() * 1000)
            conn.execute(
                'INSERT INTO webhook_logs (timestamp, ip_address, endpoint, result, detail) VALUES (?, ?, ?, ?, ?)',
                (now, ip, endpoint, result, detail)
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to log webhook verification attempt to state ledger: {e}")

@webhook_bp.route('/github', methods=['POST'])
def github_webhook():
    ip = request.remote_addr or "unknown"
    endpoint = "/api/webhook/github"
    
    secret = os.environ.get('GITHUB_WEBHOOK_SECRET')
    if not secret:
        logger.warning("GITHUB_WEBHOOK_SECRET not configured. Rejecting webhook request.")
        log_verification_attempt(ip, endpoint, "FAILED", "Secret not configured")
        # Return 401 as it's a server configuration issue preventing authentication
        return jsonify({"error": "Webhook secret not configured"}), 401

    signature = request.headers.get('X-Hub-Signature-256')
    if not signature:
        logger.warning("Missing X-Hub-Signature-256 header")
        log_verification_attempt(ip, endpoint, "FAILED", "Missing signature header")
        return jsonify({"error": "Missing signature header"}), 401
        
    delivery_id = request.headers.get('X-GitHub-Delivery')
    if not delivery_id:
        logger.warning("Missing X-GitHub-Delivery header")
        log_verification_attempt(ip, endpoint, "FAILED", "Missing delivery ID header")
        return jsonify({"error": "Missing delivery ID"}), 400

    payload = request.get_data()
    
    # 1. Verify Signature
    if not verify_hmac_signature(payload, signature, secret):
        logger.warning(f"Invalid HMAC signature for delivery {delivery_id}")
        log_verification_attempt(ip, endpoint, "FAILED", f"Invalid signature for {delivery_id}")
        return jsonify({"error": "Invalid signature"}), 401

    # 2. Check for Replay Attack
    if replay_cache.check_and_add(delivery_id):
        logger.warning(f"Replay attack detected for delivery {delivery_id}")
        log_verification_attempt(ip, endpoint, "FAILED", f"Replay attack: {delivery_id}")
        return jsonify({"error": "Replay attack detected"}), 400

    # Verification successful
    log_verification_attempt(ip, endpoint, "SUCCESS", f"Delivery {delivery_id}")
    logger.info(f"Successfully verified GitHub webhook delivery {delivery_id}")

    # Process payload logic goes here (e.g. queue event for agent actions)
    # Return 200 OK since verification passed
    return jsonify({"ok": True, "message": "Webhook received and verified"}), 200
