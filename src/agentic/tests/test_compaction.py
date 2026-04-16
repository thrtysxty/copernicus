#!/usr/bin/env python3
"""Unit tests for compaction engine."""

import pytest
from compaction import (
    CompactionConfig,
    CompactionEngine,
    ContextLimitExceededError,
    count_tokens_approx
)


def test_tier_1_microcompact():
    """Tier 1: deduplicate identical tool results."""
    prompt = """Read(file.txt) → content1
Write(file.txt, data) → success
Read(file.txt) → content1  # Duplicate
"""

    engine = CompactionEngine()
    history = []
    token_count = count_tokens_approx(prompt)

    compacted, tokens, info = engine._microcompact(prompt, token_count, history)

    # Should have [cached: Read(file.txt)] reference
    assert "[cached: Read(file.txt)]" in compacted
    assert tokens < token_count  # Should reduce token count


def test_tier_2_snip():
    """Tier 2: trim oldest messages, preserve protected tail."""
    prompt = "Test prompt"
    token_count = 90000  # Over threshold for 128k limit at 80%

    # Create long history
    history = [
        {"role": "user", "content": f"Message {i}"}
        for i in range(20)
    ]

    config = CompactionConfig(context_limit=100000)
    engine = CompactionEngine(config)

    compacted, tokens, info = engine._snip(prompt, token_count, history)

    # Should have removal marker
    assert "turns omitted" in compacted
    assert info["turns_removed"] > 0
    assert info["protected_tail_preserved"] == 8  # default


def test_tier_2_protected_tail():
    """Protected tail of 8 turns is never removed by snip."""
    prompt = "Test prompt"
    token_count = 90000

    # History exactly at protected tail
    history = [
        {"role": "user", "content": f"Message {i}"}
        for i in range(8)
    ]

    config = CompactionConfig(context_limit=100000)
    engine = CompactionEngine(config)

    compacted, tokens, info = engine._snip(prompt, token_count, history)

    # No turns should be removed
    assert info["turns_removed"] == 0
    assert "turns omitted" not in compacted


def test_tier_3_summarize():
    """Tier 3: replace snip marker with summary."""
    prompt = "[5 turns omitted]\nCurrent context"
    token_count = 85000

    history = []
    snip_info = {"turns_removed": 5}

    config = CompactionConfig()
    engine = CompactionEngine(config)

    compacted, tokens, info = engine._summarize(prompt, token_count, history, snip_info)

    # Should have summary
    assert "Summary:" in compacted
    assert "turns omitted" not in compacted
    assert info["model_used"] == "claude-haiku-3"


def test_tier_4_collapse():
    """Tier 4: staged stripping of tool bodies and thinking blocks."""
    prompt = """Read(file.txt) → very long content here that should be stripped
Thinking: this is a thinking block that should also be stripped
Normal text remains.
"""
    token_count = 95000

    history = []
    config = CompactionConfig(context_limit=100000)
    engine = CompactionEngine(config)

    compacted, tokens, info = engine._collapse(prompt, token_count, history)

    # Tool output stripped
    assert "[output stripped]" in compacted
    # Thinking block stripped
    assert "[thinking stripped]" in compacted or "thinking stripped" in compacted
    assert info["tool_results_stripped"] > 0


def test_context_limit_exceeded_error():
    """Tier 4 abort: if collapse cannot bring prompt under limit."""
    # Create a prompt that will still be too large after collapse
    prompt = "A" * 1000000  # Very large prompt
    token_count = 250000  # Way over limit

    history = []
    config = CompactionConfig(context_limit=100000)
    engine = CompactionEngine(config)

    # Should raise ContextLimitExceededError
    with pytest.raises(ContextLimitExceededError):
        engine.compact(prompt, token_count, history)


def test_compaction_tail_override():
    """compaction_tail=4 in dispatch config overrides default protected tail of 8."""
    config = CompactionConfig(compaction_tail=4)
    assert config.effective_protected_tail() == 4

    # Without override
    config2 = CompactionConfig()
    assert config2.effective_protected_tail() == 8


def test_full_compaction_flow():
    """Test the full tiered compaction flow."""
    # Create prompt that will trigger tier 1
    prompt = """Read(file.txt) → content1
Read(file.txt) → content1  # Duplicate
"""
    token_count = count_tokens_approx(prompt)

    # Set threshold low to trigger compaction
    config = CompactionConfig(context_limit=1000)
    engine = CompactionEngine(config)

    history = []
    compacted, tokens, ledger = engine.compact(prompt, token_count, history)

    # Should apply tier 1
    assert ledger["compaction_tier"] >= 1
    assert "[cached: Read(file.txt)]" in compacted


if __name__ == "__main__":
    pytest.main([__file__, "-v"])