import os
import re
import argparse
import sys

# --- Coloring for terminal output ---
def green(text):
    return f"\033[92m{text}\033[0m"

def yellow(text):
    return f"\033[93m{text}\033[0m"

def red(text):
    return f"\033[91m{text}\033[0m"

def blue(text):
    return f"\033[94m{text}\033[0m"

class StoryValidator:
    def __init__(self, story_path):
        self.story_path = story_path
        self.story_content = ""
        self.repo_root = self._get_repo_root()
        self.issues = []
        self.warnings = []

    def _get_repo_root(self):
        current_dir = os.getcwd()
        while current_dir != os.path.dirname(current_dir):
            if os.path.isdir(os.path.join(current_dir, ".git")):
                return current_dir
            current_dir = os.path.dirname(current_dir)
        return os.getcwd() # Fallback

    def _read_story_content(self):
        if not os.path.exists(self.story_path):
            self.issues.append(f"FAIL: Story file not found: {self.story_path}")
            return False
        with open(self.story_path, 'r') as f:
            self.story_content = f.read()
        return True

    def _add_issue(self, message):
        self.issues.append(red(f"FAIL: {message}"))

    def _add_warning(self, message):
        self.warnings.append(yellow(f"WARN: {message}"))

    def _extract_section_content(self, section_title):
        # Last resort: construct the pattern without re.escape inside the literal
        # This is to work around the write_file tool's behavior with newlines
        pattern_str = r"## " + re.escape(section_title) + r"\n(.*?)(?=\n## |\Z)"
        pattern = re.compile(pattern_str, re.DOTALL)
        match = pattern.search(self.story_content)
        return match.group(1).strip() if match else ""

    def _get_ipc_channels(self):
        preload_path = os.path.join(self.repo_root, "copernicus/electron/preload.ts")
        if not os.path.exists(preload_path):
            self._add_issue(f"IPC channel check skipped: {preload_path} not found.")
            return [], []

        with open(preload_path, 'r') as f:
            preload_content = f.read()

        send_channels = re.findall(r"SEND_CHANNELS\s*=\s*(?:new\s+Set\()?\[(.*?)\]", preload_content, re.DOTALL)
        listen_channels = re.findall(r"LISTEN_CHANNELS\s*=\s*(?:new\s+Set\()?\[(.*?)\]", preload_content, re.DOTALL)

        send_channels_list = []
        if send_channels:
            send_channels_list = re.findall("'([^']+)'|\"([^\"]+)\"", send_channels[0])
            send_channels_list = [c[0] or c[1] for c in send_channels_list]

        listen_channels_list = []
        if listen_channels:
            listen_channels_list = re.findall("'([^']+)'|\"([^\"]+)\"", listen_channels[0])
            listen_channels_list = [c[0] or c[1] for c in listen_channels_list]
        
        return set(send_channels_list), set(listen_channels_list)

    # --- 2a. File path verification ---
    def _check_file_paths(self):
        print(blue("--- Running File Path Verification (2a) ---"))
        files_in_scope_content = self._extract_section_content("Files in Scope")
        scope_content = self._extract_section_content("Scope")
        
        all_file_lines = (files_in_scope_content + "\n" + scope_content).splitlines()
        
        file_paths = []
        for line in all_file_lines:
            line = line.strip()
            # Regex to find paths like 'path/to/file.ts', 'path/to/file.py', etc.
            # Handles markdown list items like - `path/to/file.ts`
            match = re.search(r"[`]?([\w./_-]+\.(?:tsx|jsx|json|ts|js|py|html|md|sh|ps1|yaml|yml|css|scss|txt|xml|java|cs|go|cpp|hpp|vue|svelte|c|h))[`]?", line)
            if match:
                path = match.group(1)
                is_new = "(new)" in line.lower()
                file_paths.append((path, is_new, line))

        if not file_paths:
            self._add_warning("No file paths found in 'Files in Scope' or 'Scope' sections.")
            return

        for path, is_new, original_line in file_paths:
            full_path = os.path.join(self.repo_root, path)
            if is_new:
                if os.path.exists(full_path):
                    self._add_warning(f"File marked (new) already exists: {path}")
                else:
                    print(green(f"PASS: (new) file does not exist (as expected): {path}"))
            else:
                if not os.path.exists(full_path):
                    self._add_issue(f"Referenced file not found: {path} (from line: '{original_line}')")
                else:
                    print(green(f"PASS: Referenced file exists: {path}"))

    # --- 2b. IPC channel verification ---
    def _check_ipc_channels(self):
        print(blue("--- Running IPC Channel Verification (2b) ---"))
        send_channels_in_code, listen_channels_in_code = self._get_ipc_channels()

        ipc_content = (self._extract_section_content("Acceptance Criteria") + "\n" +
                       self._extract_section_content("IPC Channels Used"))
        
        if not ipc_content.strip():
            self._add_warning("No IPC channel references found in 'Acceptance Criteria' or 'IPC Channels Used'.")
            return

        # Regex to find 'channel:name' or "channel:name"
        channel_matches = re.findall("['\"]([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)['\"]", ipc_content)
        if not channel_matches:
            self._add_warning("No IPC channel patterns ('channel:name') found in story content.")
            return

        for channel in set(channel_matches): # Use set to avoid duplicate checks
            # Simplistic check: if it's mentioned as existing, it should be in either send or listen
            if channel not in send_channels_in_code and channel not in listen_channels_in_code:
                self._add_issue(f"IPC channel '{channel}' referenced but not found in preload.ts SEND_CHANNELS or LISTEN_CHANNELS.")
            else:
                print(green(f"PASS: IPC channel '{channel}' found in preload.ts."))
            
            # Additional check for channels marked as (new) in acceptance criteria
            if "(new)" in ipc_content and channel in ipc_content: # crude check if (new) is mentioned near channel
                 self._add_warning(f"IPC channel '{channel}' is marked as (new) but already exists in preload.ts. Consider if this is intended.")
            
    # --- 2c. TypeScript interface/type spot-check ---
    def _check_typescript_types(self):
        print(blue("--- Running TypeScript Type Spot-Check (2c) ---"))
        ac_content = self._extract_section_content("Acceptance Criteria")
        
        # Regex to find PascalCase identifiers that look like type names
        type_candidates = set(re.findall(r'\b[A-Z][a-zA-Z0-9]*(?:<.*?>)?\b', ac_content))
        
        # Filter out common words that are not types (e.g., "macOS", "Linux", "Windows", "Jules", "Task")
        # This list could be expanded.
        non_type_words = {"MacOS", "Linux", "Windows", "Jules", "Task", "GUI", "IPC", "CI", "CD", "API", "UAC", "DMG", "NSIS", "AppImage", "Electron", "Pythonw"}
        type_candidates = {t for t in type_candidates if t not in non_type_words and not t.isupper()} # Exclude acronyms
        
        if not type_candidates:
            self._add_warning("No TypeScript type candidates found in 'Acceptance Criteria'.")
            return

        for type_name in sorted(list(type_candidates)):
            # Search in copernicus/src and copernicus/electron
            search_dirs = [
                os.path.join(self.repo_root, "copernicus/src"),
                os.path.join(self.repo_root, "copernicus/electron")
            ]
            
            found = False
            # Using grep -r for specific patterns
            # Note: This will execute shell commands. Consider a more Pythonic way for robustness.
            # For now, adhering to the spec's `grep -r` instruction.
            patterns = [
                rf"interface {type_name}",
                rf"type {type_name}",
                rf"class {type_name}",
                rf"enum {type_name}"
            ]
            
            for search_dir in search_dirs:
                if not os.path.exists(search_dir):
                    continue

                for pattern in patterns:
                    cmd = f"grep -r '{pattern}' {search_dir}"
                    result = os.popen(cmd).read()
                    if result:
                        found = True
                        break
                if found:
                    break
            
            if not found:
                self._add_warning(f"TypeScript type candidate '{type_name}' not found in copernicus/src or copernicus/electron.")
            else:
                print(green(f"PASS: TypeScript type candidate '{type_name}' found."))

    # --- 2d. Story metadata completeness ---
    def _check_metadata_completeness(self):
        print(blue("--- Running Story Metadata Completeness (2d) ---"))
        
        metadata_checks = {
            "## Blocks:": False,
            "## Blocked By:": False,
            "**Status:**": False,
            "## Acceptance Criteria": False,
            "## Definition of Done": False,
        }

        for line in self.story_content.splitlines():
            for key in metadata_checks:
                if key in line:
                    metadata_checks[key] = True

        for key, found in metadata_checks.items():
            if not found:
                self._add_issue(f"Missing required metadata: '{key}'")

        # Check for empty Acceptance Criteria
        ac_content = self._extract_section_content("Acceptance Criteria")
        if not ac_content.strip():
            self._add_issue("Acceptance Criteria section is empty.")
        else:
            print(green("PASS: Acceptance Criteria is present and not empty."))
        
        # Check status DRAFT
        status_match = re.search(r"\*\*Status:\*\*\s*(.*)", self.story_content)
        if status_match:
            status = status_match.group(1).strip().upper()
            if status == "DRAFT":
                self._add_warning("Story status is DRAFT.")
            else:
                print(green(f"PASS: Story status is '{status}' (not DRAFT)."))
        else:
            self._add_issue("Could not find story status (e.g., '**Status:** COMPLETE').")

    # --- 2e. Story number consistency ---
    def _check_story_number_consistency(self):
        print(blue("--- Running Story Number Consistency (2e) ---"))
        filename_match = re.search(r"story_(\d+)_.*\.md", os.path.basename(self.story_path))
        if not filename_match:
            self._add_issue(f"Could not extract story number from filename: {self.story_path}")
            return
        
        filename_story_num = filename_match.group(1)

        content_match = re.search(r"## Story Number\s*(\d+)", self.story_content)
        if not content_match:
            self._add_issue("Could not find '## Story Number' in story content.")
            return

        content_story_num = content_match.group(1)

        if filename_story_num != content_story_num:
            self._add_issue(f"Story number mismatch: Filename has {filename_story_num}, content has {content_story_num}.")
        else:
            print(green(f"PASS: Story number {filename_story_num} consistent between filename and content."))

    def validate(self):
        if not self._read_story_content():
            return False, self.issues, self.warnings

        self._check_file_paths()
        self._check_ipc_channels()
        self._check_typescript_types()
        self._check_metadata_completeness()
        self._check_story_number_consistency()

        return len(self.issues) == 0, self.issues, self.warnings

def main():
    parser = argparse.ArgumentParser(description="Validate a story spec Markdown file.")
    parser.add_argument("story_path", help="Path to the story Markdown file.")
    args = parser.parse_args()

    validator = StoryValidator(args.story_path)
    
    # Run validation and get results
    is_valid, issues, warnings = validator.validate()

    print(blue("\n--- Validation Summary ---"))
    for w in warnings:
        print(w)
    for i in issues:
        print(i)

    if is_valid:
        if not warnings:
            print(green("Validation: ALL PASS"))
        else:
            print(yellow("Validation: PASS with WARNINGS"))
        sys.exit(0)
    else:
        print(red("Validation: FAIL"))
        sys.exit(1)

if __name__ == "__main__":
    main()
