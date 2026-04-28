import pytest
from flask import Flask
from backend.api.docs import docs_bp

@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(docs_bp, url_prefix='/api/docs')
    app.config['TESTING'] = True

    with app.test_client() as client:
        yield client

def test_visual_audit_placeholder(client):
    response = client.post('/api/docs/visual-audit')
    assert response.status_code == 200
    data = response.get_json()
    assert data == {"queued": True}
