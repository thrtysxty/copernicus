import logging
logger = logging.getLogger(__name__)
from flask import Flask
from flask_cors import CORS
from backend.api.stories import stories_bp
from backend.api.agents import agents_bp
from backend.api.settings import settings_bp
from backend.api.health import health_bp
from backend.api.llm import llm_bp
from backend.api.orchestration import orchestration_bp
from backend.api.docs import docs_bp
from backend.api.registry import registry_bp
from backend.socket_manager import socketio
from backend.utils.errors import AppError, handle_app_error

# Configure logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)

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

def validate_origin(origin):
    return origin in {'http://localhost:3000', 'http://localhost:5001', 'app://copernicus'}

CORS(app, origins=validate_origin, supports_credentials=False)

socketio.init_app(app, cors_allowed_origins=validate_origin)

app.register_blueprint(stories_bp, url_prefix='/api/stories')
app.register_blueprint(agents_bp, url_prefix='/api/agents')
app.register_blueprint(settings_bp, url_prefix='/api/settings')
app.register_blueprint(health_bp, url_prefix='/api')
app.register_blueprint(llm_bp, url_prefix='/api/llm')
app.register_blueprint(orchestration_bp, url_prefix='/api/orchestration')
app.register_blueprint(docs_bp, url_prefix='/api/docs')
app.register_blueprint(registry_bp, url_prefix='/api/registry')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001, debug=False)
