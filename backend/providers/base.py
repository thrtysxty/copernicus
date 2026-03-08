from abc import ABC, abstractmethod
from typing import Iterator, List, Dict

class BaseProvider(ABC):
    @abstractmethod
    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> Iterator[str]:
        """Stream response tokens one at a time."""
        pass

    def chat(self, messages: List[Dict[str, str]], model: str, **kwargs) -> str:
        """Non-streaming chat; consumes stream_chat and joins tokens."""
        return "".join(self.stream_chat(messages, model, **kwargs))
