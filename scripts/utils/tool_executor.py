import os
import subprocess
import sys

try:
    import termios
except ImportError:
    termios = None


class ToolExecutor:
    def __init__(self, repo_root):
        self.repo_root = os.path.abspath(repo_root)

    def confirm(self, action, details):
        print(f"\n⚠️  TOOL REQUEST: {action}")
        print(f"   {details}")

        # Flush stdin to prevent accidental skipping via buffered input
        if termios:
            try:
                termios.tcflush(sys.stdin, termios.TCIFLUSH)
            except Exception:
                pass

        try:
            response = input("   Execute? [y/N]: ").strip().lower()
            return response == "y"
        except EOFError:
            return False

    def write_file(self, rel_path, content, confirm=True, allow_overwrite=False):
        """Write a new file. By default, refuses to overwrite existing files.

        Args:
            rel_path: Path relative to repo root
            content: File content to write
            confirm: Whether to prompt for confirmation (CLI mode)
            allow_overwrite: If True, allows overwriting existing files (for TUI diff approval)
        """
        # Security check: prevent path traversal
        full_path = os.path.abspath(os.path.join(self.repo_root, rel_path))
        if not full_path.startswith(self.repo_root):
            return "Error: Path traversal detected. Access denied."

        # Restrict to new files only (unless explicitly allowed via TUI approval)
        if os.path.exists(full_path) and not allow_overwrite:
            return (
                f"Error: File '{rel_path}' already exists. "
                "Use <edit_file> to modify existing files."
            )

        if not confirm or self.confirm("WRITE FILE (NEW)", rel_path):
            try:
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(content)
                return f"✓ Created new file: {rel_path}"
            except Exception as e:
                return f"Error writing file: {e}"
        return "Action cancelled by user."

    def edit_file(self, rel_path, old_string, new_string, confirm=True):
        """Perform a technical edit on an existing file.

        Args:
            rel_path: Path relative to repo root
            old_string: Exact text to find and replace (must be unique)
            new_string: Replacement text
            confirm: Whether to prompt for confirmation (CLI mode)

        Returns:
            Success message or error description
        """
        # Security check: prevent path traversal
        full_path = os.path.abspath(os.path.join(self.repo_root, rel_path))
        if not full_path.startswith(self.repo_root):
            return "Error: Path traversal detected. Access denied."

        # File must exist for edits
        if not os.path.exists(full_path):
            return f"Error: File '{rel_path}' does not exist. Use <write_file> for new files."

        # Read current content
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            return f"Error reading file: {e}"

        # Validate old_string exists
        if old_string not in content:
            # Provide helpful error with preview
            preview = old_string[:100] + "..." if len(old_string) > 100 else old_string
            return (
                f"Error: old_string not found in '{rel_path}'.\n"
                f"Looking for: {repr(preview)}\n"
                "Ensure exact match including whitespace and indentation."
            )

        # Validate old_string is unique
        occurrences = content.count(old_string)
        if occurrences > 1:
            return (
                f"Error: old_string appears {occurrences} times in '{rel_path}'.\n"
                "Provide more context to make the match unique."
            )

        # Perform the replacement
        new_content = content.replace(old_string, new_string, 1)

        # Confirm and write
        if not confirm or self.confirm(
            "EDIT FILE",
            f"{rel_path}\n   -{len(old_string)} chars +{len(new_string)} chars",
        ):
            try:
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                return f"✓ Edited {rel_path}"
            except Exception as e:
                return f"Error writing file: {e}"
        return "Action cancelled by user."

    def exec_command(self, command, confirm=True):
        # Security check: basic blacklist
        dangerous = ["rm -rf", "mkfs", "dd ", ":(){ :|:& };:"]  # nosec
        if any(d in command for d in dangerous):
            return "Error: Dangerous command detected."

        if not confirm or self.confirm("EXECUTE SHELL", command):
            try:
                # Run in repo root
                result = subprocess.run(
                    command,
                    shell=True,
                    cwd=self.repo_root,
                    capture_output=True,
                    text=True,
                )
                output = result.stdout + result.stderr
                return f"Command executed. Exit code: {result.returncode}\nOutput:\n{output}"
            except Exception as e:
                return f"Error executing command: {e}"
        return "Action cancelled by user."
