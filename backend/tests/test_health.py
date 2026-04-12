import pytest
from unittest.mock import patch
from backend.app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check_success(client):
    """Test that the health check returns 200 OK and expected status."""
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
    assert data['version'] == '1.0'
    assert 'timestamp' in data

def test_health_check_timestamp(client):
    """Test that the health check returns the correct timestamp by mocking time.time."""
    mock_time = 1234567890
    with patch('time.time', return_value=mock_time):
        response = client.get('/api/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['timestamp'] == mock_time

def test_health_check_unsupported_method(client):
    """Test that the health check rejects POST requests."""
    response = client.post('/api/health')
    assert response.status_code == 405
