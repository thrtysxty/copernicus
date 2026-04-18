import pytest
import json
from backend.app import app
from backend.limiter import limiter

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        limiter.storage.reset()
        yield client
        limiter.storage.reset()

def test_research_rate_limit(client, mocker):
    # Mock subprocess.run to return a successful result
    mock_result = mocker.Mock()
    mock_result.returncode = 0
    mock_result.stdout = "Assistant response"
    mocker.patch('subprocess.run', return_value=mock_result)
    mocker.patch('os.unlink')
    
    payload = {
        "prompt": "Test prompt",
        "persona": "scribe",
        "model": "gpt-4"
    }
    
    for i in range(10):
        resp = client.post('/api/agents/research', json=payload)
        assert resp.status_code == 200, f"Request {i} failed: {resp.data}"
    
    resp = client.post('/api/agents/research', json=payload)
    assert resp.status_code == 429
    
    data = json.loads(resp.data)
    assert data["error"] == "Rate limit exceeded"
    assert "retry_after" in data
    assert resp.headers.get("Retry-After") is not None

def test_chat_rate_limit(client, mocker):
    mock_provider = mocker.Mock()
    mock_provider.stream_chat.return_value = iter(["data: {}\n\n"])
    mocker.patch('backend.api.llm.get_provider', return_value=mock_provider)

    payload = {
        "messages": [{"role": "user", "content": "hello"}],
        "model": "gpt-4"
    }
    
    for i in range(30):
        resp = client.post('/api/llm/chat', json=payload)
        assert resp.status_code == 200
        # Consume the stream to avoid context issues
        for _ in resp.response:
            pass
        
    resp = client.post('/api/llm/chat', json=payload)
    assert resp.status_code == 429
    
    data = json.loads(resp.data)
    assert data["error"] == "Rate limit exceeded"
