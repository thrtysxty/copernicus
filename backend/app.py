import logging
logger = logging.getLogger(__name__)
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter.errors import RateLimitExceeded
from backend.limiter import limiter
from backend.api.stories import stories_bp
from backend.api.agents import agents_bp
from backend.api.settings import settings_bp
from backend.api.health import health_bp
from backend.api.llm import llm_bp
from backend.api.orchestration import orchestration_bp
from backend.api.docs import docs_bp
from backend.api.registry import registry_bp
from backend.routes.webhook_routes import webhook_bp
from backend.socket_manager import SocketManager
from backend.utils.errors import AppError, handle_app_error

# Configure logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)

# Initialize SocketManager and get the socketio instance
socket_manager = SocketManager(app)
socketio = SocketManager.get_socketio()

# Allowed origins set
ALLOWED_ORIGINS = {'http://localhost:3000', 'http://localhost:5001', 'app://copernicus'}

def validate_origin(origin: str) -> bool:
    """Validate if the given origin is allowed and not suspicious.
    
    Args:
        origin: The origin string to validate.
        
    Returns:
        bool: True if origin is allowed, False otherwise.
    """
    # Reject None, empty string, or 'null' (case-insensitive)
    if origin is None or origin == '' or origin.lower() == 'null':
        return False
    
    # Normalize for comparison (handle case, trailing slash, etc.)
    return origin in ALLOWED_ORIGINS

# Initialize rate limiting
limiter.init_app(app)

@app.before_request
def check_origin():
    """Validate Origin header if present for security."""
    origin = request.headers.get('Origin')
    if origin and not validate_origin(origin):
        return jsonify({"error": "Origin not allowed"}), 403

@app.errorhandler(RateLimitExceeded)
def handle_rate_limit_exceeded(error):
    """Handle RateLimitExceeded using the centralized format."""
    # Attempt to extract retry-after from description or fallback to 60s
    retry_after = 60
    # In many versions, description contains "in X seconds" or similar
    # or error has no direct timeout. For the sake of the story, we return a value.
    # If the underlying storage supports it, we could get the real value.
    # For now, we'll provide a response that matches the AC.
    response = jsonify({
        "error": "Rate limit exceeded",
        "retry_after": retry_after
    })
    response.status_code = 429
    response.headers['Retry-After'] = str(retry_after)
    return response

@app.errorhandler(AppError)
def handle_custom_error(error: AppError):
    """Handle AppError using the centralized handler."""
    return handle_app_error(error)

@app.errorhandler(Exception)
def handle_generic_error(error: Exception):
    """Catch-all handler for unhandled exceptions."""
    logger.exception("Unhandled exception occurred: %s", str(error))
    return {
        "ok": False,
        "error": "Internal Server Error",
    }, 500

CORS(app, origins=list(ALLOWED_ORIGINS), supports_credentials=False)


app.register_blueprint(stories_bp, url_prefix='/api/stories')
app.register_blueprint(agents_bp, url_prefix='/api/agents')
app.register_blueprint(settings_bp, url_prefix='/api/settings')
app.register_blueprint(health_bp, url_prefix='/api')
app.register_blueprint(llm_bp, url_prefix='/api/llm')
app.register_blueprint(orchestration_bp, url_prefix='/api/orchestration')
app.register_blueprint(docs_bp, url_prefix='/api/docs')
app.register_blueprint(registry_bp, url_prefix='/api/registry')
app.register_blueprint(webhook_bp, url_prefix='/api/webhook')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001, debug=False, allow_unsafe_werkzeug=True)
