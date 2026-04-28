from unittest.mock import patch
from backend.utils.replay_cache import ReplayCache

def test_check_and_add_new():
    cache = ReplayCache(ttl_seconds=300)
    # Adding a new item should return False (not a replay)
    assert cache.check_and_add("item1") is False
    assert "item1" in cache.cache

@patch('backend.utils.replay_cache.time.time')
def test_check_and_add_replay(mock_time):
    # Mock time to be deterministic
    mock_time.return_value = 1000.0

    cache = ReplayCache(ttl_seconds=300)
    # Add first time
    assert cache.check_and_add("item1") is False

    # Add again at the same time, should be a replay
    assert cache.check_and_add("item1") is True

    # Advance time within TTL
    mock_time.return_value = 1200.0 # 200s later, TTL is 300
    assert cache.check_and_add("item1") is True

@patch('backend.utils.replay_cache.time.time')
def test_expired_ttl(mock_time):
    mock_time.return_value = 1000.0

    cache = ReplayCache(ttl_seconds=300)
    assert cache.check_and_add("item1") is False

    # Advance time beyond TTL
    mock_time.return_value = 1301.0 # 301s later, TTL is 300

    # Should not be considered a replay, and should be added with new timestamp
    assert cache.check_and_add("item1") is False
    assert cache.cache["item1"] == 1301.0

@patch('backend.utils.replay_cache.time.time')
def test_cleanup(mock_time):
    mock_time.return_value = 1000.0

    cache = ReplayCache(ttl_seconds=300)
    cache.check_and_add("item1")

    # Advance time within TTL and add item2
    mock_time.return_value = 1200.0
    cache.check_and_add("item2")

    assert "item1" in cache.cache
    assert "item2" in cache.cache

    # Advance time beyond TTL for item1, but within TTL for item2
    mock_time.return_value = 1400.0

    # Calling check_and_add triggers cleanup
    cache.check_and_add("item3")

    # item1 should be removed
    assert "item1" not in cache.cache
    # item2 should still be there
    assert "item2" in cache.cache
    # item3 should be added
    assert "item3" in cache.cache
