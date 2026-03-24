import os
import asyncio
from flask import Blueprint, jsonify
from backend.middleware.auth import require_auth
from notebooklm.client import NotebookLMClient

notebooklm_bp = Blueprint('notebooklm', __name__)

@notebooklm_bp.route('/status', methods=['GET'])
@require_auth
def get_status():
    """
    Check if NotebookLM credentials are cached and valid.
    """
    try:
        # NotebookLMClient.from_storage() will raise if credentials aren't found or valid
        NotebookLMClient.from_storage()
        return jsonify({
            "ok": True,
            "credentialsCached": True
        })
    except Exception as e:
        return jsonify({
            "ok": True,
            "credentialsCached": False,
            "error": str(e)
        })

@notebooklm_bp.route('/notebooks', methods=['GET'])
@require_auth
def list_notebooks():
    """
    List all available NotebookLM notebooks for the user.
    """
    try:
        client = NotebookLMClient.from_storage()

        # We need to run the async notebooks.list() in a sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def fetch_notebooks():
            try:
                # Based on notebooklm-py docs, notebooks.list() returns objects
                # with notebook_id and title
                notebooks_raw = await client.notebooks.list()
                result = []
                for nb in notebooks_raw:
                    result.append({
                        "id": getattr(nb, 'notebook_id', getattr(nb, 'id', '')),
                        "title": getattr(nb, 'title', 'Unknown Notebook')
                    })
                return result
            except Exception as inner_e:
                raise inner_e

        try:
            notebooks = loop.run_until_complete(fetch_notebooks())
            return jsonify(notebooks)
        finally:
            loop.close()

    except Exception as e:
        # Return empty list on error per AC (no 500)
        return jsonify([])
