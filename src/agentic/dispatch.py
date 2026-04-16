#!/usr/bin/env python3
"""
Agent dispatch logic with compaction integration.
"""

import os
import sys
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from .compaction import CompactionConfig, apply_compaction, ContextLimitExceededError
from .compaction import count_tokens_approx

logger = logging.getLogger(__name__)


def load_story_metadata(story_path: str) -> Dict[str, Any]:
    """Extract metadata from story file."""
    metadata = {
        "compaction_tail": None,
        "context_limit": 128000,
        "model": "claude-sonnet-4-6",
    }

    # Parse story file for metadata
    try:
        with open(story_path, 'r') as f:
            content = f.read()

            # Extract model from story if specified
            # This is a placeholder - actual parsing would be more robust
            if "Model:" in content:
                lines = content.split('\n')
                for line in lines:
                    if line.startswith("**Model:**"):
                        model = line.replace("**Model:**", "").strip()
                        metadata["model"] = model
                        # Set context limit based on model
                        if "haiku" in model.lower():
                            metadata["context_limit"] = 200000
                        elif "sonnet" in model.lower():
                            metadata["context_limit"] = 128000
                        elif "opus" in model.lower():
                            metadata["context_limit"] = 128000
                        else:
                            metadata["context_limit"] = 128000

            # Extract compaction tail override
            if "compaction_tail:" in content:
                lines = content.split('\n')
                for line in lines:
                    if line.startswith("compaction_tail:"):
                        try:
                            tail = int(line.split(":")[1].strip())
                            metadata["compaction_tail"] = tail
                        except ValueError:
                            pass

    except Exception as e:
        logger.warning(f"Failed to parse story metadata: {e}")

    return metadata


def assemble_prompt(
    story_content: str,
    history: List[Dict[str, Any]],
    tool_results: List[Dict[str, Any]],
    config: Dict[str, Any]
) -> str:
    """Assemble complete dispatch prompt.

    This is a placeholder - actual implementation would
    integrate with existing prompt assembly logic.
    """
    prompt_parts = []

    # Add story content
    prompt_parts.append(f"# Story\n{story_content}\n")

    # Add history
    if history:
        prompt_parts.append("# History\n")
        for turn in history[-10:]:  # Last 10 turns
            role = turn.get("role", "unknown")
            content = turn.get("content", "")
            prompt_parts.append(f"{role}: {content}")

    # Add tool results
    if tool_results:
        prompt_parts.append("# Tool Results\n")
        for result in tool_results:
            tool = result.get("tool", "unknown")
            input_data = result.get("input", "")
            output = result.get("output", "")
            prompt_parts.append(f"{tool}({input_data}) → {output}")

    return "\n".join(prompt_parts)


def dispatch_to_agent(
    story_path: str,
    agent_config: Dict[str, Any],
    history: List[Dict[str, Any]],
    tool_results: List[Dict[str, Any]],
    worktree_dir: str,
    ledger_callback = None
) -> Dict[str, Any]:
    """Main dispatch function with compaction integration.

    Args:
        story_path: Path to story file
        agent_config: Agent configuration
        history: Message history
        tool_results: Tool call results
        worktree_dir: Worktree directory
        ledger_callback: Callback to log compaction data

    Returns:
        Dict with dispatch result including compaction metadata
    """
    result = {
        "success": False,
        "error": None,
        "compaction_applied": False,
        "compaction_tier": 0,
        "tokens_before": 0,
        "tokens_after": 0,
    }

    try:
        # Load story content
        with open(story_path, 'r') as f:
            story_content = f.read()

        # Load story metadata
        metadata = load_story_metadata(story_path)

        # Assemble prompt
        prompt = assemble_prompt(story_content, history, tool_results, agent_config)
        token_count = count_tokens_approx(prompt)
        result["tokens_before"] = token_count

        # Apply compaction if needed
        compaction_config = CompactionConfig(
            context_limit=metadata["context_limit"],
            compaction_tail=metadata["compaction_tail"]
        )

        try:
            compacted_prompt, ledger_data = apply_compaction(
                prompt, history,
                context_limit=metadata["context_limit"],
                config=compaction_config
            )

            result.update({
                "compaction_applied": True,
                "compaction_tier": ledger_data["compaction_tier"],
                "tokens_after": ledger_data["tokens_after_compaction"],
            })

            # Log compaction to ledger if callback provided
            if ledger_callback:
                ledger_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "event_type": "compaction",
                    "compaction_tier": ledger_data["compaction_tier"],
                    "tokens_before_compaction": ledger_data["tokens_before_compaction"],
                    "tokens_after_compaction": ledger_data["tokens_after_compaction"],
                    "model_used": ledger_data["model_used"],
                    "story_number": os.path.basename(story_path).split('_')[1],
                }
                ledger_callback(ledger_entry)

            prompt = compacted_prompt

        except ContextLimitExceededError as e:
            result["error"] = str(e)
            return result

        # Proceed with actual dispatch
        # This is where the actual agent API would be called
        # For now, just log and return success
        logger.info(f"Dispatching with prompt ({result['tokens_after']} tokens, tier {result['compaction_tier']})")

        # Simulate successful dispatch
        result["success"] = True

    except Exception as e:
        logger.error(f"Dispatch failed: {e}")
        result["error"] = str(e)

    return result


if __name__ == "__main__":
    # Test the dispatch logic
    logging.basicConfig(level=logging.INFO)

    # Create a test story file
    test_story = """# Test Story

**Model:** claude-sonnet-4-6
**compaction_tail:** 4

Test content for dispatch."""

    test_story_path = "/tmp/test_story_667.md"
    with open(test_story_path, 'w') as f:
        f.write(test_story)

    # Test dispatch
    history = [
        {"role": "user", "content": "First message"},
        {"role": "assistant", "content": "First response"},
    ] * 15  # Create long history to trigger compaction

    tool_results = [
        {"tool": "Read", "input": "file.txt", "output": "content1"},
        {"tool": "Read", "input": "file.txt", "output": "content1"},
        {"tool": "Write", "input": "file.txt, data", "output": "success"},
    ]

    result = dispatch_to_agent(
        test_story_path,
        {"agent_type": "coder"},
        history,
        tool_results,
        "/tmp/worktree"
    )

    print(f"Dispatch result: {json.dumps(result, indent=2)}")

    # Cleanup
    os.remove(test_story_path)