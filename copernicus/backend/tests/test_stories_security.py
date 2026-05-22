"""
SQL Injection Security Tests for Stories CRUD.

Tests that malicious SQL metacharacters in story input are safely escaped
and do not cause database errors or injection vulnerabilities.
"""

import unittest
import sqlite3
from pathlib import Path

# Add parent to path to import app
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app
from app import db


class TestStoriesSecurity(unittest.TestCase):
    """Test SQL injection protection in stories endpoints."""

    def setUp(self):
        """Set up test client and database."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        # Create test database
        self.db_path = Path(__file__).parent / 'test_security.db'
        self.db_path.unlink(missing_ok=True)

    def tearDown(self):
        """Clean up test database."""
        if self.db_path.exists():
            self.db_path.unlink()

    def _get_db_connection(self):
        """Get a database connection for assertions."""
        return sqlite3.connect(self.db_path)

    def test_sql_injection_in_title(self):
        """Test that SQL metacharacters in title are safely stored."""
        # SQL injection attempt
        malicious_title = "'; DROP TABLE stories; --"

        response = self.client.post('/api/stories', json={
            'title': malicious_title,
            'description': 'Test story'
        })

        # Should return success (201), not DB error (500)
        self.assertEqual(response.status_code, 201)

    def test_sql_injection_in_description(self):
        """Test that SQL metacharacters in description are safely stored."""
        malicious_desc = "' UNION SELECT * FROM users WHERE '1'='1"

        response = self.client.post('/api/stories', json={
            'title': 'Test Story',
            'description': malicious_desc
        })

        # Should return success (201), not DB error (500)
        self.assertEqual(response.status_code, 201)

    def test_sql_injection_in_both_fields(self):
        """Test SQL injection with metacharacters in both title and description."""
        malicious = "'; DELETE FROM stories; --"

        response = self.client.post('/api/stories', json={
            'title': malicious,
            'description': malicious
        })

        # Should return success (201), not DB error (500)
        self.assertEqual(response.status_code, 201)

    def test_retrieve_stored_injection(self):
        """Test that retrieved content matches stored content."""
        injection_payload = "'; DROP TABLE stories; --"

        # Create story with injection
        response = self.client.post('/api/stories', json={
            'title': injection_payload,
            'description': 'Test'
        })

        story_id = response.json.get('id')
        self.assertIsNotNone(story_id)

        # Retrieve the story
        response = self.client.get(f'/api/stories/{story_id}')

        # Should return 200 with the malicious content stored
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['title'], injection_payload)

    def test_special_sql_characters(self):
        """Test various SQL special characters are handled safely."""
        sql_chars = [
            "' OR '1'='1",
            "'; EXEC xp_cmdshell('dir'); --",
            "1; DROP TABLE stories; --",
            "admin'--",
            "'; WAITFOR DELAY '0:0:5'; --",
        ]

        for payload in sql_chars:
            with self.subTest(payload=payload):
                response = self.client.post('/api/stories', json={
                    'title': payload,
                    'description': 'Test'
                })
                self.assertEqual(response.status_code, 201,
                    f"Failed for payload: {payload}")


def run_tests():
    """Run the security tests."""
    suite = unittest.TestLoader().loadTestsFromTestCase(TestStoriesSecurity)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
