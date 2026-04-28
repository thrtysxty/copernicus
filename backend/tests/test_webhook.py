import os
import pytest
import hmac
import hashlib
from flask import Flask
from backend.routes.webhook_routes import webhook_bp

@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(webhook_bp, url_prefix='/api/webhook')

    prev_secret = os.environ.get('GITHUB_WEBHOOK_SECRET')
    os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret'
    os.environ['COPERNICUS_DB_PATH'] = ':memory:'

    with app.test_client() as client:
        yield client

    # Restore env state
    if prev_secret is None:
        os.environ.pop('GITHUB_WEBHOOK_SECRET', None)
    else:
        os.environ['GITHUB_WEBHOOK_SECRET'] = prev_secret

def test_github_webhook_missing_secret(client):
    del os.environ['GITHUB_WEBHOOK_SECRET']
    response = client.post('/api/webhook/github')
    assert response.status_code == 401
    assert b"Webhook secret not configured" in response.data

def test_github_webhook_missing_signature(client):
    os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret'
    response = client.post('/api/webhook/github')
    assert response.status_code == 401
    assert b"Missing signature header" in response.data

def test_github_webhook_missing_delivery_id(client):
    os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret'
    headers = {'X-Hub-Signature-256': 'sha256=invalid'}
    response = client.post('/api/webhook/github', headers=headers)
    assert response.status_code == 400
    assert b"Missing delivery ID" in response.data

def test_github_webhook_invalid_signature(client):
    os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret'
    headers = {
        'X-Hub-Signature-256': 'sha256=invalid',
        'X-GitHub-Delivery': 'test-delivery-1'
    }
    response = client.post('/api/webhook/github', data=b"{}", headers=headers)
    assert response.status_code == 401
    assert b"Invalid signature" in response.data

def test_github_webhook_valid_signature(client):
    os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret'
    payload = b'{"test": "data"}'
    
    # Calculate valid signature
    secret = 'test-secret'
    expected_hmac = hmac.new(
        key=secret.encode('utf-8'),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    headers = {
        'X-Hub-Signature-256': f'sha256={expected_hmac}',
        'X-GitHub-Delivery': 'test-delivery-valid'
    }
    response = client.post('/api/webhook/github', data=payload, headers=headers)
    assert response.status_code == 200
    assert b"Webhook received and verified" in response.data

def test_github_webhook_replay_attack(client):
    os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret'
    payload = b'{"test": "data"}'
    
    # Calculate valid signature
    secret = 'test-secret'
    expected_hmac = hmac.new(
        key=secret.encode('utf-8'),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    headers = {
        'X-Hub-Signature-256': f'sha256={expected_hmac}',
        'X-GitHub-Delivery': 'test-delivery-replay'
    }
    
    # First request should succeed
    response1 = client.post('/api/webhook/github', data=payload, headers=headers)
    assert response1.status_code == 200
    
    # Second request with same delivery ID should fail
    response2 = client.post('/api/webhook/github', data=payload, headers=headers)
    assert response2.status_code == 400
    assert b"Replay attack detected" in response2.data
