import time
from typing import Dict

class ReplayCache:
    def __init__(self, ttl_seconds: int = 300):
        """
        Initializes a ReplayCache to track recently seen IDs and prevent replay attacks.
        
        Args:
            ttl_seconds (int): Time-to-live for cached items in seconds (default 300s = 5m).
        """
        self.ttl_seconds = ttl_seconds
        self.cache: Dict[str, float] = {}
        
    def check_and_add(self, item_id: str) -> bool:
        """
        Checks if the item_id has been seen within the TTL window.
        If not seen or expired, adds it and returns False (not a replay).
        If seen, returns True (is a replay).
        
        Args:
            item_id (str): The unique ID of the request (e.g., X-GitHub-Delivery).
            
        Returns:
            bool: True if this is a replay attack, False otherwise.
        """
        self._cleanup()
        
        current_time = time.time()
        
        if item_id in self.cache:
            if current_time - self.cache[item_id] <= self.ttl_seconds:
                return True # Replay detected
                
        self.cache[item_id] = current_time
        return False
        
    def _cleanup(self):
        """Removes expired entries from the cache to prevent memory leaks."""
        current_time = time.time()
        expired_keys = [
            k for k, v in self.cache.items()
            if current_time - v > self.ttl_seconds
        ]
        for k in expired_keys:
            del self.cache[k]

# Global instance for easy import and usage
replay_cache = ReplayCache(ttl_seconds=300)
