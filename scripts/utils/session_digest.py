import argparse
import json
import os
import sys
import requests
from typing import Generator
from datetime import datetime


class OpenRouterClient:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"

    def stream_chat(self, prompt: str) -> Generator[str, None, None]:
        if not self.api_key:
            yield "Error: OPENROUTER_API_KEY not set.\n"
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/high-plains-hipster",
            "X-Title": "COPERNICUS IDE Agent",
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "temperature": 0.1,
            "top_p": 0.9,
            "repetition_penalty": 1.1,
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


def parse_secrets_file(filepath: str) -> dict:
    secrets = {}
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    secrets[key.strip()] = value.strip().strip('"').strip("'")
    return secrets


def generate_transcript(jsonl_path: str, transcript_path: str):
    if os.path.exists(transcript_path):
        print(f"Transcript already exists: {transcript_path}. Skipping.")
        return

    session_id = os.path.basename(jsonl_path).replace("session_", "").replace(".jsonl", "")
    date_str = os.path.basename(os.path.dirname(jsonl_path))

    transcript_lines = [
        f"# Session Transcript \u2014 {session_id}",
        f"_{date_str}_",
        "",
        "---",
        "",
    ]

    try:
        with open(jsonl_path, "r") as f:
            for line in f:
                try:
                    event = json.loads(line)
                    if event.get("type") == "message":
                        message = event.get("message", {})
                        role = message.get("role")
                        content_blocks = message.get("content", [])

                        if role == "human":
                            parts = []
                            for block in content_blocks:
                                if isinstance(block, dict) and block.get("type") == "text":
                                    parts.append(block.get("text", ""))
                                elif isinstance(block, str):
                                    parts.append(block)
                            if parts:
                                transcript_lines.append(f"**Human:** {''.join(parts).strip()}")
                                transcript_lines.append("")
                        elif role == "assistant":
                            parts = []
                            for block in content_blocks:
                                if isinstance(block, dict) and block.get("type") == "text":
                                    parts.append(block.get("text", ""))
                            if parts:
                                transcript_lines.append(f"**Assistant:** {''.join(parts).strip()}")
                                transcript_lines.append("")
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        print(f"JSONL file not found: {jsonl_path}")
        return
    except Exception as e:
        print(f"Error processing {jsonl_path}: {e}")
        return

    with open(transcript_path, "w") as f:
        f.write("\n".join(transcript_lines))
    print(f"Generated transcript: {transcript_path}")


def generate_digest(jsonl_path: str, transcript_path: str, digest_path: str):
    if os.path.exists(digest_path):
        print(f"Digest already exists: {digest_path}. Skipping.")
        return

    generate_transcript(jsonl_path, transcript_path)

    if not os.path.exists(transcript_path):
        with open(digest_path, "w") as f:
            f.write(
                f"# Session Digest \u2014 Error\n"
                f"_Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_\n\n---\n\n"
                "Error: Transcript generation failed."
            )
        return

    secrets = parse_secrets_file(os.path.expanduser("~/.secrets"))
    api_key = secrets.get("OPENROUTER_API_KEY") or secrets.get("MODEL_CALLS_KEY")

    if not api_key:
        print("Error: OPENROUTER_API_KEY or MODEL_CALLS_KEY not found in ~/.secrets.")
        with open(digest_path, "w") as f:
            f.write(
                f"# Session Digest \u2014 Error\n"
                f"_Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_\n\n---\n\n"
                "Error: API key not found in ~/.secrets."
            )
        return

    model_name = os.environ.get("DIGEST_MODEL", "deepseek/deepseek-chat")
    client = OpenRouterClient(api_key=api_key, model=model_name)

    with open(transcript_path, "r") as f:
        transcript_text = f.read()

    system_prompt = (
        "You are a technical architect reviewing a design session transcript.\n"
        "Extract the following sections. Be concise. Use markdown bullet lists.\n\n"
        "## Design Decisions\n"
        "Architectural or implementation choices made in this session and the reasoning given.\n\n"
        "## Architecture Facts\n"
        "Established technical truths about the codebase (stack, patterns, constraints).\n\n"
        "## Product Vision\n"
        "Mission or product direction statements made in this session.\n\n"
        "## Problems Identified\n"
        "Gaps, blockers, bugs, or issues surfaced in this session.\n\n"
        "## KB Article Candidates\n"
        'Topics worth a KB article. Format: "Topic \u2014 suggested section \u2014 audience".\n\n'
        "If a section has no content, write \"None identified.\""
    )

    full_prompt = f"{system_prompt}\n\n---\n\n{transcript_text}"

    digest_content = []
    try:
        for chunk in client.stream_chat(full_prompt):
            digest_content.append(chunk)
        model_output = "".join(digest_content)
    except Exception as e:
        model_output = f"Error: Model call failed: {e}"

    session_id = os.path.basename(jsonl_path).replace("session_", "").replace(".jsonl", "")
    with open(digest_path, "w") as f:
        f.write(
            f"# Session Digest \u2014 {session_id}\n"
            f"_Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_\n\n"
            f"---\n\n{model_output}"
        )
    print(f"Generated digest: {digest_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate session transcripts and digests.")
    parser.add_argument("jsonl_path", help="Path to the session JSONL file.")
    parser.add_argument(
        "--transcript-only",
        action="store_true",
        help="Only generate the transcript, no model call.",
    )
    args = parser.parse_args()

    jsonl_path = os.path.abspath(args.jsonl_path)
    base_name = os.path.splitext(jsonl_path)[0]
    transcript_path = f"{base_name}_transcript.md"
    digest_path = f"{base_name}_digest.md"

    if args.transcript_only:
        generate_transcript(jsonl_path, transcript_path)
    else:
        generate_digest(jsonl_path, transcript_path, digest_path)

    sys.exit(0)


if __name__ == "__main__":
    main()
