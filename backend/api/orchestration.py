from flask import Blueprint, jsonify
import time
from backend.utils.validate import validate
from backend.schemas.orchestration import ModelSwitchRequest, ResolveConfirmationRequest

orchestration_bp = Blueprint('orchestration', __name__)

# Simple in-memory request store for human-in-the-loop confirmations
pending_confirmations = {}
confirmation_results = {}

@orchestration_bp.route('/confirm-model-switch', methods=['POST'])
@validate(ModelSwitchRequest)
def request_confirmation(request_data: ModelSwitchRequest):
    request_id = str(int(time.time() * 1000))
    model_name = request_data.model
    reason = request_data.reason
    
    # Store the request
    pending_confirmations[request_id] = {
        "model": model_name,
        "reason": reason,
        "status": "pending"
    }
    timeout = 60 # seconds
    start_time = time.time()
    
    while request_id not in confirmation_results:
        if time.time() - start_time > timeout:
            return jsonify({"approved": False, "error": "User confirmation timed out"}), 408
        time.sleep(0.1)
        
    result = confirmation_results.pop(request_id)
    pending_confirmations.pop(request_id, None)
    
    return jsonify({"approved": result}), 200

# TODO(story-228): not yet wired
@orchestration_bp.route('/pending-confirmations', methods=['GET'])
def get_pending():
    return jsonify(pending_confirmations), 200

# TODO(story-228): not yet wired
@orchestration_bp.route('/resolve-confirmation', methods=['POST'])
@validate(ResolveConfirmationRequest)
def resolve_confirmation(request_data: ResolveConfirmationRequest):
    request_id = request_data.request_id
    approved = request_data.approved
    
    if request_id in pending_confirmations:
        confirmation_results[request_id] = approved
        return jsonify({"status": "resolved"}), 200
    
    return jsonify({"error": "Request ID not found"}), 404
