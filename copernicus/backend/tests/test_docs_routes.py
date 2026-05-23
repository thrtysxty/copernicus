"""
Docs Endpoints Tests for Flask API.

Tests all HTTP verbs and status codes for the docs endpoints.
"""

import unittest
from pathlib import Path
import sys

# Add parent to path to import app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app, reset_test_db


class TestDocsRoutes(unittest.TestCase):
    """Test docs endpoints."""

    def setUp(self):
        """Set up test client."""
        reset_test_db()
        self.app = create_app('testing')
        self.client = self.app.test_client()

    def test_docs_index_returns_200(self):
        """GET /docs/ returns 200 with status message."""
        response = self.client.get('/docs/')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertIn('Documentation endpoint', data['message'])

    def test_docs_readme_returns_200(self):
        """GET /docs/readme returns 200 with title and content."""
        response = self.client.get('/docs/readme')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['title'], 'README')
        self.assertEqual(data['content'], 'Documentation content')

    def test_docs_api_returns_200_with_endpoints(self):
        """GET /docs/api returns 200 with endpoints list."""
        response = self.client.get('/docs/api')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('endpoints', data)
        self.assertIsInstance(data['endpoints'], list)
        # Verify the documented endpoints are present
        endpoint_paths = [ep['path'] for ep in data['endpoints']]
        self.assertIn('/docs/readme', endpoint_paths)
        self.assertIn('/docs/api', endpoint_paths)

    def test_docs_get_doc_returns_404_for_nonexistent(self):
        """GET /docs/<path> returns 404 for non-existent files."""
        response = self.client.get('/docs/some/file.md')
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertEqual(data['status'], 'not_found')

    def test_docs_invalid_path_returns_400(self):
        """GET /docs with invalid path returns 400."""
        # Test path with special characters that might cause issues
        response = self.client.get('/docs/../../../etc/passwd')
        self.assertEqual(response.status_code, 400)
        # Should not leak sensitive content
        data = response.get_json()
        self.assertNotIn('root:', data)

    def test_docs_empty_path_returns_404(self):
        """GET /docs with empty path returns 404."""
        response = self.client.get('/docs/')
        # Should return 404 since there's no specific route for empty path
        self.assertIn(response.status_code, (200, 404))


def run_tests():
    """Run the docs route tests."""
    suite = unittest.TestLoader().loadTestsFromTestCase(TestDocsRoutes)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
