#!/usr/bin/env python3
import logging
logger = logging.getLogger(__name__)
import os
import sys

# Ensure we can import the bridge from the same directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from agent_cli import UnifiedAgentBridge

TUI_ERROR = None
AgentTui = None

# Try to import the TUI version
try:
    from agent_tui import AgentTui

    HAS_TEXTUAL = True
except ImportError as e:
    TUI_ERROR = f"⚠️  TUI unavailable: {e}"
    if "textual" in str(e) or "TextArea" in str(e) or "Collapsible" in str(e):
        TUI_ERROR += "\n   👉 Run: pip install textual>=0.40.0"
    HAS_TEXTUAL = False
except Exception as e:
    TUI_ERROR = f"⚠️  TUI initialization failed: {e}"
    HAS_TEXTUAL = False


class AgentConsole:
    def __init__(self):
        self.current_story = None
        self.story_dir = "docs/dev/stories"
        self.bridge = UnifiedAgentBridge()

    def clear_screen(self):
        os.system("cls" if os.name == "nt" else "clear")

    def do_use(self, arg):
        """Set the current story context."""
        if not arg:
            print("Usage: use <story_filename>")
            return

        # Auto-complete path if just filename given
        target = arg
        if not os.path.exists(target) and os.path.exists(
            os.path.join(self.story_dir, arg)
        ):
            target = os.path.join(self.story_dir, arg)

        if os.path.exists(target):
            self.current_story = target
            print(f"Context set to: {self.current_story}")
        else:
            print(f"File not found: {arg}")

    def do_provider(self, arg):
        """Switch the AI provider (ollama/gemini)."""
        if not arg:
            print(f"Current provider: {self.bridge.provider.upper()}")
            return

        if arg.lower() not in ["ollama", "gemini", "openrouter"]:
            print("Usage: provider [ollama|gemini|openrouter]")
            return

        os.environ["AGENT_PROVIDER"] = arg.lower()
        self.bridge = UnifiedAgentBridge()
        print(f"✅ Switched provider to: {self.bridge.provider.upper()}")

    def do_model(self, arg):
        """Set the OpenRouter model (e.g., anthropic/claude-3.5-sonnet)."""
        if not arg:
            current = os.getenv(
                "OPENROUTER_MODEL", "arcee-ai/trinity-large-preview:free"
            )
            print(f"Current OpenRouter model: {current}")
            return

        os.environ["OPENROUTER_MODEL"] = arg
        print(f"✅ OpenRouter model set to: {arg}")

    def do_personas(self, _arg):
        """List available personas."""
        print("Available Personas:")
        for p in self.bridge.persona_files.keys():
            print(f"  - /{p}")

    def do_tree(self, _arg):
        """Show the project worktree (requires 'pip install rich')."""
        try:
            from rich.tree import Tree
            from rich import print as rprint
            from rich.filesize import decimal
            from rich.markup import escape
        except ImportError:
            print("❌ 'rich' library not found. Please run: pip install rich")
            return

        root_dir = os.getcwd()
        tree = Tree(f"📂 [bold]{os.path.basename(root_dir)}[/bold]")

        def walk_directory(directory, tree_node):
            paths = sorted(os.listdir(directory))
            for path in paths:
                if path.startswith(".") or path in [
                    "__pycache__",
                    "node_modules",
                    "venv",
                    ".venv",
                ]:
                    continue
                full_path = os.path.join(directory, path)
                if os.path.isdir(full_path):
                    branch = tree_node.add(f"📁 [bold cyan]{escape(path)}[/bold cyan]")
                    walk_directory(full_path, branch)
                else:
                    file_size = os.path.getsize(full_path)
                    tree_node.add(f"{escape(path)} [dim]({decimal(file_size)})[/dim]")

        walk_directory(root_dir, tree)
        rprint(tree)

    def run_command(self, command):
        """Run a direct agent command via the bridge."""
        try:
            print(f"\n🤖 Executing: {command}")
            self.bridge.execute(command, self.current_story)
            return True
        except KeyboardInterrupt:
            print("\n🛑 Operation cancelled by user.")
            return False
        except Exception as e:
            print(f"\n❌ Error: {e}")
            return False

    def run_workflow(self, workflow_type):
        """Run a multi-step workflow (replacing Make targets)."""
        if not self.current_story:
            print(
                "⚠️  No story selected. Use 'use <story>' first to enable persistence."
            )
            # We allow continuing without a story, but warn the user.

        if workflow_type == "review":
            if self.run_command("/product-owner review"):
                self.run_command("/architect design")
        elif workflow_type == "impl":
            if self.run_command("/senior-dev implement"):
                self.run_command("/ci-cd validate")
        elif workflow_type == "doc":
            print("📝 Starting Documentation Workflow...")
            self.run_command(
                "/scribe Create a basic user guide and save it to docs/user/USER_GUIDE.md using the <write_file> tag."
            )

    def loop(self):
        self.clear_screen()
        print("\033[96m")
        print(r"""
  _    _ _       _       _____  _       _
 | |  | (_)     | |     |  __ \| |     (_)
 | |__| |_  __ _| |__   | |__) | | __ _ _ _ __  ___
 |  __  | |/ _` | '_ \  |  ___/| |/ _` | | '_ \/ __|
 | |  | | | (_| | | | | | |    | | (_| | | | | \__ \
 |_|  |_|_|\__, |_| |_| |_|    |_|\__,_|_|_| |_|___/
            __/ |
           |___/
  _    _ _           _
 | |  | (_)         | |
 | |__| |_ _ __  ___| |_ ___ _ __
 |  __  | | '_ \/ __| __/ _ \ '__|
 | |  | | | |_) \__ \ ||  __/ |
 |_|  |_|_| .__/|___/\__\___|_|
          | |
          |_|
""")
        print("\033[0m")
        print(f"🤠 Agent Shell ({self.bridge.provider.upper()})")

        if TUI_ERROR:
            print(f"\n\033[93m{TUI_ERROR}\033[0m")
            print("Falling back to legacy console in 3 seconds...")
            import time

            time.sleep(3)

        print(
            "Type 'help' for commands, or '/<persona> <msg>' to chat.\n"
            "Example: /architect Review this code"
        )
        print("========================================")

        while True:
            try:
                context_str = (
                    os.path.basename(self.current_story)
                    if self.current_story
                    else "no-story"
                )
                prompt = f"[{self.bridge.provider.upper()}:{context_str}]> "

                try:
                    line = input(prompt).strip()
                except EOFError:
                    break

                if not line:
                    continue

                parts = line.split()
                cmd = parts[0].lower()
                arg = parts[1] if len(parts) > 1 else ""

                # Allow commands to be typed with or without slash
                normalized_cmd = cmd.lstrip("/")

                if normalized_cmd in ["exit", "quit", "q"]:
                    break
                elif normalized_cmd == "clear":
                    self.clear_screen()
                elif normalized_cmd == "use":
                    self.do_use(arg)
                elif normalized_cmd == "provider":
                    self.do_provider(arg)
                elif normalized_cmd == "model":
                    self.do_model(arg)
                elif normalized_cmd == "personas":
                    self.do_personas(arg)
                elif normalized_cmd == "review":
                    self.run_workflow("review")
                elif normalized_cmd in ["impl", "implement"]:
                    self.run_workflow("impl")
                elif normalized_cmd in ["doc", "document"]:
                    self.run_workflow("doc")
                elif normalized_cmd == "help":
                    print(
                        "Commands:\n"
                        "  /persona <msg>  - Chat with a specific agent (e.g., /architect hello)\n"
                        "  use <story>     - Set active story context\n"
                        "  provider [name] - Switch AI provider (ollama/gemini/openrouter)\n"
                        "  model [name]    - Set OpenRouter model string\n"
                        "  personas        - List available agent personas\n"
                        "  tree            - Show project file structure\n"
                        "  review          - Run Review workflow\n"
                        "  implement       - Run Implementation workflow\n"
                        "  document        - Run Documentation workflow\n"
                        "  clear           - Clear screen\n"
                        "  exit            - Quit"
                    )
                elif cmd.startswith("/"):
                    # Pass the full raw line to the bridge
                    self.run_command(line)
                else:
                    print(f"Unknown command: {cmd}")
            except KeyboardInterrupt:
                print("\nExiting...")
                break
            except Exception as e:
                logger.error("Error occurred", exc_info=True)


if __name__ == "__main__":
    # Ensure script is executable
    if HAS_TEXTUAL and AgentTui is not None:
        AgentTui().run()
    else:
        # Fallback to legacy console
        AgentConsole().loop()
