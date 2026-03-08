import sys
from unittest.mock import MagicMock

# Mock flask before importing backend.api.agents
mock_flask = MagicMock()
sys.modules["flask"] = mock_flask

import threading
import time
import unittest
from pathlib import Path

# Add parent to path if needed
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.api.agents import ContextManager, ContextItem


class TestContextManager(unittest.TestCase):
    
    def test_concurrent_adds(self):
        """Test that 10 threads can each add 10 items without race conditions."""
        cm = ContextManager()
        session_id = "concurrent_test_session"
        errors = []
        
        def add_items(thread_id):
            try:
                for i in range(10):
                    item = ContextItem(
                        id=f"item_{thread_id}_{i}",
                        role="user",
                        content=f"Content from thread {thread_id}, item {i}",
                        token_count=10
                    )
                    cm.add_item(session_id, item)
            except Exception as e:
                errors.append(e)
        
        # Create and start 10 threads
        threads = []
        for i in range(10):
            t = threading.Thread(target=add_items, args=(i,))
            threads.append(t)
            t.start()
        
        # Wait for all threads to complete
        for t in threads:
            t.join()
        
        # Verify no errors occurred
        self.assertEqual(len(errors), 0, f"Errors during concurrent adds: {errors}")
        
        # Verify all 100 items are present
        items = cm.get_items(session_id)
        self.assertEqual(len(items), 100)
        
        # Clean up
        cm.reset_session(session_id)
    
    def test_max_sessions_eviction(self):
        """Test that adding 101 sessions evicts the oldest session (insertion order)."""
        cm = ContextManager()
        
        # Add 101 sessions with one item each
        for i in range(101):
            session_id = f"session_{i:03d}"
            item = ContextItem(
                id=f"item_{i}",
                role="user",
                content=f"Content for session {i}",
                token_count=10
            )
            cm.add_item(session_id, item)
            # Small sleep to ensure different timestamps (optional, but good for ordering)
            time.sleep(0.001)
        
        # Verify only 100 sessions remain
        self.assertEqual(len(cm._sessions), 100)
        
        # Verify session_000 (the first one) was evicted
        self.assertNotIn("session_000", cm._sessions)
        self.assertNotIn("session_000", cm._token_counts)
        self.assertNotIn("session_000", cm._last_accessed)
        
        # Verify session_001 through session_100 exist (100 sessions)
        self.assertIn("session_001", cm._sessions)
        self.assertIn("session_100", cm._sessions)
        
        # Clean up
        for i in range(1, 101):
            cm.reset_session(f"session_{i:03d}")


if __name__ == "__main__":
    unittest.main()
