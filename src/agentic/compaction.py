#!/usr/bin/env python3
"""
Context Window Compaction Hierarchy — Tiered compression for agent dispatch prompts.

Four tiers, cheapest to most expensive:
1. Microcompact — deduplicate repeated tool result blocks
2. Snip — trim oldest messages, preserve protected tail
3. Summarize — compress omitted turns with fast model
4. Collapse — staged stripping of tool bodies, thinking blocks

Each tier is applied only if needed and logged to ledger.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class CompactionConfig:
    """Configuration for compaction behavior."""
    # Model context limit (in tokens)
    context_limit: int = 128000  # Default for large models

    # Threshold for applying compaction (percentage of context limit)
    compaction_threshold: float = 0.8  # 80%

    # Protected tail size (number of recent turns to preserve)
    protected_tail: int = 8

    # Override via story metadata or dispatch config
    compaction_tail: Optional[int] = None

    # Fast model for summarization
    fast_model: str = "claude-haiku-3"

    # Maximum summary tokens
    max_summary_tokens: int = 500

    def effective_protected_tail(self) -> int:
        """Return the effective protected tail size."""
        return self.compaction_tail or self.protected_tail


class CompactionEngine:
    """Four-tier compaction engine for dispatch prompts."""

    def __init__(self, config: Optional[CompactionConfig] = None):
        self.config = config or CompactionConfig()
        self.tier_activated = 0

    def compact(self, prompt: str, prompt_tokens: int,
                history: List[Dict[str, Any]]) -> Tuple[str, int, Dict[str, Any]]:
        """
        Apply tiered compaction to prompt.

        Args:
            prompt: Assembled prompt string
            prompt_tokens: Estimated token count of prompt
            history: List of message history turns (each with role, content, etc.)

        Returns:
            Tuple of (compacted_prompt, final_token_count, ledger_data)
            Ledger data includes tier, tokens_before, tokens_after, model_used
        """
        self.tier_activated = 0
        original_tokens = prompt_tokens
        current_prompt = prompt
        ledger_data = {
            "compaction_tier": 0,
            "tokens_before_compaction": original_tokens,
            "tokens_after_compaction": original_tokens,
            "model_used": None,
        }

        # Check if we need compaction at all
        threshold = int(self.config.context_limit * self.config.compaction_threshold)
        if prompt_tokens <= threshold:
            return prompt, prompt_tokens, ledger_data

        logger.info(f"Prompt exceeds {self.config.compaction_threshold*100:.0f}% threshold: "
                   f"{prompt_tokens}/{self.config.context_limit} tokens")

        # Tier 1: Microcompact (deduplicate tool results)
        compacted_prompt, compacted_tokens, tier1_info = self._microcompact(
            current_prompt, prompt_tokens, history
        )

        if compacted_tokens <= threshold:
            self.tier_activated = 1
            ledger_data.update({
                "compaction_tier": 1,
                "tokens_after_compaction": compacted_tokens,
                "model_used": tier1_info.get("model_used"),
            })
            logger.info(f"Tier 1 (Microcompact) sufficient: {prompt_tokens} → {compacted_tokens} tokens")
            return compacted_prompt, compacted_tokens, ledger_data

        # Tier 2: Snip (trim oldest messages)
        compacted_prompt, compacted_tokens, tier2_info = self._snip(
            compacted_prompt, compacted_tokens, history
        )

        if compacted_tokens <= threshold:
            self.tier_activated = 2
            ledger_data.update({
                "compaction_tier": 2,
                "tokens_after_compaction": compacted_tokens,
                "model_used": tier2_info.get("model_used"),
            })
            logger.info(f"Tier 2 (Snip) sufficient: {prompt_tokens} → {compacted_tokens} tokens")
            return compacted_prompt, compacted_tokens, ledger_data

        # Tier 3: Summarize (compress with fast model)
        compacted_prompt, compacted_tokens, tier3_info = self._summarize(
            compacted_prompt, compacted_tokens, history, tier2_info
        )

        if compacted_tokens <= threshold:
            self.tier_activated = 3
            ledger_data.update({
                "compaction_tier": 3,
                "tokens_after_compaction": compacted_tokens,
                "model_used": tier3_info.get("model_used"),
            })
            logger.info(f"Tier 3 (Summarize) sufficient: {prompt_tokens} → {compacted_tokens} tokens")
            return compacted_prompt, compacted_tokens, ledger_data

        # Tier 4: Collapse (staged stripping)
        compacted_prompt, compacted_tokens, tier4_info = self._collapse(
            compacted_prompt, compacted_tokens, history
        )

        if compacted_tokens <= threshold:
            self.tier_activated = 4
            ledger_data.update({
                "compaction_tier": 4,
                "tokens_after_compaction": compacted_tokens,
                "model_used": tier4_info.get("model_used"),
            })
            logger.info(f"Tier 4 (Collapse) sufficient: {prompt_tokens} → {compacted_tokens} tokens")
            return compacted_prompt, compacted_tokens, ledger_data

        # If we still exceed limit after all tiers, abort
        raise ContextLimitExceededError(
            f"Prompt exceeds context limit after all compaction tiers: "
            f"{compacted_tokens}/{self.config.context_limit} tokens.")

    def _microcompact(self, prompt: str, token_count: int,
                      history: List[Dict[str, Any]]) -> Tuple[str, int, Dict[str, Any]]:
        """
        Tier 1: Deduplicate identical tool result blocks.

        Looks for patterns: tool_name(args) → result
        If same tool+args+result appears multiple times, replace duplicates
        with [cached: <tool>(<args>)] reference.
        """
        # Regex to find tool call patterns
        # This is a simplified pattern - actual implementation would need to match
        # the specific format used in agent tool results
        tool_pattern = r'(\w+)\(([^)]*)\) → ([^\n]+)(?:\n|$)'

        # Build a mapping of tool calls to their first occurrence
        seen_tools = {}
        lines = prompt.split('\n')
        new_lines = []

        for line in lines:
            match = re.match(tool_pattern, line.strip())
            if match:
                tool, args, result = match.groups()
                key = f"{tool}({args}) → {result}"

                if key in seen_tools:
                    # Replace duplicate with cached reference
                    new_lines.append(f"[cached: {tool}({args})]")
                    # Assuming ~10 tokens saved per duplicate
                    token_count -= 10
                else:
                    seen_tools[key] = True
                    new_lines.append(line)
            else:
                new_lines.append(line)

        compacted_prompt = '\n'.join(new_lines)
        info = {
            "model_used": None,
            "duplicates_removed": len(seen_tools) - len([v for v in seen_tools.values() if v]),
        }
        return compacted_prompt, token_count, info

    def _snip(self, prompt: str, token_count: int,
              history: List[Dict[str, Any]]) -> Tuple[str, int, Dict[str, Any]]:
        """
        Tier 2: Trim oldest messages while preserving protected tail.

        We need to work with the message history structure, not just string prompt.
        This is a placeholder - actual implementation would need to understand
        the history format and extract/remove turns.
        """
        protected_tail = self.config.effective_protected_tail()

        if len(history) <= protected_tail:
            # Not enough history to snip
            return prompt, token_count, {"model_used": None, "turns_removed": 0}

        # Calculate how many turns we need to remove to get under threshold
        # This is simplified - actual implementation would need token counts per turn
        token_per_turn_estimate = 100  # Rough estimate
        threshold = int(self.config.context_limit * self.config.compaction_threshold)
        excess_tokens = token_count - threshold
        turns_to_remove = min(
            len(history) - protected_tail,
            max(1, excess_tokens // token_per_turn_estimate)
        )

        # Remove turns and add marker
        removed_turns = history[:turns_to_remove]

        # Estimate token reduction
        token_reduction = turns_to_remove * token_per_turn_estimate + 5  # marker tokens
        new_token_count = max(threshold, token_count - token_reduction)

        info = {
            "model_used": None,
            "turns_removed": turns_to_remove,
            "protected_tail_preserved": protected_tail,
        }

        # Note: In real implementation, we'd need to reconstruct prompt from history
        # This is a placeholder return
        marker = f"[{turns_to_remove} turns omitted]"
        return f"{marker}\n{prompt}", new_token_count, info

    def _summarize(self, prompt: str, token_count: int,
                   history: List[Dict[str, Any]],
                   snip_info: Dict[str, Any]) -> Tuple[str, int, Dict[str, Any]]:
        """
        Tier 3: Compress omitted turns with fast model.

        Replace snip marker with summary block.
        """
        # Implementation would call fast model API
        # This is a placeholder
        summary = "[Summary: Previous context summarized for brevity]"

        # Replace snip marker with summary
        # In real implementation, we'd locate the marker and replace
        turns_removed = snip_info.get("turns_removed", 0)
        marker = f"[{turns_removed} turns omitted]"
        if marker in prompt:
            prompt = prompt.replace(marker, summary)

        # Estimate tokens (summary is shorter than omitted turns)
        summary_tokens = 10  # Rough estimate
        original_marker_tokens = 5
        token_reduction = turns_removed * 100 - summary_tokens + original_marker_tokens
        new_token_count = max(0, token_count - token_reduction)

        info = {
            "model_used": self.config.fast_model,
            "summary_tokens": summary_tokens,
        }

        return prompt, new_token_count, info

    def _collapse(self, prompt: str, token_count: int,
                  history: List[Dict[str, Any]]) -> Tuple[str, int, Dict[str, Any]]:
        """
        Tier 4: Staged collapse - strip tool bodies, then thinking blocks.

        This is last resort before aborting.
        """
        # Stage 1: Strip tool result bodies (keep tool name + input only)
        # Regex to match tool patterns and remove result
        tool_pattern = r'(\w+)\(([^)]*)\) → ([^\n]+)'
        def replace_tool_body(match):
            tool, args, _ = match.groups()
            return f"{tool}({args}) → [output stripped]"

        stage1_prompt = re.sub(tool_pattern, replace_tool_body, prompt)

        # Estimate token reduction from stage 1
        # Rough estimate: 50% of tool result tokens removed
        tool_result_estimate = 20  # tokens per tool result
        tool_count = len(re.findall(tool_pattern, prompt))
        stage1_reduction = tool_count * (tool_result_estimate // 2)

        # Stage 2: Strip thinking blocks
        thinking_pattern = r'(?:Thought|Thinking):[^\n]+(?:\n[^\n]+)*'
        stage2_prompt = re.sub(thinking_pattern, '[thinking stripped]', stage1_prompt)

        # Estimate token reduction from stage 2
        thinking_count = len(re.findall(thinking_pattern, prompt))
        thinking_estimate = 30  # tokens per thinking block
        stage2_reduction = thinking_count * thinking_estimate

        total_reduction = stage1_reduction + stage2_reduction
        new_token_count = max(0, token_count - total_reduction)

        # If still over limit, do hard truncation with warning
        threshold = int(self.config.context_limit * 0.95)  # 95% hard limit
        if new_token_count > threshold:
            logger.warning(f"Hard truncation required after collapse: {new_token_count} tokens")
            # Truncate to hard limit
            max_chars = threshold * 4  # Rough char-to-token ratio
            if len(stage2_prompt) > max_chars:
                stage2_prompt = stage2_prompt[:max_chars] + "... [truncated]"
                new_token_count = threshold

        info = {
            "model_used": None,
            "tool_results_stripped": tool_count,
            "thinking_blocks_stripped": thinking_count,
        }

        return stage2_prompt, new_token_count, info


class ContextLimitExceededError(Exception):
    """Raised when prompt exceeds context limit after all compaction tiers."""
    pass


def count_tokens_approx(text: str) -> int:
    """
    Approximate token count for English text.
    ~4 chars per token for English, ~3 for code.
    """
    # Very rough approximation
    return len(text) // 4


def apply_compaction(prompt: str, history: List[Dict[str, Any]],
                    context_limit: int = 128000,
                    config: Optional[CompactionConfig] = None) -> Tuple[str, Dict[str, Any]]:
    """
    Convenience function to apply compaction.

    Returns:
        Tuple of (compacted_prompt, ledger_data)
    """
    if config is None:
        config = CompactionConfig(context_limit=context_limit)
    else:
        config.context_limit = context_limit

    engine = CompactionEngine(config)
    token_count = count_tokens_approx(prompt)

    try:
        compacted_prompt, final_tokens, ledger_data = engine.compact(
            prompt, token_count, history
        )
        return compacted_prompt, ledger_data
    except ContextLimitExceededError as e:
        logger.error(f"Context limit exceeded: {e}")
        # Re-raise with full details for caller to handle
        raise


if __name__ == "__main__":
    # Simple test/demo
    test_prompt = """Here is a test prompt with repeated tools.
read(file.txt) → content1
read(file.txt) → content1  # Duplicate
write(file.txt, data) → success
read(file.txt) → content1  # Another duplicate
"""

    test_history = [
        {"role": "user", "content": "First message"},
        {"role": "assistant", "content": "First response"},
    ] * 20  # Make it long

    prompt, ledger = apply_compaction(test_prompt, test_history, context_limit=1000)
    print(f"Compacted prompt (tier {ledger['compaction_tier']}):\n{prompt[:200]}...")