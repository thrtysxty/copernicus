import os
import json
import requests
from typing import List, Dict, Generator


class OpenRouterClient:
    """
    Client for interacting with models via OpenRouter (e.g., Arcee Trinity).
    Acts as a drop-in replacement for Ollama/Gemini clients.
    """

    def __init__(self, model: str = None):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = model or os.getenv(
            "OPENROUTER_MODEL", "arcee-ai/trinity-large-preview:free"
        )
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"

        # We don't raise immediately to allow the app to start,
        # but we check this before making requests.

    def stream_chat(self, messages: List[Dict[str, str]]) -> Generator[str, None, None]:
        """
        Streams the response from the model to support TUI real-time updates.
        """
        if not self.api_key:
            yield "⚠️  Error: OPENROUTER_API_KEY environment variable not set.\n"
            yield "   Please sign up at openrouter.ai and set the variable in your .env file."
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/high-plains-hipster",
            "X-Title": "High Plains Hipster Agent",
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "temperature": 0.1,  # Low temperature for code precision
            "top_p": 0.9,  # Constrain token pool to top 90% probability
            "repetition_penalty": 1.1,  # Discourage repetitive loops
            "max_tokens": 8192,
        }

        try:
            response = requests.post(
                self.api_url, headers=headers, json=payload, stream=True, timeout=60
            )
            response.raise_for_status()

            for line in response.iter_lines():
                if line:
                    line = line.decode("utf-8")
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                content = data["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
        except requests.exceptions.Timeout:
            yield "\n[Error: Request timed out after 60 seconds]\n"
        except requests.exceptions.ConnectionError as e:
            yield f"\n[Error: Connection failed - {str(e)}]\n"
        except requests.exceptions.HTTPError as e:
            yield f"\n[Error: HTTP {e.response.status_code} - {e.response.text[:200]}]\n"
        except Exception as e:
            yield f"\n[Error calling OpenRouter: {type(e).__name__}: {str(e)}]\n"
            if "401" in str(e):
                yield "   (Check your API Key)"
