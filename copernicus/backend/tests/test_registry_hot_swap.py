"""
Registry Hot-Swap Tests.

NEEDS REVIEW: No provider registry or hot-swap mechanism exists in this backend.
The backend app.py has no registry module, no get_provider(), no reload() function.

What does exist:
  - app.create_app(config_name) — Flask app factory
  - app.db — singleton Database helper wrapping sqlite3
  - No concept of "providers" or "registry" — LLM provider routing lives elsewhere
    (see copernicus/backend/api/llm.py for the actual LLM routing layer)

Tests below cover app initialization and session state, which is the closest
analogue to "registry initialization" available in this codebase.
"""
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app


class TestRegistryHotSwap(unittest.TestCase):
    """Registry initialization and app factory tests."""

    def setUp(self):
        """Set up fresh app for each test."""
        reset_test_db()
        self.app = create_app('testing')
        self.client = self.app.test_client()

    def test_initial_load_returns_200(self):
        """Initial load — app bootstraps cleanly, GET /api/stories returns 200."""
        response = self.client.get('/api/stories')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIsInstance(data, list)

    def test_initial_load_returns_empty_list(self):
        """Initial load — fresh database returns empty list, not None."""
        response = self.client.get('/api/stories')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data, [])

    def test_unknown_provider_returns_404(self):
        """Unknown provider query — GET /api/stories/9999 returns 404 with error body."""
        response = self.client.get('/api/stories/9999')
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertIn('error', data)

    def test_app_factory_registers_blueprints(self):
        """App factory — blueprints are registered, routes respond."""
        # stories_bp is the only registered blueprint in testing config
        response = self.client.get('/api/stories')
        self.assertEqual(response.status_code, 200)

    def test_db_singleton_initialized(self):
        """DB singleton — Database instance is initialized on app creation."""
        from app import db
        # db should be a Database instance with a connect method
        self.assertIsNotNone(db)
        self.assertTrue(hasattr(db, "connect"))
        self.assertTrue(callable(db.connect))


def reset_test_db():
    """Reset module-level DB state between test runs."""
    import app
    app._test_db_path = None


if __name__ == '__main__':
    unittest.main(verbosity=2)
