"""
Stories CRUD Tests for Flask API.

Tests all HTTP verbs and status codes for the stories endpoints.
"""

import unittest
from pathlib import Path
import sys

# Add parent to path to import app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app


class TestStoriesRoutes(unittest.TestCase):
    """Test stories CRUD endpoints."""

    def setUp(self):
        """Set up test client with in-memory database."""
        self.app = create_app('testing')
        self.client = self.app.test_client()

    def test_get_stories_returns_json_list(self):
        """GET /api/stories returns 200 with JSON list."""
        response = self.client.get('/api/stories')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIsInstance(data, list)

    def test_post_story_with_required_fields_returns_201(self):
        """POST /api/stories with required fields returns 201 with story object."""
        payload = {
            'title': 'Test Story',
            'description': 'A test story description'
        }
        response = self.client.post('/api/stories', json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertIsInstance(data, dict)
        self.assertIn('id', data)
        self.assertEqual(data['title'], 'Test Story')
        self.assertEqual(data['description'], 'A test story description')

    def test_get_story_by_id_existing_returns_200(self):
        """GET /api/stories/<id> returns 200 for existing story."""
        # First create a story
        create_payload = {
            'title': 'Existing Story',
            'description': 'Should be retrievable'
        }
        create_resp = self.client.post('/api/stories', json=create_payload)
        story_id = create_resp.get_json()['id']

        response = self.client.get(f'/api/stories/{story_id}')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['title'], 'Existing Story')

    def test_get_story_by_id_missing_returns_404(self):
        """GET /api/stories/<id> returns 404 for missing story."""
        response = self.client.get('/api/stories/999')
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertIn('error', data)

    def test_put_story_updates_existing(self):
        """PUT /api/stories/<id> returns 200 with updated object."""
        # Create initial story
        self.client.post('/api/stories', json={
            'title': 'Original Title',
            'description': 'Original description'
        })

        # Update it
        update_payload = {
            'title': 'Updated Title',
            'description': 'Updated description'
        }
        response = self.client.put('/api/stories/1', json=update_payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['title'], 'Updated Title')
        self.assertEqual(data['description'], 'Updated description')

    def test_put_story_with_invalid_id_returns_404(self):
        """PUT /api/stories/<id> returns 404 for non-existent story."""
        payload = {
            'title': 'New Title',
            'description': 'New description'
        }
        response = self.client.put('/api/stories/999', json=payload)
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertIn('error', data)

    def test_post_story_without_data_returns_400(self):
        """POST /api/stories without data returns 400."""
        response = self.client.post('/api/stories', json={})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_put_story_without_data_returns_400(self):
        """PUT /api/stories/<id> with empty body returns 400."""
        create_resp = self.client.post('/api/stories', json={'title': 'Story', 'description': 'desc'})
        story_id = create_resp.get_json()['id']
        response = self.client.put(f'/api/stories/{story_id}', json={})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_post_story_empty_title_returns_400(self):
        """POST /api/stories with empty title returns 400."""
        response = self.client.post('/api/stories', json={'title': '', 'description': 'desc'})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_post_story_empty_description_returns_400(self):
        """POST /api/stories with empty description returns 400."""
        response = self.client.post('/api/stories', json={'title': 'Title', 'description': ''})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_post_story_title_too_long_returns_400(self):
        """POST /api/stories with 501-char title returns 400."""
        response = self.client.post('/api/stories', json={'title': 'x' * 501, 'description': 'desc'})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_put_story_empty_title_returns_400(self):
        """PUT /api/stories/<id> with empty title returns 400."""
        create_resp = self.client.post('/api/stories', json={'title': 'Story', 'description': 'desc'})
        story_id = create_resp.get_json()['id']
        response = self.client.put(f'/api/stories/{story_id}', json={'title': '', 'description': 'new desc'})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)


def run_tests():
    """Run the story route tests."""
    suite = unittest.TestLoader().loadTestsFromTestCase(TestStoriesRoutes)
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite).wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
