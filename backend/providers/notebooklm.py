import os
import json
import logging
import asyncio
from typing import Iterator, List, Dict
from backend.providers.base import BaseProvider
from backend.utils.errors import AppError
from notebooklm.client import NotebookLMClient

logger = logging.getLogger(__name__)

class NotebookLMProvider(BaseProvider):
    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> Iterator[str]:
        """Stream response tokens one at a time."""
        if not model.startswith("notebooklm:"):
            raise AppError(f"Invalid model format for NotebookLMProvider: {model}")

        notebook_id = model.split(":", 1)[1]

        # Extract last user message
        user_messages = [m for m in messages if m.get("role") == "user"]
        if not user_messages:
            raise AppError("No user message found in the chat history.")

        last_user_message = user_messages[-1].get("content", "")

        # Prepend prior messages as context if len > 1
        if len(messages) > 1:
            context_parts = []
            for m in messages[:-1]:
                role = m.get("role", "unknown")
                content = m.get("content", "")
                context_parts.append(f"{role.capitalize()}: {content}")

            context_string = "\n".join(context_parts)
            query = f"Previous Conversation Context:\n{context_string}\n\nCurrent Question: {last_user_message}"
        else:
            query = last_user_message

        try:
            # We run the async code in a sync wrapper since our backend generators are sync
            client = NotebookLMClient.from_storage()

            # The streaming generator in Python flask expects a standard sync generator
            # that yields bytes/strings. The easiest way to wrap an async generator
            # is to run an event loop inside the synchronous generator.
            # However, since flask handles requests in threads, we can create a new loop.

            def sync_generator():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

                queue = asyncio.Queue()

                async def consume_stream():
                    try:
                        async for chunk in client.chat.ask(notebook_id, query):
                            await queue.put({"type": "token", "data": chunk})
                        await queue.put({"type": "done"})
                    except Exception as e:
                        logger.error(f"NotebookLM stream error: {e}")
                        await queue.put({"type": "error", "error": str(e)})

                task = loop.create_task(consume_stream())

                try:
                    while True:
                        msg = loop.run_until_complete(queue.get())
                        if msg["type"] == "token":
                            chunk_data = {"token": msg["data"]}
                            yield f"data: {json.dumps(chunk_data)}\n\n"
                        elif msg["type"] == "done":
                            yield "data: [DONE]\n\n"
                            break
                        elif msg["type"] == "error":
                            error_data = {"error": msg["error"]}
                            yield f"data: {json.dumps(error_data)}\n\n"
                            break
                finally:
                    # Cancel the task if it's still running
                    if not task.done():
                        task.cancel()

                    try:
                        loop.run_until_complete(task)
                    except asyncio.CancelledError:
                        pass

                    loop.close()

            yield from sync_generator()

        except Exception as e:
            logger.error(f"NotebookLMProvider error: {e}")
            if "credentials" in str(e).lower() or "not found" in str(e).lower():
                raise AppError("NotebookLM credentials not found. Please run `notebooklm login`.")
            raise AppError(f"NotebookLM error: {e}")
