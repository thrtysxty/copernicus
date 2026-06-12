"""
Path Traversal Security Tests for Docs Endpoints.

Tests that path traversal attempts (../ sequences) are rejected or sanitized,
while valid paths are accepted.
"""

import unittest
from pathlib import Path
import sys

# Add parent to path to import app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app


class TestDocsPathSecurity(unittest.TestCase):
    """Test path traversal protection in docs endpoints."""

    def setUp(self):
        """Set up test client."""
        self.app = create_app('testing')
        self.client = self.app.test_client()

    def test_path_traversal_dot_dot_slash(self):
        """Test that ../ sequences are rejected."""
        # Various path traversal attempts
        traversal_paths = [
            '/docs/../../../etc/passwd',
            '/docs/..%2f..%2f..%2fetc/passwd',  # URL encoded
            '/docs/....//....//etc/passwd',      # double dot bypass
            '/docs/../..%2fetc/passwd',          # mixed encoding
            '/docs/../../../..',                  # multiple levels
        ]

        for path in traversal_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                # Should return 400 (Bad Request) or 403 (Forbidden), not 200
                # and definitely not allow access to /etc/passwd
                self.assertNotEqual(response.status_code, 200,
                    f"Path traversal succeeded for: {path}")
                # Should not leak sensitive content
                if response.data and b'root:' in response.data:
                    self.fail(f"Path traversal leaked sensitive content: {path}")

    def test_path_escaping_project_root(self):
        """Test that attempts to escape project root are rejected."""
        escape_attempts = [
            '/docs/../../../Users/dadmin/Projects/copernicus',
            '/docs/../../..',
            '/docs/..',
            '/docs/..\..',  # backslash variant (if applicable)
        ]

        for path in escape_attempts:
            with self.subTest(path=path):
                response = self.client.get(path)
                # Should reject, not return 200
                self.assertNotEqual(response.status_code, 200,
                    f"Project root escape succeeded: {path}")

    def test_valid_path_accepted(self):
        """Test that valid paths are accepted."""
        # These should return 404 (not found) rather than 400/403
        # since the endpoints don't exist, but they should NOT be rejected
        # for path security reasons
        valid_paths = [
            '/docs/readme',
            '/docs/api',
        ]

        for path in valid_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                # Should return 404 (not found) - meaning the path was
                # processed but the resource doesn't exist, not rejected for security
                # If it returns 400/403, it means the path was incorrectly blocked
                if response.status_code in (400, 403):
                    self.fail(f"Valid path incorrectly rejected: {path}")

    def test_empty_and_none_paths(self):
        """Test that empty or None paths are handled safely."""
        response = self.client.get('/')
        # Should not crash, should return something (404 or 200)
        self.assertIn(response.status_code, (200, 404, 400))

    def test_null_byte_injection(self):
        """Test that null bytes in paths are rejected."""
        null_paths = [
            '/docs/../../../etc/passwd\x00.txt',
            '/docs/../../../etc/passwd%00.txt',  # URL encoded null
        ]

        for path in null_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                # Should reject null byte injection
                self.assertNotEqual(response.status_code, 200,
                    f"Null byte injection succeeded: {path}")


def run_tests():
    """Run the security tests."""
    suite = unittest.TestLoader().loadTestsFromTestCase(TestDocsPathSecurity)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
