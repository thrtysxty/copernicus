import os
import pytest
import hmac
import hashlib
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
from flask import Flask

from backend.middleware.auth import require_auth
from backend.utils.hmac_verify import verify_hmac_signature
from backend.utils.replay_cache import ReplayCache
from backend.utils.path_guard import assert_safe_path
from backend.routes.webhook_routes import webhook_bp


# ============================================================================
# AUTH MIDDLEWARE TESTS
# ============================================================================

class TestAuthMiddleware:
    """Tests for require_auth decorator in middleware/auth.py."""

    def test_missing_api_key_returns_401(self):
        """Missing X-API-Key header should return 401 Unauthorized."""
        app = Flask(__name__)
        app.config['TESTING'] = True

        # Set a valid API key
        os.environ['COPERNICUS_API_KEY'] = 'valid-key-123'

        @app.route('/test')
        def test_endpoint():
            return 'OK'

        with app.test_client() as client:
            response = client.get('/test')
            assert response.status_code == 401
            json_data = response.get_json()
            assert json_data['ok'] is False
            assert 'Unauthorized' in json_data['error']

    def test_wrong_api_key_returns_401(self):
        """Wrong X-API-Key should return 401 Unauthorized."""
        app = Flask(__name__)
        app.config['TESTING'] = True

        os.environ['COPERNICUS_API_KEY'] = 'valid-key-123'

        @app.route('/test')
        def test_endpoint():
            return 'OK'

        with app.test_client() as client:
            response = client.get('/test', headers={'X-API-Key': 'wrong-key'})
            assert response.status_code == 401
            json_data = response.get_json()
            assert json_data['ok'] is False

    def test_empty_string_key_returns_401(self):
        """Empty string API key should return 401."""
        app = Flask(__name__)
        app.config['TESTING'] = True

        os.environ['COPERNICUS_API_KEY'] = 'valid-key-123'

        @app.route('/test')
        def test_endpoint():
            return 'OK'

        with app.test_client() as client:
            response = client.get('/test', headers={'X-API-Key': ''})
            assert response.status_code == 401

    def test_valid_api_key_proceeds(self):
        """Valid X-API-Key should allow request to proceed."""
        app = Flask(__name__)
        app.config['TESTING'] = True

        os.environ['COPERNICUS_API_KEY'] = 'valid-key-123'

        @app.route('/test')
        def test_endpoint():
            return 'OK'

        with app.test_client() as client:
            response = client.get('/test', headers={'X-API-Key': 'valid-key-123'})
            assert response.status_code == 200

    def test_dev_mode_no_key_env_bypass(self):
        """When COPERNICUS_API_KEY is not set, auth is bypassed (dev mode)."""
        app = Flask(__name__)
        app.config['TESTING'] = True

        # Remove the API key env var
        prev = os.environ.pop('COPERNICUS_API_KEY', None)

        @app.route('/test')
        def test_endpoint():
            return 'OK'

        with app.test_client() as client:
            # No API key set, should bypass auth
            response = client.get('/test')
            assert response.status_code == 200

            # Restore
            if prev is not None:
                os.environ['COPERNICUS_API_KEY'] = prev

    def test_decorator_applied_to_function(self):
        """Test that require_auth properly wraps the decorated function."""
        @require_auth
        def protected_function():
            return 'secret_data'

        # When no API key is set, should bypass
        result = protected_function()
        assert result == 'secret_data'


# ============================================================================
# HMAC VERIFICATION TESTS
# ============================================================================

class TestHmacVerification:
    """Tests for verify_hmac_signature in utils/hmac_verify.py."""

    def test_valid_signature(self):
        """Valid HMAC signature should return True."""
        payload = b'{"event": "push", "repo": "test"}'
        secret = 'my-secret-key'

        expected_sig = hmac.new(
            key=secret.encode('utf-8'),
            msg=payload,
            digestmod=hashlib.sha256
        ).hexdigest()

        assert verify_hmac_signature(payload, expected_sig, secret) is True

    def test_valid_signature_with_sha256_prefix(self):
        """GitHub format 'sha256=<hex>' should be stripped and validated."""
        payload = b'Hello World'
        secret = 'secret123'

        expected_sig = hmac.new(
            key=secret.encode('utf-8'),
            msg=payload,
            digestmod=hashlib.sha256
        ).hexdigest()

        # Test with prefix
        assert verify_hmac_signature(payload, f'sha256={expected_sig}', secret) is True
        # Test without prefix
        assert verify_hmac_signature(payload, expected_sig, secret) is True

    def test_invalid_signature(self):
        """Invalid signature should return False."""
        payload = b'test payload'
        secret = 'secret'

        assert verify_hmac_signature(payload, 'invalid_signature', secret) is False
        assert verify_hmac_signature(payload, 'sha256=invalid_signature', secret) is False

    def test_tampered_payload_detection(self):
        """Tampered payload should fail verification."""
        payload = b'original data'
        secret = 'key'

        expected_sig = hmac.new(
            key=secret.encode('utf-8'),
            msg=payload,
            digestmod=hashlib.sha256
        ).hexdigest()

        # Verify original
        assert verify_hmac_signature(payload, expected_sig, secret) is True

        # Tamper with payload
        tampered = b'tampered data'
        assert verify_hmac_signature(tampered, expected_sig, secret) is False

    def test_empty_payload_handling(self):
        """Empty payload with valid signature should pass."""
        payload = b''
        secret = 'key'

        expected_sig = hmac.new(
            key=secret.encode('utf-8'),
            msg=payload,
            digestmod=hashlib.sha256
        ).hexdigest()

        assert verify_hmac_signature(payload, expected_sig, secret) is True

    def test_empty_signature_input(self):
        """Empty signature should return False."""
        payload = b'test'
        secret = 'key'

        assert verify_hmac_signature(payload, '', secret) is False
        assert verify_hmac_signature(payload, None, secret) is False

    def test_empty_secret_input(self):
        """Empty secret should return False."""
        payload = b'test'
        signature = 'valid_sig'

        assert verify_hmac_signature(payload, signature, '') is False

    def test_different_secrets(self):
        """Same payload with different secrets should fail."""
        payload = b'same data'

        sig1 = hmac.new(b'secret1', payload, hashlib.sha256).hexdigest()
        sig2 = hmac.new(b'secret2', payload, hashlib.sha256).hexdigest()

        assert verify_hmac_signature(payload, sig1, 'secret1') is True
        assert verify_hmac_signature(payload, sig1, 'secret2') is False
        assert verify_hmac_signature(payload, sig2, 'secret1') is False

    def test_case_sensitivity(self):
        """HMAC comparison should be case-sensitive (using compare_digest)."""
        payload = b'test'
        secret = 'key'

        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

        # Uppercase hex should fail
        assert verify_hmac_signature(payload, expected.upper(), secret) is False
        # Mixed case should fail
        assert verify_hmac_signature(payload, expected.swapcase(), secret) is False

    def test_special_characters_in_secret(self):
        """Secret with special characters should work correctly."""
        payload = b'data'
        secret = 'key!@#$%^&*()_+-=[]{}|;:,.<>?'

        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        assert verify_hmac_signature(payload, expected, secret) is True

    def test_unicode_in_payload_and_secret(self):
        """Unicode content should be handled correctly."""
        payload = b'\xc3\xa9\xc3\xa9\xc3\xa9'  # ééé in UTF-8
        secret = 'café'

        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        assert verify_hmac_signature(payload, expected, secret) is True


# ============================================================================
# WEBHOOK ROUTES TESTS
# ============================================================================

class TestWebhookSecurity:
    """Tests for webhook_routes.py security features."""

    @pytest.fixture
    def client(self):
        """Create test client with proper environment setup."""
        app = Flask(__name__)
        app.config['TESTING'] = True
        app.register_blueprint(webhook_bp, url_prefix='/api/webhook')

        # Set up environment
        os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret-key'
        os.environ['COPERNICUS_DB_PATH'] = ':memory:'

        with app.test_client() as client:
            yield client

    def test_valid_github_webhook(self, client):
        """Valid webhook with correct HMAC should return 200."""
        payload = b'{"event": "push", "repository": {"name": "test"}}'
        delivery_id = 'test-delivery-123'

        signature = hmac.new(
            b'test-secret-key',
            payload,
            hashlib.sha256
        ).hexdigest()

        headers = {
            'X-Hub-Signature-256': f'sha256={signature}',
            'X-GitHub-Delivery': delivery_id
        }

        response = client.post('/api/webhook/github', data=payload, headers=headers)
        assert response.status_code == 200
        assert b"Webhook received and verified" in response.data

    def test_missing_signature_header(self, client):
        """Missing X-Hub-Signature-256 header should return 401."""
        response = client.post('/api/webhook/github', data=b'{}')
        assert response.status_code == 401
        assert b"Missing signature header" in response.data

    def test_missing_delivery_header(self, client):
        """Missing X-GitHub-Delivery header should return 400."""
        headers = {'X-Hub-Signature-256': 'sha256=invalid'}
        response = client.post('/api/webhook/github', data=b'{}', headers=headers)
        assert response.status_code == 400
        assert b"Missing delivery ID" in response.data

    def test_invalid_signature(self, client):
        """Invalid HMAC signature should return 401."""
        headers = {
            'X-Hub-Signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
            'X-GitHub-Delivery': 'test-delivery'
        }
        response = client.post('/api/webhook/github', data=b'{}', headers=headers)
        assert response.status_code == 401
        assert b"Invalid signature" in response.data

    def test_missing_secret_env(self, client):
        """Missing GITHUB_WEBHOOK_SECRET env var should return 401."""
        # Remove secret temporarily
        secret = os.environ.pop('GITHUB_WEBHOOK_SECRET', None)

        try:
            response = client.post('/api/webhook/github', data=b'{}')
            assert response.status_code == 401
            assert b"Webhook secret not configured" in response.data
        finally:
            # Restore
            if secret is not None:
                os.environ['GITHUB_WEBHOOK_SECRET'] = secret

    def test_replay_attack_prevention(self, client):
        """Same delivery ID sent twice should be rejected on second attempt."""
        payload = b'{"event": "push"}'
        delivery_id = 'test-delivery-replay'

        signature = hmac.new(
            b'test-secret-key',
            payload,
            hashlib.sha256
        ).hexdigest()

        headers = {
            'X-Hub-Signature-256': f'sha256={signature}',
            'X-GitHub-Delivery': delivery_id
        }

        # First request succeeds
        response1 = client.post('/api/webhook/github', data=payload, headers=headers)
        assert response1.status_code == 200

        # Second request with same delivery ID is replay attack
        response2 = client.post('/api/webhook/github', data=payload, headers=headers)
        assert response2.status_code == 400
        assert b"Replay attack detected" in response2.data

    def test_replay_attack_different_payload_same_delivery(self, client):
        """Different payload with same delivery ID should also be rejected."""
        delivery_id = 'replay-delivery-456'

        # First request
        payload1 = b'first payload'
        sig1 = hmac.new(b'test-secret-key', payload1, hashlib.sha256).hexdigest()
        headers1 = {
            'X-Hub-Signature-256': f'sha256={sig1}',
            'X-GitHub-Delivery': delivery_id
        }
        response1 = client.post('/api/webhook/github', data=payload1, headers=headers1)
        assert response1.status_code == 200

        # Second request with different payload but same delivery ID
        payload2 = b'second payload'
        sig2 = hmac.new(b'test-secret-key', payload2, hashlib.sha256).hexdigest()
        headers2 = {
            'X-Hub-Signature-256': f'sha256={sig2}',
            'X-GitHub-Delivery': delivery_id
        }
        response2 = client.post('/api/webhook/github', data=payload2, headers=headers2)
        assert response2.status_code == 400
        assert b"Replay attack detected" in response2.data

    def test_valid_signature_with_prefix_variations(self, client):
        """Test various signature prefix formats."""
        payload = b'test'
        delivery_id = 'prefix-test'

        sig = hmac.new(b'test-secret-key', payload, hashlib.sha256).hexdigest()

        # Test lowercase prefix
        headers = {
            'X-Hub-Signature-256': f'sha256={sig}'.lower(),
            'X-GitHub-Delivery': delivery_id
        }
        response = client.post('/api/webhook/github', data=payload, headers=headers)
        assert response.status_code == 200

    def test_empty_payload_handling(self, client):
        """Empty payload should be handled gracefully."""
        headers = {
            'X-Hub-Signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
            'X-GitHub-Delivery': 'empty-test'
        }
        response = client.post('/api/webhook/github', data=b'', headers=headers)
        # Should fail signature validation, not crash
        assert response.status_code in (401, 400)


# ============================================================================
# REPLAY CACHE TESTS
# ============================================================================

class TestReplayCache:
    """Tests for replay_cache.py with thread safety and TTL validation."""

    def test_first_seen_allowed(self):
        """First time seeing an ID should be allowed (return False)."""
        cache = ReplayCache(ttl_seconds=300)
        result = cache.check_and_add('unique-id-1')
        assert result is False
        assert 'unique-id-1' in cache.cache

    def test_duplicate_same_id_rejected(self):
        """Same ID within TTL should be rejected (return True)."""
        cache = ReplayCache(ttl_seconds=300)
        cache.check_and_add('duplicate-id')
        result = cache.check_and_add('duplicate-id')
        assert result is True  # Replay detected

    def test_expired_ttl_allows_new(self):
        """After TTL expires, same ID should be allowed again."""
        cache = ReplayCache(ttl_seconds=1)  # 1 second TTL for testing
        cache.check_and_add('expire-test')

        # Wait for TTL to expire
        time.sleep(1.1)

        # Should be allowed again
        result = cache.check_and_add('expire-test')
        assert result is False
        assert cache.cache['expire-test'] > time.time() - 1

    def test_concurrent_access_thread_safety(self):
        """Test thread safety with concurrent access."""
        import threading

        cache = ReplayCache(ttl_seconds=300)
        results = []
        lock = threading.Lock()

        def worker(item_id, count):
            local_results = []
            for _ in range(count):
                result = cache.check_and_add(item_id)
                with lock:
                    local_results.append(result)
            results.extend(local_results)

        # Create 10 threads, each doing 100 operations on same IDs
        threads = []
        num_threads = 10
        operations_per_thread = 100

        for i in range(num_threads):
            t = threading.Thread(target=worker, args=(f'concurrent-test-{i}', operations_per_thread))
            threads.append(t)

        # Start all threads
        for t in threads:
            t.start()

        # Wait for completion
        for t in threads:
            t.join()

        # Verify: first 10 should be False (new), rest should be True (replays)
        # Each thread does 100 ops, so 1000 total
        # First 10 unique IDs seen once each = 10 False
        # Remaining 990 = True
        false_count = sum(1 for r in results if r is False)
        true_count = sum(1 for r in results if r is True)

        assert false_count == num_threads, f"Expected {num_threads} first-seen, got {false_count}"
        assert true_count == num_threads * (operations_per_thread - 1), \
            f"Expected {num_threads * (operations_per_thread - 1)} replays, got {true_count}"

    def test_cleanup_removes_expired(self):
        """_cleanup should remove expired entries."""
        cache = ReplayCache(ttl_seconds=1)
        cache.check_and_add('item1')
        cache.check_and_add('item2')

        time.sleep(1.1)
        cache._cleanup()

        assert 'item1' not in cache.cache
        assert 'item2' not in cache.cache

    def test_cleanup_on_check_and_add(self):
        """check_and_add should trigger cleanup internally."""
        cache = ReplayCache(ttl_seconds=1)
        cache.check_and_add('item1')

        time.sleep(1.1)

        # This should trigger cleanup and allow item1 again
        result = cache.check_and_add('item1')
        assert result is False
        assert 'item1' in cache.cache

    def test_different_ids_independent(self):
        """Different IDs should be tracked independently."""
        cache = ReplayCache(ttl_seconds=300)
        cache.check_and_add('id1')
        cache.check_and_add('id2')
        cache.check_and_add('id3')

        assert cache.check_and_add('id1') is True  # replay
        assert cache.check_and_add('id2') is True  # replay
        assert cache.check_and_add('id3') is False  # new
        assert cache.check_and_add('id4') is False  # new

    def test_empty_cache(self):
        """Empty cache should handle operations gracefully."""
        cache = ReplayCache(ttl_seconds=300)
        result = cache.check_and_add('')
        assert result is False
        assert cache.cache == {'': time.time()}


# ============================================================================
# PATH GUARD TESTS
# ============================================================================

class TestPathGuard:
    """Tests for path_guard.py security features."""

    def test_absolute_path_inside_allowed_root(self):
        """Absolute path within allowed root should pass."""
        test_root = Path('/tmp/test_allowed_root')
        test_root.mkdir(parents=True, exist_ok=True)

        try:
            safe_path = assert_safe_path(str(test_root / 'data.txt'), roots=[str(test_root)])
            assert safe_path == test_root / 'data.txt'
        finally:
            import shutil
            shutil.rmtree(str(test_root), ignore_errors=True)

    def test_absolute_path_outside_allowed_root(self):
        """Absolute path outside all roots should raise ValueError."""
        with pytest.raises(ValueError, match="Path outside allowed roots:"):
            assert_safe_path('/etc/passwd', roots=['/tmp/allowed'])

    def test_path_traversal_with_dotdot(self):
        """Path traversal with ../ should be rejected."""
        allowed_root = Path('/tmp/allowed_root')
        allowed_root.mkdir(parents=True, exist_ok=True)

        try:
            # Try to escape using ..
            bad_path = str(allowed_root / '..' / 'etc' / 'passwd')
            with pytest.raises(ValueError, match="Path outside allowed roots:"):
                assert_safe_path(bad_path, roots=[str(allowed_root)])
        finally:
            import shutil
            shutil.rmtree(str(allowed_root), ignore_errors=True)

    def test_path_traversal_with_multiple_dots(self):
        """Multiple levels of traversal should be rejected."""
        with pytest.raises(ValueError, match="Path outside allowed roots:"):
            assert_safe_path('/tmp/allowed/../../../etc/shadow', roots=['/tmp/allowed'])

    def test_symlink_outside_allowed_root(self):
        """Symlink pointing outside allowed root should be rejected."""
        import tempfile
        import shutil

        with tempfile.TemporaryDirectory() as tmpdir:
            allowed_root = Path(tmpdir) / 'allowed'
            allowed_root.mkdir()

            # Create target outside allowed root
            target_file = Path(tmpdir) / 'outside.txt'
            target_file.write_text('secret')

            # Create symlink inside allowed root pointing outside
            symlink_path = allowed_root / 'evil_link'
            symlink_path.symlink_to(target_file)

            with pytest.raises(ValueError, match="Path outside allowed roots:"):
                assert_safe_path(str(symlink_path), roots=[str(allowed_root)])

    def test_symlink_inside_allowed_root(self):
        """Symlink pointing inside allowed root should pass."""
        with tempfile.TemporaryDirectory() as tmpdir:
            allowed_root = Path(tmpdir) / 'allowed'
            allowed_root.mkdir()

            target = allowed_root / 'target.txt'
            target.write_text('data')

            symlink = allowed_root / 'link.txt'
            symlink.symlink_to(target)

            safe_path = assert_safe_path(str(symlink), roots=[str(allowed_root)])
            assert safe_path == target

    def test_relative_path_valid(self):
        """Valid relative path should pass."""
        # Create a temp directory structure
        with tempfile.TemporaryDirectory() as tmpdir:
            test_root = Path(tmpdir)
            test_file = test_root / 'subdir' / 'file.txt'
            test_file.parent.mkdir(parents=True)
            test_file.write_text('test')

            # Resolve relative path
            relative_path = str(test_file.relative_to(test_root))
            safe_path = assert_safe_path(relative_path, roots=[str(test_root)])
            assert safe_path == test_file

    def test_relative_path_traversal(self):
        """Relative path with traversal should be rejected."""
        with tempfile.TemporaryDirectory() as tmpdir:
            allowed = Path(tmpdir) / 'allowed'
            allowed.mkdir()

            # Relative path that tries to escape
            bad_path = str(allowed / '..' / '..' / 'etc' / 'passwd')
            with pytest.raises(ValueError, match="Path outside allowed roots:"):
                assert_safe_path(bad_path, roots=[str(allowed)])

    def test_empty_path(self):
        """Empty path should raise ValueError."""
        with pytest.raises(ValueError, match="Path outside allowed roots:"):
            assert_safe_path('', roots=['/tmp/allowed'])

    def test_none_path(self):
        """None path should raise ValueError."""
        with pytest.raises(ValueError, match="Path outside allowed roots:"):
            assert_safe_path(None, roots=['/tmp/allowed'])

    def test_custom_roots_parameter(self):
        """Custom roots parameter should override ALLOWED_ROOTS."""
        with tempfile.TemporaryDirectory() as tmpdir:
            custom_root = Path(tmpdir) / 'custom'
            custom_root.mkdir()

            # Should work with custom root even though it's not in default ALLOWED_ROOTS
            safe_path = assert_safe_path(str(custom_root / 'file.txt'),
                                         roots=[str(custom_root)])
            assert safe_path == custom_root / 'file.txt'

    def test_case_sensitivity_unix(self):
        """Path matching should be case-sensitive (Unix behavior)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            allowed = Path(tmpdir) / 'Allowed'
            allowed.mkdir()

            # Lowercase should fail
            with pytest.raises(ValueError, match="Path outside allowed roots:"):
                assert_safe_path(str(allowed / 'file.txt').lower(), roots=[str(allowed)])


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestIntegration:
    """Integration tests combining multiple security components."""

    @pytest.fixture
    def client(self):
        """Create test client with proper environment setup."""
        app = Flask(__name__)
        app.config['TESTING'] = True
        app.register_blueprint(webhook_bp, url_prefix='/api/webhook')

        # Set up environment
        os.environ['GITHUB_WEBHOOK_SECRET'] = 'test-secret-key'
        os.environ['COPERNICUS_DB_PATH'] = ':memory:'

        with app.test_client() as client:
            yield client

    def test_webhook_with_invalid_hmac_and_missing_delivery(self, client):
        """Multiple security failures should still return appropriate error."""
        headers = {
            'X-Hub-Signature-256': 'sha256=invalid',
            # Missing X-GitHub-Delivery
        }
        response = client.post('/api/webhook/github', data=b'{}', headers=headers)
        # Missing delivery check happens before signature check
        assert response.status_code == 400

    def test_webhook_replay_with_valid_signature(self, client):
        """Replay detection works even with valid HMAC."""
        payload = b'{"event": "test"}'
        delivery_id = 'integration-replay-test'

        sig = hmac.new(b'test-secret-key', payload, hashlib.sha256).hexdigest()
        headers = {
            'X-Hub-Signature-256': f'sha256={sig}',
            'X-GitHub-Delivery': delivery_id
        }

        # First request
        response1 = client.post('/api/webhook/github', data=payload, headers=headers)
        assert response1.status_code == 200

        # Second request - replay detected despite valid HMAC
        response2 = client.post('/api/webhook/github', data=payload, headers=headers)
        assert response2.status_code == 400
        assert b"Replay attack detected" in response2.data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
