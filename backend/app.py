from flask import Flask
from flask_cors import CORS
from backend.api.stories import stories_bp
from backend.api.agents import agents_bp
from backend.api.settings import settings_bp
from backend.api.health import health_bp

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'app://copernicus'])

app.register_blueprint(stories_bp, url_prefix='/api/stories')
app.register_blueprint(agents_bp, url_prefix='/api/agents')
app.register_blueprint(settings_bp, url_prefix='/api/settings')
app.register_blueprint(health_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
