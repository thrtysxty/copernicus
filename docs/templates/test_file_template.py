import pytest
from backend.app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_{feature_name}_endpoint(client):
    """
    Test for the {feature_name} endpoint.
    """
    response = client.get('/{feature_name}')
    assert response.status_code == 200
    assert response.json['status'] == 'ok'
