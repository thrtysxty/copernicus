#!/usr/bin/env python3
"""Ollama native coder agent with tool-calling loop.

Drop-in replacement for dispatch_claude_ollama.sh. Runs a proper Ollama SDK
tool-calling loop: call model → execute tool_calls → append results → repeat.

Usage:
    python3 scripts/ollama_coder.py <prompt_file> [--model MODEL] [--max-turns N] [--repo-root PATH]
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


def _load_api_key() -> None:
    """Load OLLAMA_API_KEY from env, falling back to ~/.secrets if not set."""
    if os.environ.get("OLLAMA_API_KEY"):
        return
    try:
        result = subprocess.run(
            ["bash", "-c", "source ~/.secrets && echo $OLLAMA_API_KEY"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        key = result.stdout.strip()
        if key:
            os.environ["OLLAMA_API_KEY"] = key
    except Exception:
        pass  # Proceed without a key; ollama may not require one for local hosts


def _load_openrouter_key() -> None:
    """Load OPENROUTER_API_KEY from env, falling back to ~/.secrets if not set."""
    if os.environ.get("OPENROUTER_API_KEY"):
        return
    try:
        result = subprocess.run(
            ["bash", "-c", "source ~/.secrets && echo $OPENROUTER_API_KEY"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        key = result.stdout.strip()
        if key:
            os.environ["OPENROUTER_API_KEY"] = key
    except Exception:
        pass


def _to_openai_tools(tools_list: list) -> list:
    """Convert a list of Python functions to OpenAI tool schema dicts."""
    result = []
    for fn in tools_list:
        result.append({
            "type": "function",
            "function": {
                "name": fn.__name__,
                "description": fn.__doc__.strip() if fn.__doc__ else "",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": True,
                },
            },
        })
    return result


def _make_tools(repo_root: Path):
    """Return the four tool functions, closed over repo_root."""

    def read_file(path: str) -> str:
        """Read a file relative to the repo root and return its contents as a string."""
        try:
            target = (repo_root / path).resolve()
            return target.read_text(encoding="utf-8")
        except Exception as exc:
            return f"ERROR: {exc}"

    def write_file(path: str, content: str) -> str:
        """Write content to a file relative to the repo root, creating parent directories as needed. Returns 'OK' on success."""
        try:
            target = (repo_root / path).resolve()
            # Path traversal guard
            if not str(target).startswith(str(repo_root.resolve())):
                return "ERROR: path outside repo root"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            return "OK"
        except Exception as exc:
            return f"ERROR: {exc}"

    def run_bash(command: str) -> str:
        """Run a shell command with a 60-second timeout and return combined stdout and stderr. Blocked: git push, git reset --hard, rm -rf /."""
        # Substring blocks for git patterns
        substring_blocked = ["git push", "git reset --hard"]
        for pattern in substring_blocked:
            if pattern in command:
                return f"ERROR: command blocked — contains '{pattern}'"
        # Regex block for rm -rf / (only when / is the literal root, not a subdirectory)
        if re.search(r"rm\s+-rf\s+/(?:\s|$)", command):
            return "ERROR: command blocked — contains 'rm -rf /'"
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(repo_root),
            )
            output = result.stdout
            if result.stderr:
                output += result.stderr
            return output if output else "(no output)"
        except subprocess.TimeoutExpired:
            return "ERROR: command timed out after 60 seconds"
        except Exception as exc:
            return f"ERROR: {exc}"

    def list_directory(path: str) -> str:
        """List files in a directory relative to the repo root. Returns newline-joined relative paths."""
        try:
            target = (repo_root / path).resolve()
            entries = sorted(target.iterdir())
            rel_paths = [str(e.relative_to(repo_root)) for e in entries]
            return "\n".join(rel_paths) if rel_paths else "(empty directory)"
        except Exception as exc:
            return f"ERROR: {exc}"

    return read_file, write_file, run_bash, list_directory


def _dispatch_tool(name: str, arguments: dict, tools_map: dict) -> str:
    """Dispatch a tool call by name with the given arguments dict."""
    func = tools_map.get(name)
    if func is None:
        return f"ERROR: unknown tool '{name}'"
    try:
        return str(func(**arguments))
    except Exception as exc:
        return f"ERROR: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ollama native coder agent with tool-calling loop.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 scripts/ollama_coder.py /tmp/prompt.md\n"
            "  python3 scripts/ollama_coder.py /tmp/prompt.md --model deepseek-v3.1:671b-cloud --max-turns 20\n"
        ),
    )
    parser.add_argument("prompt_file", help="Path to the prompt file to send as the initial user message.")
    parser.add_argument(
        "--model",
        default="deepseek-v3.1:671b-cloud",
        help="Ollama model name (default: deepseek-v3.1:671b-cloud)",
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=40,
        dest="max_turns",
        help="Maximum tool-call rounds before hard stop (default: 40)",
    )
    parser.add_argument(
        "--repo-root",
        default=None,
        dest="repo_root",
        help="Working directory root for file tools (default: cwd at invocation)",
    )
    parser.add_argument(
        "--provider",
        choices=["ollama", "openrouter"],
        default="ollama",
        help="Inference provider: ollama (default) or openrouter",
    )
    args = parser.parse_args()

    # Resolve repo root
    repo_root = Path(args.repo_root).resolve() if args.repo_root else Path.cwd().resolve()

    # Read prompt file
    prompt_path = Path(args.prompt_file)
    if not prompt_path.exists():
        print(f"ERROR: prompt file not found: {prompt_path}", file=sys.stderr)
        return 1

    try:
        prompt = prompt_path.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"ERROR: could not read prompt file: {exc}", file=sys.stderr)
        return 1

    # Build tools
    read_file, write_file, run_bash, list_directory = _make_tools(repo_root)
    tools_list = [read_file, write_file, run_bash, list_directory]
    tools_map = {fn.__name__: fn for fn in tools_list}

    print(f"[ollama_coder] provider={args.provider}  model={args.model}  max_turns={args.max_turns}  repo_root={repo_root}", file=sys.stderr)

    # ── OpenRouter path ───────────────────────────────────────────────────────
    if args.provider == "openrouter":
        _load_openrouter_key()
        try:
            import openai  # noqa: PLC0415
        except ImportError:
            print("ERROR: openai Python SDK not installed. Run: pip install openai", file=sys.stderr)
            return 1

        api_key = os.environ.get("OPENROUTER_API_KEY", "")
        if not api_key:
            print("ERROR: OPENROUTER_API_KEY not set — add it to ~/.secrets", file=sys.stderr)
            return 1

        client = openai.OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        openai_tools = _to_openai_tools(tools_list)

        messages: list[Any] = [{"role": "user", "content": prompt}]
        turn = 0

        try:
            while turn < args.max_turns:
                print(f"[ollama_coder] turn {turn + 1}/{args.max_turns} — calling model ...", file=sys.stderr)
                response = client.chat.completions.create(
                    model=args.model,
                    messages=messages,
                    tools=openai_tools,
                )
                msg = response.choices[0].message

                # Append assistant message in OpenAI format
                assistant_entry: dict[str, Any] = {
                    "role": "assistant",
                    "content": msg.content or "",
                }
                if msg.tool_calls:
                    assistant_entry["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": getattr(getattr(tc, "function", None), "name", ""),
                                "arguments": getattr(getattr(tc, "function", None), "arguments", "{}"),
                            },
                        }
                        for tc in msg.tool_calls
                    ]
                messages.append(assistant_entry)

                if not msg.tool_calls:
                    print("[ollama_coder] no tool_calls — agent finished.", file=sys.stderr)
                    break

                for tc in msg.tool_calls:
                    fn = getattr(tc, "function", None)
                    name = getattr(fn, "name", "") if fn else ""
                    try:
                        import json as _json
                        raw_args = getattr(fn, "arguments", None) if fn else None
                        arguments = _json.loads(raw_args) if raw_args else {}
                    except Exception:
                        arguments = {}
                    print(f"[ollama_coder]   tool: {name}({list(arguments.keys())})", file=sys.stderr)
                    result = _dispatch_tool(name, arguments, tools_map)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(result),
                    })

                turn += 1
            else:
                print(f"[ollama_coder] max_turns ({args.max_turns}) reached — stopping.", file=sys.stderr)

        except Exception as exc:
            print(f"ERROR: API error: {exc}", file=sys.stderr)
            return 1

        # Print final assistant content
        final_content = ""
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "assistant":
                final_content = msg.get("content", "") or ""
                break
        print(final_content)
        return 0

    # ── Ollama path (default) ─────────────────────────────────────────────────
    # Load API key before importing ollama (some SDK versions check at import)
    _load_api_key()

    # Import ollama after env setup
    try:
        import ollama  # noqa: PLC0415
    except ImportError:
        print("ERROR: ollama Python SDK not installed. Run: pip install ollama", file=sys.stderr)
        return 1

    # Determine whether to pass think=True
    use_think = any(kw in args.model.lower() for kw in ("deepseek", "qwen"))

    # Build extra kwargs for ollama.chat
    chat_kwargs: dict = {"tools": tools_list}
    if use_think:
        chat_kwargs["think"] = True

    # Agent loop
    messages = [{"role": "user", "content": prompt}]
    turn = 0

    try:
        while turn < args.max_turns:
            print(f"[ollama_coder] turn {turn + 1}/{args.max_turns} — calling model ...", file=sys.stderr)
            response = ollama.chat(model=args.model, messages=messages, **chat_kwargs)
            messages.append(response.message)

            if not response.message.tool_calls:
                print("[ollama_coder] no tool_calls — agent finished.", file=sys.stderr)
                break

            for tool_call in response.message.tool_calls:
                name = tool_call.function.name
                arguments = tool_call.function.arguments or {}
                print(f"[ollama_coder]   tool: {name}({list(arguments.keys())})", file=sys.stderr)
                result = _dispatch_tool(name, arguments, tools_map)
                messages.append({"role": "tool", "content": str(result)})

            turn += 1
        else:
            print(f"[ollama_coder] max_turns ({args.max_turns}) reached — stopping.", file=sys.stderr)

    except Exception as exc:
        print(f"ERROR: API error: {exc}", file=sys.stderr)
        return 1

    # Print final model response content to stdout for callers to capture
    # Walk backward to find the last assistant message (mix of dicts and Message objects)
    final_content = ""
    for msg in reversed(messages):
        if isinstance(msg, dict):
            if msg.get("role") == "assistant":
                final_content = msg.get("content", "") or ""
                break
        else:
            role = getattr(msg, "role", None)
            if role == "assistant":
                final_content = getattr(msg, "content", "") or ""
                break

    print(final_content)
    return 0


if __name__ == "__main__":
    sys.exit(main())
