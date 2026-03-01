from flask import Blueprint, jsonify
import time

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "version": "1.0",
        "timestamp": int(time.time())
    }), 200
