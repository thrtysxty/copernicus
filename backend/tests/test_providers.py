import unittest
from typing import Iterator, List, Dict
from backend.providers.base import BaseProvider

class MockProvider(BaseProvider):
    def stream_chat(self, messages: List[Dict[str, str]], model: str, **kwargs) -> Iterator[str]:
        yield "Hello"
        yield " "
        yield "World"

class TestProviders(unittest.TestCase):
    def test_base_provider_chat(self):
        provider = MockProvider()
        result = provider.chat([], "test-model")
        self.assertEqual(result, "Hello World")

    def test_abstract_instantiation(self):
        with self.assertRaises(TypeError):
            BaseProvider()

if __name__ == "__main__":
    unittest.main()
