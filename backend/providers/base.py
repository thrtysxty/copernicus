from abc import ABC, abstractmethod
from typing import Generator, List, Dict, Any

class LLMProvider(ABC):
    @abstractmethod
    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        system: str,
        api_key: str,
        base_url: str = None
    ) -> Generator[str, None, None]:
        pass
